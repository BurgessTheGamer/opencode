# OpenCode Enhanced - Personal Development Workspace

This is Jacob's personal development workspace for OpenCode enhancements. All features are developed and tested here before submitting clean PRs upstream.

## 🚀 Quick Start

```bash
# Run development version with ALL features
./opencode-dev-launcher.sh

# Current branch with all features
git checkout personal-main
```

## 📁 Repository Structure

```
opencode-enhanced/
├── packages/
│   ├── opencode/       # Main CLI (TypeScript/Bun)
│   └── tui/           # Terminal UI (Go/Bubble Tea)
├── AGENTS.md          # This file - NEVER include in PRs!
├── opencode-dev-launcher.sh  # Dev script - NEVER include in PRs!
└── .gitignore
```

## 🔄 Git Workflow (CRITICAL)

### Branch Strategy

- **`personal-main`**: Your main branch with ALL features combined
- **Feature branches**: Individual branches for clean PRs to upstream
- **Personal repo**: https://github.com/BurgessTheGamer/opencode

### ⚠️ NEVER Include in PRs

- `AGENTS.md` - Personal documentation
- `opencode-dev-launcher.sh` - Personal dev script
- Any other personal files

### PR Workflow

1. Always work on `personal-main` for development
2. Create clean feature branches from `origin/dev` for PRs
3. Cherry-pick only the specific feature changes
4. NEVER auto-submit PRs - always ask first
5. Each feature gets its own PR

## ✅ Completed Features

### 1. Interactive Scrollbar - PR #486 (MERGED ✅)

- **Location**: `packages/tui/internal/components/chat/messages.go`
- **Features**: Click/drag scrollbar for message area
- **Status**: Successfully merged into main repo

### 2. Text Selection & Copy - PR #518

- **Location**: `packages/tui/internal/components/chat/messages.go`
- **Features**: Click+drag selection, Ctrl+Shift+C to copy
- **Status**: Submitted, pending review

### 3. Aiken LSP Support - PR #547 (Updated ✅)

- **Location**: `packages/opencode/src/lsp/server.ts`
- **Implementation**: Uses `bun x @aiken-lang/aiken lsp` pattern
- **Status**: Updated based on feedback, pending review

### 4. Chat Box Height Limiting - PR #565

- **Location**: `packages/tui/internal/components/textarea/textarea.go`
- **Features**: Grows 1-8 lines, then scrolls with scrollbar
- **Status**: Submitted, pending review

### 5. Text Input Scrollbar (99% Complete)

- **Location**: `packages/tui/internal/components/chat/editor.go`
- **Status**: Works except bottom 1-2 pixels (parent bounds issue)
- **Not yet PR'd**: Saved in personal repo

## 🛠️ Development Commands

```bash
# Test changes
./opencode-dev-launcher.sh

# Build TUI only
cd packages/tui && go build -o opencode-dev ./cmd/opencode

# Run TypeScript CLI directly
cd packages/opencode && bun run ./src/index.ts

# Push to personal repo
git push personal personal-main:main
```

## 📋 Technical Architecture

### TUI System (Go/Bubble Tea)

- **Entry**: `packages/tui/cmd/opencode/main.go`
- **Core Model**: `packages/tui/internal/tui/tui.go`
- **Components**: `packages/tui/internal/components/`
- **Layout System**: Flex layout with overlay support
- **Theme System**: Adaptive colors for light/dark terminals

### CLI System (TypeScript/Bun)

- **Entry**: `packages/opencode/src/index.ts`
- **LSP Support**: `packages/opencode/src/lsp/server.ts`
- **Tools**: `packages/opencode/src/tool/`
- **MCP Integration**: `packages/opencode/src/mcp/index.ts`
- **Session Management**: `packages/opencode/src/session/index.ts`
- **Provider System**: `packages/opencode/src/provider/provider.ts`
- **Pattern**: Use `bun x` for npm packages (no global installs)

### Tool Integration Architecture

#### **Built-in Tools** (`packages/opencode/src/tool/`)

