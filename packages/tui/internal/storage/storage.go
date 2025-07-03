// Package storage provides a SQLite-based storage engine for OpenCode.
// It allows storing and retrieving scraped content, managing context windows,
// and providing intelligent chunking for AI interactions.
package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/sqlitedialect"
	"github.com/uptrace/bun/driver/sqliteshim"
	"github.com/uptrace/bun/extra/bundebug"
)

// Storage represents the main storage engine interface
type Storage interface {
	// Content management
	StoreContent(ctx context.Context, content *Content) error
	GetContent(ctx context.Context, id string) (*Content, error)
	SearchContent(ctx context.Context, query string, limit int) ([]*Content, error)

	// Session management
	CreateSession(ctx context.Context, session *Session) error
	GetSession(ctx context.Context, id string) (*Session, error)
	ListSessions(ctx context.Context, limit int) ([]*Session, error)

	// Context window management
	GetContextWindow(ctx context.Context, sessionID string, maxTokens int) ([]*Content, error)

	// Cleanup
	DeleteOldContent(ctx context.Context, before time.Time) error
	DeleteAllContent(ctx context.Context) error
	Close() error
}

// Engine implements the Storage interface using Bun ORM with SQLite
type Engine struct {
	db *bun.DB
}

// Config holds storage engine configuration
type Config struct {
	DatabasePath string
	Debug        bool
}

// DefaultConfig returns sensible defaults
func DefaultConfig() Config {
	return Config{
		DatabasePath: "opencode-storage.db",
		Debug:        false,
	}
}

// Content represents stored content from web scraping or other sources
type Content struct {
	bun.BaseModel `bun:"table:contents,alias:c"`

	ID          string    `bun:"id,pk" json:"id"`
	SessionID   string    `bun:"session_id" json:"session_id"`
	URL         string    `bun:"url" json:"url"`
	Title       string    `bun:"title" json:"title"`
	Content     string    `bun:"content,type:text" json:"content"`
	ContentType string    `bun:"content_type" json:"content_type"`
	Metadata    JSONMap   `bun:"metadata,type:json" json:"metadata"`
	TokenCount  int       `bun:"token_count" json:"token_count"`
	CreatedAt   time.Time `bun:"created_at" json:"created_at"`
	UpdatedAt   time.Time `bun:"updated_at" json:"updated_at"`
}

// Session represents an OpenCode session
type Session struct {
	bun.BaseModel `bun:"table:sessions,alias:s"`

	ID        string    `bun:"id,pk" json:"id"`
	Name      string    `bun:"name" json:"name"`
	CreatedAt time.Time `bun:"created_at" json:"created_at"`
	UpdatedAt time.Time `bun:"updated_at" json:"updated_at"`
}

// JSONMap is a custom type for JSON storage
type JSONMap map[string]interface{}

// Scan implements sql.Scanner interface
func (m *JSONMap) Scan(src interface{}) error {
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, m)
	case string:
		return json.Unmarshal([]byte(v), m)
	case nil:
		*m = make(JSONMap)
		return nil
	default:
		return fmt.Errorf("unsupported type: %T", src)
	}
}

// Value implements driver.Valuer interface
func (m JSONMap) Value() (interface{}, error) {
	if m == nil {
		return nil, nil
	}
	return json.Marshal(m)
}

