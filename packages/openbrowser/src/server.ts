#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

// Import tool implementations
import { scrapeWebpage } from "./tools/scrape.js"
import { crawlWebpages } from "./tools/crawl.js"
import { extractStructuredData } from "./tools/extract.js"
import { searchWeb } from "./tools/search.js"
import { browserAutomation } from "./tools/automation.js"
import { createProfile, deleteProfile, listProfiles } from "./tools/profiles.js"

// Import schemas
import {
  ScrapeWebpageSchema,
  CrawlWebpagesSchema,
  ExtractStructuredDataSchema,
  SearchWebSchema,
  BrowserAutomationSchema,
  CreateProfileSchema,
  DeleteProfileSchema,
  ListProfilesSchema,
} from "./types.js"

const NAME = "openbrowser"
const VERSION = "1.0.0"

async function main() {
  const server = new McpServer(
    {
      name: NAME,
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  )

  // Register scraping tools
  server.tool(
    "scrape_webpage",
    "Extract content from a webpage with optional AI enhancement",
    ScrapeWebpageSchema.shape,
    scrapeWebpage,
  )

  server.tool(
    "crawl_webpages",
    "Crawl multiple linked pages with intelligent guidance",
    CrawlWebpagesSchema.shape,
    crawlWebpages,
  )

  server.tool(
    "extract_structured_data",
    "Extract structured data from HTML using AI",
    ExtractStructuredDataSchema.shape,
    extractStructuredData,
  )

  // Register search tool
  server.tool(
    "search_web",
    "Search the web using DuckDuckGo",
    SearchWebSchema.shape,
    searchWeb,
  )

  // Register automation tool
  server.tool(
    "browser_automation",
    "Perform automated browser actions",
    BrowserAutomationSchema.shape,
    browserAutomation,
  )

  // Register profile management tools
  server.tool(
    "create_profile",
    "Create a new browser profile",
    CreateProfileSchema.shape,
    createProfile,
  )

  server.tool(
    "delete_profile",
    "Delete a browser profile",
    DeleteProfileSchema.shape,
    deleteProfile,
  )

  server.tool(
    "list_profiles",
    "List all browser profiles",
    ListProfilesSchema.shape,
    listProfiles,
  )

  // Connect to stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error(`${NAME} MCP Server v${VERSION} started`)
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.error("Shutting down OpenBrowser MCP Server...")
  process.exit(0)
})

process.on("SIGTERM", () => {
  console.error("Shutting down OpenBrowser MCP Server...")
  process.exit(0)
})

main().catch((error) => {
  console.error("Fatal error in OpenBrowser MCP Server:", error)
  process.exit(1)
})
