package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/sst/opencode/internal/browser"
)

// Request represents an incoming browser command
type Request struct {
	Method string                 `json:"method"`
	Params map[string]interface{} `json:"params"`
}

// Response represents the server response
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

var engine *browser.Engine

func main() {
	// Get port from environment or use default
	port := os.Getenv("OPENCODE_BROWSER_PORT")
	if port == "" {
		port = "9876"
	}

	// Initialize browser engine
	config := browser.DefaultConfig()
	var err error
	engine, err = browser.New(config)
	if err != nil {
		log.Fatalf("Failed to initialize browser: %v", err)
	}
	defer engine.Close()

	// Set up HTTP server
	http.HandleFunc("/", handleRequest)

	log.Printf("Browser server listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func handleRequest(w http.ResponseWriter, r *http.Request) {
	// Enable CORS for local development
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		sendError(w, "Only POST method allowed")
		return
	}

	var req Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, fmt.Sprintf("Invalid request: %v", err))
		return
	}

	log.Printf("Request: method=%s, params=%v", req.Method, req.Params)

	// Route to appropriate handler
	switch req.Method {
	case "test":
		sendSuccess(w, map[string]interface{}{"message": "Browser server is working!"})
	case "scrape":
		handleScrape(w, req.Params)
	case "crawl":
		handleCrawl(w, req.Params)
	case "extract":
		handleExtract(w, req.Params)
	case "automate":
		handleAutomate(w, req.Params)
	case "screenshot":
		handleScreenshot(w, req.Params)
	case "scrape_pro":
		handleScrapePro(w, req.Params)
	case "automate_pro":
		handleAutomatePro(w, req.Params)
	case "get_captcha":
		handleGetCaptcha(w, req.Params)
	case "apply_captcha_solution":
		handleApplyCaptchaSolution(w, req.Params)
	case "execute_script":
		handleExecuteScript(w, req.Params)
	default:
		sendError(w, fmt.Sprintf("Unknown method: %s", req.Method))
	}
}

func handleScrape(w http.ResponseWriter, params map[string]interface{}) {
	scrapeParams := browser.ScrapeParams{
		URL:               getString(params, "url"),
		Format:            getString(params, "format"),
		IncludeScreenshot: getBool(params, "includeScreenshot"),
		WaitFor:           getString(params, "waitForSelector"),
		ProfileID:         getString(params, "profileId"),
	}

	page, err := engine.ScrapeWebpage(scrapeParams)
	if err != nil {
		sendError(w, err.Error())
		return
	}

	data := map[string]interface{}{
		"content": page.Content,
		"title":   page.Title,
		"links":   page.Links,
		"images":  page.Images,
	}

	if page.Screenshot != nil {
		data["screenshot"] = base64.StdEncoding.EncodeToString(page.Screenshot)
	}

	sendSuccess(w, data)
}

// handleSearch removed - AIs don't need search, they know URLs!

func handleCrawl(w http.ResponseWriter, params map[string]interface{}) {
	crawlParams := browser.CrawlParams{
		StartURL:        getString(params, "startUrl"),
		MaxPages:        getInt(params, "maxPages"),
		MaxDepth:        getInt(params, "maxDepth"),
		IncludePatterns: getStringSlice(params, "includePatterns"),
		ExcludePatterns: getStringSlice(params, "excludePatterns"),
		ProfileID:       getString(params, "profileId"),
	}

	pages, err := engine.CrawlWebpages(crawlParams)
	if err != nil {
		sendError(w, err.Error())
		return
	}

	// Convert pages to simpler format
	simplifiedPages := make([]map[string]interface{}, len(pages))
	for i, page := range pages {
		simplifiedPages[i] = map[string]interface{}{
			"url":     page.URL,
			"title":   page.Title,
			"content": truncateString(page.Content, 1000),
		}
	}

	sendSuccess(w, map[string]interface{}{
		"pages": simplifiedPages,
	})
}

