import { describe, it, expect } from "bun:test"
import {
  OpenBrowserAutomateProTool,
  OpenBrowserScrapeProTool,
} from "../../src/tool/openbrowser-captcha"

describe("OpenBrowser CAPTCHA Tools", () => {
  describe("OpenBrowserAutomateProTool", () => {
    it("should have correct tool definition", () => {
      expect(OpenBrowserAutomateProTool.id).toBe("openbrowser_automate_pro")
      expect(OpenBrowserAutomateProTool.description).toContain(
        "CAPTCHA detection",
      )
    })

    it("should have required parameters", () => {
      const schema = OpenBrowserAutomateProTool.parameters
      const shape = schema.shape

      expect(shape.url).toBeDefined()
      expect(shape.actions).toBeDefined()
      // solveCaptchas removed - now uses chat-based flow
      expect(shape.profileId).toBeDefined()
    })

    it("should handle browser server connection", async () => {
      const result = await OpenBrowserAutomateProTool.execute(
        {
          url: "https://example.com",
          actions: [{ type: "click", selector: "button" }],
        },
        {} as any, // Mock context
      )

      // Either succeeds (if browser server is running) or fails gracefully
      expect(result.output).toBeDefined()
      expect(result.metadata["title"]).toBeDefined()
      expect(result.metadata["profileId"]).toBeDefined()
    })
  })

  describe("OpenBrowserScrapeProTool", () => {
    it("should have correct tool definition", () => {
      expect(OpenBrowserScrapeProTool.id).toBe("openbrowser_scrape_pro")
      expect(OpenBrowserScrapeProTool.description).toContain(
        "CAPTCHA detection",
      )
    })

    it("should have required parameters", () => {
      const schema = OpenBrowserScrapeProTool.parameters
      const shape = schema.shape

      expect(shape.url).toBeDefined()
      expect(shape.format).toBeDefined()
      expect(shape.includeScreenshot).toBeDefined()
      // solveCaptchas removed - now uses chat-based flow
      expect(shape.profileId).toBeDefined()
    })

    it("should handle browser server connection", async () => {
      const result = await OpenBrowserScrapeProTool.execute(
        {
          url: "https://example.com",
          format: "markdown",
          includeScreenshot: false,
        },
        {} as any, // Mock context
      )

      // Either succeeds (if browser server is running) or fails gracefully
      expect(result.output).toBeDefined()
      expect(result.metadata["title"]).toBeDefined()
      expect(result.metadata["profileId"]).toBeDefined()
    })
  })
})
