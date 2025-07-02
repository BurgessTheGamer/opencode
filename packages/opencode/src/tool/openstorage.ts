import { z } from "zod"
import { Tool } from "./tool"
import { spawn, ChildProcess } from "child_process"
import { join } from "path"

// OpenStorage tool - Local SQLite storage for context management
// Description is used by individual tools

// Storage server instance
let storageServer: ChildProcess | null = null
let storageServerPort = 9877
let isStarting = false
let lastHealthCheck = 0

// Health check the storage server
async function isStorageHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${storageServerPort}`, {
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

// Kill existing storage server process
async function killStorageServer(): Promise<void> {
  if (storageServer) {
    try {
      storageServer.kill("SIGTERM")
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (!storageServer.killed) {
        storageServer.kill("SIGKILL")
      }
    } catch (err) {
      // Suppress error logging to prevent TUI flooding
    }
    storageServer = null
  }
}

// Auto-start storage server with recovery
async function ensureStorageServer(): Promise<void> {
  // Check if we need a health check
  const now = Date.now()
  if (storageServer && now - lastHealthCheck < 30000) {
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
    if (storageServer) {
      const healthy = await isStorageHealthy()
      if (healthy) {
        lastHealthCheck = now
        return
      }
      // Storage server unhealthy, restarting...
      await killStorageServer()
    }

    // Check if another instance is running
    const externalHealthy = await isStorageHealthy()
    if (externalHealthy) {
      // Found existing storage server on port
      lastHealthCheck = now
      return
    }

    // Start new storage server
    const storagePath = join(__dirname, "../../../tui/storage-server")
    // Suppress console.log to prevent TUI flooding

    storageServer = spawn(storagePath, [], {
      env: {
        ...process.env,
        OPENCODE_STORAGE_PORT: String(storageServerPort),
        OPENCODE_STORAGE_DB: join(
          process.env["HOME"] || "",
          ".opencode",
          "storage.db",
        ),
      },
      stdio: ["ignore", "ignore", "ignore"], // Suppress all output to prevent TUI flooding
      detached: false,
    })

    storageServer.on("exit", () => {
      // Storage server exited
      storageServer = null
    })

    storageServer.on("error", () => {
      // Storage server spawn error
      storageServer = null
    })

    // Wait for server to be ready with retries
    let retries = 10
    while (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const healthy = await isStorageHealthy()
      if (healthy) {
        // Storage server started successfully
        lastHealthCheck = now
        return
      }
      retries--
    }

    throw new Error("Storage server failed to start after 5 seconds")
  } finally {
    isStarting = false
  }
}

// Helper to call storage server with retry logic
async function callStorage(
  method: string,
  params: any,
  retries = 3,
): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await ensureStorageServer()

      const storageUrl = `http://localhost:${storageServerPort}`
      const requestBody = JSON.stringify({ method, params })
      // Suppress logging to prevent TUI flooding

      const response = await fetch(storageUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })

      if (!response.ok) {
        throw new Error(`Storage server error: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || "Unknown storage error")
      }

      return result.data
    } catch (error: any) {
      if (attempt === retries) {
        throw error
      }

      // Suppress logging - Storage call failed, retrying...

      // Force restart on connection errors
      if (
        error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED")
      ) {
        await killStorageServer()
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
}

// 1. Store scraped content
export const OpenStorageStoreTool = Tool.define({
  id: "openstorage_store",
  description:
    "Store scraped content in local SQLite database for later retrieval",
  parameters: z.object({
    sessionId: z.string().describe("Session ID to associate content with"),
    url: z.string().describe("URL of the content"),
    title: z.string().describe("Title of the content"),
    content: z.string().describe("The actual content to store"),
    contentType: z
      .string()
      .default("text")
      .describe("Type of content (text, markdown, html)"),
    metadata: z.record(z.any()).optional().describe("Additional metadata"),
  }),
  async execute(params, ctx) {
    const result = await callStorage("store_content", {
      session_id: params.sessionId || ctx.sessionID,
      url: params.url,
      title: params.title,
      content: params.content,
      content_type: params.contentType,
      metadata: params.metadata,
    })

    return {
      output: `Content stored successfully. ID: ${result.id}, Token count: ${result.token_count}`,
      metadata: {
        title: "Content Stored",
        contentId: result.id,
        tokenCount: result.token_count,
        sessionId: params.sessionId || ctx.sessionID,
      },
    }
  },
})

// 2. Retrieve content by ID
export const OpenStorageGetTool = Tool.define({
  id: "openstorage_get",
  description: "Retrieve stored content by ID",
  parameters: z.object({
    id: z.string().describe("Content ID to retrieve"),
  }),
  async execute(params, _ctx) {
    const content = await callStorage("get_content", { id: params.id })

    // Prevent flooding - truncate if content is too large
    let outputContent = content.content
    let truncated = false

    if (outputContent && outputContent.length > MAX_CONTEXT_OUTPUT) {
      outputContent =
        outputContent.substring(0, MAX_CONTEXT_OUTPUT) +
        "\n\n⚠️ [Content truncated to prevent flooding - original size: " +
        content.content.length.toLocaleString() +
        " chars]"
      truncated = true
    }

    return {
      output: outputContent,
      metadata: {
        id: content.id,
        title: content.title,
        url: content.url,
        contentType: content.content_type,
        tokenCount: content.token_count,
        createdAt: content.created_at,
        truncated,
        originalSize: content.content?.length || 0,
      },
    }
  },
})

// 3. Search stored content
export const OpenStorageSearchTool = Tool.define({
  id: "openstorage_search",
  description: "Search stored content using full-text search",
  parameters: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().default(10).describe("Maximum results to return"),
  }),
  async execute(params, _ctx) {
    const result = await callStorage("search_content", {
      query: params.query,
      limit: params.limit,
    })

    if (result.count === 0) {
      return {
        output: "No results found for your search query.",
        metadata: {
          title: "Search Results",
          query: params.query,
          count: 0,
        },
      }
    }

    const output = result.results
      .map(
        (r: any, i: number) =>
          `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ID: ${r.id}\n   Tokens: ${r.token_count}`,
      )
      .join("\n\n")

    return {
      output: `Found ${result.count} results:\n\n${output}`,
      metadata: {
        title: "Search Results",
        query: params.query,
        count: result.count,
        results: result.results.map((r: any) => ({
          id: r.id,
          title: r.title,
          url: r.url,
        })),
      },
    }
  },
})

// 4. Get context window for current session
const MAX_CONTEXT_OUTPUT = 30000 // Same as bash tool - 30KB max
const MAX_CONTENT_PREVIEW = 1000 // Preview length for each item

export const OpenStorageContextTool = Tool.define({
  id: "openstorage_context",
  description: "Get stored content for current session within token limits",
  parameters: z.object({
    sessionId: z
      .string()
      .optional()
      .describe("Session ID (defaults to current)"),
    maxTokens: z
      .number()
      .default(100000)
      .describe("Maximum tokens to retrieve"),
  }),
  async execute(params, ctx) {
    const result = await callStorage("get_context_window", {
      session_id: params.sessionId || ctx.sessionID,
      max_tokens: params.maxTokens,
    })

    if (result.count === 0) {
      return {
        output: "No content stored for this session yet.",
        metadata: {
          title: "Context Window",
          sessionId: params.sessionId || ctx.sessionID,
          count: 0,
          totalTokens: 0,
          itemsShown: 0,
          truncated: false,
        },
      }
    }

    // Build output with smart truncation
    let output = `📦 Storage Context: ${result.count} items (${result.total_tokens} tokens)\n\n`
    let currentLength = output.length
    let itemsIncluded = 0
    let truncated = false

    for (const content of result.contents) {
      // Create item header
      const header = `# ${content.title}\nURL: ${content.url}\nStored: ${content.created_at}\nID: ${content.id}\n\n`

      // Truncate content if needed
      let itemContent = content.content || ""
      if (itemContent.length > MAX_CONTENT_PREVIEW) {
        itemContent =
          itemContent.substring(0, MAX_CONTENT_PREVIEW) +
          "\n\n[Content truncated - use openstorage_get with ID to retrieve full content]"
      }

      const itemText = header + itemContent + "\n\n---\n\n"

      // Check if adding this item would exceed limit
      if (currentLength + itemText.length > MAX_CONTEXT_OUTPUT) {
        truncated = true
        break
      }

      output += itemText
      currentLength += itemText.length
      itemsIncluded++
    }

    if (truncated || itemsIncluded < result.count) {
      output += `\n⚠️ Output truncated: Showing ${itemsIncluded}/${result.count} items\n`
      output += `💡 Use openstorage_get with specific IDs to retrieve full content\n`
      output += `💡 Use openstorage_search to find specific content\n`
    }

    return {
      output,
      metadata: {
        title: "Context Window",
        sessionId: params.sessionId || ctx.sessionID,
        count: result.count,
        totalTokens: result.total_tokens,
        itemsShown: itemsIncluded,
        truncated: truncated || itemsIncluded < result.count,
      },
    }
  },
})