// New creates a new storage engine with the given configuration
func New(config Config) (*Engine, error) {
	// Open SQLite database
	sqldb, err := sql.Open(sqliteshim.ShimName, config.DatabasePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Create Bun DB
	db := bun.NewDB(sqldb, sqlitedialect.New())

	// Enable debug logging if requested
	if config.Debug {
		db.AddQueryHook(bundebug.NewQueryHook(
			bundebug.WithVerbose(true),
		))
	}

	engine := &Engine{
		db: db,
	}

	// Initialize schema
	if err := engine.initSchema(context.Background()); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return engine, nil
}

// initSchema creates the database tables if they don't exist
func (e *Engine) initSchema(ctx context.Context) error {
	models := []interface{}{
		(*Content)(nil),
		(*Session)(nil),
	}

	for _, model := range models {
		_, err := e.db.NewCreateTable().
			Model(model).
			IfNotExists().
			Exec(ctx)
		if err != nil {
			return err
		}
	}

	// Create indexes
	_, err := e.db.NewCreateIndex().
		Model((*Content)(nil)).
		Index("idx_content_session_id").
		Column("session_id").
		IfNotExists().
		Exec(ctx)
	if err != nil {
		return err
	}

	_, err = e.db.NewCreateIndex().
		Model((*Content)(nil)).
		Index("idx_content_created_at").
		Column("created_at").
		IfNotExists().
		Exec(ctx)
	if err != nil {
		return err
	}

	// Enable FTS5 for content search
	_, err = e.db.ExecContext(ctx, `
		CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
			content_id UNINDEXED,
			title,
			content
		)
	`)
	if err != nil {
		return err
	}

	// Create triggers to keep FTS in sync
	_, err = e.db.ExecContext(ctx, `
		CREATE TRIGGER IF NOT EXISTS content_ai AFTER INSERT ON contents BEGIN
			INSERT INTO content_fts(content_id, title, content) 
			VALUES (new.id, new.title, new.content);
		END
	`)
	if err != nil {
		return err
	}

	return nil
}

// StoreContent stores content in the database
func (e *Engine) StoreContent(ctx context.Context, content *Content) error {
	content.CreatedAt = time.Now()
	content.UpdatedAt = time.Now()

	// Calculate approximate token count (rough estimate)
	content.TokenCount = len(content.Content) / 4

	_, err := e.db.NewInsert().
		Model(content).
		Exec(ctx)
	return err
}

// GetContent retrieves content by ID
func (e *Engine) GetContent(ctx context.Context, id string) (*Content, error) {
	content := new(Content)
	err := e.db.NewSelect().
		Model(content).
		Where("id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return content, nil
}

// SearchContent performs full-text search on content
func (e *Engine) SearchContent(ctx context.Context, query string, limit int) ([]*Content, error) {
	var contents []*Content

	// Use FTS5 for search
	err := e.db.NewRaw(`
		SELECT c.* FROM contents c
		WHERE c.id IN (
			SELECT content_id FROM content_fts 
			WHERE content_fts MATCH ?
			ORDER BY rank
			LIMIT ?
		)
	`, query, limit).Scan(ctx, &contents)

	return contents, err
}

// CreateSession creates a new session
func (e *Engine) CreateSession(ctx context.Context, session *Session) error {
	session.CreatedAt = time.Now()
	session.UpdatedAt = time.Now()

	_, err := e.db.NewInsert().
		Model(session).
		Exec(ctx)
	return err
}

// GetSession retrieves a session by ID
func (e *Engine) GetSession(ctx context.Context, id string) (*Session, error) {
	session := new(Session)
	err := e.db.NewSelect().
		Model(session).
		Where("id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return session, nil
}

// ListSessions lists recent sessions
func (e *Engine) ListSessions(ctx context.Context, limit int) ([]*Session, error) {
	var sessions []*Session
	err := e.db.NewSelect().
		Model(&sessions).
		OrderExpr("created_at DESC").
		Limit(limit).
		Scan(ctx)
	return sessions, err
}

// GetContextWindow retrieves content for a session within token limits
func (e *Engine) GetContextWindow(ctx context.Context, sessionID string, maxTokens int) ([]*Content, error) {
	var contents []*Content

	// Get most recent content that fits within token limit
	err := e.db.NewRaw(`
		WITH token_sum AS (
			SELECT 
				id,
				SUM(token_count) OVER (ORDER BY created_at DESC) as running_total
			FROM contents
			WHERE session_id = ?
		)
		SELECT c.* FROM contents c
		JOIN token_sum ts ON c.id = ts.id
		WHERE ts.running_total <= ?
		ORDER BY c.created_at DESC
	`, sessionID, maxTokens).Scan(ctx, &contents)

	return contents, err
}

// DeleteOldContent removes content older than the specified time
func (e *Engine) DeleteOldContent(ctx context.Context, before time.Time) error {
	_, err := e.db.NewDelete().
		Model((*Content)(nil)).
		Where("created_at < ?", before).
		Exec(ctx)
	return err
}

// DeleteAllContent removes all content from storage
func (e *Engine) DeleteAllContent(ctx context.Context) error {
	// Delete from FTS table first
	_, err := e.db.ExecContext(ctx, "DELETE FROM content_fts")
	if err != nil {
		return err
	}

	// Delete all content
	_, err = e.db.NewDelete().
		Model((*Content)(nil)).
		Exec(ctx)
	return err
}

// CleanupSession removes old content from a session, keeping only the most recent N items
func (e *Engine) CleanupSession(ctx context.Context, sessionID string, keepLast int) (int, error) {
	// First, get the IDs of items to keep
	var keepIDs []string
	err := e.db.NewRaw(`
		SELECT id FROM contents 
		WHERE session_id = ? 
		ORDER BY created_at DESC 
		LIMIT ?
	`, sessionID, keepLast).Scan(ctx, &keepIDs)
	if err != nil {
		return 0, err
	}

	// Delete everything else from this session
	result, err := e.db.NewDelete().
		Model((*Content)(nil)).
		Where("session_id = ?", sessionID).
		Where("id NOT IN (?)", bun.In(keepIDs)).
		Exec(ctx)
	if err != nil {
		return 0, err
	}

	rowsAffected, _ := result.RowsAffected()
	return int(rowsAffected), nil
}

// Close closes the database connection
func (e *Engine) Close() error {
	return e.db.Close()
}
