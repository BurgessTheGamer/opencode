import type { SearchWebParams, ToolResult } from "../types.js"
import { BrowserManager } from "../browser/manager.js"

export async function searchWeb(params: SearchWebParams): Promise<ToolResult> {
  let browser
  let page

  try {
    // Use DuckDuckGo HTML version for easy scraping
    const searchUrl = new URL("https://html.duckduckgo.com/html/")
    searchUrl.searchParams.set("q", params.query)
    searchUrl.searchParams.set("kl", params.region)

    browser = await BrowserManager.getBrowser()
    page = await BrowserManager.createPage(browser)

    // Navigate to search results
    await page.goto(searchUrl.toString(), {
      waitUntil: "networkidle0",
      timeout: 30000,
    })

    // Extract search results
    const results = await page.evaluate((maxResults) => {
      const resultElements = document.querySelectorAll(".result")
      const searchResults = []

      for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
        const result = resultElements[i]
        if (!result) continue

        const titleElement = result.querySelector(".result__title a")
        const snippetElement = result.querySelector(".result__snippet")
        const urlElement = result.querySelector(".result__url")

        if (titleElement && snippetElement) {
          searchResults.push({
            title: titleElement.textContent?.trim() || "",
            url: (titleElement as HTMLAnchorElement).href || "",
            snippet: snippetElement.textContent?.trim() || "",
            displayUrl: urlElement?.textContent?.trim() || "",
          })
        }
      }
      return searchResults
    }, params.maxResults)

    // Format results as markdown
    const markdown = results
      .map(
        (result, index) =>
          `${index + 1}. **${result.title}**\n   ${result.displayUrl}\n   ${result.snippet}\n   [Link](${result.url})`,
      )
      .join("\n\n")

    return {
      content: [
        {
          type: "text",
          text: `Search results for "${params.query}":\n\n${markdown}`,
        },
      ],
    }
  } catch (error) {
    // Fallback to a simpler approach using fetch
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(params.query)}`
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      })

      if (!response.ok) {
        throw new Error(`Search failed with status: ${response.status}`)
      }

      const html = await response.text()

      // Simple regex extraction
      const results = []
      const resultRegex =
        /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/g
      let match
      let count = 0

      while (
        (match = resultRegex.exec(html)) !== null &&
        count < params.maxResults
      ) {
        results.push({
          title: match[2]?.trim() || "",
          url: match[1] || "",
          snippet: match[3]?.trim() || "",
        })
        count++
      }

      const markdown = results
        .map(
          (result, index) =>
            `${index + 1}. **${result.title}**\n   ${result.snippet}\n   [Link](${result.url})`,
        )
        .join("\n\n")

      return {
        content: [
          {
            type: "text",
            text: `Search results for "${params.query}":\n\n${markdown}`,
          },
        ],
      }
    } catch (fallbackError) {
      console.error("Fallback search also failed:", fallbackError)
      throw fallbackError
    }
  } finally {
    if (page) {
      await page.close().catch(() => {})
    }
  }
}
