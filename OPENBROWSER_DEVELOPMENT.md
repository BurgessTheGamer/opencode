# 🚀 OpenBrowser MCP Development Guide

## 📋 **Project Overview**

**Goal**: Create a free, open-source alternative to HyperBrowser MCP that perfectly replicates ALL functionality while adding AI-enhanced capabilities.

**Status**: Development branch `feature/openbrowser-mcp` created
**Timeline**: 4 weeks (28 days)
**Architecture**: TypeScript MCP Server integrated with OpenCode Enhanced

## 🎯 **HyperBrowser Feature Mapping**

### **✅ Confirmed Replicable Features**

| HyperBrowser Tool         | Our Implementation      | Technology Stack             | Status  |
| ------------------------- | ----------------------- | ---------------------------- | ------- |
| `scrape_webpage`          | AI-enhanced scraping    | Puppeteer + Readability + AI | Planned |
| `crawl_webpages`          | Intelligent crawling    | Crawlee + AI guidance        | Planned |
| `extract_structured_data` | AI-powered extraction   | Cheerio + AI parsing         | Planned |
| `search_with_bing`        | Free search alternative | DuckDuckGo API               | Planned |
| `browser_use_agent`       | Browser automation      | Puppeteer automation         | Planned |
| `create_profile`          | Profile management      | Local file storage           | Planned |
| `delete_profile`          | Profile management      | Local file storage           | Planned |
| `list_profiles`           | Profile management      | Local file storage           | Planned |

### **🚫 Skipping (AI Agent Features)**

- `openai_computer_use_agent` - Requires OpenAI API (not free)
- `claude_computer_use_agent` - Requires Anthropic API (not free)

**Note**: We can add these later as optional features for users with API keys.

## 🏗️ **Project Structure**

```
packages/openbrowser/
├── src/
│   ├── server.ts              # MCP server entry point
│   ├── tools/
│   │   ├── scrape.ts          # scrape_webpage implementation
│   │   ├── crawl.ts           # crawl_webpages implementation
│   │   ├── extract.ts         # extract_structured_data implementation
│   │   ├── search.ts          # search_with_bing alternative
│   │   ├── automation.ts      # browser_use_agent implementation
│   │   └── profiles.ts        # profile management tools
│   ├── browser/
│   │   ├── manager.ts         # Browser session management
│   │   ├── stealth.ts         # Anti-detection features
│   │   ├── content.ts         # Content extraction utilities
│   │   └── profiles.ts        # Profile storage system
│   ├── ai/
│   │   ├── enhancer.ts        # AI provider integration
│   │   ├── extractor.ts       # AI-powered data extraction
│   │   └── analyzer.ts        # Content analysis and understanding
│   ├── utils/
│   │   ├── markdown.ts        # HTML to Markdown conversion
│   │   ├── readability.ts     # Content cleaning
│   │   └── validation.ts      # Input validation
│   └── types.ts               # TypeScript definitions
├── package.json
├── tsconfig.json
├── README.md
└── DEVELOPMENT.md             # This file
```

## 🔧 **Technology Stack**

### **Core Dependencies**

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "puppeteer": "^23.0.0",
    "crawlee": "^3.0.0",
    "cheerio": "^1.0.0",
    "turndown": "^7.0.0",
    "@mozilla/readability": "^0.5.0",
    "ai": "^4.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "bun-types": "^1.0.0"
  }
}
```

### **Browser Engine**

- **Puppeteer**: Headless Chrome automation
- **Stealth Plugin**: Anti-detection capabilities
- **Profile Management**: Local browser profile storage

### **Content Processing**

- **Readability.js**: Mozilla's content extraction algorithm
- **Turndown**: HTML to Markdown conversion
- **Cheerio**: Server-side jQuery for HTML parsing

### **AI Integration**

- **OpenCode AI Providers**: Direct access to Claude, GPT, etc.
- **Intelligent Extraction**: AI-powered content understanding
- **Smart Crawling**: AI-guided link following

## 📋 **Development Phases**

### **Phase 1: Foundation** (Days 1-7)

- [x] Create project structure
- [ ] Set up MCP server
- [ ] Implement browser manager
- [ ] Basic tool registration
- [ ] Integration with OpenCode

### **Phase 2: Core Tools** (Days 8-14)

- [ ] `scrape_webpage` - Basic + AI-enhanced
- [ ] `extract_structured_data` - AI-powered
- [ ] `search_web` - DuckDuckGo integration
- [ ] Profile management tools

### **Phase 3: Advanced Features** (Days 15-21)

- [ ] `crawl_webpages` - Intelligent crawling
- [ ] `browser_automation` - Puppeteer automation
- [ ] Stealth mode and anti-detection
- [ ] Performance optimization

### **Phase 4: Polish & Integration** (Days 22-28)

- [ ] Comprehensive testing
- [ ] Documentation completion
- [ ] OpenCode integration testing
- [ ] PR preparation

## 🎯 **Key Implementation Details**

### **1. MCP Server Setup**

```typescript
// packages/openbrowser/src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

