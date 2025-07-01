package browser

import (
	"bytes"
	"context"
	"fmt"
	"image/png"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/kbinani/screenshot"
)

// TakeScreenshot captures a screenshot of the entire screen or active window
func TakeScreenshot(fullScreen bool) ([]byte, error) {
	// Get the number of displays
	n := screenshot.NumActiveDisplays()
	if n <= 0 {
		return nil, fmt.Errorf("no active displays found")
	}

	// Capture the primary display
	bounds := screenshot.GetDisplayBounds(0)
	img, err := screenshot.CaptureRect(bounds)
	if err != nil {
		return nil, fmt.Errorf("failed to capture screenshot: %w", err)
	}

	// Encode to PNG
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("failed to encode screenshot: %w", err)
	}

	return buf.Bytes(), nil
}

// ScreenshotParams defines parameters for taking screenshots
type ScreenshotParams struct {
	URL       string `json:"url"`
	FullPage  bool   `json:"fullPage"`
	WaitFor   string `json:"waitForSelector,omitempty"`
	ProfileID string `json:"profileId,omitempty"`
}

// TakeWebScreenshot captures a screenshot of a web page
func (e *Engine) TakeWebScreenshot(params ScreenshotParams) ([]byte, int, int, error) {
	// For web screenshots, we still need to use chromedp
	// but we can enhance it with better error handling

	if params.ProfileID == "" {
		params.ProfileID = "screenshot"
	}

	ctx, _ := e.getOrCreateContext(params.ProfileID)

	// Create timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var screenshot []byte
	var width, height int

	actions := []chromedp.Action{
		chromedp.Navigate(params.URL),
	}

	// Add wait condition
	if params.WaitFor != "" {
		actions = append(actions, chromedp.WaitVisible(params.WaitFor))
	} else {
		actions = append(actions, chromedp.WaitReady("body"))
	}

	// Get viewport dimensions
	actions = append(actions,
		chromedp.Evaluate(`window.innerWidth`, &width),
		chromedp.Evaluate(`window.innerHeight`, &height),
	)

	// Take screenshot
	if params.FullPage {
		actions = append(actions, chromedp.FullScreenshot(&screenshot, 90))
	} else {
		actions = append(actions, chromedp.CaptureScreenshot(&screenshot))
	}

	if err := chromedp.Run(timeoutCtx, actions...); err != nil {
		return nil, 0, 0, fmt.Errorf("failed to take screenshot: %w", err)
	}

	return screenshot, width, height, nil
}