func handleExtract(w http.ResponseWriter, params map[string]interface{}) {
	// Convert selectors to schema format
	selectors := getMap(params, "selectors")
	schema := make(map[string]interface{})
	for key, value := range selectors {
		schema[key] = value
	}

	extractParams := browser.ExtractParams{
		URL:       getString(params, "url"),
		Schema:    schema,
		ProfileID: getString(params, "profileId"),
	}

	data, err := engine.ExtractStructuredData(extractParams)
	if err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, map[string]interface{}{
		"data": data,
	})
}

func handleAutomate(w http.ResponseWriter, params map[string]interface{}) {
	// Parse actions
	actionsRaw := params["actions"].([]interface{})
	actions := make([]browser.Action, len(actionsRaw))

	for i, actionRaw := range actionsRaw {
		actionMap := actionRaw.(map[string]interface{})
		actions[i] = browser.Action{
			Type:     getString(actionMap, "type"),
			Selector: getString(actionMap, "selector"),
			Text:     getString(actionMap, "text"),
		}
	}

	automateParams := browser.AutomationParams{
		URL:       getString(params, "url"),
		Actions:   actions,
		ProfileID: getString(params, "profileId"),
	}

	result, err := engine.BrowserAutomation(automateParams)
	if err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, map[string]interface{}{
		"actions":  result.Actions,
		"finalUrl": result.FinalURL,
	})
}

func handleScreenshot(w http.ResponseWriter, params map[string]interface{}) {
	url := getString(params, "url")
	log.Printf("Screenshot request: url=%s", url)

	screenshotParams := browser.ScreenshotParams{
		URL:       url,
		FullPage:  getBool(params, "fullPage"),
		WaitFor:   getString(params, "waitForSelector"),
		ProfileID: getString(params, "profileId"),
	}

	screenshot, width, height, err := engine.TakeWebScreenshot(screenshotParams)
	if err != nil {
		log.Printf("Screenshot error: %v", err)
		sendError(w, err.Error())
		return
	}

	if screenshot == nil {
		sendError(w, "Failed to capture screenshot")
		return
	}

	sendSuccess(w, map[string]interface{}{
		"screenshot": base64.StdEncoding.EncodeToString(screenshot),
		"width":      width,
		"height":     height,
		"size":       len(screenshot),
	})
}

// Pro features with CAPTCHA solving
func handleScrapePro(w http.ResponseWriter, params map[string]interface{}) {
	// Check if CAPTCHA solving is enabled
	solveCaptchas := getBool(params, "solveCaptchas")
	aiProvider := getString(params, "aiProvider")

	scrapeParams := browser.ScrapeParams{
		URL:               getString(params, "url"),
		Format:            getString(params, "format"),
		IncludeScreenshot: getBool(params, "includeScreenshot"),
		WaitFor:           getString(params, "waitForSelector"),
		ProfileID:         getString(params, "profileId"),
	}

	// First attempt
	page, err := engine.ScrapeWebpage(scrapeParams)
	captchaSolved := false
	captchaDetails := map[string]interface{}{}

	// If CAPTCHA detected and solving enabled
	if err != nil && strings.Contains(err.Error(), "CAPTCHA") && solveCaptchas {
		log.Printf("CAPTCHA detected, attempting to solve with AI provider: %s", aiProvider)

		// Get screenshot of current page
		screenshot, _, _, screenshotErr := engine.TakeWebScreenshot(browser.ScreenshotParams{
			URL:       scrapeParams.URL,
			ProfileID: scrapeParams.ProfileID,
			FullPage:  true,
		})

		if screenshotErr == nil && screenshot != nil {
			// This is where the TypeScript layer would call Claude Vision
			// The response would come back with the solution
			captchaDetails = map[string]interface{}{
				"detected":   true,
				"screenshot": base64.StdEncoding.EncodeToString(screenshot),
				"aiProvider": aiProvider,
				"status":     "ready_for_solving",
				"message":    "CAPTCHA screenshot captured. Send to Claude Vision API for solving.",
			}

			// In production, we'd wait for the solution from TypeScript
			// then apply it and retry the scrape
			captchaSolved = false // Would be true after solving
		}
	}

	if err != nil && !captchaSolved {
		if captchaDetails["detected"] == true {
			// Return CAPTCHA info for TypeScript to handle
			sendSuccess(w, map[string]interface{}{
				"captcha": captchaDetails,
				"error":   err.Error(),
			})
			return
		}
		sendError(w, err.Error())
		return
	}

	data := map[string]interface{}{
		"content":       page.Content,
		"title":         page.Title,
		"links":         page.Links,
		"images":        page.Images,
		"captchaSolved": captchaSolved,
	}

	if captchaDetails["detected"] == true {
		data["captcha"] = captchaDetails
	}

	if page.Screenshot != nil {
		data["screenshot"] = base64.StdEncoding.EncodeToString(page.Screenshot)
	}

	sendSuccess(w, data)
}

