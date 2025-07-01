import { Readability } from "@mozilla/readability"
import TurndownService from "turndown"
import { JSDOM } from "jsdom"
import type { ExtractedContent } from "../types.js"

export class ContentExtractor {
  private static turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  })

  static async extract(html: string, url?: string): Promise<ExtractedContent> {
    // Parse HTML with jsdom
    const dom = new JSDOM(html, { url })
    const document = dom.window.document

    // Use Readability to extract main content
    const reader = new Readability(document)
    const article = reader.parse()

    if (!article) {
      throw new Error("Failed to extract content from page")
    }

    // Convert to markdown
    const markdown = this.turndownService.turndown(article.content)

    // Extract links
    const links = Array.from(document.querySelectorAll("a[href]"))
      .map((a) => ({
        url: (a as HTMLAnchorElement).href,
        text: (a as HTMLAnchorElement).textContent || "",
      }))
      .filter((link) => link.url && !link.url.startsWith("#"))

    // Extract images
    const images = Array.from(document.querySelectorAll("img[src]"))
      .map((img) => ({
        url: (img as HTMLImageElement).src,
        alt: (img as HTMLImageElement).alt || "",
      }))
      .filter((img) => img.url)

    // Extract metadata
    const getMetaContent = (name: string): string | undefined => {
      const meta = document.querySelector(
        `meta[name="${name}"], meta[property="${name}"]`,
      )
      return meta?.getAttribute("content") || undefined
    }

    const metadata: ExtractedContent["metadata"] = {}

    const description =
      getMetaContent("description") ||
      getMetaContent("og:description") ||
      getMetaContent("twitter:description")
    if (description) metadata.description = description

    const keywordsStr = getMetaContent("keywords")
    if (keywordsStr)
      metadata.keywords = keywordsStr.split(",").map((k) => k.trim())

    const author = getMetaContent("author") || getMetaContent("article:author")
    if (author) metadata.author = author

    const publishedTime =
      getMetaContent("article:published_time") ||
      getMetaContent("datePublished")
    if (publishedTime) metadata.publishedTime = publishedTime

    return {
      title: article.title || document.title || "",
      content: article.textContent || "",
      markdown,
      links,
      images,
      metadata,
    }
  }

  static async extractSimple(html: string): Promise<string> {
    // Simple extraction without Readability
    const dom = new JSDOM(html)
    const document = dom.window.document

    // Remove script and style elements
    const scripts = document.querySelectorAll("script, style")
    scripts.forEach((el) => el.remove())

    // Get body content
    const body = document.body || document.documentElement
    return this.turndownService.turndown(body.innerHTML)
  }
}
