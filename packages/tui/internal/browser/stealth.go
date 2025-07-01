package browser

import (
	"context"
	"math/rand"
	"time"

	"github.com/chromedp/chromedp"
)

// getStealthOptions returns Chrome options for stealth mode
func getStealthOptions() []chromedp.ExecAllocatorOption {
	return []chromedp.ExecAllocatorOption{
		// Disable automation indicators
		chromedp.Flag("enable-automation", false),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),

		// Disable GPU and sandbox for better compatibility
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-setuid-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),

		// Better rendering
		chromedp.Flag("disable-web-security", false),
		chromedp.Flag("disable-features", "VizDisplayCompositor"),
		chromedp.Flag("disable-background-timer-throttling", true),
		chromedp.Flag("disable-backgrounding-occluded-windows", true),
		chromedp.Flag("disable-renderer-backgrounding", true),

		// Permissions
		chromedp.Flag("disable-notifications", true),
		chromedp.Flag("disable-popup-blocking", false),

		// Better fingerprinting resistance
		chromedp.Flag("disable-webgl", false),
		chromedp.Flag("use-fake-ui-for-media-stream", true),
		chromedp.Flag("use-fake-device-for-media-stream", true),

		// Performance
		chromedp.Flag("disable-ipc-flooding-protection", true),
		chromedp.Flag("disable-breakpad", true),
		chromedp.Flag("metrics-recording-only", true),
		chromedp.Flag("no-first-run", true),
		chromedp.Flag("no-default-browser-check", true),
	}
}

// Common user agents for rotation
var userAgents = []string{
	// Chrome on Windows
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",

	// Chrome on Mac
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",

	// Chrome on Linux
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

	// Edge
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",

	// Safari
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
}

// randomUserAgent returns a random user agent string
func randomUserAgent() string {
	rand.Seed(time.Now().UnixNano())
	return userAgents[rand.Intn(len(userAgents))]
}

// applyStealthJS injects JavaScript to make the browser less detectable
func applyStealthJS() chromedp.Action {
	return chromedp.ActionFunc(func(ctx context.Context) error {
		// Override navigator.webdriver
		chromedp.Evaluate(`
			Object.defineProperty(navigator, 'webdriver', {
				get: () => undefined
			});
		`, nil).Do(ctx)

		// Override navigator.plugins
		chromedp.Evaluate(`
			Object.defineProperty(navigator, 'plugins', {
				get: () => [
					{
						0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
						description: "Portable Document Format",
						filename: "internal-pdf-viewer",
						length: 1,
						name: "Chrome PDF Plugin"
					}
				]
			});
		`, nil).Do(ctx)

		// Override navigator.languages
		chromedp.Evaluate(`
			Object.defineProperty(navigator, 'languages', {
				get: () => ['en-US', 'en']
			});
		`, nil).Do(ctx)

		// Override Permissions API
		chromedp.Evaluate(`
			const originalQuery = window.navigator.permissions.query;
			window.navigator.permissions.query = (parameters) => (
				parameters.name === 'notifications' ?
					Promise.resolve({ state: Notification.permission }) :
					originalQuery(parameters)
			);
		`, nil).Do(ctx)

		// Fix Chrome runtime
		chromedp.Evaluate(`
			window.chrome = {
				runtime: {
					connect: () => {},
					sendMessage: () => {}
				}
			};
		`, nil).Do(ctx)

		return nil
	})
}
