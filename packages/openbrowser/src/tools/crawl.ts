import type { CrawlWebpagesParams, ToolResult, CrawlResult } from "../types.js"
import { BrowserManager } from "../browser/manager.js"
import { ContentExtractor } from "../browser/content.js"
import { AIEnhancer } from "../ai/enhancer.ts"

export async function crawlWebpages(
  params: CrawlWebpagesParams,
): Promise<ToolResult> {
  const visited = new Set<string>()
  const toVisit: Array<{ url: string; depth: number }> = [
    { url: params.startUrl, depth: 0 },
  ]
  const results: CrawlResult[] = []
  let browser
  let page

  try {
    browser = await BrowserManager.getBrowser(params.profileId)
    page = await BrowserManager.createPage(browser, params.profileId)

    while (toVisit.length > 0 && results.length < params.maxPages) {
      const current = toVisit.shift()
      if (
        !current ||
        visited.has(current.url) ||
        current.depth > params.maxDepth
      ) {
        continue
      }

      visited.add(current.url)

      try {
        // Navigate to page
        await page.goto(current.url, {
          waitUntil: "networkidle0",
          timeout: 30000,
        })

        // Extract content
        const html = await page.content()
        const extracted = await ContentExtractor.extract(html, current.url)

        // Create crawl result
        const result: CrawlResult = {
          url: current.url,
          title: extracted.title,
          content: extracted.content,
          links: extracted.links.map((l) => l.url),
          depth: current.depth,
          timestamp: new Date().toISOString(),
        }

        // Apply AI guidance if requested
        if (params.aiGuided && params.intent) {
          // Use AI to determine which links to follow
          const relevantLinks = await selectRelevantLinks(
            extracted.links,
            params.intent,
            current.url,
          )
          result.links = relevantLinks.map((l) => l.url)
        }

        results.push(result)

        // Add new links to crawl queue
        if (current.depth < params.maxDepth) {
          for (const link of result.links) {
            try {
              const linkUrl = new URL(link, current.url)

              // Check if URL matches include/exclude patterns
              if (params.includePatterns) {
                const matches = params.includePatterns.some((pattern) =>
                  linkUrl.href.includes(pattern),
                )
                if (!matches) continue
              }

              if (params.excludePatterns) {
                const excluded = params.excludePatterns.some((pattern) =>
                  linkUrl.href.includes(pattern),
                )
                if (excluded) continue
              }

              // Only crawl same domain by default
              const currentDomain = new URL(current.url).hostname
              if (
                linkUrl.hostname === currentDomain &&
                !visited.has(linkUrl.href)
              ) {
                toVisit.push({
                  url: linkUrl.href,
                  depth: current.depth + 1,
                })
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
      } catch (error) {
        results.push({
          url: current.url,
          title: "Error",
          content: "",
          links: [],
          depth: current.depth,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Format results
    const summary =
      `Crawled ${results.length} pages from ${params.startUrl}\n\n` +
      results
        .map(
          (r) =>
            `${r.depth > 0 ? "  ".repeat(r.depth) + "└─ " : ""}${r.title || r.url}\n` +
            `${r.depth > 0 ? "  ".repeat(r.depth + 1) : "  "}URL: ${r.url}\n` +
            (r.error
              ? `${r.depth > 0 ? "  ".repeat(r.depth + 1) : "  "}Error: ${r.error}\n`
              : ""),
        )
        .join("\n")

    return {
      content: [
        {
          type: "text",
          text: summary,
        },
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    }
  } catch (error) {
    console.error("Crawl error:", error)
    return {
      content: [
        {
          type: "text",
          text: `Error crawling pages: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  } finally {
    if (page) {
      await page.close().catch(() => {})
    }
  }
}

// Helper function to use AI for selecting relevant links
async function selectRelevantLinks(
  links: Array<{ url: string; text: string }>,
  intent: string,
  currentUrl: string,
): Promise<Array<{ url: string; text: string }>> {
  // For now, simple keyword matching
  // TODO: Integrate with AI provider for smarter selection
  const keywords = intent.toLowerCase().split(" ")

  return links
    .filter((link) => {
      const text = link.text.toLowerCase()
      const url = link.url.toLowerCase()
      return keywords.some(
        (keyword) => text.includes(keyword) || url.includes(keyword),
      )
    })
    .slice(0, 10) // Limit to top 10 relevant links
}
