import { z } from "zod"
import { Tool } from "./tool"
import { spawn } from "child_process"
import { join } from "path"

// OpenBrowser tool - Native Go browser engine
const DESCRIPTION = `- Advanced web browser automation and scraping
- Pure Go implementation (no Chrome required!)
- 20MB vs 200MB size advantage
- Free web search via DuckDuckGo
- Screenshots, crawling, and automation
- Alternative to HyperBrowser MCP
`

// Browser server instance
let browserServer: any = null
let browserServerPort = 9876

// Auto-start browser server
async function ensureBrowserServer(): Promise<void> {
  if (browserServer) return

  const browserPath = join(__dirname, "../../../tui/browser-server")
  browserServer = spawn(browserPath, [], {
    env: { ...process.env, OPENCODE_BROWSER_PORT: String(browserServerPort) },
    stdio: ["ignore", "pipe", "pipe"],
  })

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

// Helper to call Go browser server
async function callGoBrowser(method: string, params: any): Promise<any> {
  await ensureBrowserServer()

  const browserUrl = `http://localhost:${browserServerPort}`

  const response = await fetch(browserUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ method, params }),
  })

  if (!response.ok) {
    throw new Error(`Browser server error: ${response.statusText}`)
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error || "Unknown browser error")
  }

  return result.data
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
  }),
  async execute(params) {
    const result = await callGoBrowser("scrape", params)

    return {
      output: result.content,
      metadata: {
        title: result.title || "OpenBrowser Scrape",
        url: params.url,
        format: params.format,
        browserEngine: "Native Go Engine",
        links: result.links?.length || 0,
        images: result.images?.length || 0,
        screenshot: result.screenshot ? "included" : "not included",
      },
    }
  },
})

// 2. Search tool using DuckDuckGo (FREE!)
export const OpenBrowserSearchTool = Tool.define({
  id: "openbrowser_search",
  description: "Search the web using DuckDuckGo (FREE, no API key required!)",
  parameters: z.object({
    query: z.string().describe("Search query"),
    maxResults: z.number().default(10),
    region: z.string().optional().describe("Region code (e.g., 'us-en')"),
  }),
  async execute(params) {
    const result = await callGoBrowser("search", params)

    // Handle empty or null results
    if (!result || !result.results) {
      return {
        output: `No results found for "${params.query}"`,
        metadata: {
          title: `Search: ${params.query}`,
          url: "DuckDuckGo Search",
          resultsFound: 0,
          searchEngine: "DuckDuckGo (via Go Browser)",
        },
      }
    }

    const formattedResults = result.results.map(
      (r: any, i: number) =>
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet || ""}`,
    )

    return {
      output: `Found ${result.results.length} results for "${params.query}":\n\n${formattedResults.join("\n\n")}`,
      metadata: {
        title: `Search: ${params.query}`,
        url: "DuckDuckGo Search",
        resultsFound: result.results.length,
        searchEngine: "DuckDuckGo (via Go Browser)",
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
  async execute(params) {
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

    return {
      output: `Crawled ${result.pages.length} pages:\n\n${result.pages
        .map(
          (p: any) =>
            `## ${p.title || "Untitled"}\n${p.url}\n\n${(p.content || "").substring(0, 500)}...`,
        )
        .join("\n\n---\n\n")}`,
      metadata: {
        title: `Crawled ${result.pages.length} pages`,
        url: params.startUrl,
        pagesFound: result.pages.length,
        browserEngine: "Native Go Crawler",
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

// Export all OpenBrowser tools
export const OpenBrowserTools = [
  OpenBrowserScrapeTool,
  // OpenBrowserSearchTool, // Removed - AIs already know URLs!
  OpenBrowserCrawlTool,
  OpenBrowserExtractTool,
  OpenBrowserAutomateTool,
  OpenBrowserScreenshotTool,
]

// Cleanup on exit
process.on("exit", () => {
  if (browserServer) {
    browserServer.kill()
  }
})