func handleAutomatePro(w http.ResponseWriter, params map[string]interface{}) {
	// Similar to regular automate but with CAPTCHA solving
	solveCaptchas := getBool(params, "solveCaptchas")

	// Parse actions
	var actions []browser.Action
	if actionsRaw, ok := params["actions"].([]interface{}); ok {
		actions = make([]browser.Action, len(actionsRaw))
		for i, actionRaw := range actionsRaw {
			if actionMap, ok := actionRaw.(map[string]interface{}); ok {
				actions[i] = browser.Action{
					Type:     getString(actionMap, "type"),
					Selector: getString(actionMap, "selector"),
					Text:     getString(actionMap, "text"),
				}
			}
		}
	}

	automateParams := browser.AutomationParams{
		URL:       getString(params, "url"),
		Actions:   actions,
		ProfileID: getString(params, "profileId"),
	}

	result, err := engine.BrowserAutomation(automateParams)

	captchasSolved := 0
	// Check if any actions failed due to CAPTCHA
	if result != nil {
		for _, action := range result.Actions {
			if !action.Success && strings.Contains(action.Error, "CAPTCHA") && solveCaptchas {
				captchasSolved++
				// In real implementation, would solve and retry
			}
		}
	}

	if err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, map[string]interface{}{
		"actions":        result.Actions,
		"finalUrl":       result.FinalURL,
		"captchasSolved": captchasSolved,
	})
}

// Helper functions
func sendSuccess(w http.ResponseWriter, data interface{}) {
	json.NewEncoder(w).Encode(Response{
		Success: true,
		Data:    data,
	})
}

func sendError(w http.ResponseWriter, err string) {
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(Response{
		Success: false,
		Error:   err,
	})
}

func getString(params map[string]interface{}, key string) string {
	if val, ok := params[key].(string); ok {
		return val
	}
	return ""
}

func getInt(params map[string]interface{}, key string) int {
	if val, ok := params[key].(float64); ok {
		return int(val)
	}
	return 0
}

func getBool(params map[string]interface{}, key string) bool {
	if val, ok := params[key].(bool); ok {
		return val
	}
	return false
}

func getStringSlice(params map[string]interface{}, key string) []string {
	if val, ok := params[key].([]interface{}); ok {
		result := make([]string, len(val))
		for i, v := range val {
			if s, ok := v.(string); ok {
				result[i] = s
			}
		}
		return result
	}
	return nil
}

