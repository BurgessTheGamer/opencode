# OpenBrowser + OpenStorage: Web Automation for OpenCode

## What We Built

We've added web automation and local storage capabilities to OpenCode through 17 new tools that work together seamlessly.

### 🌐 OpenBrowser (9 tools)

**Basic Web Tools**

- `openbrowser_scrape` - Extract web content as markdown
- `openbrowser_crawl` - Crawl multiple pages from a website
- `openbrowser_extract` - Extract specific data using CSS selectors
- `openbrowser_automate` - Click buttons, fill forms, interact with pages
- `openbrowser_screenshot` - Capture full-page screenshots

**Enhanced Tools**

- `openbrowser_scrape_pro` - Scraping with CAPTCHA detection
- `openbrowser_automate_pro` - Automation with enhanced reporting

**CAPTCHA Tools**

- `openbrowser_get_captcha` - Detect and capture CAPTCHAs
- `openbrowser_apply_captcha_solution` - Apply solutions to solve CAPTCHAs

### 💾 OpenStorage (8 tools)

**Content Management**

- `openstorage_store` - Save content with metadata
- `openstorage_get` - Retrieve content by ID
- `openstorage_search` - Search across all stored content

**Session Management**

- `openstorage_context` - View current session content
- `openstorage_session` - Create new sessions
- `openstorage_list_sessions` - List all sessions
- `openstorage_cleanup_session` - Clean up old content
- `openstorage_clear_all` - Reset storage completely

## How It Works

1. **Automatic Integration**: When you scrape a webpage, it's automatically stored and searchable
2. **Session-based**: Each OpenCode session has its own browser profile and storage context
3. **CAPTCHA Handling**: Pro tools can detect CAPTCHAs and use Claude Vision to solve them
4. **Local Storage**: Everything stays on your machine using SQLite

## Real Examples We Tested

### Example 1: Research Workflow

```javascript
// Scrape documentation
openbrowser_scrape("https://docs.anthropic.com/en/docs/about-claude/models")
// → Automatically stored with ID: ad64a603-113d-44bd-be4a-491f9fc62064

// Search existing knowledge
openstorage_search("Claude AI models")
// → Found 4 results across different sessions

// Extract specific data
openbrowser_extract(url, { pricing: "table", models: "code" })
// → Structured data: Claude Opus 4, Sonnet 4 pricing
```

### Example 2: Website Monitoring

```javascript
// Capture baseline
openbrowser_screenshot("https://opencode.ai")
// → 1920x941 screenshot stored

// Scrape content
openbrowser_scrape("https://opencode.ai")
// → 922 chars, 9 links, 5 images tracked

// Store monitoring report
openstorage_store(monitoring_data)
// → Ready for future comparison
```

### Example 3: CAPTCHA Solving

```javascript
// Detect CAPTCHA
openbrowser_get_captcha("https://www.google.com/recaptcha/api2/demo")
// → CAPTCHA detected and screenshot captured

// Apply solution
openbrowser_apply_captcha_solution({
  type: "recaptcha_v2",
  solution: "click_checkbox",
})
// → CAPTCHA solved successfully
```

## Testing Results

We tested all 17 tools across 6 real-world workflows:

**Tools**: 16/17 working (we removed 1 redundant tool)

- ✅ All basic web automation working
- ✅ CAPTCHA detection and solving functional
- ✅ Storage and search working perfectly
- ✅ Session management robust

**Workflows Tested**:

1. Documentation research (Anthropic docs)
2. Competitive analysis (Cursor.sh)
3. API documentation aggregation (GitHub)
4. Website monitoring (OpenCode.ai)
5. Form automation (HTTPBin)
6. Research archival (GitHub Copilot)

**Sites Successfully Tested**:

- Anthropic documentation
- Cursor.sh (AI editor)
- GitHub repositories
- Google reCAPTCHA demo
- HTTPBin forms
- OpenCode.ai

## Technical Details

- **Browser Engine**: Pure Go implementation (no Chrome dependency)
- **Storage**: SQLite with full-text search
- **Size**: ~20MB additional footprint
- **Platforms**: Windows, macOS, Linux, FreeBSD
- **Integration**: Works with all OpenCode AI providers

## Current Limitations

1. Some websites block automated access (expected behavior)
2. Complex image CAPTCHAs may need additional work
3. Error messages could be more consistent across tools

## Why This Matters

This gives OpenCode users the ability to:

- Research and extract information from any website
- Build knowledge bases from web content
- Automate repetitive web tasks
- Handle CAPTCHAs when needed
- Keep all data local and private

All of this happens within OpenCode's existing workflow, using the same AI providers and session management you're already familiar with.

---

_Built and tested by Jacob - July 2025_
