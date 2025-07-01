// Package browser provides a Chrome-based browser automation engine for OpenCode.
// It supports web scraping, crawling, search, and browser automation with
// anti-detection features and session management.
package browser

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
)

// Browser represents the main browser engine interface
type Browser interface {
	// Core functionality
	ScrapeWebpage(params ScrapeParams) (*Page, error)
	SearchWeb(params SearchParams) ([]SearchResult, error)
	CrawlWebpages(params CrawlParams) ([]*Page, error)
	ExtractStructuredData(params ExtractParams) (interface{}, error)
	BrowserAutomation(params AutomationParams) (*AutomationResult, error)
	TakeWebScreenshot(params ScreenshotParams) ([]byte, int, int, error)

	// Profile management
	CreateProfile(params CreateProfileParams) (*Profile, error)
	GetProfile(name string) (*Profile, error)
	DeleteProfile(name string) error
	ListProfiles() ([]*Profile, error)

	// Lifecycle
	Close() error
}

// Engine implements the Browser interface using Chrome/Chromium
type Engine struct {
	// Chrome context
	allocCtx    context.Context
	allocCancel context.CancelFunc

	// Profile management
	profiles map[string]*Profile
	mu       sync.RWMutex

	// Configuration
	config Config
}

// Config holds browser engine configuration
type Config struct {
	Headless       bool
	UserDataDir    string
	ProxyURL       string
	DefaultTimeout time.Duration
	WindowSize     WindowSize
	EnableStealth  bool
	ChromePath     string // Optional: custom Chrome executable path
}

// DefaultConfig returns sensible defaults
func DefaultConfig() Config {
	return Config{
		Headless:       true,
		DefaultTimeout: 30 * time.Second,
		WindowSize:     WindowSize{Width: 1920, Height: 1080},
		EnableStealth:  true,
		ChromePath:     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	}
}

// New creates a new browser engine with the given configuration
func New(config Config) (*Engine, error) {
	engine := &Engine{
		profiles: make(map[string]*Profile),
		config:   config,
	}

	// Initialize Chrome
	if err := engine.initChrome(); err != nil {
		return nil, fmt.Errorf("failed to initialize Chrome: %w", err)
	}

	return engine, nil
}

// initChrome initializes the Chrome browser
func (e *Engine) initChrome() error {
	opts := chromedp.DefaultExecAllocatorOptions[:]

	// Basic options
	opts = append(opts,
		chromedp.Flag("headless", e.config.Headless),
		chromedp.WindowSize(e.config.WindowSize.Width, e.config.WindowSize.Height),
	)

	// Stealth options to avoid detection
	if e.config.EnableStealth {
		opts = append(opts, getStealthOptions()...)
	}

	// Custom Chrome path if specified
	if e.config.ChromePath != "" {
		opts = append(opts, chromedp.ExecPath(e.config.ChromePath))
	}

	// User data directory for persistence
	if e.config.UserDataDir != "" {
		opts = append(opts, chromedp.UserDataDir(e.config.UserDataDir))
	}

	// Proxy configuration
	if e.config.ProxyURL != "" {
		opts = append(opts, chromedp.ProxyServer(e.config.ProxyURL))
	}

	// Create allocator context
	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), opts...)
	e.allocCtx = allocCtx
	e.allocCancel = allocCancel

	// Test Chrome is working
	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	testCtx, testCancel := context.WithTimeout(ctx, 5*time.Second)
	defer testCancel()

	var title string
	if err := chromedp.Run(testCtx,
		chromedp.Navigate("about:blank"),
		chromedp.Title(&title),
	); err != nil {
		allocCancel()
		return fmt.Errorf("Chrome test failed: %w", err)
	}

	return nil
}

// Close cleans up all resources
func (e *Engine) Close() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Close all profile contexts
	for _, profile := range e.profiles {
		if profile.cancel != nil {
			profile.cancel()
		}
	}

	// Close Chrome allocator
	if e.allocCancel != nil {
		e.allocCancel()
	}

	return nil
}

// getOrCreateContext gets or creates a Chrome context for the given profile
func (e *Engine) getOrCreateContext(profileID string) (context.Context, context.CancelFunc) {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Get or create profile
	profile, exists := e.profiles[profileID]
	if !exists {
		profile = &Profile{
			ID:        profileID,
			Name:      profileID,
			Created:   time.Now(),
			UserAgent: randomUserAgent(),
		}
		e.profiles[profileID] = profile
	}

	// Create new context if needed
	if profile.ctx == nil {
		ctx, cancel := chromedp.NewContext(e.allocCtx)
		profile.ctx = ctx
		profile.cancel = cancel

		// Apply profile settings and stealth
		chromedp.Run(ctx,
			chromedp.Evaluate(`navigator.userAgent = "`+profile.UserAgent+`"`, nil),
			applyStealthJS(),
		)
	}

	return profile.ctx, profile.cancel
}
