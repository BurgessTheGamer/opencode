import { z } from "zod"
import { Tool } from "./tool"
import { spawn, ChildProcess } from "child_process"
import { join } from "path"
import {
  OpenStorageStoreTool,
  OpenStorageCleanupSessionTool,
} from "./openstorage"

// OpenBrowser tool - Native Go browser engine with STORAGE-FIRST approach
const DESCRIPTION = `- Advanced web browser automation and scraping
- Pure Go implementation (no Chrome required!)
- 20MB vs 200MB size advantage
- All content automatically stored in OpenStorage
- Returns minimal output to prevent chat flooding
`

// Browser server instance
let browserServer: ChildProcess | null = null
let browserServerPort = 9876
let isStarting = false
let lastHealthCheck = 0

// Storage cleanup tracking
let storageItemCount = 0
const CLEANUP_THRESHOLD = 50 // Clean up after every 50 items stored

// Health check the browser server
async function isBrowserHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${browserServerPort}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "test", params: {} }),
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) return false

    const result = await response.json()
    return result.success === true
  } catch {
    return false
  }
}

// Kill existing browser server process
async function killBrowserServer(): Promise<void> {
  if (browserServer) {
    try {
      browserServer.kill("SIGTERM")
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (!browserServer.killed) {
        browserServer.kill("SIGKILL")
      }
    } catch (err) {
      // Suppress error logging to prevent TUI flooding
    }
    browserServer = null
  }
}

// Auto-start browser server with recovery
async function ensureBrowserServer(): Promise<void> {
  // Check if we need a health check
  const now = Date.now()
  if (browserServer && now - lastHealthCheck < 30000) {
    return // Skip health check if we checked recently
  }

  // Prevent multiple simultaneous starts
  if (isStarting) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return
  }

  try {
    isStarting = true

    // Health check existing server
    if (browserServer) {
      const healthy = await isBrowserHealthy()
      if (healthy) {
        lastHealthCheck = now
        return
      }
      // Suppress logging - browser server unhealthy, restarting...
      await killBrowserServer()
    }

    // Check if another instance is running
    const externalHealthy = await isBrowserHealthy()
    if (externalHealthy) {
      // Found existing browser server on port
      lastHealthCheck = now
      return
    }

    // Start new browser server
    const browserPath = join(__dirname, "../../../tui/browser-server")
    // Suppress console.log to prevent TUI flooding

    browserServer = spawn(browserPath, [], {
      env: { ...process.env, OPENCODE_BROWSER_PORT: String(browserServerPort) },
      stdio: ["ignore", "ignore", "ignore"], // Suppress all output to prevent TUI flooding
      detached: false,
    })

    browserServer.on("exit", () => {
      // Browser server exited
      browserServer = null
    })

    browserServer.on("error", () => {
      // Browser server spawn error
      browserServer = null
    })

    // Wait for server to be ready with retries
    let retries = 10
    while (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const healthy = await isBrowserHealthy()
      if (healthy) {
        // Browser server started successfully
        lastHealthCheck = now
        return
      }
      retries--
    }

    throw new Error("Browser server failed to start after 5 seconds")
  } finally {
    isStarting = false
  }
}

