package browser

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/chromedp/chromedp"
)

// ExecuteScript executes JavaScript on a webpage and returns the result
func (e *Engine) ExecuteScript(params ScriptParams) (interface{}, error) {
	// Set defaults
	if params.ProfileID == "" {
		params.ProfileID = "default"
	}
	if params.Timeout == 0 {
		params.Timeout = int(e.config.DefaultTimeout.Milliseconds())
	}

	// Get or create context for profile
	ctx, _ := e.getOrCreateContext(params.ProfileID)

	// Create timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(params.Timeout)*time.Millisecond)
	defer cancel()

	var result interface{}

	// Navigate to the URL first
	actions := []chromedp.Action{
		chromedp.Navigate(params.URL),
		chromedp.WaitReady("body"),
	}

	// Execute the script and get the result
	actions = append(actions, chromedp.Evaluate(params.Script, &result))

	// Execute all actions
	if err := chromedp.Run(timeoutCtx, actions...); err != nil {
		return nil, fmt.Errorf("failed to execute script: %w", err)
	}

	// If result is a string that looks like JSON, try to parse it
	if resultStr, ok := result.(string); ok {
		var jsonResult interface{}
		if err := json.Unmarshal([]byte(resultStr), &jsonResult); err == nil {
			return jsonResult, nil
		}
	}

	return result, nil
}
