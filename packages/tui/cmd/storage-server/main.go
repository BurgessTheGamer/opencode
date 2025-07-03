package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/sst/opencode/internal/storage"
)

// Request represents an incoming storage command
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

var storageEngine *storage.Engine

func main() {
	// Get port from environment or use default
	port := os.Getenv("OPENCODE_STORAGE_PORT")
	if port == "" {
		port = "9877"
	}

	// Get database path
	dbPath := os.Getenv("OPENCODE_STORAGE_DB")
	if dbPath == "" {
		dbPath = "opencode-storage.db"
	}

	// Initialize storage engine
	config := storage.Config{
		DatabasePath: dbPath,
		Debug:        os.Getenv("OPENCODE_STORAGE_DEBUG") == "true",
	}

	var err error
	storageEngine, err = storage.New(config)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer storageEngine.Close()

	// Set up HTTP server
	http.HandleFunc("/", handleRequest)

	log.Printf("Storage server listening on port %s", port)
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

	log.Printf("Request: method=%s", req.Method)

	// Route to appropriate handler
	switch req.Method {
	case "test":
		sendSuccess(w, map[string]interface{}{"message": "Storage server is working!"})
	case "store_content":
		handleStoreContent(w, req.Params)
	case "get_content":
		handleGetContent(w, req.Params)
	case "search_content":
		handleSearchContent(w, req.Params)
	case "create_session":
		handleCreateSession(w, req.Params)
	case "get_session":
		handleGetSession(w, req.Params)
	case "list_sessions":
		handleListSessions(w, req.Params)
	case "get_context_window":
		handleGetContextWindow(w, req.Params)
	case "cleanup":
		handleCleanup(w, req.Params)
	case "cleanup_session":
		handleCleanupSession(w, req.Params)
	case "clear_all":
		handleClearAll(w, req.Params)
	default:
		sendError(w, fmt.Sprintf("Unknown method: %s", req.Method))
	}
}

func handleStoreContent(w http.ResponseWriter, params map[string]interface{}) {
	content := &storage.Content{
		ID:          uuid.New().String(),
		SessionID:   getString(params, "session_id"),
		URL:         getString(params, "url"),
		Title:       getString(params, "title"),
		Content:     getString(params, "content"),
		ContentType: getString(params, "content_type"),
	}

	// Parse metadata if provided
	if metadataRaw, ok := params["metadata"].(map[string]interface{}); ok {
		content.Metadata = storage.JSONMap(metadataRaw)
	}

	ctx := context.Background()
	if err := storageEngine.StoreContent(ctx, content); err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, map[string]interface{}{
		"id":          content.ID,
		"token_count": content.TokenCount,
	})
}

func handleGetContent(w http.ResponseWriter, params map[string]interface{}) {
	id := getString(params, "id")
	if id == "" {
		sendError(w, "id is required")
		return
	}

	ctx := context.Background()
	content, err := storageEngine.GetContent(ctx, id)
	if err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, content)
}

func handleSearchContent(w http.ResponseWriter, params map[string]interface{}) {
	query := getString(params, "query")
	if query == "" {
		sendError(w, "query is required")
		return
	}

	limit := getInt(params, "limit")
	if limit == 0 {
		limit = 10
	}

	ctx := context.Background()
	contents, err := storageEngine.SearchContent(ctx, query, limit)
	if err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, map[string]interface{}{
		"results": contents,
		"count":   len(contents),
	})
}

func handleCreateSession(w http.ResponseWriter, params map[string]interface{}) {
	session := &storage.Session{
		ID:   uuid.New().String(),
		Name: getString(params, "name"),
	}

	if session.Name == "" {
		session.Name = fmt.Sprintf("Session %s", time.Now().Format("2006-01-02 15:04"))
	}

	ctx := context.Background()
	if err := storageEngine.CreateSession(ctx, session); err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, session)
}

func handleGetSession(w http.ResponseWriter, params map[string]interface{}) {
	id := getString(params, "id")
	if id == "" {
		sendError(w, "id is required")
		return
	}

	ctx := context.Background()
	session, err := storageEngine.GetSession(ctx, id)
	if err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, session)
}

func handleListSessions(w http.ResponseWriter, params map[string]interface{}) {
	limit := getInt(params, "limit")
	if limit == 0 {
		limit = 20
	}

	ctx := context.Background()
	sessions, err := storageEngine.ListSessions(ctx, limit)
	if err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, map[string]interface{}{
		"sessions": sessions,
		"count":    len(sessions),
	})
}

func handleGetContextWindow(w http.ResponseWriter, params map[string]interface{}) {
	sessionID := getString(params, "session_id")
	if sessionID == "" {
		sendError(w, "session_id is required")
		return
	}

	maxTokens := getInt(params, "max_tokens")
	if maxTokens == 0 {
		maxTokens = 100000 // Default to ~100k tokens
	}

	ctx := context.Background()
	contents, err := storageEngine.GetContextWindow(ctx, sessionID, maxTokens)
	if err != nil {
		sendError(w, err.Error())
		return
	}

	// Calculate total tokens
	totalTokens := 0
	for _, c := range contents {
		totalTokens += c.TokenCount
	}

	sendSuccess(w, map[string]interface{}{
		"contents":     contents,
		"count":        len(contents),
		"total_tokens": totalTokens,
	})
}

func handleCleanup(w http.ResponseWriter, params map[string]interface{}) {
	daysOld := getInt(params, "days_old")
	if daysOld == 0 {
		daysOld = 7 // Default to 7 days
	}

	before := time.Now().AddDate(0, 0, -daysOld)

	ctx := context.Background()
	if err := storageEngine.DeleteOldContent(ctx, before); err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, map[string]interface{}{
		"message": fmt.Sprintf("Deleted content older than %d days", daysOld),
	})
}

func handleCleanupSession(w http.ResponseWriter, params map[string]interface{}) {
	sessionID := getString(params, "session_id")
	keepLast := getInt(params, "keep_last")
	if keepLast == 0 {
		keepLast = 10 // Keep last 10 items by default
	}

	ctx := context.Background()

	// Delete all content for this session except the last N items
	deleted, err := storageEngine.CleanupSession(ctx, sessionID, keepLast)
	if err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, map[string]interface{}{
		"message": fmt.Sprintf("Deleted %d old items from session %s", deleted, sessionID),
		"deleted": deleted,
	})
}

func handleClearAll(w http.ResponseWriter, params map[string]interface{}) {
	ctx := context.Background()

	// Delete all content
	if err := storageEngine.DeleteAllContent(ctx); err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, map[string]interface{}{
		"message": "All storage content has been cleared",
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