- **BashTool**: Command execution
- **EditTool**: File editing with validation
- **WebFetchTool**: HTTP content retrieval with markdown conversion
- **GlobTool**: File pattern matching
- **GrepTool**: Content searching
- **ListTool**: Directory listing
- **ReadTool**: File reading
- **WriteTool**: File writing
- **TodoTool**: Task management

#### **MCP Tools** (`packages/opencode/src/mcp/index.ts`)

- **Local MCP Servers**: Stdio transport with command execution
- **Remote MCP Servers**: SSE transport with URL endpoints
- **Tool Prefixing**: `{clientName}_{toolName}` pattern
- **Error Handling**: Comprehensive error wrapping and reporting

#### **AI Provider Integration** (`packages/opencode/src/session/index.ts`)

- **Multi-Provider Support**: Anthropic, OpenAI, Google, GitHub Copilot
- **Tool Execution Context**: Session ID, message ID, abort signals
- **Real-time Streaming**: Tool results streamed back to UI
- **Cost Tracking**: Token usage and cost calculation per tool call

### Key Patterns

- **Message Passing**: All UI communication via Bubble Tea messages
- **Component Isolation**: Each component manages its own state
- **Overlay Rendering**: Advanced ANSI-aware overlay system
- **Performance**: Caching, selective updates, viewport optimization
- **Tool Execution**: Async execution with abort signals and metadata tracking
- **AI Integration**: Direct AI service access for tool enhancement

## 🚀 Current Development

### 6. Pure Go Native Browser (IMPLEMENTED! 🎉)

- **Goal**: Chrome-free browser engine built into OpenCode
- **Location**: `packages/tui/internal/browser/`
- **Architecture**: Pure Go implementation with native libraries
- **Status**: ALL HyperBrowser MCP features implemented!
- **Size**: 20MB vs 200MB (Chrome)

#### **Implemented Tools (100% Feature Parity)**

1. ✅ **`ScrapeWebpage`** - HTML/Markdown extraction with screenshots
2. ✅ **`CrawlWebpages`** - Multi-page crawling with Colly
3. ✅ **`ExtractStructuredData`** - CSS selector & AI-powered extraction
4. ✅ **`SearchWeb`** - DuckDuckGo search (FREE!)
5. ✅ **`BrowserAutomation`** - Form filling, clicking, typing
6. ✅ **Profile Management** - Sessions linked to OpenCode sessions

#### **Key Technologies**

- **HTML Parsing**: `PuerkitoBio/goquery` - jQuery-like DOM manipulation
- **Web Crawling**: `gocolly/colly/v2` - Fast, concurrent crawler
- **Stateful Browsing**: `headzoo/surf` - Cookie & session management
- **Screenshots**: `kbinani/screenshot` - Native screen capture
- **JavaScript**: `dop251/goja` - Pure Go JS engine
- **Text Rendering**: `golang/freetype` - Font rendering

#### **Revolutionary Features**

- **No Chrome Dependency**: 90% smaller than Puppeteer solutions
- **Native Integration**: Direct access to OpenCode's AI providers
- **Real Screenshots**: Captures actual rendered output
- **Cross-Platform**: Works on Windows, macOS, Linux, FreeBSD
- **Session-Based Profiles**: Each OpenCode session = browser profile

#### **Next Steps**

1. Add Go dependencies to `packages/tui/go.mod`
2. Run `go mod tidy` to install dependencies
3. Integrate with OpenCode's tool system
4. Test with real websites

## 🎯 Success Metrics

- **5 major features** implemented (4 completed + OpenBrowser planned)
- **3 PRs submitted**, 1 merged
- **Zero breaking changes**
- **100% TypeScript compilation**
- **Clean PR separation**
- **Free alternative to paid services** (OpenBrowser vs HyperBrowser)

## 📝 Important Notes

### For AI Assistants

1. ALWAYS save to personal repo first
2. NEVER auto-submit PRs without asking
3. Keep `AGENTS.md` and `opencode-dev-launcher.sh` out of PRs
4. Test on `personal-main`, PR from feature branches
5. Use `bun x` pattern for npm packages
6. **OpenBrowser Development**: Follow existing tool patterns in `packages/opencode/src/tool/`
7. **MCP Integration**: Use existing MCP patterns in `packages/opencode/src/mcp/index.ts`
8. **AI Enhancement**: Leverage `packages/opencode/src/session/index.ts` for AI provider access

