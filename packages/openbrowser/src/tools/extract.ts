import type { ExtractStructuredDataParams, ToolResult } from "../types.js"
import { BrowserManager } from "../browser/manager.js"
import { AIEnhancer } from "../ai/enhancer.ts"
import * as cheerio from "cheerio"

export async function extractStructuredData(
  params: ExtractStructuredDataParams,
): Promise<ToolResult> {
  let browser
  let page
  let html: string

  try {
    // Get HTML content either from URL or provided HTML
    if (params.url) {
      browser = await BrowserManager.getBrowser(params.profileId)
      page = await BrowserManager.createPage(browser, params.profileId)

      await page.goto(params.url, {
        waitUntil: "networkidle0",
        timeout: 30000,
      })

      html = await page.content()

      // Take screenshot for AI to understand visual context
      const screenshot = await page.screenshot({
        encoding: "base64",
        fullPage: true,
      })

      // If AI-powered, use visual + HTML for better extraction
      if (params.aiPowered) {
        const extractedData = await AIEnhancer.extractStructured(
          html,
          params.schema,
        )

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(extractedData, null, 2),
            },
            {
              type: "image",
              data: screenshot,
              mimeType: "image/png",
            },
          ],
        }
      }
    } else if (params.html) {
      html = params.html
    } else {
      throw new Error("Either 'url' or 'html' parameter is required")
    }

    // Non-AI extraction using cheerio
    const $ = cheerio.load(html)
    const result: any = {}

    // Simple extraction based on schema structure
    for (const [key, value] of Object.entries(params.schema)) {
      if (typeof value === "string") {
        // Treat string values as CSS selectors
        const element = $(value as string).first()
        result[key] = element.text().trim() || element.attr("content") || ""
      } else if (typeof value === "object" && value !== null) {
        // Handle nested objects
        if (value.selector) {
          const elements = $(value.selector)
          if (value.multiple) {
            result[key] = elements
              .map((_, el) => {
                const $el = $(el)
                if (value.attribute) {
                  return $el.attr(value.attribute)
                }
                return $el.text().trim()
              })
              .get()
          } else {
            const $el = elements.first()
            result[key] = value.attribute
              ? $el.attr(value.attribute)
              : $el.text().trim()
          }
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  } catch (error) {
    console.error("Error extracting structured data:", error)
    return {
      content: [
        {
          type: "text",
          text: `Error extracting data: ${error instanceof Error ? error.message : String(error)}`,
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