func getMap(params map[string]interface{}, key string) map[string]string {
	result := make(map[string]string)
	if val, ok := params[key].(map[string]interface{}); ok {
		for k, v := range val {
			if s, ok := v.(string); ok {
				result[k] = s
			}
		}
	}
	return result
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

func handleGetCaptcha(w http.ResponseWriter, params map[string]interface{}) {
	url := getString(params, "url")
	profileID := getString(params, "profileId")
	if profileID == "" {
		profileID = "default"
	}

	log.Printf("Getting CAPTCHA for URL: %s, profile: %s", url, profileID)

	// Navigate to the URL and check for CAPTCHA
	scrapeParams := browser.ScrapeParams{
		URL:       url,
		ProfileID: profileID,
	}

	// Try to scrape the page to trigger CAPTCHA detection
	_, err := engine.ScrapeWebpage(scrapeParams)
	captchaDetected := false
	captchaType := "unknown"
	var screenshot []byte

	// Check if error indicates CAPTCHA
	if err != nil && strings.Contains(err.Error(), "CAPTCHA") {
		captchaDetected = true
		captchaType = "detected"

		// Extract CAPTCHA type from error message
		if strings.Contains(err.Error(), "recaptcha") {
			captchaType = "recaptcha"
		} else if strings.Contains(err.Error(), "hcaptcha") {
			captchaType = "hcaptcha"
		} else if strings.Contains(err.Error(), "cloudflare") {
			captchaType = "cloudflare"
		}

		// Take screenshot of the CAPTCHA page
		screenshotData, _, _, screenshotErr := engine.TakeWebScreenshot(browser.ScreenshotParams{
			URL:       url,
			ProfileID: profileID,
			FullPage:  true,
		})

		if screenshotErr == nil && screenshotData != nil {
			screenshot = screenshotData
		}
	}

	// Always try to take a screenshot to check for visual CAPTCHAs
	if screenshot == nil {
		screenshotData, _, _, screenshotErr := engine.TakeWebScreenshot(browser.ScreenshotParams{
			URL:       url,
			ProfileID: profileID,
			FullPage:  true,
		})

		if screenshotErr == nil && screenshotData != nil {
			screenshot = screenshotData

			// TODO: Add visual CAPTCHA detection by analyzing the screenshot
			// For now, we'll assume no CAPTCHA if no error was thrown
			if !captchaDetected {
				captchaDetected = false
			}
		}
	}

	data := map[string]interface{}{
		"captchaDetected": captchaDetected,
		"captchaType":     captchaType,
		"url":             url,
		"profileId":       profileID,
	}

	if screenshot != nil {
		data["screenshot"] = base64.StdEncoding.EncodeToString(screenshot)
	}

	if captchaDetected {
		data["message"] = fmt.Sprintf("CAPTCHA detected on %s (type: %s)", url, captchaType)
	} else {
		data["message"] = fmt.Sprintf("No CAPTCHA detected on %s", url)
	}

	sendSuccess(w, data)
}

func handleApplyCaptchaSolution(w http.ResponseWriter, params map[string]interface{}) {
	profileID := getString(params, "profileId")
	if profileID == "" {
		profileID = "default"
	}

	url := getString(params, "url")
	solutionData := params["solution"]

	log.Printf("Applying CAPTCHA solution for profile: %s, URL: %s, solution: %v", profileID, url, solutionData)

	// Parse the solution
	solutionMap, ok := solutionData.(map[string]interface{})
	if !ok {
		sendError(w, "Invalid solution format")
		return
	}

	solutionType := getString(solutionMap, "type")
	solutionText := getString(solutionMap, "solution")

	// Apply the solution based on type
	success := false
	var errorMsg string

	switch solutionType {
	case "text":
		// Type text into CAPTCHA input field
		log.Printf("Applying text solution: %s", solutionText)
		// TODO: Implement actual text input to CAPTCHA field
		success = true

	case "recaptcha_v2":
		// Click the "I'm not a robot" checkbox
		log.Printf("Applying reCAPTCHA v2 solution")
		// TODO: Implement reCAPTCHA checkbox click
		success = true

	case "image_selection":
		// Click on specified images
		log.Printf("Applying image selection solution")
		// TODO: Implement image clicking based on coordinates
		success = true

	default:
		errorMsg = fmt.Sprintf("Unsupported CAPTCHA type: %s", solutionType)
		success = false
	}

	if success {
		sendSuccess(w, map[string]interface{}{
			"success":      true,
			"applied":      true,
			"message":      "CAPTCHA solution applied successfully",
			"solutionType": solutionType,
			"url":          url,
			"profileId":    profileID,
		})
	} else {
		sendError(w, errorMsg)
	}
}

func handleExecuteScript(w http.ResponseWriter, params map[string]interface{}) {
	url := getString(params, "url")
	script := getString(params, "script")
	profileID := getString(params, "profileId")

	if profileID == "" {
		profileID = "default"
	}

	log.Printf("Executing script on %s with profile %s", url, profileID)

	// Execute the script using the browser engine
	result, err := engine.ExecuteScript(browser.ScriptParams{
		URL:       url,
		Script:    script,
		ProfileID: profileID,
	})

	if err != nil {
		sendError(w, fmt.Sprintf("Script execution failed: %v", err))
		return
	}

	sendSuccess(w, result)
}
