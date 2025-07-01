#!/bin/bash

echo "Testing OpenCode Browser Integration"
echo "===================================="

# Start browser server in background
echo "Starting browser server..."
cd packages/tui
./browser-server &
SERVER_PID=$!
sleep 2

# Test basic scraping
echo -e "\n1. Testing basic web scraping..."
curl -s -X POST http://localhost:9876 \
  -H "Content-Type: application/json" \
  -d '{
    "method": "scrape",
    "params": {
      "url": "https://example.com",
      "format": "text"
    }
  }' | jq -r '.data.title'

# Test web search
echo -e "\n2. Testing web search..."
curl -s -X POST http://localhost:9876 \
  -H "Content-Type: application/json" \
  -d '{
    "method": "search",
    "params": {
      "query": "OpenAI GPT",
      "maxResults": 3
    }
  }' | jq -r '.data.results | length'

# Kill server
echo -e "\nStopping browser server..."
kill $SERVER_PID

echo -e "\nAll tests completed!"