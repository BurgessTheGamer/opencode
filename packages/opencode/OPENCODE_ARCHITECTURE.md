# OpenCode Architecture: Bun, Processes, and Integration

## Overview

OpenCode uses a sophisticated multi-process architecture with Bun as the primary runtime, spawning specialized servers for different functionalities. This document explains how everything works together.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Terminal                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenCode CLI (Bun Process)                    │
│                     src/index.ts (Entry Point)                   │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   Yargs     │  │   Bootstrap  │  │    Provider System     │ │
│  │  Commands   │  │   Process    │  │  (AI Models/Auth)      │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TUI Command Handler                         │
│                    src/cli/cmd/tui.ts                           │
│                                                                  │
│  1. Starts HTTP Server (Hono) on random port                   │
│  2. Spawns TUI binary (Go) with environment variables          │
│  3. Manages lifecycle and auto-updates                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌─────────────────────────────┐ ┌─────────────────────────────────┐
│   HTTP Server (Bun/Hono)   │ │      TUI Process (Go)           │
│   src/server/server.ts      │ │   tui/cmd/opencode/main.go     │
│                             │ │                                 │
│  - REST API endpoints       │ │  - Terminal UI (Bubble Tea)    │
│  - SSE event streaming      │ │  - User interaction             │
│  - Session management       │ │  - Display messages             │
│  - Tool execution           │ │  - HTTP client to Bun server   │
└─────────────────────────────┘ └─────────────────────────────────┘
```

## Process Communication Flow

```
┌──────────────┐     User Input      ┌──────────────┐
│              │ ◄─────────────────── │              │
│  TUI Process │                      │     User     │
│     (Go)     │ ───────────────────► │              │
│              │   Display Output     └──────────────┘
└──────┬───────┘
       │
       │ HTTP Request
       │ (Create session, send message)
       ▼
┌──────────────┐
│              │
│  Bun Server  │ ◄─── SSE Events Stream ────┐
│   (Hono)     │                            │
│              │                            │
└──────┬───────┘                            │
       │                                    │
       │ Execute Tools                      │
       ▼                                    │
┌──────────────┐                            │
│              │                            │
│ Tool System  │ ───── Results ─────────────┘
│              │
└──────┬───────┘
       │
       │ Spawn Child Processes
       ▼
┌─────────────────────────────────────────────┐
│          Child Process Servers              │
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Browser    │  │     Storage          │ │
│  │  Server     │  │     Server           │ │
│  │   (Go)      │  │      (Go)            │ │
│  └─────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────┘
```

## OpenBrowser & OpenStorage Integration

### 1. Tool Registration

```typescript
// In src/tool/openbrowser.ts
export const OpenBrowserScrapeTool = Tool.define({
  id: "openbrowser_scrape",
  description: DESCRIPTION,
  parameters: z.object({...}),
  async execute(params, ctx) {
    // 1. Ensure browser server is running
    await ensureBrowserServer()

    // 2. Make HTTP request to Go server
    const response = await fetch(`http://localhost:9876`, {
      method: "POST",
      body: JSON.stringify({ method: "scrape", params })
    })

    // 3. Auto-store in OpenStorage
    await OpenStorageStoreTool.execute({
      sessionId: ctx.sessionID,
      url: params.url,
      content: result.content,
      title: result.title
    }, ctx)

    return { output: minimalOutput }
  }
})
```

### 2. Server Lifecycle Management

```
┌─────────────────────────────────────────────────────────┐
│                  Tool Execution Request                  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              ensureBrowserServer() Check                 │
│                                                          │
│  ┌─────────────────┐              ┌──────────────────┐  │
│  │ Server exists?  │───── No ───► │  Spawn new       │  │
│  └────────┬────────┘              │  Go process      │  │
│           │                       └──────────────────┘  │
│          Yes                                            │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────┐              ┌──────────────────┐  │
│  │ Health check    │──── Fail ──► │  Kill & restart  │  │
│  │ (every 30s)     │              │  Go process      │  │
│  └────────┬────────┘              └──────────────────┘  │
│           │                                             │
│          Pass                                           │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────┐                                    │
│  │ Execute request │                                    │
│  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
```

### 3. Process Spawning Details

```typescript
// Browser server spawning (src/tool/openbrowser.ts)
browserServer = spawn(browserPath, [], {
  env: {
    ...process.env,
    OPENCODE_BROWSER_PORT: String(browserServerPort),
    OPENCODE_SESSION_ID: getCurrentSessionId(),
  },
  stdio: ["ignore", "ignore", "ignore"], // Prevent TUI flooding
  detached: false,
})

// Storage server spawning (src/tool/openstorage.ts)
storageServer = spawn(storagePath, [], {
  env: {
    ...process.env,
    OPENCODE_STORAGE_PORT: String(storageServerPort),
    OPENCODE_STORAGE_DB: join(HOME, ".opencode", "storage.db"),
  },
  stdio: ["ignore", "ignore", "ignore"], // Prevent TUI flooding
  detached: false,
})
```

## Data Flow Example: Web Scraping with Storage

```
User: "Scrape https://example.com"
         │
         ▼
