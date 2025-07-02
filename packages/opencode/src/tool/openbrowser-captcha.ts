import { z } from "zod"
import { Tool } from "./tool"

// Pro tools that detect CAPTCHAs and guide users to the chat-based solving flow
// These tools enhance the basic browser tools with CAPTCHA detection

// Helper to call browser server
async function callBrowserServer(method: string, params: any): Promise<any> {
  const browserUrl = `http://localhost:9876`

  const response = await fetch(browserUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method,
      params,
    }),
  })

  if (!response.ok) {
    throw new Error(`Browser server error: ${response.statusText}`)
  }

  return response.json()
}

// Enhanced automation with CAPTCHA detection (Pro/Max feature)
export const OpenBrowserAutomateProTool = Tool.define({
  id: "openbrowser_automate_pro",
  description: `Advanced browser automation with CAPTCHA detection
- Detects CAPTCHAs and guides you through the chat-based solving flow
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
    profileId: z.string().optional().describe("Browser profile to use"),
  }),
  async execute(params, _ctx): Promise<{ output: string; metadata: any }> {
    try {
      const profileId = params.profileId || "default"
      const result = await callBrowserServer("automate_pro", {
        ...params,
        profileId,
        solveCaptchas: false, // We don't auto-solve, we guide to chat flow
      })

      // Check if CAPTCHA was detected during automation
      if (result.data?.captchaDetected) {
        const completedActions = result.data.actionsCompleted || 0
        return {
          output: `🛑 CAPTCHA detected during automation!

Actions completed before CAPTCHA: ${completedActions}/${params.actions.length}

To solve the CAPTCHA and continue:
1. Run: openbrowser_get_captcha --url "${result.data.currentUrl || params.url}" --profileId "${profileId}"
2. I'll analyze the CAPTCHA image
3. Run: openbrowser_apply_captcha_solution with my solution
4. Resume automation with remaining actions

Profile ID: ${profileId} (use this for all commands)`,
          metadata: {
            title: "Automation Paused - CAPTCHA Detected",
            url: result.data.currentUrl || params.url,
            profileId,
            captchaDetected: true,
            actionsCompleted: completedActions,
            totalActions: params.actions.length,
            remainingActions: params.actions.slice(completedActions),
          },
        }
      }

      // Success - no CAPTCHA encountered
      return {
        output: `Automation completed successfully:\n${
          result.data.actions
            ?.map(
              (a: any) =>
                `- ${a.type}: ${a.success ? "✓" : "✗"} ${a.message || ""}`,
            )
            .join("\n") || "No actions performed"
        }\n\nFinal URL: ${result.data.finalUrl || params.url}`,
        metadata: {
          title: "Pro Browser Automation Complete",
          url: result.data.finalUrl || params.url,
          profileId,
          actionsPerformed: result.data.actions?.length || 0,
          success: result.data.actions?.every((a: any) => a.success) || false,
          captchaDetected: false,
        },
      }
    } catch (error: any) {
      return {
        output: `Automation failed: ${error.message}`,
        metadata: {
          title: "Pro Browser Automation Failed",
          error: error.message,
          url: params.url,
          profileId: params.profileId || "default",
        },
      }
    }
  },
})

// Enhanced scraping with CAPTCHA detection
export const OpenBrowserScrapeProTool = Tool.define({
  id: "openbrowser_scrape_pro",
  description: `Advanced web scraping with CAPTCHA detection
- Detects CAPTCHAs and guides you through the chat-based solving flow
- Pro/Max exclusive feature`,
  parameters: z.object({
    url: z.string().describe("The URL to scrape"),
    format: z.enum(["markdown", "html", "text"]).default("markdown"),
    includeScreenshot: z.boolean().default(false),
    waitForSelector: z.string().optional().describe("CSS selector to wait for"),
    profileId: z.string().optional().describe("Browser profile to use"),
  }),
  async execute(params, _ctx): Promise<{ output: string; metadata: any }> {
    try {
      const profileId = params.profileId || "default"
      const result = await callBrowserServer("scrape_pro", {
        ...params,
        profileId,
        solveCaptchas: false, // We don't auto-solve, we guide to chat flow
      })

      // Check if CAPTCHA was detected
      if (result.data?.captchaDetected) {
        return {
          output: `🛑 CAPTCHA detected on ${params.url}!

To solve the CAPTCHA and scrape the page:
1. Run: openbrowser_get_captcha --url "${params.url}" --profileId "${profileId}"
2. I'll analyze the CAPTCHA image
3. Run: openbrowser_apply_captcha_solution with my solution
4. Retry this scrape with --profileId "${profileId}"

Profile ID: ${profileId} (use this for all commands)`,
          metadata: {
            title: "Scraping Blocked - CAPTCHA Detected",
            url: params.url,
            profileId,
            captchaDetected: true,
            format: params.format,
          },
        }
      }

      // Success - no CAPTCHA
      return {
        output: result.data?.content || "Page scraped successfully",
        metadata: {
          title: result.data?.title || "Pro Web Scrape Complete",
          url: params.url,
          profileId,
          format: params.format,
          captchaDetected: false,
          links: result.data?.links?.length || 0,
          images: result.data?.images?.length || 0,
          screenshot: params.includeScreenshot ? "included" : "not included",
        },
      }
    } catch (error: any) {
      return {
        output: `Scraping failed: ${error.message}`,
        metadata: {
          title: "Pro Scraping Failed",
          url: params.url,
          profileId: params.profileId || "default",
          error: error.message,
        },
      }
    }
  },
})
