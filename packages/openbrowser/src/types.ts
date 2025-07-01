import { z } from "zod"

// Import the correct type from MCP SDK
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"

// Re-export for convenience
export type ToolResult = CallToolResult

// Scrape webpage parameters
export const ScrapeWebpageSchema = z.object({
  url: z.string().describe("The URL to scrape"),
  format: z
    .enum(["markdown", "html", "text"])
    .default("markdown")
    .describe("Output format"),
  includeScreenshot: z.boolean().default(false).describe("Include screenshot"),
  aiEnhanced: z
    .boolean()
    .default(false)
    .describe("Use AI for intelligent extraction"),
  intent: z
    .string()
    .optional()
    .describe("What you're looking for (for AI enhancement)"),
  profileId: z.string().optional().describe("Browser profile to use"),
  waitFor: z.string().optional().describe("CSS selector to wait for"),
  timeout: z.number().default(30000).describe("Timeout in milliseconds"),
})
export type ScrapeWebpageParams = z.infer<typeof ScrapeWebpageSchema>

// Crawl webpages parameters
export const CrawlWebpagesSchema = z.object({
  startUrl: z.string().describe("Starting URL for crawling"),
  maxPages: z.number().default(10).describe("Maximum pages to crawl"),
  maxDepth: z.number().default(3).describe("Maximum crawl depth"),
  aiGuided: z
    .boolean()
    .default(false)
    .describe("Use AI to guide crawling decisions"),
  intent: z
    .string()
    .optional()
    .describe("What you're looking for (for AI guidance)"),
  includePatterns: z
    .array(z.string())
    .optional()
    .describe("URL patterns to include"),
  excludePatterns: z
    .array(z.string())
    .optional()
    .describe("URL patterns to exclude"),
  profileId: z.string().optional().describe("Browser profile to use"),
  respectRobots: z.boolean().default(true).describe("Respect robots.txt"),
})
export type CrawlWebpagesParams = z.infer<typeof CrawlWebpagesSchema>

// Extract structured data parameters
export const ExtractStructuredDataSchema = z.object({
  url: z
    .string()
    .optional()
    .describe("URL to extract from (if not providing HTML)"),
  html: z.string().optional().describe("HTML content to extract from"),
  schema: z.record(z.any()).describe("JSON schema for extraction"),
  aiPowered: z.boolean().default(true).describe("Use AI for extraction"),
  profileId: z.string().optional().describe("Browser profile to use"),
})
export type ExtractStructuredDataParams = z.infer<
  typeof ExtractStructuredDataSchema
>

// Search web parameters
export const SearchWebSchema = z.object({
  query: z.string().describe("Search query"),
  maxResults: z.number().default(10).describe("Maximum results to return"),
  region: z.string().default("us-en").describe("Search region"),
  safeSearch: z
    .enum(["strict", "moderate", "off"])
    .default("moderate")
    .describe("Safe search setting"),
})
export type SearchWebParams = z.infer<typeof SearchWebSchema>

// Browser automation parameters
export const BrowserAutomationSchema = z.object({
  url: z.string().describe("URL to navigate to"),
  actions: z
    .array(
      z.object({
        type: z.enum(["click", "type", "wait", "scroll", "screenshot"]),
        selector: z.string().optional(),
        text: z.string().optional(),
        timeout: z.number().optional(),
      }),
    )
    .describe("Actions to perform"),
  profileId: z.string().optional().describe("Browser profile to use"),
  headless: z.boolean().default(true).describe("Run in headless mode"),
})
export type BrowserAutomationParams = z.infer<typeof BrowserAutomationSchema>

// Profile management parameters
export const CreateProfileSchema = z.object({
  name: z.string().describe("Profile name"),
  userAgent: z.string().optional().describe("Custom user agent"),
  viewport: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional()
    .describe("Viewport size"),
  proxy: z.string().optional().describe("Proxy URL"),
})
export type CreateProfileParams = z.infer<typeof CreateProfileSchema>

export const DeleteProfileSchema = z.object({
  name: z.string().describe("Profile name to delete"),
})
export type DeleteProfileParams = z.infer<typeof DeleteProfileSchema>

export const ListProfilesSchema = z.object({})
export type ListProfilesParams = z.infer<typeof ListProfilesSchema>

// Browser profile interface
export interface BrowserProfile {
  id: string
  name: string
  created: string
  userAgent?: string
  viewport?: {
    width: number
    height: number
  }
  proxy?: string
  path: string
}

// Content extraction result
export interface ExtractedContent {
  title: string
  content: string
  markdown: string
  links: Array<{
    url: string
    text: string
  }>
  images: Array<{
    url: string
    alt: string
  }>
  metadata: {
    description?: string
    keywords?: string[]
    author?: string
    publishedTime?: string
  }
}

// Crawl result
export interface CrawlResult {
  url: string
  title: string
  content: string
  links: string[]
  depth: number
  timestamp: string
  error?: string
}

// AI enhancement context
export interface AIContext {
  sessionID?: string
  messageID?: string
  intent?: string
  previousResults?: any[]
}
