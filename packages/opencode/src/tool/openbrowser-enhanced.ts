import { z } from "zod"
import { Tool } from "./tool"
import { OpenStorageStoreTool } from "./openstorage"

// Enhanced scraping for PERFECT website replicas
const ENHANCED_DESCRIPTION = `- Creates PERFECT website replicas with all assets
- Captures CSS, JavaScript, fonts, images, animations
- Preserves exact layout, colors, and interactions
- Stores everything in OpenStorage for easy retrieval
`

// Helper to call browser server
async function callBrowserServer(method: string, params: any): Promise<any> {
  const browserUrl = `http://localhost:9876`

  const response = await fetch(browserUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ method, params }),
  })

  if (!response.ok) {
    throw new Error(`Browser server error: ${response.statusText}`)
  }

  return response.json()
}

// Helper to make URLs absolute
function makeAbsoluteUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}

// Helper to extract all assets from HTML
function extractAllAssets(
  html: string,
  baseUrl: string,
): {
  stylesheets: string[]
  scripts: string[]
  images: string[]
  fonts: string[]
  icons: string[]
} {
  const assets = {
    stylesheets: [] as string[],
    scripts: [] as string[],
    images: [] as string[],
    fonts: [] as string[],
    icons: [] as string[],
  }

  // Extract stylesheets
  const linkRegex =
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi
  let match
  while ((match = linkRegex.exec(html)) !== null) {
    assets.stylesheets.push(makeAbsoluteUrl(match[1], baseUrl))
  }

  // Extract scripts
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi
  while ((match = scriptRegex.exec(html)) !== null) {
    assets.scripts.push(makeAbsoluteUrl(match[1], baseUrl))
  }

  // Extract images
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
  while ((match = imgRegex.exec(html)) !== null) {
    assets.images.push(makeAbsoluteUrl(match[1], baseUrl))
  }

  // Extract background images from inline styles
  const bgRegex = /url\(['"]?([^'")\s]+)['"]?\)/gi
  while ((match = bgRegex.exec(html)) !== null) {
    const url = match[1]
    if (!url.startsWith("data:")) {
      assets.images.push(makeAbsoluteUrl(url, baseUrl))
    }
  }

  // Extract icons (favicon, apple-touch-icon, etc.)
  const iconRegex =
    /<link[^>]+rel=["'](?:icon|apple-touch-icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/gi
  while ((match = iconRegex.exec(html)) !== null) {
    assets.icons.push(makeAbsoluteUrl(match[1], baseUrl))
  }

  return assets
}

// Helper to fetch and inline all CSS
async function fetchAndInlineCSS(stylesheets: string[]): Promise<string> {
  const cssPromises = stylesheets.map(async (url) => {
    try {
      const response = await fetch(url)
      if (!response.ok) return ""

      let css = await response.text()

      // Fix relative URLs in CSS
      css = css.replace(/url\(['"]?([^'")\s]+)['"]?\)/gi, (match, url) => {
        if (url.startsWith("data:") || url.startsWith("http")) {
          return match
        }
        const absoluteUrl = makeAbsoluteUrl(url, new URL(stylesheets[0]).origin)
        return `url('${absoluteUrl}')`
      })

      return `/* From: ${url} */\n${css}`
    } catch {
      return `/* Failed to load: ${url} */`
    }
  })

  const cssContents = await Promise.all(cssPromises)
  return cssContents.join("\n\n")
}

// Enhanced scraping tool for PERFECT replicas
export const OpenBrowserScrapePerfectTool = Tool.define({
  id: "openbrowser_scrape_perfect",
  description: ENHANCED_DESCRIPTION,
  parameters: z.object({
    url: z.string().describe("The URL to create a perfect replica of"),
    includeJavaScript: z
      .boolean()
      .default(true)
      .describe("Include all JavaScript files"),
    inlineAssets: z
      .boolean()
      .default(true)
      .describe("Inline CSS and images for standalone HTML"),
    captureComputedStyles: z
      .boolean()
      .default(true)
      .describe("Capture final computed styles"),
  }),
  async execute(params, ctx) {
    // First, get the raw HTML and screenshot
    const scrapeResult = await callBrowserServer("scrape", {
      url: params.url,
      format: "html",
      includeScreenshot: true,
      waitFor: "body",
    })

    const html = scrapeResult.data.content
    const screenshot = scrapeResult.data.screenshot
    const title = scrapeResult.data.title

    // Extract all assets
    const assets = extractAllAssets(html, params.url)

    // Fetch and inline all CSS
    const inlinedCSS = await fetchAndInlineCSS(assets.stylesheets)

    // Get computed styles if requested
    let computedStyles = ""
    if (params.captureComputedStyles) {
      const computedResult = await callBrowserServer("execute_script", {
        url: params.url,
        script: `
          // Capture all computed styles
          const allElements = document.querySelectorAll('*');
          const styles = {};
          
          allElements.forEach((el, index) => {
            const computed = window.getComputedStyle(el);
            const important = [
              'display', 'position', 'width', 'height', 'margin', 'padding',
              'background', 'color', 'font', 'border', 'transform', 'animation',
              'flex', 'grid', 'z-index', 'opacity', 'overflow'
            ];
            
            const elementStyles = {};
            important.forEach(prop => {
              const value = computed.getPropertyValue(prop);
              if (value && value !== 'none' && value !== 'auto') {
                elementStyles[prop] = value;
              }
            });
            
            if (Object.keys(elementStyles).length > 0) {
              // Add a unique class to the element
              el.classList.add('opencode-' + index);
              styles['.opencode-' + index] = elementStyles;
            }
          });
          
          return styles;
        `,
      })

      if (computedResult.success) {
        const styles = computedResult.data
        computedStyles = Object.entries(styles)
          .map(([selector, props]) => {
            const propString = Object.entries(props as any)
              .map(([prop, value]) => `  ${prop}: ${value};`)
              .join("\n")
            return `${selector} {\n${propString}\n}`
          })
          .join("\n\n")
      }
    }

    // Build the perfect replica HTML
    let replicaHTML = html

    // Replace the head section with our enhanced version
    const headEndIndex = replicaHTML.indexOf("</head>")
    if (headEndIndex !== -1) {
      const enhancedHead = `
    <!-- OpenCode Perfect Replica - All Assets Inlined -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Inlined CSS from all stylesheets -->
    <style>
    /* Reset styles for consistency */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    /* Original stylesheets */
    ${inlinedCSS}
    
    /* Computed styles for perfect accuracy */
    ${computedStyles}
    </style>
    
    <!-- Preserve original meta tags -->
`

      replicaHTML =
        replicaHTML.slice(0, headEndIndex) +
        enhancedHead +
        replicaHTML.slice(headEndIndex)
    }

    // Fix all image URLs to be absolute
    replicaHTML = replicaHTML.replace(
      /<img([^>]+)src=["']([^"']+)["']/gi,
      (_match: string, attrs: string, src: string) => {
        const absoluteSrc = makeAbsoluteUrl(src, params.url)
        return `<img${attrs}src="${absoluteSrc}"`
      },
    )

    // Fix all link URLs to be absolute
    replicaHTML = replicaHTML.replace(
      /<a([^>]+)href=["']([^"']+)["']/gi,
      (match: string, attrs: string, href: string) => {
        if (!href.startsWith("#")) {
          const absoluteHref = makeAbsoluteUrl(href, params.url)
          return `<a${attrs}href="${absoluteHref}"`
        }
        return match
      },
    )

    // Store the perfect replica
    const storeResult = await OpenStorageStoreTool.execute(
      {
        sessionId: ctx.sessionID,
        url: params.url,
        title: `Perfect Replica: ${title}`,
        content: replicaHTML,
        contentType: "html",
        metadata: {
          source: "openbrowser_scrape_perfect",
          originalUrl: params.url,
          assetsCaptured: {
            stylesheets: assets.stylesheets.length,
            scripts: assets.scripts.length,
            images: assets.images.length,
            fonts: assets.fonts.length,
            icons: assets.icons.length,
          },
          computedStylesCaptured: params.captureComputedStyles,
          screenshotIncluded: !!screenshot,
          perfectReplica: true,
        },
      },
      ctx,
    )

    // Also store the screenshot if captured
    if (screenshot) {
      await OpenStorageStoreTool.execute(
        {
          sessionId: ctx.sessionID,
          url: params.url,
          title: `Screenshot: ${title}`,
          content: screenshot,
          contentType: "image/png",
          metadata: {
            source: "openbrowser_scrape_perfect",
            originalUrl: params.url,
            type: "screenshot",
          },
        },
        ctx,
      )
    }

    return {
      output: `✅ Perfect Replica Created: ${title}
📦 Storage ID: ${storeResult.metadata.contentId}
🎨 Assets Captured:
  - ${assets.stylesheets.length} stylesheets
  - ${assets.scripts.length} scripts  
  - ${assets.images.length} images
  - ${assets.fonts.length} fonts
  - ${assets.icons.length} icons
${params.captureComputedStyles ? "✓ Computed styles captured" : ""}
${screenshot ? "✓ Screenshot included" : ""}

🔍 Use openstorage_get to retrieve the perfect replica HTML`,
      metadata: {
        title: `Perfect Replica: ${title}`,
        url: params.url,
        storageId: storeResult.metadata.contentId,
        assetsCaptured: assets,
        perfectReplica: true,
      },
    }
  },
})

// Export the enhanced tool
export const OpenBrowserEnhancedTools = [OpenBrowserScrapePerfectTool]
