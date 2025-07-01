package browser

import (
	"fmt"
	"net/url"
	"strings"
	"sync"
)

// CrawlWebpages crawls multiple pages starting from a URL
func (e *Engine) CrawlWebpages(params CrawlParams) ([]*Page, error) {
	if params.MaxPages == 0 {
		params.MaxPages = 10
	}
	if params.MaxDepth == 0 {
		params.MaxDepth = 2
	}
	if params.ProfileID == "" {
		params.ProfileID = "crawler"
	}

	// Parse start URL
	startURL, err := url.Parse(params.StartURL)
	if err != nil {
		return nil, fmt.Errorf("invalid start URL: %w", err)
	}

	// Track visited URLs
	visited := make(map[string]bool)
	var visitedMu sync.Mutex

	// Results
	var pages []*Page
	var pagesMu sync.Mutex

	// URL queue
	type queueItem struct {
		url   string
		depth int
	}
	queue := []queueItem{{url: params.StartURL, depth: 0}}

	// Process queue
	for len(queue) > 0 && len(pages) < params.MaxPages {
		// Get next URL
		item := queue[0]
		queue = queue[1:]

		// Skip if already visited
		visitedMu.Lock()
		if visited[item.url] {
			visitedMu.Unlock()
			continue
		}
		visited[item.url] = true
		visitedMu.Unlock()

		// Scrape the page
		page, err := e.ScrapeWebpage(ScrapeParams{
			URL:       item.url,
			Format:    "html",
			ProfileID: params.ProfileID,
		})
		if err != nil {
			continue // Skip failed pages
		}

		// Add to results
		pagesMu.Lock()
		pages = append(pages, page)
		pagesMu.Unlock()

		// Extract links if not at max depth
		if item.depth < params.MaxDepth {
			for _, link := range page.Links {
				// Resolve relative URLs
				linkURL, err := url.Parse(link.URL)
				if err != nil {
					continue
				}
				absoluteURL := startURL.ResolveReference(linkURL).String()

				// Check if URL matches patterns
				if !matchesPatterns(absoluteURL, params.IncludePatterns, params.ExcludePatterns) {
					continue
				}

				// Add to queue if not visited
				visitedMu.Lock()
				if !visited[absoluteURL] {
					queue = append(queue, queueItem{
						url:   absoluteURL,
						depth: item.depth + 1,
					})
				}
				visitedMu.Unlock()
			}
		}
	}

	return pages, nil
}

// matchesPatterns checks if a URL matches include/exclude patterns
func matchesPatterns(url string, includePatterns, excludePatterns []string) bool {
	// If include patterns specified, URL must match at least one
	if len(includePatterns) > 0 {
		matched := false
		for _, pattern := range includePatterns {
			if strings.Contains(url, pattern) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// URL must not match any exclude pattern
	for _, pattern := range excludePatterns {
		if strings.Contains(url, pattern) {
			return false
		}
	}

	return true
}
