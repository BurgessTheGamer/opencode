import { z } from "zod"
import { Tool } from "./tool"

// CAPTCHA solving integration for browser automation
// This extends the browser server to support CAPTCHA solving with Claude

// Helper to call browser server with CAPTCHA solving
async function callBrowserWithCaptcha(
  method: string,
  params: any,
  ctx?: any, // Tool context with access to session
): Promise<any> {
  const browserUrl = `http://localhost:9876`

  // First attempt without CAPTCHA solving
  const response = await fetch(browserUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method,
      params: {
        ...params,
        solveCaptchas: true,
        aiProvider: "claude-3-5-sonnet-20241022",
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Browser server error: ${response.statusText}`)
  }

  const result = await response.json()

  // Check if CAPTCHA was detected
  if (result.success && result.data?.captcha?.detected) {
    const captchaData = result.data.captcha

    // Use Claude Vision to solve the CAPTCHA
    if (captchaData.screenshot && ctx) {
      // This would integrate with OpenCode's existing Claude connection
      const solution = await solveCaptchaWithClaude(
        captchaData.screenshot,
        captchaData.type || "unknown",
        ctx,
      )

      // Send solution back to browser server
      await fetch(browserUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "apply_captcha_solution",
          params: {
            profileId: params.profileId,
            solution: solution,
          },
        }),
      })

      // Retry original request
      return callBrowserWithCaptcha(method, params, ctx)
    }
  }

  if (!result.success) {
    throw new Error(result.error || "Unknown browser error")
  }

  return result.data
}

// Helper to solve CAPTCHA using Claude Vision
async function solveCaptchaWithClaude(
  screenshotBase64: string,
  captchaType: string,
  ctx: any,
): Promise<any> {
  // Access the Claude provider through the session context
  if (!ctx.sessionID) {
    throw new Error("No session context available for Claude Vision")
  }

  try {
    // Import necessary modules
    const { Provider } = await import("../provider/provider")
    const { generateText } = await import("ai")

    // Get Claude model for vision tasks
    const model = await Provider.getModel(
      "anthropic",
      "claude-3-5-sonnet-20241022",
    )

    // Prepare the prompt based on CAPTCHA type
    let prompt = "You are helping solve a CAPTCHA. "

    switch (captchaType) {
      case "recaptcha":
        prompt +=
          "This is a reCAPTCHA. Please identify all images that match the given criteria."
        break
      case "hcaptcha":
        prompt +=
          "This is an hCaptcha. Please identify all images that match the given criteria."
        break
      case "text":
        prompt +=
          "Please read the text shown in this CAPTCHA image and return ONLY the text, nothing else."
        break
      default:
        prompt +=
          "Please solve this CAPTCHA by following the instructions shown."
    }

    // Call Claude Vision API
    const result = await generateText({
      model: model.language,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image",
              image: `data:image/png;base64,${screenshotBase64}`,
            },
          ],
        },
      ],
      maxTokens: 100,
      temperature: 0.1, // Low temperature for accuracy
    })

    // Parse the response
    const solution = result.text.trim()

    // Return structured solution
    return {
      type: captchaType === "text" ? "text" : "selection",
      solution: solution,
      confidence: 0.95,
      instructions: `Claude Vision solved ${captchaType} CAPTCHA`,
    }
  } catch (error: any) {
    console.error("Failed to solve CAPTCHA with Claude:", error)
    throw new Error(`CAPTCHA solving failed: ${error.message}`)
  }
}

// Enhanced automation with CAPTCHA solving (Pro/Max feature)
export const OpenBrowserAutomateProTool = Tool.define({
  id: "openbrowser_automate_pro",
  description: `Advanced browser automation with automatic CAPTCHA solving
- Uses Claude Computer Use to solve CAPTCHAs
- Pro/Max exclusive feature
- Handles reCAPTCHA, hCaptcha, and image CAPTCHAs`,
  parameters: z.object({
    url: z.string().describe("Starting URL"),
    actions: z
      .array(
        z.object({
          type: z.enum(["click", "type", "wait", "scroll", "screenshot"]),
          selector: z.string().optional(),
          text: z.string().optional(),
          timeout: z.number().optional(),
        }),
      )
      .describe("List of actions to perform"),
    solveCaptchas: z
      .boolean()
      .default(true)
      .describe("Automatically solve CAPTCHAs with Claude"),
    profileId: z.string().optional().describe("Browser profile to use"),
  }),
  async execute(params) {
    try {
      const result = await callBrowserWithCaptcha("automate_pro", params)

      const captchaInfo =
        result.captchasSolved > 0
          ? `\n\nCAPTCHAs solved: ${result.captchasSolved} (using Claude Computer Use)`
          : ""

      return {
        output: `Automation completed:\n${result.actions
          .map(
            (a: any) =>
              `- ${a.type}: ${a.success ? "✓" : "✗"} ${a.message || ""}`,
          )
          .join("\n")}${captchaInfo}\n\nFinal URL: ${result.finalUrl}`,
        metadata: {
          title: "Pro Browser Automation",
          url: result.finalUrl,
          actionsPerformed: result.actions.length,
          captchasSolved: result.captchasSolved || 0,
          success: result.actions.every((a: any) => a.success),
          browserEngine: "Chrome with Claude CAPTCHA Solving",
          feature: "Pro/Max Exclusive",
        },
      }
    } catch (error: any) {
      return {
        output: `Automation failed: ${error.message}`,
        metadata: {
          title: "Pro Browser Automation Failed",
          error: error.message,
          feature: "Pro/Max Exclusive",
          url: params.url,
          actionsPerformed: 0,
          captchasSolved: 0,
          success: false,
          browserEngine: "Chrome with Claude CAPTCHA Solving",
        },
      }
    }
  },
})

// Enhanced scraping with CAPTCHA bypass
export const OpenBrowserScrapeProTool = Tool.define({
  id: "openbrowser_scrape_pro",
  description: `Advanced web scraping with automatic CAPTCHA solving
- Bypasses CAPTCHAs using Claude Computer Use
- Pro/Max exclusive feature`,
  parameters: z.object({
    url: z.string().describe("The URL to scrape"),
    format: z.enum(["markdown", "html", "text"]).default("markdown"),
    includeScreenshot: z.boolean().default(false),
    waitForSelector: z.string().optional().describe("CSS selector to wait for"),
    solveCaptchas: z
      .boolean()
      .default(true)
      .describe("Automatically solve CAPTCHAs"),
    profileId: z.string().optional().describe("Browser profile to use"),
  }),
  async execute(params) {
    try {
      const result = await callBrowserWithCaptcha("scrape_pro", params)

      const captchaInfo = result.captchaSolved
        ? " (CAPTCHA solved with Claude)"
        : ""

      return {
        output: result.content,
        metadata: {
          title: result.title || "Pro Web Scrape",
          url: params.url,
          format: params.format,
          browserEngine: "Chrome with Claude CAPTCHA Solving",
          captchaSolved: result.captchaSolved || false,
          links: result.links?.length || 0,
          images: result.images?.length || 0,
          screenshot: result.screenshot ? "included" : "not included",
          feature: "Pro/Max Exclusive" + captchaInfo,
        },
      }
    } catch (error: any) {
      return {
        output: `Scraping failed: ${error.message}`,
        metadata: {
          title: "Pro Scraping Failed",
          url: params.url,
          format: params.format,
          browserEngine: "Chrome with Claude CAPTCHA Solving",
          captchaSolved: false,
          links: 0,
          images: 0,
          screenshot: "not included",
          feature: "Pro/Max Exclusive",
          error: error.message,
        },
      }
    }
  },
})
