import { z } from "zod"
import { Tool } from "./tool"
import { spawn, ChildProcess } from "child_process"
import { join } from "path"
import {
  OpenStorageStoreTool,
  OpenStorageCleanupSessionTool,
} from "./openstorage"

// OpenBrowser tool - Native Go browser engine
const DESCRIPTION = `- Advanced web browser automation and scraping
- Pure Go implementation (no Chrome required!)
- 20MB vs 200MB size advantage
- Free web search via DuckDuckGo
- Screenshots, crawling, and automation
- Alternative to HyperBrowser MCP
`

// Content size limits to prevent context flooding
const MAX_CONTENT_LENGTH = 10000 // Reduced to 10KB to prevent flooding
const MAX_PREVIEW_LENGTH = 500 // Reduced preview for summaries
const MAX_LINKS_TO_SHOW = 5 // Show fewer links
const MAX_IMAGES_TO_SHOW = 3 // Show fewer images

// Smart content truncation
function truncateContent(
  content: string,
  maxLength: number = MAX_CONTENT_LENGTH,
): { content: string; truncated: boolean } {
  if (!content || content.length <= maxLength) {
    return { content, truncated: false }
  }

  // Try to truncate at a sentence boundary
  const truncated = content.substring(0, maxLength)
  const lastPeriod = truncated.lastIndexOf(".")
  const lastNewline = truncated.lastIndexOf("\n")
  const cutPoint = Math.max(lastPeriod, lastNewline, maxLength - 200)

  return {
    content: cutPoint > 0 ? truncated.substring(0, cutPoint) : truncated,
    truncated: content.length > maxLength,
  }
}

