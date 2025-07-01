package browser

import (
	"context"
	"fmt"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/chromedp/chromedp/kb"
)

// BrowserAutomation performs automated browser actions
func (e *Engine) BrowserAutomation(params AutomationParams) (*AutomationResult, error) {
	if params.ProfileID == "" {
		params.ProfileID = "automation"
	}

	// Get or create context
	ctx, _ := e.getOrCreateContext(params.ProfileID)

	// Create timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	result := &AutomationResult{
		Success: true,
		Actions: make([]ActionResult, 0),
	}

	// Navigate to initial URL if provided
	if params.URL != "" {
		if err := chromedp.Run(timeoutCtx, chromedp.Navigate(params.URL)); err != nil {
			return nil, fmt.Errorf("failed to navigate: %w", err)
		}
		result.FinalURL = params.URL

		// Check for CAPTCHA after navigation
		if err := e.DetectAndSolveCaptcha(timeoutCtx); err != nil {
			// Log CAPTCHA detection but don't fail
			result.Actions = append(result.Actions, ActionResult{
				Type:    "captcha_check",
				Success: false,
				Error:   err.Error(),
			})
		}
	}

	// Execute each action
	for _, action := range params.Actions {
		actionResult := e.executeAction(timeoutCtx, action)
		result.Actions = append(result.Actions, actionResult)

		if !actionResult.Success {
			result.Success = false
			result.Error = actionResult.Error
			break
		}
	}

	// Get final page content
	if result.Success {
		var content string
		var url string
		chromedp.Run(timeoutCtx,
			chromedp.Text("body", &content),
			chromedp.Location(&url),
		)
		result.FinalContent = content
		result.FinalURL = url
	}

	return result, nil
}

// executeAction executes a single browser action
func (e *Engine) executeAction(ctx context.Context, action Action) ActionResult {
	result := ActionResult{
		Type:    action.Type,
		Success: true,
	}

	var err error

	switch action.Type {
	case "click":
		err = chromedp.Run(ctx,
			chromedp.WaitVisible(action.Selector),
			chromedp.Click(action.Selector),
		)
		if err == nil {
			result.Message = fmt.Sprintf("Clicked element: %s", action.Selector)
		}

	case "type":
		err = chromedp.Run(ctx,
			chromedp.WaitVisible(action.Selector),
			chromedp.Clear(action.Selector),
			chromedp.SendKeys(action.Selector, action.Text),
		)

	case "wait":
		if action.Selector != "" {
			err = chromedp.Run(ctx, chromedp.WaitVisible(action.Selector))
			if err == nil {
				result.Message = fmt.Sprintf("Waited for element: %s", action.Selector)
			}
		} else if action.Text != "" {
			// Parse duration - accept milliseconds as plain number
			var duration time.Duration
			if ms, parseErr := time.ParseDuration(action.Text + "ms"); parseErr == nil {
				duration = ms
			} else if d, parseErr := time.ParseDuration(action.Text); parseErr == nil {
				duration = d
			} else {
				duration = 1 * time.Second
			}
			time.Sleep(duration)
			result.Message = fmt.Sprintf("Waited for %v", duration)
		}

	case "screenshot":
		var screenshot []byte
		err = chromedp.Run(ctx, chromedp.FullScreenshot(&screenshot, 90))
		if err == nil {
			result.Screenshot = screenshot
		}

	case "scroll":
		if action.Selector != "" {
			err = chromedp.Run(ctx,
				chromedp.ScrollIntoView(action.Selector),
			)
		} else {
			// Scroll to bottom
			err = chromedp.Run(ctx,
				chromedp.Evaluate(`window.scrollTo(0, document.body.scrollHeight)`, nil),
			)
		}

	case "press":
		// Handle keyboard shortcuts
		key := action.Key
		if key == "" {
			key = action.Text
		}

		var keyCode string
		switch key {
		case "Enter":
			keyCode = kb.Enter
		case "Tab":
			keyCode = kb.Tab
		case "Escape":
			keyCode = kb.Escape
		case "Backspace":
			keyCode = kb.Backspace
		case "Delete":
			keyCode = kb.Delete
		case "ArrowUp":
			keyCode = kb.ArrowUp
		case "ArrowDown":
			keyCode = kb.ArrowDown
		case "ArrowLeft":
			keyCode = kb.ArrowLeft
		case "ArrowRight":
			keyCode = kb.ArrowRight
		default:
			err = fmt.Errorf("unknown key: %s", key)
		}

		if err == nil {
			err = chromedp.Run(ctx, chromedp.KeyEvent(keyCode))
		}
	case "select":
		// Select dropdown option
		err = chromedp.Run(ctx,
			chromedp.SetValue(action.Selector, action.Text),
		)

	case "navigate":
		err = chromedp.Run(ctx,
			chromedp.Navigate(action.Text),
		)

	default:
		err = fmt.Errorf("unknown action type: %s", action.Type)
	}

	if err != nil {
		result.Success = false
		result.Error = err.Error()
	}

	return result
}