// 5. Create a new session
export const OpenStorageSessionTool = Tool.define({
  id: "openstorage_session",
  description: "Create a new storage session",
  parameters: z.object({
    name: z.string().optional().describe("Session name"),
  }),
  async execute(params, _ctx) {
    const session = await callStorage("create_session", {
      name: params.name,
    })

    return {
      output: `Created new session: ${session.name} (ID: ${session.id})`,
      metadata: {
        title: "Session Created",
        sessionId: session.id,
        name: session.name,
        createdAt: session.created_at,
      },
    }
  },
})

// 6. List recent sessions
export const OpenStorageListSessionsTool = Tool.define({
  id: "openstorage_list_sessions",
  description: "List recent storage sessions",
  parameters: z.object({
    limit: z.number().default(20).describe("Maximum sessions to return"),
  }),
  async execute(params, _ctx) {
    const result = await callStorage("list_sessions", {
      limit: params.limit,
    })

    if (result.count === 0) {
      return {
        output: "No sessions found.",
        metadata: {
          title: "Session List",
          count: 0,
        },
      }
    }

    const output = result.sessions
      .map(
        (s: any, i: number) =>
          `${i + 1}. ${s.name}\n   ID: ${s.id}\n   Created: ${s.created_at}`,
      )
      .join("\n\n")

    return {
      output: `Found ${result.count} sessions:\n\n${output}`,
      metadata: {
        title: "Session List",
        count: result.count,
        sessions: result.sessions,
      },
    }
  },
})

