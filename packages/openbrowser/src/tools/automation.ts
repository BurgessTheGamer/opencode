import type { BrowserAutomationParams, ToolResult } from "../types.js"
import { BrowserManager } from "../browser/manager.js"

export async function browserAutomation(
  params: BrowserAutomationParams,
): Promise<ToolResult> {
  let browser
  let page
  const results: string[] = []
  const screenshots: string[] = []

  try {
    browser = await BrowserManager.getBrowser(params.profileId)
    page = await BrowserManager.createPage(browser, params.profileId)

    // Navigate to initial URL
    await page.goto(params.url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    })

    results.push(`Navigated to ${params.url}`)

    // Execute each action
    for (const action of params.actions) {
      try {
        switch (action.type) {
          case "click":
            if (!action.selector) {
              throw new Error("Click action requires a selector")
            }
            await page.waitForSelector(action.selector, {
              timeout: action.timeout || 5000,
            })
            await page.click(action.selector)
            results.push(`Clicked on ${action.selector}`)
            break

          case "type":
            if (!action.selector || !action.text) {
              throw new Error("Type action requires selector and text")
            }
            await page.waitForSelector(action.selector, {
              timeout: action.timeout || 5000,
            })
            await page.type(action.selector, action.text)
            results.push(`Typed "${action.text}" into ${action.selector}`)
            break

          case "wait":
            if (action.selector) {
              await page.waitForSelector(action.selector, {
                timeout: action.timeout || 30000,
              })
              results.push(`Waited for ${action.selector}`)
            } else if (action.timeout) {
              await new Promise((resolve) =>
                setTimeout(resolve, action.timeout),
              )
              results.push(`Waited for ${action.timeout}ms`)
            } else {
              throw new Error("Wait action requires selector or timeout")
            }
            break

          case "scroll":
            if (action.selector) {
              await page.evaluate((selector) => {
                const element = document.querySelector(selector)
                if (element) {
                  element.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
              }, action.selector)
              results.push(`Scrolled to ${action.selector}`)
            } else {
              // Scroll to bottom
              await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight)
              })
              results.push("Scrolled to bottom of page")
            }
            await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait for scroll to complete
            break

          case "screenshot":
            const screenshot = await page.screenshot({
              encoding: "base64",
              fullPage: action.selector ? false : true,
            })
            screenshots.push(screenshot)
            results.push("Captured screenshot")
            break

          default:
            results.push(`Unknown action type: ${action.type}`)
        }
      } catch (actionError) {
        const errorMsg =
          actionError instanceof Error
            ? actionError.message
            : String(actionError)
        results.push(`Error executing ${action.type}: ${errorMsg}`)
      }
    }

    // Get final page URL
    const finalUrl = page.url()

    // Build response
    const content: ToolResult["content"] = [
      {
        type: "text",
        text: `Browser automation completed:\n\n${results.join("\n")}\n\nFinal URL: ${finalUrl}`,
      },
    ]

    // Add screenshots
    for (const screenshot of screenshots) {
      content.push({
        type: "image",
        data: screenshot,
        mimeType: "image/png",
      })
    }

    return { content }
  } catch (error) {
    console.error("Browser automation error:", error)
    return {
      content: [
        {
          type: "text",
          text: `Error during browser automation: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  } finally {
    if (page && !params.headless) {
      // Keep browser open for debugging if not headless
      console.log("Browser kept open for debugging")
    } else if (page) {
      await page.close().catch(() => {})
    }
  }
}