// Helper to call Go browser server with retry logic
async function callGoBrowser(
  method: string,
  params: any,
  retries = 3,
): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await ensureBrowserServer()

      const browserUrl = `http://localhost:${browserServerPort}`
      const response = await fetch(browserUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ method, params }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })

      if (!response.ok) {
        throw new Error(`Browser server error: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        // Check if it's a Chrome context error
        if (result.error?.includes("context canceled") && attempt < retries) {
          // Suppress logging - Chrome context error, restarting browser
          await killBrowserServer()
          await new Promise((resolve) => setTimeout(resolve, 1000))
          continue
        }
        throw new Error(result.error || "Unknown browser error")
      }

      return result.data
    } catch (error: any) {
      if (attempt === retries) {
        throw error
      }

      // Suppress logging - Browser call failed, retrying...

      // Force restart on connection errors
      if (
        error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED")
      ) {
        await killBrowserServer()
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
}

// Periodic cleanup helper
async function periodicCleanup(ctx: any) {
  storageItemCount++
  if (storageItemCount >= CLEANUP_THRESHOLD) {
    storageItemCount = 0
    // Perform cleanup in background (don't wait)
    OpenStorageCleanupSessionTool.execute(
      {
        sessionId: ctx.sessionID,
        keepLast: 30, // Keep last 30 items
      },
      ctx,
    ).catch(() => {
      // Suppress error logging to prevent TUI flooding
    })
  }
}

// 1. ScrapeWebpage - STORAGE-FIRST approach
export const OpenBrowserScrapeTool = Tool.define({
  id: "openbrowser_scrape",
  description: DESCRIPTION,
  parameters: z.object({
    url: z.string().describe("The URL to scrape"),
    format: z.enum(["markdown", "html", "text"]).default("markdown"),
    includeScreenshot: z.boolean().default(false),
    waitForSelector: z.string().optional().describe("CSS selector to wait for"),
    profileId: z.string().optional().describe("Browser profile to use"),
  }),
  async execute(params, ctx) {
    const result = await callGoBrowser("scrape", params)

    // ALWAYS store in OpenStorage
    const storeResult = await OpenStorageStoreTool.execute(
      {
        sessionId: ctx.sessionID,
        url: params.url,
        title: result.title || "Untitled Page",
        content: result.content || "",
        contentType: params.format,
        metadata: {
          source: "openbrowser_scrape",
          browserEngine: "Native Go Engine",
          contentLength: result.content?.length || 0,
          links: result.links?.length || 0,
          images: result.images?.length || 0,
          screenshot: result.screenshot ? "base64_available" : "none",
          scrapedAt: new Date().toISOString(),
        },
      },
      ctx,
    )

    // Periodic cleanup
    await periodicCleanup(ctx)

    // MINIMAL output - no content returned!
    const contentSize = result.content?.length || 0
    const linkCount = result.links?.length || 0
    const imageCount = result.images?.length || 0

    return {
      output: `✅ Scraped: ${result.title || "Untitled Page"}
📦 Storage ID: ${storeResult.metadata.contentId}
💾 Size: ${contentSize.toLocaleString()} chars (${storeResult.metadata.tokenCount} tokens)
🔗 Links: ${linkCount} | 🖼️ Images: ${imageCount}
🔍 Use openstorage_get to retrieve content`,
      metadata: {
        title: result.title || "OpenBrowser Scrape",
        url: params.url,
        storageId: storeResult.metadata.contentId,
        contentSize,
        tokenCount: storeResult.metadata.tokenCount,
        linkCount,
        imageCount,
        browserEngine: "Native Go Engine",
      },
    }
  },
})

// 2. CrawlWebpages - STORAGE-FIRST approach
export const OpenBrowserCrawlTool = Tool.define({
  id: "openbrowser_crawl",
  description: "Crawl multiple web pages starting from a URL",
  parameters: z.object({
    startUrl: z.string().describe("The starting URL to crawl from"),
    maxPages: z
      .number()
      .default(10)
      .describe("Maximum number of pages to crawl"),
    maxDepth: z.number().default(3).describe("Maximum crawl depth"),
    includePatterns: z
      .array(z.string())
      .optional()
      .describe("URL patterns to include"),
    excludePatterns: z
      .array(z.string())
      .optional()
      .describe("URL patterns to exclude"),
    respectRobots: z.boolean().default(true).describe("Respect robots.txt"),
  }),
  async execute(params, ctx) {
    const result = await callGoBrowser("crawl", params)

    // Handle empty results
    if (!result || !result.pages || result.pages.length === 0) {
      return {
        output: `No pages crawled from ${params.startUrl}`,
        metadata: {
          title: "No pages crawled",
          url: params.startUrl,
          pagesFound: 0,
          browserEngine: "Native Go Crawler",
        },
      }
    }

    // Store each crawled page
    const storedPages = []
    for (const page of result.pages) {
      try {
        const storeResult = await OpenStorageStoreTool.execute(
          {
            sessionId: ctx.sessionID,
            url: page.url,
            title: page.title || "Untitled Page",
            content: page.content || "",
            contentType: "html",
            metadata: {
              source: "openbrowser_crawl",
              browserEngine: "Native Go Crawler",
              crawlDepth: page.depth || 0,
              parentUrl: params.startUrl,
              contentLength: page.content?.length || 0,
              crawledAt: new Date().toISOString(),
            },
          },
          ctx,
        )

        storedPages.push({
          url: page.url,
          title: page.title,
          storageId: storeResult.metadata.contentId,
          contentLength: page.content?.length || 0,
          tokens: storeResult.metadata.tokenCount,
        })
      } catch (error) {
        // Suppress error logging to prevent TUI flooding
      }
    }

    // Periodic cleanup
    await periodicCleanup(ctx)

    // MINIMAL output summary
    const totalContentSize = result.pages.reduce(
      (sum: number, p: any) => sum + (p.content?.length || 0),
      0,
    )
    const totalTokens = storedPages.reduce((sum, p) => sum + (p.tokens || 0), 0)

    return {
      output: `✅ Crawled ${result.pages.length} pages
📦 Stored ${storedPages.length} pages
💾 Total: ${totalContentSize.toLocaleString()} chars (${totalTokens} tokens)

Storage IDs:
${storedPages.map((p, i) => `${i + 1}. ${p.storageId}`).join("\n")}

🔍 Use openstorage_get to retrieve content`,
      metadata: {
        title: `Crawled ${result.pages.length} pages`,
        url: params.startUrl,
        pagesFound: result.pages.length,
        browserEngine: "Native Go Crawler",
      },
    }
  },
})

// 3. ExtractStructuredData - Direct output (already minimal)
export const OpenBrowserExtractTool = Tool.define({
  id: "openbrowser_extract",
  description: "Extract structured data from web pages using CSS selectors",
  parameters: z.object({
    url: z.string().describe("URL to extract data from"),
    selectors: z
      .record(z.string())
      .describe("Map of field names to CSS selectors"),
    multiple: z.boolean().default(false).describe("Extract multiple items"),
  }),
  async execute(params) {
    const result = await callGoBrowser("extract", params)

    return {
      output: JSON.stringify(result.data, null, 2),
      metadata: {
        title: "Data Extraction",
        url: params.url,
        fieldsExtracted: Object.keys(result.data).length,
        browserEngine: "Native Go Engine",
      },
    }
  },
})

// 4. BrowserAutomation - Minimal output
export const OpenBrowserAutomateTool = Tool.define({
  id: "openbrowser_automate",
  description: "Automate browser interactions like clicking and typing",
  parameters: z.object({
    url: z.string().describe("Starting URL"),
    actions: z
      .array(
        z.object({
          type: z.enum(["click", "type", "wait", "scroll", "screenshot"]),
          selector: z.string().optional(),
          text: z.string().optional(),
          timeout: z.number().optional(),
        }),
      )
      .describe("List of actions to perform"),
  }),
  async execute(params) {
    const result = await callGoBrowser("automate", params)

    const successCount = result.actions.filter((a: any) => a.success).length

    return {
      output: `✅ Automation complete: ${successCount}/${result.actions.length} actions succeeded
📍 Final URL: ${result.finalUrl}`,
      metadata: {
        title: "Browser Automation",
        url: result.finalUrl,
        actionsPerformed: result.actions.length,
        successCount,
        browserEngine: "Native Go Engine",
      },
    }
  },
})

// 5. Take Screenshot - Minimal output
export const OpenBrowserScreenshotTool = Tool.define({
  id: "openbrowser_screenshot",
  description: "Take a screenshot of a webpage",
  parameters: z.object({
    url: z.string().describe("URL to screenshot"),
    fullPage: z.boolean().default(false).describe("Capture full page"),
    waitForSelector: z
      .string()
      .optional()
      .describe("Wait for element before screenshot"),
  }),
  async execute(params, ctx) {
    const result = await callGoBrowser("screenshot", params)

    // Store screenshot in OpenStorage
    const storeResult = await OpenStorageStoreTool.execute(
      {
        sessionId: ctx.sessionID,
        url: params.url,
        title: `Screenshot of ${params.url}`,
        content: result.screenshot, // Base64 image
        contentType: "image/png",
        metadata: {
          source: "openbrowser_screenshot",
          browserEngine: "Native Go Engine",
          dimensions: `${result.width}x${result.height}`,
          size: result.size,
          fullPage: params.fullPage,
          screenshotAt: new Date().toISOString(),
        },
      },
      ctx,
    )

    return {
      output: `✅ Screenshot captured: ${result.width}x${result.height}
📦 Storage ID: ${storeResult.metadata.contentId}
🔍 Use openstorage_get to retrieve image`,
      metadata: {
        title: "Screenshot",
        url: params.url,
        storageId: storeResult.metadata.contentId,
        dimensions: `${result.width}x${result.height}`,
        size: result.size,
        browserEngine: "Native Go Engine",
      },
    }
  },
})

// Import enhanced tools
import { OpenBrowserEnhancedTools } from "./openbrowser-enhanced"

// Export all OpenBrowser tools
export const OpenBrowserTools = [
  OpenBrowserScrapeTool,
  OpenBrowserCrawlTool,
  OpenBrowserExtractTool,
  OpenBrowserAutomateTool,
  OpenBrowserScreenshotTool,
  ...OpenBrowserEnhancedTools,
]

// Cleanup on exit
process.on("exit", () => {
  if (browserServer) {
    try {
      browserServer.kill("SIGTERM")
    } catch (err) {
      // Suppress error logging to prevent TUI flooding
    }
  }
})

process.on("SIGINT", () => {
  if (browserServer) {
    browserServer.kill("SIGTERM")
  }
  process.exit(0)
})

process.on("SIGTERM", () => {
  if (browserServer) {
    browserServer.kill("SIGTERM")
  }
  process.exit(0)
})