const server = new McpServer(
  {
    name: "openbrowser",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
)

// Register all tools
server.tool(
  "scrape_webpage",
  "AI-enhanced web scraping",
  scrapeWebpageSchema,
  scrapeWebpage,
)
server.tool(
  "crawl_webpages",
  "Intelligent multi-page crawling",
  crawlWebpagesSchema,
  crawlWebpages,
)
server.tool(
  "extract_structured_data",
  "AI-powered data extraction",
  extractStructuredDataSchema,
  extractStructuredData,
)
server.tool("search_web", "Free web search", searchWebSchema, searchWeb)
server.tool(
  "browser_automation",
  "Browser automation",
  browserAutomationSchema,
  browserAutomation,
)
server.tool(
  "create_profile",
  "Create browser profile",
  createProfileSchema,
  createProfile,
)
server.tool(
  "delete_profile",
  "Delete browser profile",
  deleteProfileSchema,
  deleteProfile,
)
server.tool(
  "list_profiles",
  "List browser profiles",
  listProfilesSchema,
  listProfiles,
)

const transport = new StdioServerTransport()
await server.connect(transport)
```

### **2. AI-Enhanced Scraping**

```typescript
// packages/openbrowser/src/tools/scrape.ts
export async function scrapeWebpage(params: ScrapeWebpageParams) {
  const browser = await BrowserManager.getBrowser(params.profileId)
  const page = await browser.newPage()

  // Configure stealth mode
  await StealthMode.configure(page)

  // Navigate and extract
  await page.goto(params.url, { waitUntil: "networkidle0" })
  const html = await page.content()

  // Basic content extraction
  const readableContent = await ContentExtractor.extract(html)
  const markdown = MarkdownConverter.convert(readableContent)

  // AI enhancement if requested
  let aiResult = markdown
  if (params.aiEnhanced) {
    aiResult = await AIEnhancer.extractIntelligent(html, params.intent)
  }

  // Screenshot if requested
  let screenshot = null
  if (params.includeScreenshot) {
    screenshot = await page.screenshot({ encoding: "base64" })
  }

  return {
    content: [
      {
        type: "text",
        text: aiResult,
      },
    ],
    metadata: {
      url: params.url,
      title: await page.title(),
      screenshot: screenshot,
      aiEnhanced: params.aiEnhanced,
    },
  }
}
```

### **3. AI Provider Integration**

```typescript
// packages/openbrowser/src/ai/enhancer.ts
import { generateText } from "ai"

export class AIEnhancer {
  static async extractIntelligent(html: string, intent?: string) {
    // Access OpenCode's AI providers directly
    const model = await getOpenCodeAIModel()

    const result = await generateText({
      model: model.language,
      messages: [
        {
          role: "user",
          content: `Extract relevant information${intent ? ` for: "${intent}"` : ""} 
        from this HTML content. Return clean, structured data:
        
        ${html.substring(0, 50000)}`, // Limit content size
        },
      ],
      maxTokens: 4000,
    })

    return result.text
  }

  static async extractStructured(html: string, schema: any) {
    const model = await getOpenCodeAIModel()

    const result = await generateText({
      model: model.language,
      messages: [
        {
          role: "user",
          content: `Extract data matching this exact schema: ${JSON.stringify(schema)}
        From this HTML: ${html.substring(0, 30000)}
        Return valid JSON only, no explanations.`,
        },
      ],
      maxTokens: 2000,
    })

    try {
      return JSON.parse(result.text)
    } catch (e) {
      throw new Error(`Failed to parse AI response as JSON: ${result.text}`)
    }
  }
}
```

### **4. OpenCode Integration**

```json
// Add to opencode.json
{
  "mcp": {
    "openbrowser": {
      "type": "local",
      "command": ["bun", "run", "./packages/openbrowser/src/server.ts"],
      "enabled": true,
      "environment": {
        "OPENCODE_AI_ACCESS": "true",
        "OPENBROWSER_PROFILES_DIR": "~/.openbrowser/profiles"
      }
    }
  }
}
```

## 🚀 **Competitive Advantages**

### **vs HyperBrowser**

| Feature            | HyperBrowser      | OpenBrowser           | Advantage   |
| ------------------ | ----------------- | --------------------- | ----------- |
| **Cost**           | Paid API          | 100% Free             | ✅ Free     |
| **AI Integration** | Basic             | Native AI enhancement | ✅ Smarter  |
| **Customization**  | Limited           | Full control          | ✅ Flexible |
| **Integration**    | External service  | Native OpenCode tool  | ✅ Seamless |
| **Performance**    | Network dependent | Local processing      | ✅ Faster   |
| **Privacy**        | Data sent to API  | Local processing      | ✅ Private  |

### **Unique Features**

1. **AI-Native Design**: Every tool enhanced with AI understanding
2. **Intent-Based Processing**: AI adapts to user's specific needs
3. **Context Awareness**: Understands current OpenCode project context
4. **Workflow Integration**: Seamlessly chains with other OpenCode tools
5. **Zero Cost**: No API fees, usage limits, or vendor lock-in

## 📝 **Development Checkpoints**

### **Checkpoint 1: Foundation Complete** (Day 7)

- [ ] MCP server running
- [ ] Browser manager functional
- [ ] Basic tool registration
- [ ] OpenCode integration working

### **Checkpoint 2: Core Tools Complete** (Day 14)

- [ ] `scrape_webpage` working with AI enhancement
- [ ] `extract_structured_data` with AI parsing
- [ ] `search_web` with DuckDuckGo
- [ ] Profile management functional

### **Checkpoint 3: Advanced Features Complete** (Day 21)

- [ ] `crawl_webpages` with intelligent guidance
- [ ] Browser automation working
- [ ] Stealth mode implemented
- [ ] Performance optimized

### **Checkpoint 4: Production Ready** (Day 28)

- [ ] All tests passing
- [ ] Documentation complete
- [ ] OpenCode integration tested
- [ ] Ready for PR submission

## 🔧 **Development Commands**

```bash
# Start development
cd packages/openbrowser
bun install
bun run dev

# Test with OpenCode
cd /Users/Jacob/Desktop/opencode-enhanced
./opencode-dev-launcher.sh

# Run specific tool tests
bun test scrape
bun test crawl
bun test extract

# Build for production
bun run build

# Lint and format
bun run lint
bun run format
```

## 🎯 **Success Metrics**

### **Technical Goals**

- [ ] 100% HyperBrowser feature parity
- [ ] AI enhancement for all tools
- [ ] Sub-second response times
- [ ] Zero external API dependencies
- [ ] 100% TypeScript coverage

### **User Experience Goals**

- [ ] Seamless OpenCode integration
- [ ] Intuitive tool usage
- [ ] Comprehensive documentation
- [ ] Error handling and recovery
- [ ] Performance monitoring

### **Community Impact Goals**

- [ ] Open-source alternative to paid service
- [ ] Reusable components for other projects
- [ ] Educational value for MCP development
- [ ] Contribution to OpenCode ecosystem

## 🚨 **Critical Implementation Notes**

### **AI Provider Access**

- **CONFIRMED**: OpenCode provides direct access to AI providers
- **Location**: `packages/opencode/src/session/index.ts:402-485`
- **Usage**: Tools can call AI models directly via session context
- **Models**: Claude, GPT, Google, GitHub Copilot

### **MCP Integration Pattern**

- **CONFIRMED**: Exact same pattern as existing MCP tools
- **Location**: `packages/opencode/src/mcp/index.ts`
- **Transport**: Stdio for local servers
- **Tool Naming**: `{clientName}_{toolName}` format

### **Tool Definition Pattern**

- **CONFIRMED**: Same as WebFetch tool
- **Location**: `packages/opencode/src/tool/webfetch.ts`
- **Schema**: Zod validation
- **Return**: `{ output: string, metadata: object }`

## 📚 **Reference Documentation**

### **Key Files to Study**

1. `packages/opencode/src/tool/webfetch.ts` - Tool implementation pattern
2. `packages/opencode/src/mcp/index.ts` - MCP integration
3. `packages/opencode/src/session/index.ts` - AI provider access
4. `packages/opencode/src/provider/provider.ts` - Provider system

### **External References**

1. [HyperBrowser MCP Source](https://github.com/hyperbrowserai/mcp)
2. [Model Context Protocol Docs](https://modelcontextprotocol.io/)
3. [Puppeteer Documentation](https://pptr.dev/)
4. [Crawlee Documentation](https://crawlee.dev/)

---

**Last Updated**: Development branch created, ready to begin implementation
**Next Step**: Initialize project structure and dependencies