// Create a summary of the page content
function createPageSummary(result: any): string {
  const lines = []

  // Title and URL
  lines.push(`# ${result.title || "Untitled Page"}`)
  lines.push(`URL: ${result.url || "Unknown"}`)
  lines.push("")

  // Content preview
  if (result.content) {
    const preview = result.content.substring(0, MAX_PREVIEW_LENGTH)
    lines.push("## Content Preview")
    lines.push(
      preview + (result.content.length > MAX_PREVIEW_LENGTH ? "..." : ""),
    )
    lines.push("")
    lines.push(`Total content size: ${result.content.length} characters`)
  }

  // Links summary
  if (result.links && result.links.length > 0) {
    lines.push("")
    lines.push(`## Links (${result.links.length} total)`)
    const linksToShow = result.links.slice(0, MAX_LINKS_TO_SHOW)
    linksToShow.forEach((link: any) => {
      lines.push(`- ${link.text || "No text"}: ${link.href}`)
    })
    if (result.links.length > MAX_LINKS_TO_SHOW) {
      lines.push(
        `... and ${result.links.length - MAX_LINKS_TO_SHOW} more links`,
      )
    }
  }

  // Images summary
  if (result.images && result.images.length > 0) {
    lines.push("")
    lines.push(`## Images (${result.images.length} total)`)
    const imagesToShow = result.images.slice(0, MAX_IMAGES_TO_SHOW)
    imagesToShow.forEach((img: any) => {
      lines.push(`- ${img.alt || "No alt text"}: ${img.src}`)
    })
    if (result.images.length > MAX_IMAGES_TO_SHOW) {
      lines.push(
        `... and ${result.images.length - MAX_IMAGES_TO_SHOW} more images`,
      )
    }
  }

  return lines.join("\n")
}

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
      console.error("Error killing browser server:", err)
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
      console.log("Browser server unhealthy, restarting...")
      await killBrowserServer()
    }

    // Check if another instance is running
    const externalHealthy = await isBrowserHealthy()
    if (externalHealthy) {
      console.log("Found existing browser server on port", browserServerPort)
      lastHealthCheck = now
      return
    }

    // Start new browser server
    const browserPath = join(__dirname, "../../../tui/browser-server")
    console.log("Starting browser server from:", browserPath)

    browserServer = spawn(browserPath, [], {
      env: { ...process.env, OPENCODE_BROWSER_PORT: String(browserServerPort) },
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    })

    browserServer.on("exit", (code, signal) => {
      console.log(
        `Browser server exited with code ${code} and signal ${signal}`,
      )
      browserServer = null
    })

    browserServer.on("error", (err: Error) => {
      console.error("Browser server spawn error:", err)
      browserServer = null
    })

    // Wait for server to be ready with retries
    let retries = 10
    while (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const healthy = await isBrowserHealthy()
      if (healthy) {
        console.log("Browser server started successfully")
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
          console.log(
            `Chrome context error, restarting browser (attempt ${attempt}/${retries})`,
          )
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

      console.log(
        `Browser call failed (attempt ${attempt}/${retries}):`,
        error.message,
      )

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

// 1. ScrapeWebpage - Full featured scraping
export const OpenBrowserScrapeTool = Tool.define({
  id: "openbrowser_scrape",
  description: DESCRIPTION,
  parameters: z.object({
    url: z.string().describe("The URL to scrape"),
    format: z.enum(["markdown", "html", "text"]).default("markdown"),
    includeScreenshot: z.boolean().default(false),
    waitForSelector: z.string().optional().describe("CSS selector to wait for"),
    profileId: z.string().optional().describe("Browser profile to use"),
    summaryOnly: z
      .boolean()
      .default(false)
      .describe("Return only a summary for large pages"),
    maxContentLength: z
      .number()
      .optional()
      .describe("Maximum content length to return"),
  }),
  async execute(params, ctx) {
    const result = await callGoBrowser("scrape", params)

    // ALWAYS store in OpenStorage for persistence and later retrieval
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

    // Increment storage counter and perform periodic cleanup
    storageItemCount++
    if (storageItemCount >= CLEANUP_THRESHOLD) {
      // Reset counter
      storageItemCount = 0

      // Perform cleanup in background (don't wait)
      OpenStorageCleanupSessionTool.execute(
        {
          sessionId: ctx.sessionID,
          keepLast: 30, // Keep last 30 items
        },
        ctx,
      ).catch((err) => {
        console.error("Periodic storage cleanup failed:", err)
      })
    }

    // ALWAYS return minimal output - content is stored, not returned!
    const contentSize = result.content?.length || 0
    const linkCount = result.links?.length || 0
    const imageCount = result.images?.length || 0

    return {
      output: `✅ Scraped and stored: ${result.title || "Untitled Page"}
📦 Storage ID: ${storeResult.metadata.contentId}
💾 Size: ${contentSize.toLocaleString()} characters (${storeResult.metadata.tokenCount} tokens)
🔗 Links: ${linkCount} | 🖼️ Images: ${imageCount}
🔍 Use openstorage_get with ID to retrieve content`,
      metadata: {
        title: result.title || "OpenBrowser Scrape",
        url: params.url,
        storageId: storeResult.metadata.contentId,
        contentSize,
        tokenCount: storeResult.metadata.tokenCount,
        linkCount,
        imageCount,
        browserEngine: "Native Go Engine",
        screenshot: result.screenshot ? "stored" : "none",
      },
    }
  },
})

// 3. CrawlWebpages - Multi-page crawling
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

    // Handle empty or null results
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

    // Store each crawled page in OpenStorage
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
        console.error(`Failed to store page ${page.url}:`, error)
      }
    }

    // Return minimal summary - all content is stored!
    const totalContentSize = result.pages.reduce(
      (sum: number, p: any) => sum + (p.content?.length || 0),
      0,
    )

    const totalTokens = storedPages.reduce((sum, p) => sum + (p.tokens || 0), 0)

    return {
      output: `✅ Crawled ${result.pages.length} pages from ${params.startUrl}
📦 Stored ${storedPages.length} pages in OpenStorage
💾 Total size: ${totalContentSize.toLocaleString()} characters (${totalTokens} tokens)

Storage IDs:
${storedPages.map((p, i) => `${i + 1}. ${p.storageId} - ${p.title || p.url}`).join("\n")}

🔍 Use openstorage_get with any ID to retrieve content`,
      metadata: {
        title: `Crawled ${result.pages.length} pages`,
        url: params.startUrl,
        pagesFound: result.pages.length,
        pagesStored: storedPages.length,
        totalContentSize,
        totalTokens,
        browserEngine: "Native Go Crawler",
        storedPages: storedPages.map((p) => ({
          url: p.url,
          storageId: p.storageId,
        })),
      },
    }
  },
})

