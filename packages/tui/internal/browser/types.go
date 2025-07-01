package browser

import (
	"context"
	"time"
)

// Page represents a scraped web page
type Page struct {
	URL        string            `json:"url"`
	Title      string            `json:"title"`
	Content    string            `json:"content"`
	HTML       string            `json:"html,omitempty"`
	Links      []Link            `json:"links,omitempty"`
	Images     []Image           `json:"images,omitempty"`
	Metadata   map[string]string `json:"metadata,omitempty"`
	Screenshot []byte            `json:"screenshot,omitempty"`
}

// Link represents a hyperlink found on a page
type Link struct {
	URL  string `json:"url"`
	Text string `json:"text"`
}

// Image represents an image found on a page
type Image struct {
	URL string `json:"url"`
	Alt string `json:"alt"`
}

// ScrapeParams defines parameters for web scraping
type ScrapeParams struct {
	URL               string `json:"url"`
	Format            string `json:"format,omitempty"` // "html", "text", "markdown"
	IncludeScreenshot bool   `json:"includeScreenshot,omitempty"`
	WaitFor           string `json:"waitFor,omitempty"`   // CSS selector to wait for
	ProfileID         string `json:"profileId,omitempty"` // Browser profile to use
	Timeout           int    `json:"timeout,omitempty"`   // Timeout in milliseconds
}

// SearchParams defines parameters for web search
type SearchParams struct {
	Query      string `json:"query"`
	MaxResults int    `json:"maxResults,omitempty"`
}

// SearchResult represents a search result
type SearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

// CrawlParams defines parameters for web crawling
type CrawlParams struct {
	StartURL        string   `json:"startUrl"`
	MaxPages        int      `json:"maxPages,omitempty"`
	MaxDepth        int      `json:"maxDepth,omitempty"`
	IncludePatterns []string `json:"includePatterns,omitempty"`
	ExcludePatterns []string `json:"excludePatterns,omitempty"`
	ProfileID       string   `json:"profileId,omitempty"`
}

// ExtractParams defines parameters for structured data extraction
type ExtractParams struct {
	URL       string                 `json:"url,omitempty"`
	HTML      string                 `json:"html,omitempty"`
	Schema    map[string]interface{} `json:"schema"`
	ProfileID string                 `json:"profileId,omitempty"`
}

// AutomationParams defines parameters for browser automation
type AutomationParams struct {
	URL       string   `json:"url,omitempty"`
	Actions   []Action `json:"actions"`
	ProfileID string   `json:"profileId,omitempty"`
}

// Action represents a browser automation action
type Action struct {
	Type     string `json:"type"`               // "click", "type", "wait", "screenshot", "scroll"
	Selector string `json:"selector,omitempty"` // CSS selector
	Text     string `json:"text,omitempty"`     // Text to type or wait duration
	Key      string `json:"key,omitempty"`      // Keyboard key
}

// AutomationResult represents the result of browser automation
type AutomationResult struct {
	Success      bool           `json:"success"`
	FinalURL     string         `json:"finalUrl,omitempty"`
	FinalContent string         `json:"finalContent,omitempty"`
	Actions      []ActionResult `json:"actions"`
	Error        string         `json:"error,omitempty"`
}

// ActionResult represents the result of a single action
type ActionResult struct {
	Type       string `json:"type"`
	Success    bool   `json:"success"`
	Message    string `json:"message,omitempty"`
	Error      string `json:"error,omitempty"`
	Screenshot []byte `json:"screenshot,omitempty"`
}

// Profile represents a browser profile
type Profile struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Created   time.Time `json:"created"`
	UserAgent string    `json:"userAgent,omitempty"`
	Viewport  *Viewport `json:"viewport,omitempty"`
	Proxy     string    `json:"proxy,omitempty"`

	// Internal Chrome context
	ctx    context.Context
	cancel context.CancelFunc
}

// CreateProfileParams defines parameters for creating a profile
type CreateProfileParams struct {
	Name      string    `json:"name"`
	UserAgent string    `json:"userAgent,omitempty"`
	Viewport  *Viewport `json:"viewport,omitempty"`
	Proxy     string    `json:"proxy,omitempty"`
}

// Viewport represents browser viewport dimensions
type Viewport struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

// WindowSize represents browser window dimensions
type WindowSize struct {
	Width  int
	Height int
}