// 7. Cleanup old content
export const OpenStorageCleanupTool = Tool.define({
  id: "openstorage_cleanup",
  description: "Delete old stored content to free up space",
  parameters: z.object({
    daysOld: z
      .number()
      .default(7)
      .describe("Delete content older than this many days"),
  }),
  async execute(params, _ctx) {
    const result = await callStorage("cleanup", {
      days_old: params.daysOld,
    })

    return {
      output: result.message,
      metadata: {
        title: "Cleanup Complete",
        daysOld: params.daysOld,
      },
    }
  },
})

// 8. Cleanup session content
export const OpenStorageCleanupSessionTool = Tool.define({
  id: "openstorage_cleanup_session",
  description:
    "Clean up old content from current session, keeping only recent items",
  parameters: z.object({
    sessionId: z
      .string()
      .optional()
      .describe("Session ID to clean (defaults to current)"),
    keepLast: z.number().default(10).describe("Number of recent items to keep"),
  }),
  async execute(params, ctx) {
    const result = await callStorage("cleanup_session", {
      session_id: params.sessionId || ctx.sessionID,
      keep_last: params.keepLast,
    })

    return {
      output: result.message,
      metadata: {
        title: "Session Cleanup",
        sessionId: params.sessionId || ctx.sessionID,
        deleted: result.deleted,
        keepLast: params.keepLast,
      },
    }
  },
})

// Export all OpenStorage tools
export const OpenStorageTools = [
  OpenStorageStoreTool,
  OpenStorageGetTool,
  OpenStorageSearchTool,
  OpenStorageContextTool,
  OpenStorageSessionTool,
  OpenStorageListSessionsTool,
  OpenStorageCleanupTool,
  OpenStorageCleanupSessionTool,
]

// Cleanup on exit
process.on("exit", () => {
  if (storageServer) {
    try {
      storageServer.kill("SIGTERM")
    } catch (err) {
      // Suppress error logging to prevent TUI flooding
    }
  }
})

process.on("SIGINT", () => {
  if (storageServer) {
    storageServer.kill("SIGTERM")
  }
  process.exit(0)
})

process.on("SIGTERM", () => {
  if (storageServer) {
    storageServer.kill("SIGTERM")
  }
  process.exit(0)
})
