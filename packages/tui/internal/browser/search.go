package browser

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
)

// SearchWeb performs a web search using DuckDuckGo
func (e *Engine) SearchWeb(params SearchParams) ([]SearchResult, error) {
	if params.MaxResults == 0 {
		params.MaxResults = 10
	}

	// Use DuckDuckGo HTML interface
	searchURL := fmt.Sprintf("https://html.duckduckgo.com/html/?q=%s", strings.ReplaceAll(params.Query, " ", "+"))

	// Get or create context
	ctx, _ := e.getOrCreateContext("search")

	// Create timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var htmlContent string

	// Navigate and get content
	if err := chromedp.Run(timeoutCtx,
		chromedp.Navigate(searchURL),
		chromedp.WaitReady("body"),
		chromedp.OuterHTML("html", &htmlContent),
	); err != nil {
		return nil, fmt.Errorf("failed to search: %w", err)
	}

	// Parse results
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("failed to parse search results: %w", err)
	}

	var results []SearchResult

	// Extract search results from DuckDuckGo HTML
	doc.Find(".result").Each(func(i int, s *goquery.Selection) {
		if len(results) >= params.MaxResults {
			return
		}

		titleElem := s.Find(".result__title")
		linkElem := titleElem.Find("a")
		snippetElem := s.Find(".result__snippet")

		href, _ := linkElem.Attr("href")

		result := SearchResult{
			Title:   strings.TrimSpace(titleElem.Text()),
			URL:     href,
			Snippet: strings.TrimSpace(snippetElem.Text()),
		}

		if result.Title != "" && result.URL != "" {
			results = append(results, result)
		}
	})

	return results, nil
}
