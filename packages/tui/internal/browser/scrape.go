package browser

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
)

// ScrapeWebpage scrapes a webpage and returns its content
func (e *Engine) ScrapeWebpage(params ScrapeParams) (*Page, error) {
	// Set defaults
	if params.Format == "" {
		params.Format = "html"
	}
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

	page := &Page{
		URL:      params.URL,
		Metadata: make(map[string]string),
	}

	var htmlContent string
	var title string

	// Build Chrome actions
	actions := []chromedp.Action{
		chromedp.Navigate(params.URL),
	}

	// Add wait condition
	if params.WaitFor != "" {
		actions = append(actions,
			chromedp.WaitVisible(params.WaitFor),
		)
	} else {
		// Default: wait for body to be ready
		actions = append(actions,
			chromedp.WaitReady("body"),
		)
	}

	// Get content
	actions = append(actions,
		chromedp.Title(&title),
		chromedp.OuterHTML("html", &htmlContent),
	)

	// Take screenshot if requested
	if params.IncludeScreenshot {
		var screenshot []byte
		actions = append(actions,
			chromedp.FullScreenshot(&screenshot, 90),
		)
		page.Screenshot = screenshot
	}

	// Execute all actions
	if err := chromedp.Run(timeoutCtx, actions...); err != nil {
		return nil, fmt.Errorf("failed to scrape page: %w", err)
	}

	page.Title = title
	page.HTML = htmlContent

	// Parse HTML for additional extraction
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	// Extract based on format
	switch params.Format {
	case "text":
		page.Content = extractText(doc)
	case "markdown":
		page.Content = htmlToMarkdown(doc)
	case "html":
		page.Content = htmlContent
	}

	// Extract links
	doc.Find("a[href]").Each(func(i int, s *goquery.Selection) {
		href, exists := s.Attr("href")
		if exists {
			page.Links = append(page.Links, Link{
				URL:  href,
				Text: strings.TrimSpace(s.Text()),
			})
		}
	})

	// Extract images
	doc.Find("img[src]").Each(func(i int, s *goquery.Selection) {
		src, exists := s.Attr("src")
		if exists {
			alt, _ := s.Attr("alt")
			page.Images = append(page.Images, Image{
				URL: src,
				Alt: alt,
			})
		}
	})

	// Extract metadata
	doc.Find("meta").Each(func(i int, s *goquery.Selection) {
		if name, exists := s.Attr("name"); exists {
			content, _ := s.Attr("content")
			page.Metadata[name] = content
		}
		if property, exists := s.Attr("property"); exists {
			content, _ := s.Attr("content")
			page.Metadata[property] = content
		}
	})

	return page, nil
}

// extractText extracts clean text from HTML
func extractText(doc *goquery.Document) string {
	// Remove script and style elements
	doc.Find("script, style, noscript").Remove()

	// Get text content
	text := doc.Text()

	// Clean up whitespace
	lines := strings.Split(text, "\n")
	var cleanLines []string

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			cleanLines = append(cleanLines, line)
		}
	}

	return strings.Join(cleanLines, "\n")
}

// htmlToMarkdown converts HTML to Markdown
func htmlToMarkdown(doc *goquery.Document) string {
	var markdown strings.Builder

	// Process the document recursively
	doc.Find("body").Children().Each(func(i int, s *goquery.Selection) {
		convertNodeToMarkdown(s, &markdown, 0)
	})

	return strings.TrimSpace(markdown.String())
}

// convertNodeToMarkdown converts a single HTML node to Markdown
func convertNodeToMarkdown(s *goquery.Selection, markdown *strings.Builder, listLevel int) {
	node := s.Get(0)
	if node == nil {
		return
	}

	switch node.Data {
	case "h1":
		markdown.WriteString("# " + strings.TrimSpace(s.Text()) + "\n\n")
	case "h2":
		markdown.WriteString("## " + strings.TrimSpace(s.Text()) + "\n\n")
	case "h3":
		markdown.WriteString("### " + strings.TrimSpace(s.Text()) + "\n\n")
	case "h4":
		markdown.WriteString("#### " + strings.TrimSpace(s.Text()) + "\n\n")
	case "h5":
		markdown.WriteString("##### " + strings.TrimSpace(s.Text()) + "\n\n")
	case "h6":
		markdown.WriteString("###### " + strings.TrimSpace(s.Text()) + "\n\n")
	case "p":
		markdown.WriteString(strings.TrimSpace(s.Text()) + "\n\n")
	case "a":
		href, _ := s.Attr("href")
		text := strings.TrimSpace(s.Text())
		if text != "" {
			markdown.WriteString(fmt.Sprintf("[%s](%s)", text, href))
		}
	case "img":
		src, _ := s.Attr("src")
		alt, _ := s.Attr("alt")
		markdown.WriteString(fmt.Sprintf("![%s](%s)\n", alt, src))
	case "ul", "ol":
		s.Children().Each(func(j int, li *goquery.Selection) {
			if li.Get(0).Data == "li" {
				prefix := "- "
				if node.Data == "ol" {
					prefix = fmt.Sprintf("%d. ", j+1)
				}
				markdown.WriteString(strings.Repeat("  ", listLevel) + prefix + strings.TrimSpace(li.Text()) + "\n")
			}
		})
		markdown.WriteString("\n")
	case "blockquote":
		lines := strings.Split(strings.TrimSpace(s.Text()), "\n")
		for _, line := range lines {
			markdown.WriteString("> " + line + "\n")
		}
		markdown.WriteString("\n")
	case "code":
		markdown.WriteString("`" + s.Text() + "`")
	case "pre":
		code := s.Find("code").Text()
		if code == "" {
			code = s.Text()
		}
		markdown.WriteString("```\n" + code + "\n```\n\n")
	case "strong", "b":
		markdown.WriteString("**" + s.Text() + "**")
	case "em", "i":
		markdown.WriteString("*" + s.Text() + "*")
	case "hr":
		markdown.WriteString("---\n\n")
	default:
		// For other elements, process children
		s.Children().Each(func(j int, child *goquery.Selection) {
			convertNodeToMarkdown(child, markdown, listLevel)
		})
	}
}
