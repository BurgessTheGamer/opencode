import { z } from "zod"
import { Tool } from "./tool"

// Alternative CAPTCHA solving that works within chat context
// Instead of making separate API calls, we return the CAPTCHA to the chat

async function callBrowserForCaptcha(
  method: string,
  params: any,
): Promise<any> {
  const browserUrl = `http://localhost:9876`

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

  return response.json()
}

// Tool to get CAPTCHA screenshot
export const OpenBrowserGetCaptchaTool = Tool.define({
  id: "openbrowser_get_captcha",
  description: `Get CAPTCHA screenshot for solving in chat
- Returns base64 screenshot of detected CAPTCHA
- Claude can analyze it in the conversation
- Use openbrowser_apply_captcha_solution to apply the solution`,
  parameters: z.object({
    url: z.string().describe("URL with CAPTCHA"),
    profileId: z.string().optional().describe("Browser profile to use"),
  }),
  async execute(params, ctx) {
    try {
      const result = await callBrowserForCaptcha("scrape_pro", {
        ...params,
        format: "markdown",
        includeScreenshot: true,
      })

      if (result.data?.captcha?.detected && result.data.captcha.screenshot) {
        return {
          output: `CAPTCHA detected! I've captured a screenshot. Please analyze this image and tell me what you see:\n\n![CAPTCHA Screenshot](data:image/png;base64,${result.data.captcha.screenshot})`,
          metadata: {
            title: "CAPTCHA Screenshot Captured",
            url: params.url,
            captchaType: result.data.captcha.type || "unknown",
            hasScreenshot: true,
            profileId: params.profileId || "default",
          },
        }
      }

      return {
        output: "No CAPTCHA detected on this page.",
        metadata: {
          title: "No CAPTCHA Found",
          url: params.url,
          captchaType: "none",
          hasScreenshot: false,
          profileId: params.profileId || "default",
        },
      }
    } catch (error: any) {
      return {
        output: `Failed to check for CAPTCHA: ${error.message}`,
        metadata: {
          title: "CAPTCHA Check Failed",
          url: params.url,
          captchaType: "error",
          hasScreenshot: false,
          profileId: params.profileId || "default",
          error: error.message,
        },
      }
    }
  },
})

// Tool to apply CAPTCHA solution
export const OpenBrowserApplyCaptchaSolutionTool = Tool.define({
  id: "openbrowser_apply_captcha_solution",
  description: `Apply CAPTCHA solution after Claude analyzes it
- Use after getting CAPTCHA with openbrowser_get_captcha
- Provide the solution Claude determined from the screenshot`,
  parameters: z.object({
    profileId: z.string().describe("Browser profile (from get_captcha)"),
    solution: z.object({
      type: z.enum(["text", "click", "select"]).describe("Solution type"),
      value: z.string().optional().describe("Text to enter"),
      coordinates: z
        .array(z.array(z.number()))
        .optional()
        .describe("Click coordinates"),
      selections: z.array(z.string()).optional().describe("Items to select"),
    }),
  }),
  async execute(params, ctx) {
    try {
      const response = await fetch("http://localhost:9876", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "apply_captcha_solution",
          params: {
            profileId: params.profileId,
            solution: params.solution,
          },
        }),
      })

      const result = await response.json()

      if (result.success) {
        return {
          output:
            "CAPTCHA solution applied successfully! The page should now be accessible.",
          metadata: {
            title: "CAPTCHA Solved",
            profileId: params.profileId,
            solutionType: params.solution.type,
            success: true,
          },
        }
      }

      return {
        output: `Failed to apply CAPTCHA solution: ${result.error || "Unknown error"}`,
        metadata: {
          title: "CAPTCHA Solution Failed",
          profileId: params.profileId,
          solutionType: params.solution.type,
          success: false,
          error: result.error,
        },
      }
    } catch (error: any) {
      return {
        output: `Error applying solution: ${error.message}`,
        metadata: {
          title: "Solution Application Error",
          profileId: params.profileId,
          solutionType: params.solution.type,
          success: false,
          error: error.message,
        },
      }
    }
  },
})

// Export chat-based CAPTCHA tools
export const OpenBrowserChatCaptchaTools = [
  OpenBrowserGetCaptchaTool,
  OpenBrowserApplyCaptchaSolutionTool,
]
