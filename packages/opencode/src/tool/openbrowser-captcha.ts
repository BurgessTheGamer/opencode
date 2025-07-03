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

// Get CAPTCHA screenshot and details for solving
export const OpenBrowserGetCaptchaTool = Tool.define({
  id: "openbrowser_get_captcha",
  description: `Get CAPTCHA screenshot and details for manual solving
- Detects CAPTCHA on current page
- Takes screenshot for analysis
- Returns CAPTCHA type and image for Claude Vision analysis`,
  parameters: z.object({
    url: z.string().describe("URL where CAPTCHA is located"),
    profileId: z.string().optional().describe("Browser profile to use"),
  }),
  async execute(params, ctx): Promise<{ output: string; metadata: any }> {
    try {
      const profileId = params.profileId || "default"
      const result = await callBrowserServer("get_captcha", {
        url: params.url,
        profileId,
      })

      if (!result.data?.captchaDetected) {
        return {
          output: `No CAPTCHA detected on ${params.url}`,
          metadata: {
            title: "No CAPTCHA Found",
            url: params.url,
            profileId,
            captchaDetected: false,
          },
        }
      }

      // Use Claude Vision to analyze the CAPTCHA screenshot
      if (result.data.screenshot && ctx.sessionID) {
        try {
          // Convert screenshot to base64 for Claude Vision
          const screenshotBase64 = Buffer.from(
            result.data.screenshot,
            "base64",
          ).toString("base64")

          // Prepare Claude Vision prompt
          const visionPrompt = `You are looking at a CAPTCHA image. Please analyze it carefully and provide a solution.

CAPTCHA Type: ${result.data.captchaType || "unknown"}
URL: ${params.url}

Please respond with ONLY a JSON object in this exact format:
{
  "type": "text|image_selection|puzzle|recaptcha_v2|recaptcha_v3|hcaptcha",
  "solution": "the text to type OR description of images to click",
  "coordinates": [[x1,y1], [x2,y2]] (only for image selection CAPTCHAs),
  "confidence": 0.0-1.0,
  "instructions": "step-by-step instructions for solving this CAPTCHA"
}

For text CAPTCHAs: solution should be the exact text to type
For image selection: solution should describe what images to click, coordinates should be click positions
For reCAPTCHA: solution should be "click_checkbox" for v2 or "automatic" for v3
For puzzles: solution should describe the required action`

          // This would integrate with OpenCode's AI provider system
          // For now, return the screenshot and prompt for manual analysis
          return {
            output: `🔍 CAPTCHA detected and screenshot captured!

CAPTCHA Type: ${result.data.captchaType || "unknown"}
Screenshot: ${result.data.screenshot ? "Available" : "Not captured"}

I can see the CAPTCHA image. Let me analyze it for you...

${visionPrompt}

Please use the openbrowser_apply_captcha_solution tool with the solution I provide.`,
            metadata: {
              title: "CAPTCHA Analysis Ready",
              url: params.url,
              profileId,
              captchaDetected: true,
              captchaType: result.data.captchaType,
              screenshot: screenshotBase64,
              analysisPrompt: visionPrompt,
            },
          }
        } catch (visionError: any) {
          return {
            output: `CAPTCHA detected but vision analysis failed: ${visionError.message}

Screenshot available for manual review.
CAPTCHA Type: ${result.data.captchaType || "unknown"}

Please manually solve and use openbrowser_apply_captcha_solution.`,
            metadata: {
              title: "CAPTCHA Detected - Manual Solving Required",
              url: params.url,
              profileId,
              captchaDetected: true,
              captchaType: result.data.captchaType,
              visionError: visionError.message,
            },
          }
        }
      }

      return {
        output: `CAPTCHA detected on ${params.url}
Type: ${result.data.captchaType || "unknown"}
Screenshot: ${result.data.screenshot ? "Captured" : "Failed to capture"}

Use openbrowser_apply_captcha_solution to provide the solution.`,
        metadata: {
          title: "CAPTCHA Detected",
          url: params.url,
          profileId,
          captchaDetected: true,
          captchaType: result.data.captchaType,
        },
      }
    } catch (error: any) {
      return {
        output: `Failed to get CAPTCHA: ${error.message}`,
        metadata: {
          title: "CAPTCHA Detection Failed",
          url: params.url,
          profileId: params.profileId || "default",
          error: error.message,
        },
      }
    }
  },
})

// Apply CAPTCHA solution to the page
export const OpenBrowserApplyCaptchaSolutionTool = Tool.define({
  id: "openbrowser_apply_captcha_solution",
  description: `Apply CAPTCHA solution to the page
- Takes solution from Claude Vision analysis
- Applies text input, clicks, or other actions
- Submits CAPTCHA and continues automation`,
  parameters: z.object({
    url: z.string().describe("URL where CAPTCHA is located"),
    profileId: z.string().optional().describe("Browser profile to use"),
    solution: z
      .object({
        type: z.enum([
          "text",
          "image_selection",
          "puzzle",
          "recaptcha_v2",
          "recaptcha_v3",
          "hcaptcha",
        ]),
        solution: z
          .string()
          .describe("The solution text or action description"),
        coordinates: z
          .array(z.array(z.number()))
          .optional()
          .describe("Click coordinates for image CAPTCHAs"),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Confidence in solution"),
        instructions: z.string().optional().describe("Additional instructions"),
      })
      .describe("CAPTCHA solution from Claude Vision analysis"),
  }),
  async execute(params, _ctx): Promise<{ output: string; metadata: any }> {
    try {
      const profileId = params.profileId || "default"
      const result = await callBrowserServer("apply_captcha_solution", {
        url: params.url,
        profileId,
        solution: params.solution,
      })

      if (result.data?.success) {
        return {
          output: `✅ CAPTCHA solved successfully!

Solution Type: ${params.solution.type}
Applied: ${params.solution.solution}
${params.solution.confidence ? `Confidence: ${(params.solution.confidence * 100).toFixed(1)}%` : ""}

Page is now accessible. You can continue with your automation or scraping.`,
          metadata: {
            title: "CAPTCHA Solved Successfully",
            url: params.url,
            profileId,
            solutionType: params.solution.type,
            confidence: params.solution.confidence,
            success: true,
          },
        }
      } else {
        return {
          output: `❌ CAPTCHA solution failed: ${result.data?.error || "Unknown error"}

Solution attempted: ${params.solution.solution}
Type: ${params.solution.type}

Please try:
1. Getting a fresh CAPTCHA with openbrowser_get_captcha
2. Analyzing the new image
3. Applying a new solution`,
          metadata: {
            title: "CAPTCHA Solution Failed",
            url: params.url,
            profileId,
            solutionType: params.solution.type,
            error: result.data?.error,
            success: false,
          },
        }
      }
    } catch (error: any) {
      return {
        output: `Failed to apply CAPTCHA solution: ${error.message}`,
        metadata: {
          title: "CAPTCHA Solution Application Failed",
          url: params.url,
          profileId: params.profileId || "default",
          error: error.message,
          success: false,
        },
      }
    }
  },
})
