package browser

import (
	"context"
	"fmt"
	"time"

	"github.com/chromedp/chromedp"
)

// SiteSelectors contains robust selectors for popular websites
var SiteSelectors = map[string]map[string][]string{
	"google.com": {
		"search": {
			"input[name='q']",
			"textarea[name='q']",
			"[aria-label*='Search']",
			"input[type='search']",
			"[role='combobox'][aria-label*='Search']",
			"#APjFqb", // Google's dynamic ID (may change)
		},
		"search_button": {
			"input[name='btnK']",
			"input[value='Google Search']",
			"[aria-label='Google Search']",
			"button[type='submit']",
		},
		"lucky_button": {
			"input[name='btnI']",
			"[value*='Lucky']",
		},
	},
	"github.com": {
		"search": {
			"[data-target='qbsearch-input.inputButton']",
			"input[placeholder*='Search']",
			".header-search-input",
			"[aria-label='Search GitHub']",
			"input[name='q']",
			"[data-hotkey='s,/']",
		},
		"login": {
			"input[name='login']",
			"#login_field",
			"[autocomplete='username']",
		},
		"password": {
			"input[name='password']",
			"#password",
			"[autocomplete='current-password']",
		},
		"sign_in": {
			"input[type='submit'][value='Sign in']",
			"button[type='submit']",
			".btn-primary",
		},
	},
	"twitter.com": {
		"search": {
			"input[data-testid='SearchBox_Search_Input']",
			"[aria-label='Search query']",
			"input[placeholder*='Search']",
		},
		"tweet": {
			"[data-testid='tweetTextarea_0']",
			"div[role='textbox']",
			"[aria-label*='Tweet text']",
		},
	},
	"x.com": { // Twitter redirect
		"search": {
			"input[data-testid='SearchBox_Search_Input']",
			"[aria-label='Search query']",
			"input[placeholder*='Search']",
		},
	},
	"linkedin.com": {
		"search": {
			"input[placeholder='Search']",
			".search-global-typeahead__input",
			"[aria-label='Search']",
		},
	},
	"amazon.com": {
		"search": {
			"#twotabsearchtextbox",
			"input[name='field-keywords']",
			"[aria-label='Search Amazon']",
		},
		"search_button": {
			"#nav-search-submit-button",
			"input[type='submit']",
		},
	},
	"youtube.com": {
		"search": {
			"input#search",
			"[name='search_query']",
			"[aria-label='Search']",
		},
		"search_button": {
			"#search-icon-legacy",
			"button#search-button",
		},
	},
	"reddit.com": {
		"search": {
			"input[name='q']",
			"[placeholder*='Search Reddit']",
			"[aria-label='Search Reddit']",
		},
	},
	"stackoverflow.com": {
		"search": {
			"input[name='q']",
			"[placeholder='Search...']",
			".s-input__search",
		},
	},
}

// GetSelectors returns all selector variations for a site and element
func GetSelectors(site, element string) []string {
	if siteMap, ok := SiteSelectors[site]; ok {
		if selectors, ok := siteMap[element]; ok {
			return selectors
		}
	}
	// Return generic selectors as fallback
	return []string{
		fmt.Sprintf("input[name='%s']", element),
		fmt.Sprintf("#%s", element),
		fmt.Sprintf(".%s", element),
		fmt.Sprintf("[aria-label*='%s']", element),
		fmt.Sprintf("[placeholder*='%s']", element),
	}
}

// WaitStrategies for different types of sites
var WaitStrategies = map[string]func() chromedp.Action{
	"spa": func() chromedp.Action {
		// For Single Page Applications
		return chromedp.ActionFunc(func(ctx context.Context) error {
			// Wait for common SPA indicators
			chromedp.Run(ctx,
				chromedp.WaitReady("body"),
				chromedp.Sleep(2*time.Second),
			)
			// Check if React/Vue/Angular is loaded
			var loaded bool
			chromedp.Run(ctx,
				chromedp.Evaluate(`
					window.React !== undefined || 
					window.Vue !== undefined || 
					window.angular !== undefined ||
					document.querySelector('[data-reactroot]') !== null
				`, &loaded),
			)
			return nil
		})
	},
	"dynamic": func() chromedp.Action {
		// For dynamically loaded content
		return chromedp.ActionFunc(func(ctx context.Context) error {
			return chromedp.Run(ctx,
				chromedp.WaitReady("body"),
				chromedp.Sleep(3*time.Second),
				// Wait for no network activity
				chromedp.Evaluate(`
					new Promise(resolve => {
						let timeout;
						const observer = new PerformanceObserver(() => {
							clearTimeout(timeout);
							timeout = setTimeout(resolve, 1000);
						});
						observer.observe({entryTypes: ['resource']});
						timeout = setTimeout(resolve, 3000);
					})
				`, nil),
			)
		})
	},
}
