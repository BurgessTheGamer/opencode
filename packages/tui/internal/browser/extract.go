package browser

import (
	"fmt"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// ExtractStructuredData extracts structured data from a webpage
func (e *Engine) ExtractStructuredData(params ExtractParams) (interface{}, error) {
	if params.ProfileID == "" {
		params.ProfileID = "extractor"
	}

	// Get HTML content
	var html string
	if params.URL != "" {
		page, err := e.ScrapeWebpage(ScrapeParams{
			URL:       params.URL,
			Format:    "html",
			ProfileID: params.ProfileID,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to scrape page: %w", err)
		}
		html = page.HTML
	} else if params.HTML != "" {
		html = params.HTML
	} else {
		return nil, fmt.Errorf("either URL or HTML must be provided")
	}

	// Parse HTML
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	// Extract data based on schema
	result := make(map[string]interface{})

	for key, value := range params.Schema {
		switch v := value.(type) {
		case string:
			// Simple CSS selector
			text := doc.Find(v).First().Text()
			result[key] = strings.TrimSpace(text)

		case map[string]interface{}:
			// Complex extraction with selector and type
			selector, _ := v["selector"].(string)
			extractType, _ := v["type"].(string)

			if selector == "" {
				continue
			}

			switch extractType {
			case "text":
				result[key] = strings.TrimSpace(doc.Find(selector).First().Text())
			case "html":
				html, _ := doc.Find(selector).First().Html()
				result[key] = html
			case "attr":
				attrName, _ := v["attribute"].(string)
				attr, _ := doc.Find(selector).First().Attr(attrName)
				result[key] = attr
			case "list":
				var items []string
				doc.Find(selector).Each(func(i int, s *goquery.Selection) {
					items = append(items, strings.TrimSpace(s.Text()))
				})
				result[key] = items
			case "table":
				result[key] = extractTable(doc.Find(selector).First())
			default:
				result[key] = strings.TrimSpace(doc.Find(selector).First().Text())
			}
		}
	}

	return result, nil
}

// extractTable extracts data from an HTML table
func extractTable(table *goquery.Selection) []map[string]string {
	var headers []string
	var rows []map[string]string

	// Extract headers
	table.Find("thead th").Each(func(i int, s *goquery.Selection) {
		headers = append(headers, strings.TrimSpace(s.Text()))
	})

	// If no thead, try first tr
	if len(headers) == 0 {
		table.Find("tr").First().Find("th, td").Each(func(i int, s *goquery.Selection) {
			headers = append(headers, strings.TrimSpace(s.Text()))
		})
	}

	// Extract rows
	table.Find("tbody tr").Each(func(i int, tr *goquery.Selection) {
		row := make(map[string]string)
		tr.Find("td").Each(func(j int, td *goquery.Selection) {
			if j < len(headers) {
				row[headers[j]] = strings.TrimSpace(td.Text())
			}
		})
		if len(row) > 0 {
			rows = append(rows, row)
		}
	})

	return rows
}
