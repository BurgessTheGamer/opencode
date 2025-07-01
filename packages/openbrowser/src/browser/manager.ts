import { Browser, Page, LaunchOptions } from "puppeteer"
import puppeteerExtra from "puppeteer-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import type { BrowserProfile } from "../types.js"

// Add stealth plugin to avoid detection
puppeteerExtra.use(StealthPlugin())

export class BrowserManager {
  private static browsers: Map<string, Browser> = new Map()
  private static profilesDir: string = path.join(
    os.homedir(),
    ".openbrowser",
    "profiles",
  )

  static async initialize() {
    // Ensure profiles directory exists
    await fs.mkdir(this.profilesDir, { recursive: true })
  }

  static async getBrowser(profileId?: string): Promise<Browser> {
    const key = profileId || "default"

    // Return existing browser if available
    if (this.browsers.has(key)) {
      const browser = this.browsers.get(key)!
      if (browser.isConnected()) {
        return browser
      }
      // Remove disconnected browser
      this.browsers.delete(key)
    }

    // Launch new browser
    const options: LaunchOptions = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    }

    // Add profile-specific options
    if (profileId) {
      const profile = await this.getProfile(profileId)
      if (profile) {
        options.userDataDir = profile.path
        if (profile.proxy) {
          options.args!.push(`--proxy-server=${profile.proxy}`)
        }
      }
    }

    const browser = await puppeteerExtra.launch(options)
    this.browsers.set(key, browser)

    // Set up cleanup on browser disconnect
    browser.on("disconnected", () => {
      this.browsers.delete(key)
    })

    return browser
  }

  static async createPage(browser: Browser, profileId?: string): Promise<Page> {
    const page = await browser.newPage()

    // Apply profile settings
    if (profileId) {
      const profile = await this.getProfile(profileId)
      if (profile) {
        if (profile.userAgent) {
          await page.setUserAgent(profile.userAgent)
        }
        if (profile.viewport) {
          await page.setViewport(profile.viewport)
        }
      }
    }

    // Set reasonable defaults
    await page.setDefaultTimeout(30000)
    await page.setDefaultNavigationTimeout(30000)

    // Block unnecessary resources for better performance
    await page.setRequestInterception(true)
    page.on("request", (req) => {
      const resourceType = req.resourceType()
      if (["font", "stylesheet"].includes(resourceType)) {
        req.abort()
      } else {
        req.continue()
      }
    })

    return page
  }

  static async closeBrowser(profileId?: string) {
    const key = profileId || "default"
    const browser = this.browsers.get(key)
    if (browser && browser.isConnected()) {
      await browser.close()
      this.browsers.delete(key)
    }
  }

  static async closeAllBrowsers() {
    const closePromises = Array.from(this.browsers.values()).map((browser) =>
      browser.close().catch(() => {}),
    )
    await Promise.all(closePromises)
    this.browsers.clear()
  }

  // Profile management
  static async createProfile(
    profile: Omit<BrowserProfile, "id" | "created" | "path">,
  ): Promise<BrowserProfile> {
    await this.initialize()

    const id = Date.now().toString()
    const profilePath = path.join(this.profilesDir, id)
    await fs.mkdir(profilePath, { recursive: true })

    const fullProfile: BrowserProfile = {
      id,
      created: new Date().toISOString(),
      path: profilePath,
      ...profile,
    }

    // Save profile metadata
    const metadataPath = path.join(profilePath, "profile.json")
    await fs.writeFile(metadataPath, JSON.stringify(fullProfile, null, 2))

    return fullProfile
  }

  static async getProfile(nameOrId: string): Promise<BrowserProfile | null> {
    await this.initialize()

    const profiles = await this.listProfiles()
    return (
      profiles.find((p) => p.id === nameOrId || p.name === nameOrId) || null
    )
  }

  static async deleteProfile(nameOrId: string): Promise<boolean> {
    const profile = await this.getProfile(nameOrId)
    if (!profile) return false

    // Close browser if it's using this profile
    await this.closeBrowser(profile.id)

    // Remove profile directory
    await fs.rm(profile.path, { recursive: true, force: true })
    return true
  }

  static async listProfiles(): Promise<BrowserProfile[]> {
    await this.initialize()

    const profiles: BrowserProfile[] = []

    try {
      const dirs = await fs.readdir(this.profilesDir)

      for (const dir of dirs) {
        const profilePath = path.join(this.profilesDir, dir)
        const metadataPath = path.join(profilePath, "profile.json")

        try {
          const metadata = await fs.readFile(metadataPath, "utf-8")
          profiles.push(JSON.parse(metadata))
        } catch {
          // Skip invalid profiles
        }
      }
    } catch {
      // No profiles yet
    }

    return profiles
  }
}

// Initialize on module load
BrowserManager.initialize().catch(console.error)

// Cleanup on process exit
process.on("SIGINT", () => {
  BrowserManager.closeAllBrowsers().then(() => process.exit(0))
})

process.on("SIGTERM", () => {
  BrowserManager.closeAllBrowsers().then(() => process.exit(0))
})