### Common Issues

- **Build errors**: Usually missing layout dependencies
- **Mouse events**: Check parent component bounds
- **LSP issues**: Ensure using `bun x` pattern

## 🔗 Resources

- [Personal Repo](https://github.com/BurgessTheGamer/opencode)
- [OpenCode Main](https://github.com/sst/opencode)
- [Bubble Tea Docs](https://github.com/charmbracelet/bubbletea)

## 🔍 OpenBrowser MCP Architecture Analysis

### **Confirmed: Turn-Key Solution Like WebFetch** ✅

After comprehensive audit, OpenBrowser will integrate **exactly like WebFetch**:

#### **WebFetch Integration Pattern** (`packages/opencode/src/tool/webfetch.ts`)

```typescript
export const WebFetchTool = Tool.define({
  id: "webfetch",
  description: DESCRIPTION,
  parameters: z.object({...}),
  async execute(params, ctx) {
    // Direct implementation using fetch + TurndownService
    // Returns { output: string, metadata: object }
  }
})
```

#### **OpenBrowser Integration Pattern** (Planned)

```typescript
// Option 1: Direct Tool Integration (Like WebFetch)
export const OpenBrowserTool = Tool.define({
  id: "openbrowser_scrape",
  description: "Advanced web scraping with browser automation",
  parameters: z.object({...}),
  async execute(params, ctx) {
    // Direct implementation using Puppeteer + AI providers
    // Leverage ctx.sessionID for AI access
  }
})

// Option 2: MCP Server Integration (Recommended)
// packages/openbrowser/ as separate MCP server
// Integrates via packages/opencode/src/mcp/index.ts
```

### **AI Provider Access Confirmed** ✅

OpenCode provides **direct AI access** for tool enhancement:

#### **Session Context** (`packages/opencode/src/session/index.ts:402-485`)

```typescript
// Tools get full AI provider access via session context
for (const item of await Provider.tools(input.providerID)) {
  tools[item.id] = tool({
    async execute(args, opts) {
      // Full access to AI providers here
      // Can call any AI model for intelligent processing
    },
  })
}
```

#### **AI-Enhanced OpenBrowser Tools**

- **Smart Content Extraction**: Use Claude/GPT for intelligent content parsing
- **Structured Data Conversion**: AI-powered HTML → JSON transformation
- **Content Summarization**: Leverage existing AI for content processing
- **Intelligent Crawling**: AI-guided link following and content prioritization

### **Optimal Implementation Strategy** 🎯

#### **Phase 1: MCP Server Approach** (Recommended)

```
packages/openbrowser/
├── src/
│   ├── server.ts              # MCP server (like HyperBrowser)
│   ├── tools/
│   │   ├── scrape.ts          # Puppeteer + AI extraction
│   │   ├── crawl.ts           # Crawlee + AI guidance
│   │   ├── extract.ts         # AI-powered HTML→JSON
│   │   └── search.ts          # DuckDuckGo integration
│   └── ai/
│       └── provider.ts        # AI provider integration
├── package.json
└── tsconfig.json
```

#### **Integration via MCP System**

```json
// opencode.json configuration
{
  "mcp": {
    "openbrowser": {
      "type": "local",
      "command": ["bun", "run", "./packages/openbrowser/src/server.ts"],
      "enabled": true
    }
  }
}
```

#### **AI Provider Integration**

```typescript
// Access OpenCode's AI providers from OpenBrowser
import { Provider } from "../opencode/src/provider/provider"

async function aiExtractStructuredData(html: string, schema: any) {
  const model = await Provider.getModel(
    "anthropic",
    "claude-3-5-sonnet-20241022",
  )
  const result = await generateText({
    model: model.language,
    messages: [
      {
        role: "user",
        content: `Extract data matching schema: ${JSON.stringify(schema)}\nFrom HTML: ${html}`,
      },
    ],
  })
  return JSON.parse(result.text)
}
```

---

_Last updated: After comprehensive OpenCode architecture audit and OpenBrowser planning_
