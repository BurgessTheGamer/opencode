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
        "CAPTCHA solving",
      )
      expect(OpenBrowserAutomateProTool.description).toContain(
        "Claude Computer Use",
      )
    })

    it("should have required parameters", () => {
      const schema = OpenBrowserAutomateProTool.parameters
      const shape = schema.shape

      expect(shape.url).toBeDefined()
      expect(shape.actions).toBeDefined()
      expect(shape.solveCaptchas).toBeDefined()
      expect(shape.profileId).toBeDefined()
    })

    it("should handle browser server connection", async () => {
      const result = await OpenBrowserAutomateProTool.execute(
        {
          url: "https://example.com",
          actions: [{ type: "click", selector: "button" }],
          solveCaptchas: true,
        },
        {} as any, // Mock context
      )

      // Either succeeds (if browser server is running) or fails gracefully
      expect(result.output).toBeDefined()
      expect(result.metadata.feature).toBe("Pro/Max Exclusive")
      expect(result.metadata.browserEngine).toContain("Chrome")
    })
  })

  describe("OpenBrowserScrapeProTool", () => {
    it("should have correct tool definition", () => {
      expect(OpenBrowserScrapeProTool.id).toBe("openbrowser_scrape_pro")
      expect(OpenBrowserScrapeProTool.description).toContain("CAPTCHA solving")
      expect(OpenBrowserScrapeProTool.description).toContain(
        "Claude Computer Use",
      )
    })

    it("should have required parameters", () => {
      const schema = OpenBrowserScrapeProTool.parameters
      const shape = schema.shape

      expect(shape.url).toBeDefined()
      expect(shape.format).toBeDefined()
      expect(shape.includeScreenshot).toBeDefined()
      expect(shape.solveCaptchas).toBeDefined()
      expect(shape.profileId).toBeDefined()
    })

    it("should handle browser server connection", async () => {
      const result = await OpenBrowserScrapeProTool.execute(
        {
          url: "https://example.com",
          format: "markdown",
          includeScreenshot: false,
          solveCaptchas: true,
        },
        {} as any, // Mock context
      )

      // Either succeeds (if browser server is running) or fails gracefully
      expect(result.output).toBeDefined()
      expect(result.metadata.feature).toContain("Pro/Max Exclusive")
      expect(result.metadata.browserEngine).toContain("Chrome")
    })
  })
})
