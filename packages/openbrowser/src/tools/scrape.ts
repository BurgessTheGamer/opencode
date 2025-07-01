import type { ScrapeWebpageParams, ToolResult } from "../types.js"
import { BrowserManager } from "../browser/manager.js"
import { ContentExtractor } from "../browser/content.js"
import { AIEnhancer } from "../ai/enhancer.ts"

export async function scrapeWebpage(
  params: ScrapeWebpageParams,
): Promise<ToolResult> {
  let browser
  let page

  try {
    // Get browser instance
    browser = await BrowserManager.getBrowser(params.profileId)
    page = await BrowserManager.createPage(browser, params.profileId)

    // Navigate to URL
    await page.goto(params.url, {
      waitUntil: "networkidle0",
      timeout: params.timeout,
    })

    // Wait for specific selector if provided
    if (params.waitFor) {
      await page.waitForSelector(params.waitFor, { timeout: params.timeout })
    }

    // Get page content
    const html = await page.content()

    // Extract content based on format
    let content: string
    let extractedData

    if (params.format === "html") {
      content = html
    } else {
      // Extract readable content
      extractedData = await ContentExtractor.extract(html, params.url)
      content =
        params.format === "markdown"
          ? extractedData.markdown
          : extractedData.content
    }

    // Apply AI enhancement if requested
    if (params.aiEnhanced && params.intent) {
      content = await AIEnhancer.extractIntelligent(html, params.intent)
    }

    // Take screenshot if requested
    let screenshot
    if (params.includeScreenshot) {
      screenshot = await page.screenshot({
        encoding: "base64",
        fullPage: true,
      })
    }

    // Build response
    const result: ToolResult = {
      content: [
        {
          type: "text",
          text: content,
        },
      ],
    }

    if (screenshot) {
      result.content.push({
        type: "image",
        data: screenshot,
        mimeType: "image/png",
      })
    }

    return result
  } catch (error) {
    console.error("Error scraping webpage:", error)
    return {
      content: [
        {
          type: "text",
          text: `Error scraping ${params.url}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  } finally {
    // Clean up
    if (page) {
      await page.close().catch(() => {})
    }
  }
}
