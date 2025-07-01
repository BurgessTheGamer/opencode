package browser

import (
	"context"
	"fmt"
	"time"

	"github.com/chromedp/chromedp"
)

// CaptchaSolver handles CAPTCHA detection and solving
type CaptchaSolver struct {
	engine *Engine
}

// DetectAndSolveCaptcha checks for CAPTCHA and attempts to solve it
func (e *Engine) DetectAndSolveCaptcha(ctx context.Context) error {
	// Common CAPTCHA selectors
	captchaSelectors := []string{
		// Google reCAPTCHA
		"iframe[src*='recaptcha']",
		".g-recaptcha",
		"#recaptcha",
		// hCaptcha
		"iframe[src*='hcaptcha']",
		".h-captcha",
		// CloudFlare
		".cf-challenge-form",
		"#challenge-form",
		// Generic
		"img[alt*='captcha' i]",
		"img[src*='captcha' i]",
		"[class*='captcha' i]",
		"[id*='captcha' i]",
	}

	// Check if CAPTCHA exists
	var captchaFound bool
	var captchaSelector string

	for _, selector := range captchaSelectors {
		var exists bool
		chromedp.Run(ctx,
			chromedp.Evaluate(fmt.Sprintf(`document.querySelector("%s") !== null`, selector), &exists),
		)
		if exists {
			captchaFound = true
			captchaSelector = selector
			break
		}
	}

	if !captchaFound {
		return nil // No CAPTCHA found
	}

	// Take screenshot of the page
	var screenshot []byte
	if err := chromedp.Run(ctx, chromedp.FullScreenshot(&screenshot, 90)); err != nil {
		return fmt.Errorf("failed to take screenshot: %w", err)
	}

	// Here's where we'd integrate with Claude's vision API
	// For now, return an error indicating manual intervention needed
	return fmt.Errorf("CAPTCHA detected at selector '%s'. Manual intervention required", captchaSelector)
}

// SolveCaptchaWithAI sends the screenshot to Claude for solving
func (e *Engine) SolveCaptchaWithAI(ctx context.Context, screenshot []byte, captchaType string) (CaptchaSolution, error) {
	// This integrates with OpenCode's existing Claude connection
	// The browser server will need to receive the AI provider from the TypeScript layer

	// Prepare prompt for Claude Vision (to be used when integrated with TypeScript layer)
	_ = fmt.Sprintf(`You are looking at a CAPTCHA image. Please analyze it and provide the solution.

CAPTCHA Type: %s

Please respond with ONLY a JSON object in this format:
{
  "type": "text|image_selection|puzzle|recaptcha_v3",
  "solution": "the text to type OR coordinates to click as array",
  "confidence": 0.0-1.0,
  "instructions": "any special steps needed"
}

For text CAPTCHAs: solution should be the text to type
For image selection: solution should be array of [x,y] coordinates to click
For puzzles: solution should be movement instructions or final position`, captchaType)

	// This will be called from the TypeScript layer which has access to Claude
	return CaptchaSolution{
		Type:         captchaType,
		Solution:     "",
		Instructions: "Awaiting Claude Vision analysis",
	}, nil
}

// CaptchaSolution represents a CAPTCHA solution
type CaptchaSolution struct {
	Type         string  `json:"type"`         // "text", "image_select", "puzzle"
	Solution     string  `json:"solution"`     // Text answer or action
	Coordinates  [][]int `json:"coordinates"`  // Click coordinates for image CAPTCHAs
	Instructions string  `json:"instructions"` // Special handling instructions
}

// ApplyCaptchaSolution applies the solution to the page
func (e *Engine) ApplyCaptchaSolution(ctx context.Context, solution CaptchaSolution) error {
	switch solution.Type {
	case "text":
		// Find text input and enter solution
		return chromedp.Run(ctx,
			chromedp.SendKeys("input[type='text']", solution.Solution),
			chromedp.Submit("form"),
		)

	case "image_select":
		// Click on specified coordinates
		for _, coord := range solution.Coordinates {
			if len(coord) >= 2 {
				chromedp.Run(ctx,
					chromedp.MouseClickXY(float64(coord[0]), float64(coord[1])),
					chromedp.Sleep(500*time.Millisecond),
				)
			}
		}
		// Click submit/verify button
		return chromedp.Run(ctx,
			chromedp.Click("button[type='submit'], .verify-button, #verify"),
		)

	case "recaptcha_v2":
		// Click the "I'm not a robot" checkbox
		return chromedp.Run(ctx,
			chromedp.Click(".recaptcha-checkbox"),
			chromedp.Sleep(2*time.Second),
		)

	default:
		return fmt.Errorf("unknown CAPTCHA type: %s", solution.Type)
	}
}