// 4. ExtractStructuredData - AI-powered extraction
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

// 5. BrowserAutomation - Click, type, scroll
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

    return {
      output: `Automation completed:\n${result.actions
        .map(
          (a: any) =>
            `- ${a.type}: ${a.success ? "✓" : "✗"} ${a.message || a.error || ""}`,
        )
        .join("\n")}\n\nFinal URL: ${result.finalUrl}`,
      metadata: {
        title: "Browser Automation",
        url: result.finalUrl,
        actionsPerformed: result.actions.length,
        success: result.actions.every((a: any) => a.success),
        browserEngine: "Native Go Engine",
      },
    }
  },
})

// 6. Take Screenshot
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
  async execute(params) {
    const result = await callGoBrowser("screenshot", params)

    return {
      output: `Screenshot captured: ${result.width}x${result.height} pixels`,
      metadata: {
        title: "Screenshot",
        url: params.url,
        dimensions: `${result.width}x${result.height}`,
        size: result.size,
        browserEngine: "Native Go Engine",
      },
    }
  },
})

// 7. Pro Scraping with CAPTCHA detection
export const OpenBrowserScrapeProTool = Tool.define({
  id: "openbrowser_scrape_pro",
  description:
    "Advanced web scraping with CAPTCHA detection\n- Detects CAPTCHAs and guides you through the chat-based solving flow\n- Pro/Max exclusive feature",
  parameters: z.object({
    url: z.string().describe("The URL to scrape"),
    format: z.enum(["markdown", "html", "text"]).default("markdown"),
    includeScreenshot: z.boolean().default(false),
    waitForSelector: z.string().optional().describe("CSS selector to wait for"),
    profileId: z.string().optional().describe("Browser profile to use"),
    summaryOnly: z
      .boolean()
      .default(false)
      .describe("Return only a summary for large pages"),
    maxContentLength: z
      .number()
      .optional()
      .describe("Maximum content length to return"),
  }),
  async execute(params, _ctx) {
    const result = await callGoBrowser("scrape_pro", params)

    // Check if CAPTCHA was detected
    if (result.captcha?.detected) {
      return {
        output: `CAPTCHA detected! Screenshot captured for solving.\n\nTo solve: Analyze the screenshot and use openbrowser_apply_captcha_solution with your answer.`,
        metadata: {
          title: "CAPTCHA Detected",
          url: params.url,
          format: params.format,
          captchaScreenshot: result.captcha.screenshot,
          profileId: params.profileId || "default",
          browserEngine: "Native Go Engine Pro",
          captchaSolved: false,
        },
      }
    }

    // Handle content - either summary or truncated
    let outputContent: string

    if (
      params.summaryOnly ||
      (result.content && result.content.length > MAX_CONTENT_LENGTH * 2)
    ) {
      outputContent = createPageSummary(result)
    } else {
      const maxLength = params.maxContentLength || MAX_CONTENT_LENGTH
      const truncateResult = truncateContent(result.content, maxLength)
      outputContent = truncateResult.content
    }

    return {
      output: outputContent,
      metadata: {
        title: result.title || "OpenBrowser Scrape Pro",
        url: params.url,
        format: params.format,
        browserEngine: "Native Go Engine Pro",
        captchaSolved: result.captchaSolved || false,
        profileId: params.profileId || "default",
        captchaScreenshot: null,
      },
    }
  },
})

