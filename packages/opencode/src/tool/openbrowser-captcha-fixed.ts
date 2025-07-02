import { z } from "zod"
import { Tool } from "./tool"

// Fixed CAPTCHA solving integration for browser automation
// This version properly integrates with OpenCode's session context

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

// Enhanced scraping with CAPTCHA detection (returns to chat for solving)
export const OpenBrowserScrapeProToolFixed = Tool.define({
  id: "openbrowser_scrape_pro",
  description: `Advanced web scraping with CAPTCHA detection
- Detects CAPTCHAs and returns them to chat for solving
- Pro/Max exclusive feature
- Works with the chat-based CAPTCHA solving flow`,
  parameters: z.object({
    url: z.string().describe("The URL to scrape"),
    format: z.enum(["markdown", "html", "text"]).default("markdown"),
    includeScreenshot: z.boolean().default(false),
    waitForSelector: z.string().optional().describe("CSS selector to wait for"),
    profileId: z.string().optional().describe("Browser profile to use"),
    retryWithProfile: z
      .string()
      .optional()
      .describe("Profile ID to retry with after CAPTCHA solving"),
  }),
  async execute(params) {
    try {
      // First attempt
      const result = await callBrowserServer("scrape", {
        url: params.url,
        format: params.format,
        includeScreenshot: params.includeScreenshot,
        waitForSelector: params.waitForSelector,
        profileId: params.profileId || params.retryWithProfile || "default",
      })

      // Check if CAPTCHA was detected
      if (result.data?.captcha?.detected) {
        const captchaData = result.data.captcha

        // Return CAPTCHA to chat for solving
        return {
          output: `CAPTCHA detected on ${params.url}!\n\nType: ${captchaData.type || "unknown"}\n\nPlease use the openbrowser_get_captcha tool to capture the CAPTCHA screenshot, then analyze it and apply the solution using openbrowser_apply_captcha_solution.\n\nProfile ID for this session: ${params.profileId || "default"}`,
          metadata: {
            title: "CAPTCHA Detected - Manual Solving Required",
            url: params.url,
            captchaDetected: true,
            captchaType: captchaData.type || "unknown",
            profileId: params.profileId || "default",
            requiresManualSolving: true,
            nextSteps: [
              "Use openbrowser_get_captcha to capture screenshot",
              "Analyze the CAPTCHA image",
              "Use openbrowser_apply_captcha_solution to apply solution",
              "Retry this scrape with the same profileId",
            ],
          },
        }
      }

      // Success - no CAPTCHA or already solved
      return {
        output: result.data?.content || "Page scraped successfully",
        metadata: {
          title: result.data?.title || "Web Scrape Successful",
          url: params.url,
          format: params.format,
          captchaDetected: false,
          profileId: params.profileId || "default",
          links: result.data?.links?.length || 0,
          images: result.data?.images?.length || 0,
          screenshot: params.includeScreenshot ? "included" : "not included",
        },
      }
    } catch (error: any) {
      return {
        output: `Scraping failed: ${error.message}`,
        metadata: {
          title: "Scraping Failed",
          url: params.url,
          error: error.message,
          profileId: params.profileId || "default",
        },
      }
    }
  },
})

// Enhanced automation with CAPTCHA detection
export const OpenBrowserAutomateProToolFixed = Tool.define({
  id: "openbrowser_automate_pro",
  description: `Advanced browser automation with CAPTCHA detection
- Detects CAPTCHAs during automation
- Returns to chat for manual solving
- Pro/Max exclusive feature`,
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
    stopOnCaptcha: z
      .boolean()
      .default(true)
      .describe("Stop automation if CAPTCHA detected"),
  }),
  async execute(params) {
    try {
      const result = await callBrowserServer("automate", {
        url: params.url,
        actions: params.actions,
        profileId: params.profileId || "default",
        detectCaptchas: true,
      })

      // Check if CAPTCHA was encountered
      if (result.data?.captchaDetected) {
        const completedActions = result.data.actionsCompleted || 0
        return {
          output: `Automation stopped - CAPTCHA detected after ${completedActions} actions!\n\nActions completed:\n${
            result.data.actions
              ?.slice(0, completedActions)
              .map((a: any) => `- ${a.type}: ✓ ${a.message || ""}`)
              .join("\n") || "None"
          }\n\nCAPTCHA detected at action ${completedActions + 1}.\n\nPlease:\n1. Use openbrowser_get_captcha with profileId "${params.profileId || "default"}"\n2. Solve the CAPTCHA\n3. Apply solution with openbrowser_apply_captcha_solution\n4. Resume automation with remaining actions`,
          metadata: {
            title: "Automation Paused - CAPTCHA Detected",
            url: result.data.currentUrl || params.url,
            captchaDetected: true,
            actionsCompleted: completedActions,
            totalActions: params.actions.length,
            profileId: params.profileId || "default",
            remainingActions: params.actions.slice(completedActions),
            requiresManualSolving: true,
          },
        }
      }

      // Success - all actions completed
      return {
        output: `Automation completed:\n${
          result.data.actions
            ?.map(
              (a: any) =>
                `- ${a.type}: ${a.success ? "✓" : "✗"} ${a.message || ""}`,
            )
            .join("\n") || "No actions performed"
        }\n\nFinal URL: ${result.data.finalUrl || params.url}`,
        metadata: {
          title: "Automation Completed",
          url: result.data.finalUrl || params.url,
          actionsPerformed: result.data.actions?.length || 0,
          success: result.data.actions?.every((a: any) => a.success) || false,
          profileId: params.profileId || "default",
          captchaDetected: false,
        },
      }
    } catch (error: any) {
      return {
        output: `Automation failed: ${error.message}`,
        metadata: {
          title: "Automation Failed",
          url: params.url,
          error: error.message,
          profileId: params.profileId || "default",
        },
      }
    }
  },
})

// Export fixed Pro tools
export const OpenBrowserProToolsFixed = [
  OpenBrowserScrapeProToolFixed,
  OpenBrowserAutomateProToolFixed,
]