┌─────────────────┐
│   TUI (Go)      │ Captures user input
└────────┬────────┘
         │ HTTP POST /session/{id}/message
         ▼
┌─────────────────┐
│ Bun HTTP Server │ Receives message, starts AI processing
└────────┬────────┘
         │ Tool execution request
         ▼
┌─────────────────┐
│ OpenBrowserTool │ Checks/starts browser server
└────────┬────────┘
         │ HTTP POST to localhost:9876
         ▼
┌─────────────────┐
│ Browser Server  │ Uses chromedp to scrape page
│     (Go)        │ Returns HTML content
└────────┬────────┘
         │ Response with content
         ▼
┌─────────────────┐
│ OpenBrowserTool │ Converts HTML to markdown
│                 │ Auto-stores in OpenStorage
└────────┬────────┘
         │ HTTP POST to localhost:9877
         ▼
┌─────────────────┐
│ Storage Server  │ Stores in SQLite with FTS
│     (Go)        │ Returns storage ID
└────────┬────────┘
         │ Storage confirmation
         ▼
┌─────────────────┐
│ Bun HTTP Server │ Sends SSE event with result
└────────┬────────┘
         │ SSE stream
         ▼
┌─────────────────┐
│   TUI (Go)      │ Displays result to user
└─────────────────┘
```

## Key Design Decisions

### 1. Why Separate Processes?

- **Language Optimization**: Go for TUI (terminal handling), Go for browser/storage (performance), TypeScript for AI logic
- **Isolation**: Crashes in browser/storage don't affect main process
- **Resource Management**: Can kill/restart servers independently
- **Scalability**: Could run servers on different machines in future

### 2. Why HTTP Communication?

- **Language Agnostic**: Go and TypeScript communicate via HTTP
- **Debugging**: Can test servers independently with curl
- **Flexibility**: Easy to add new servers or change implementations
- **Standard Protocol**: Well-understood, lots of tooling

### 3. Why Bun?

- **Fast Startup**: Critical for CLI tools
- **Native TypeScript**: No compilation step needed
- **Built-in APIs**: File system, child processes, HTTP server
- **Small Binary**: Can embed everything in single executable
- **Modern Runtime**: ESM modules, top-level await, etc.

### 4. Process Management Strategy

```
┌─────────────────────────────────────────────────────────┐
│                  Main Bun Process                        │
│                                                          │
│  Responsibilities:                                       │
│  - Command parsing (Yargs)                              │
│  - HTTP server for TUI communication                    │
│  - AI provider management                               │
│  - Tool orchestration                                   │
│  - Child process lifecycle                              │
│                                                          │
│  Child Processes:                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ TUI (Go) - Always running when in TUI mode      │   │
│  │ - Spawned by TUI command                        │   │
│  │ - Killed when user exits                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Browser Server (Go) - Started on demand         │   │
│  │ - Spawned on first browser tool use             │   │
│  │ - Health checked every 30 seconds               │   │
│  │ - Auto-restarted if unhealthy                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Storage Server (Go) - Started on demand         │   │
│  │ - Spawned on first storage tool use             │   │
│  │ - Health checked every 30 seconds               │   │
│  │ - Auto-restarted if unhealthy                   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Session & Context Management

```
┌─────────────────────────────────────────────────────────┐
│                   OpenCode Session                       │
│                                                          │
│  Session ID: abc-123-def-456                           │
│  Created: 2025-07-02 10:00:00                          │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Browser Profile                     │   │
│  │  - Cookies isolated per session                 │   │
│  │  - Cache isolated per session                   │   │
│  │  - History isolated per session                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Storage Context                     │   │
│  │  - All scraped content tagged with session ID   │   │
│  │  - Searchable within session                    │   │
│  │  - Can export/import sessions                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │              AI Context                          │   │
│  │  - Conversation history                         │   │
│  │  - Tool execution results                       │   │
│  │  - Cost tracking per session                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Performance Optimizations

### 1. Lazy Loading

- Browser/Storage servers only start when needed
- Reduces initial startup time
- Saves memory when features aren't used

### 2. Health Checking

- Checks every 30 seconds (not every request)
- Caches health status to avoid overhead
- Auto-recovery from crashes

### 3. Process Reuse

- Servers stay running between tool calls
- Amortizes startup cost over session
- Browser keeps pages cached

### 4. Minimal Output

- Tools return minimal text to prevent flooding
- Full content stored in OpenStorage
- UI can query storage for details

## Security Considerations

1. **Local Only**: All servers bind to localhost
2. **Port Selection**: Random ports to avoid conflicts
3. **Process Isolation**: Each server runs with minimal permissions
4. **No External Access**: Firewall-friendly, no incoming connections
5. **Session Isolation**: Each session has separate browser profile

## Future Enhancements

1. **Remote Servers**: Could run browser/storage on different machines
2. **Clustering**: Multiple browser servers for parallel scraping
3. **Plugins**: Dynamic loading of additional tool servers
4. **Metrics**: Performance monitoring and optimization
5. **Caching**: Smarter caching of scraped content

---

_This architecture enables OpenCode to leverage the best of multiple languages while maintaining a clean, modular design that's easy to extend and debug._