// 8. Pro Automation with CAPTCHA detection
export const OpenBrowserAutomateProTool = Tool.define({
  id: "openbrowser_automate_pro",
  description:
    "Advanced browser automation with CAPTCHA detection\n- Detects CAPTCHAs and guides you through the chat-based solving flow\n- Pro/Max exclusive feature\n- Handles reCAPTCHA, hCaptcha, and image CAPTCHAs",
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
    profileId: z.string().optional().describe("Browser profile to use"),
  }),
  async execute(params, _ctx) {
    const result = await callGoBrowser("automate_pro", params)

    return {
      output: `Automation completed:\n${result.actions
        .map(
          (a: any) =>
            `- ${a.type}: ${a.success ? "✓" : "✗"} ${a.message || a.error || ""}`,
        )
        .join(
          "\n",
        )}\n\nFinal URL: ${result.finalUrl}\nCAPTCHAs solved: ${result.captchasSolved || 0}`,
      metadata: {
        title: "Browser Automation Pro",
        url: result.finalUrl,
        actionsPerformed: result.actions.length,
        success: result.actions.every((a: any) => a.success),
        captchasSolved: result.captchasSolved || 0,
        browserEngine: "Native Go Engine Pro",
      },
    }
  },
})

// 9. Get CAPTCHA for solving
export const OpenBrowserGetCaptchaTool = Tool.define({
  id: "openbrowser_get_captcha",
  description:
    "Get CAPTCHA screenshot for solving in chat\n- Returns base64 screenshot of detected CAPTCHA\n- Claude can analyze it in the conversation\n- Use openbrowser_apply_captcha_solution to apply the solution",
  parameters: z.object({
    url: z.string().describe("URL with CAPTCHA"),
    profileId: z.string().optional().describe("Browser profile to use"),
  }),
  async execute(params, _ctx) {
    const result = await callGoBrowser("get_captcha", params)

    return {
      output:
        "CAPTCHA screenshot captured. Analyze the image and provide the solution.",
      metadata: {
        title: "CAPTCHA Screenshot",
        url: params.url,
        profileId: params.profileId || "default",
        screenshot: result.screenshot,
        captchaType: result.type || "unknown",
      },
    }
  },
})

// 10. Apply CAPTCHA solution
export const OpenBrowserApplyCaptchaSolutionTool = Tool.define({
  id: "openbrowser_apply_captcha_solution",
  description:
    "Apply CAPTCHA solution after Claude analyzes it\n- Use after getting CAPTCHA with openbrowser_get_captcha\n- Provide the solution Claude determined from the screenshot",
  parameters: z.object({
    profileId: z.string().describe("Browser profile (from get_captcha)"),
    solution: z.object({
      type: z.enum(["text", "click", "select"]).describe("Solution type"),
      value: z.string().optional().describe("Text to enter"),
      coordinates: z
        .array(z.array(z.number()))
        .optional()
        .describe("Click coordinates"),
      selections: z.array(z.string()).optional().describe("Items to select"),
    }),
  }),
  async execute(params, _ctx) {
    const result = await callGoBrowser("apply_captcha_solution", params)

    return {
      output: result.applied
        ? "CAPTCHA solution applied successfully!"
        : "Failed to apply CAPTCHA solution",
      metadata: {
        title: "CAPTCHA Solution Applied",
        profileId: params.profileId,
        success: result.applied,
        message: result.message,
      },
    }
  },
})

// Export all OpenBrowser tools
export const OpenBrowserTools = [
  OpenBrowserScrapeTool,
  // OpenBrowserSearchTool, // Removed - AIs already know URLs!
  OpenBrowserCrawlTool,
  OpenBrowserExtractTool,
  OpenBrowserAutomateTool,
  OpenBrowserScreenshotTool,
  OpenBrowserScrapeProTool,
  OpenBrowserAutomateProTool,
  OpenBrowserGetCaptchaTool,
  OpenBrowserApplyCaptchaSolutionTool,
]

// Cleanup on exit
process.on("exit", () => {
  if (browserServer) {
    try {
      browserServer.kill("SIGTERM")
    } catch (err) {
      console.error("Error killing browser server on exit:", err)
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
