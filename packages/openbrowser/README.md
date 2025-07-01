# 🚀 OpenBrowser MCP

**Free, open-source alternative to HyperBrowser MCP with AI enhancement**

OpenBrowser is a Model Context Protocol (MCP) server that provides advanced web scraping, crawling, and browser automation capabilities. Unlike paid alternatives, OpenBrowser is completely free and integrates seamlessly with OpenCode Enhanced.

## ✨ Features

### 🌐 **Web Scraping & Crawling**

- **AI-Enhanced Scraping**: Intelligent content extraction with AI understanding
- **Multi-Page Crawling**: Smart crawling with AI-guided navigation
- **Content Cleaning**: Mozilla Readability algorithm for clean content
- **Multiple Formats**: Markdown, HTML, and plain text output

### 🧠 **AI-Powered Extraction**

- **Structured Data Extraction**: AI converts HTML to JSON schemas
- **Intent-Based Processing**: AI adapts to your specific needs
- **Smart Content Analysis**: AI understands context and relevance
- **Intelligent Summarization**: AI-powered content summaries

### 🔍 **Web Search**

- **Free Search**: DuckDuckGo integration (no API keys required)
- **Multiple Regions**: Global search capabilities
- **Safe Search**: Configurable content filtering
- **Rich Results**: Structured search results

### 🤖 **Browser Automation**

- **Headless Automation**: Puppeteer-powered browser control
- **Custom Actions**: Click, type, scroll, screenshot
- **Profile Management**: Persistent browser profiles
- **Stealth Mode**: Anti-detection capabilities

## 🚀 Quick Start

### Installation

```bash
cd packages/openbrowser
bun install
```

### Development

```bash
# Start development server
bun run dev

# Build for production
bun run build

# Run tests
bun test
```

### Integration with OpenCode

Add to your `opencode.json`:

```json
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

## 🛠️ Tools

### `scrape_webpage`

Extract content from any webpage with optional AI enhancement.

```typescript
// Basic scraping
scrape_webpage({
  url: "https://example.com",
  format: "markdown",
})

// AI-enhanced scraping
scrape_webpage({
  url: "https://news.com",
  aiEnhanced: true,
  intent: "extract article headlines and summaries",
})
```

### `crawl_webpages`

Crawl multiple linked pages with intelligent guidance.

```typescript
crawl_webpages({
  startUrl: "https://docs.example.com",
  maxPages: 20,
  aiGuided: true,
  intent: "find API documentation",
})
```

### `extract_structured_data`

Extract structured data using AI-powered parsing.

```typescript
extract_structured_data({
  url: "https://products.com",
  schema: {
    name: "string",
    price: "number",
    description: "string",
  },
})
```

### `search_web`

Search the web using DuckDuckGo.

```typescript
search_web({
  query: "OpenCode Enhanced features",
  maxResults: 10,
})
```

### `browser_automation`

Perform automated browser actions.

```typescript
browser_automation({
  url: "https://example.com",
  actions: [
    { type: "click", selector: "#login-button" },
    { type: "type", selector: "#username", text: "user" },
    { type: "screenshot" },
  ],
})
```

### Profile Management

- `create_profile` - Create persistent browser profiles
- `delete_profile` - Remove browser profiles
- `list_profiles` - List all available profiles

## 🎯 Advantages over HyperBrowser

| Feature            | HyperBrowser      | OpenBrowser           |
| ------------------ | ----------------- | --------------------- |
| **Cost**           | Paid API          | 100% Free             |
| **AI Integration** | Basic             | Native AI enhancement |
| **Customization**  | Limited           | Full source control   |
| **Privacy**        | Data sent to API  | Local processing      |
| **Integration**    | External service  | Native OpenCode tool  |
| **Performance**    | Network dependent | Local optimization    |

## 🏗️ Architecture

```
OpenBrowser MCP Server
├── Tools Layer
│   ├── scrape_webpage
│   ├── crawl_webpages
│   ├── extract_structured_data
│   ├── search_web
│   ├── browser_automation
│   └── profile_management
├── Browser Layer
│   ├── Puppeteer Engine
│   ├── Stealth Mode
│   ├── Profile Manager
│   └── Session Manager
├── AI Layer
│   ├── Content Enhancer
│   ├── Structure Extractor
│   ├── Intent Analyzer
│   └── Smart Crawler
└── Utils Layer
    ├── Content Processor
    ├── Markdown Converter
    ├── Validation
    └── Error Handling
```

## 🔧 Development

### Project Structure

```
src/
├── server.ts              # MCP server entry point
├── types.ts               # TypeScript definitions
├── tools/                 # Tool implementations
│   ├── scrape.ts
│   ├── crawl.ts
│   ├── extract.ts
│   ├── search.ts
│   ├── automation.ts
│   └── profiles.ts
├── browser/               # Browser management
│   ├── manager.ts
│   ├── stealth.ts
│   └── profiles.ts
├── ai/                    # AI integration
│   ├── enhancer.ts
│   ├── extractor.ts
│   └── analyzer.ts
└── utils/                 # Utilities
    ├── content.ts
    ├── markdown.ts
    └── validation.ts
```

### Technology Stack

- **MCP SDK**: Model Context Protocol integration
- **Puppeteer**: Headless browser automation
- **Crawlee**: Advanced web crawling framework
- **Cheerio**: Server-side HTML parsing
- **Readability**: Content extraction algorithm
- **Turndown**: HTML to Markdown conversion
- **AI SDK**: AI provider integration

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests.

## 🔗 Links

- [OpenCode Enhanced](https://github.com/sst/opencode)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Development Guide](./DEVELOPMENT.md)
