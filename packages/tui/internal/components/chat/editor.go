package chat

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/charmbracelet/bubbles/v2/spinner"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/commands"
	"github.com/sst/opencode/internal/components/dialog"
	"github.com/sst/opencode/internal/components/textarea"
	"github.com/sst/opencode/internal/image"
	"github.com/sst/opencode/internal/layout"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
	"github.com/sst/opencode/internal/util"
)

type EditorComponent interface {
	tea.Model
	tea.ViewModel
	layout.Sizeable
	Content() string
	Lines() int
	Value() string
	Focused() bool
	Focus() (tea.Model, tea.Cmd)
	Blur()
	Submit() (tea.Model, tea.Cmd)
	Clear() (tea.Model, tea.Cmd)
	Paste() (tea.Model, tea.Cmd)
	Newline() (tea.Model, tea.Cmd)
	Previous() (tea.Model, tea.Cmd)
	Next() (tea.Model, tea.Cmd)
	SetInterruptKeyInDebounce(inDebounce bool)
}

type editorComponent struct {
	app                    *app.App
	width, height          int
	textarea               textarea.Model
	attachments            []app.Attachment
	history                []string
	historyIndex           int
	currentMessage         string
	spinner                spinner.Model
	interruptKeyInDebounce bool

	// Mouse interaction state for scrollbar
	isDragging      bool
	dragStartY      int
	dragStartOffset int
}

func (m *editorComponent) Init() tea.Cmd {
	return tea.Batch(m.textarea.Focus(), m.spinner.Tick, tea.EnableReportFocus)
}

func (m *editorComponent) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case spinner.TickMsg:
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	case tea.KeyPressMsg:
		// Maximize editor responsiveness for printable characters
		if msg.Text != "" {
			m.textarea, cmd = m.textarea.Update(msg)
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		}
	case dialog.ThemeSelectedMsg:
		m.textarea = createTextArea(&m.textarea)
		m.spinner = createSpinner()
		return m, tea.Batch(m.spinner.Tick, m.textarea.Focus())
	case dialog.CompletionSelectedMsg:
		if msg.IsCommand {
			commandName := strings.TrimPrefix(msg.CompletionValue, "/")
			updated, cmd := m.Clear()
			m = updated.(*editorComponent)
			cmds = append(cmds, cmd)
			cmds = append(cmds, util.CmdHandler(commands.ExecuteCommandMsg(m.app.Commands[commands.CommandName(commandName)])))
			return m, tea.Batch(cmds...)
		} else {
			existingValue := m.textarea.Value()

			// Replace the current token (after last space)
			lastSpaceIndex := strings.LastIndex(existingValue, " ")
			if lastSpaceIndex == -1 {
				m.textarea.SetValue(msg.CompletionValue + " ")
			} else {
				modifiedValue := existingValue[:lastSpaceIndex+1] + msg.CompletionValue
				m.textarea.SetValue(modifiedValue + " ")
			}
			return m, nil
		}
	}

	m.spinner, cmd = m.spinner.Update(msg)
	cmds = append(cmds, cmd)

	// Handle mouse events with coordinate translation
	switch mouseMsg := msg.(type) {
	case tea.MouseClickMsg:
		// Check if click is on the scrollbar first (at editor level)
		if m.handleEditorScrollbarClick(mouseMsg) {
			// Scrollbar click handled at editor level
		} else {
			// Translate coordinates to textarea-relative position
			// Account for: border (1), padding top (1), prompt (2 chars including space)
			translatedMsg := tea.MouseClickMsg{
				X:      mouseMsg.X - 3, // border(1) + prompt(2)
				Y:      mouseMsg.Y - 2, // border(1) + padding(1)
				Button: mouseMsg.Button,
			}
			m.textarea, cmd = m.textarea.Update(translatedMsg)
		}
	case tea.MouseMotionMsg:
		if m.isDragging {
			m.handleEditorScrollbarDrag(mouseMsg)
		} else {
			translatedMsg := tea.MouseMotionMsg{
				X: mouseMsg.X - 3, // border(1) + prompt(2)
				Y: mouseMsg.Y - 2, // border(1) + padding(1)
			}
			m.textarea, cmd = m.textarea.Update(translatedMsg)
		}
	case tea.MouseReleaseMsg:
		if m.isDragging {
			m.isDragging = false
		} else {
			translatedMsg := tea.MouseReleaseMsg{
				X:      mouseMsg.X - 3, // border(1) + prompt(2)
				Y:      mouseMsg.Y - 2, // border(1) + padding(1)
				Button: mouseMsg.Button,
			}
			m.textarea, cmd = m.textarea.Update(translatedMsg)
		}
	default:
		m.textarea, cmd = m.textarea.Update(msg)
	}
	cmds = append(cmds, cmd)

	return m, tea.Batch(cmds...)
}

func (m *editorComponent) Content() string {
	t := theme.CurrentTheme()
	base := styles.NewStyle().Foreground(t.Text()).Background(t.Background()).Render
	muted := styles.NewStyle().Foreground(t.TextMuted()).Background(t.Background()).Render
	promptStyle := styles.NewStyle().Foreground(t.Primary()).
		Padding(0, 0, 0, 1).
		Bold(true)
	prompt := promptStyle.Render(">")

	textarea := lipgloss.JoinHorizontal(
		lipgloss.Top,
		prompt,
		m.textarea.View(),
	)
	textarea = styles.NewStyle().
		Background(t.BackgroundElement()).
		Width(m.width).
		PaddingTop(1).
		PaddingBottom(1).
		BorderStyle(lipgloss.ThickBorder()).
		BorderForeground(t.Border()).
		BorderBackground(t.Background()).
		BorderLeft(true).
		BorderRight(true).
		Render(textarea)

	// Add scrollbar overlay on the right border if needed
	if m.textarea.MaxHeight > 0 && len(m.textarea.Value()) > 0 {
		scrollbar := m.renderEditorScrollbar()
		if scrollbar != "" {
			// Position scrollbar on the right border
			scrollbarX := m.width - 1
			scrollbarY := 1 // Account for top border
			textarea = layout.PlaceOverlay(scrollbarX, scrollbarY, scrollbar, textarea)
		}
	}

	hint := base(m.getSubmitKeyText()) + muted(" send   ")
	if m.app.IsBusy() {
		keyText := m.getInterruptKeyText()
		if m.interruptKeyInDebounce {
			hint = muted("working") + m.spinner.View() + muted("  ") + base(keyText+" again") + muted(" interrupt")
		} else {
			hint = muted("working") + m.spinner.View() + muted("  ") + base(keyText) + muted(" interrupt")
		}
	}

	model := ""
	if m.app.Model != nil {
		model = muted(m.app.Provider.Name) + base(" "+m.app.Model.Name)
	}

	space := m.width - 2 - lipgloss.Width(model) - lipgloss.Width(hint)
	spacer := styles.NewStyle().Background(t.Background()).Width(space).Render("")

	info := hint + spacer + model
	info = styles.NewStyle().Background(t.Background()).Padding(0, 1).Render(info)

	content := strings.Join([]string{"", textarea, info}, "\n")
	return content
}

func (m *editorComponent) View() string {
	if m.Lines() > 1 {
		return ""
	}
	return m.Content()
}

func (m *editorComponent) Focused() bool {
	return m.textarea.Focused()
}

func (m *editorComponent) Focus() (tea.Model, tea.Cmd) {
	return m, m.textarea.Focus()
}

func (m *editorComponent) Blur() {
	m.textarea.Blur()
}

func (m *editorComponent) GetSize() (width, height int) {
	return m.width, m.height
}

func (m *editorComponent) SetSize(width, height int) tea.Cmd {
	m.width = width
	m.height = height
	return nil
}

func (m *editorComponent) Lines() int {
	// If MaxHeight is set, grow naturally up to MaxHeight, then stay fixed
	if m.textarea.MaxHeight > 0 {
		contentLines := m.textarea.LineCount()
		if contentLines <= m.textarea.MaxHeight {
			return contentLines
		} else {
			return m.textarea.MaxHeight
		}
	}
	return m.textarea.LineCount()
}

func (m *editorComponent) Value() string {
	return m.textarea.Value()
}

func (m *editorComponent) Submit() (tea.Model, tea.Cmd) {
	value := strings.TrimSpace(m.Value())
	if value == "" {
		return m, nil
	}
	if len(value) > 0 && value[len(value)-1] == '\\' {
		// If the last character is a backslash, remove it and add a newline
		m.textarea.SetValue(value[:len(value)-1] + "\n")
		return m, nil
	}

	var cmds []tea.Cmd
	updated, cmd := m.Clear()
	m = updated.(*editorComponent)
	cmds = append(cmds, cmd)

	attachments := m.attachments

	// Save to history if not empty and not a duplicate of the last entry
	if value != "" {
		if len(m.history) == 0 || m.history[len(m.history)-1] != value {
			m.history = append(m.history, value)
		}
		m.historyIndex = len(m.history)
		m.currentMessage = ""
	}

	m.attachments = nil

	cmds = append(cmds, util.CmdHandler(app.SendMsg{Text: value, Attachments: attachments}))
	return m, tea.Batch(cmds...)
}

func (m *editorComponent) Clear() (tea.Model, tea.Cmd) {
	m.textarea.Reset()
	return m, nil
}

func (m *editorComponent) Paste() (tea.Model, tea.Cmd) {
	imageBytes, text, err := image.GetImageFromClipboard()
	if err != nil {
		slog.Error(err.Error())
		return m, nil
	}
	if len(imageBytes) != 0 {
		attachmentName := fmt.Sprintf("clipboard-image-%d", len(m.attachments))
		attachment := app.Attachment{FilePath: attachmentName, FileName: attachmentName, Content: imageBytes, MimeType: "image/png"}
		m.attachments = append(m.attachments, attachment)
	} else {
		m.textarea.SetValue(m.textarea.Value() + text)
	}
	return m, nil
}

func (m *editorComponent) Newline() (tea.Model, tea.Cmd) {
	m.textarea.Newline()
	return m, nil
}

func (m *editorComponent) Previous() (tea.Model, tea.Cmd) {
	currentLine := m.textarea.Line()

	// Only navigate history if we're at the first line
	if currentLine == 0 && len(m.history) > 0 {
		// Save current message if we're just starting to navigate
		if m.historyIndex == len(m.history) {
			m.currentMessage = m.textarea.Value()
		}

		// Go to previous message in history
		if m.historyIndex > 0 {
			m.historyIndex--
			m.textarea.SetValue(m.history[m.historyIndex])
		}
		return m, nil
	}
	return m, nil
}

func (m *editorComponent) Next() (tea.Model, tea.Cmd) {
	currentLine := m.textarea.Line()
	value := m.textarea.Value()
	lines := strings.Split(value, "\n")
	totalLines := len(lines)

	// Only navigate history if we're at the last line
	if currentLine == totalLines-1 {
		if m.historyIndex < len(m.history)-1 {
			// Go to next message in history
			m.historyIndex++
			m.textarea.SetValue(m.history[m.historyIndex])
		} else if m.historyIndex == len(m.history)-1 {
			// Return to the current message being composed
			m.historyIndex = len(m.history)
			m.textarea.SetValue(m.currentMessage)
		}
		return m, nil
	}
	return m, nil
}

func (m *editorComponent) SetInterruptKeyInDebounce(inDebounce bool) {
	m.interruptKeyInDebounce = inDebounce
}

func (m *editorComponent) getInterruptKeyText() string {
	return m.app.Commands[commands.SessionInterruptCommand].Keys()[0]
}

func (m *editorComponent) getSubmitKeyText() string {
	return m.app.Commands[commands.InputSubmitCommand].Keys()[0]
}

func createTextArea(existing *textarea.Model) textarea.Model {
	t := theme.CurrentTheme()
	bgColor := t.BackgroundElement()
	textColor := t.Text()
	textMutedColor := t.TextMuted()

	ta := textarea.New()

	ta.Styles.Blurred.Base = styles.NewStyle().Foreground(textColor).Background(bgColor).Lipgloss()
	ta.Styles.Blurred.CursorLine = styles.NewStyle().Background(bgColor).Lipgloss()
	ta.Styles.Blurred.Placeholder = styles.NewStyle().Foreground(textMutedColor).Background(bgColor).Lipgloss()
	ta.Styles.Blurred.Text = styles.NewStyle().Foreground(textColor).Background(bgColor).Lipgloss()
	ta.Styles.Focused.Base = styles.NewStyle().Foreground(textColor).Background(bgColor).Lipgloss()
	ta.Styles.Focused.CursorLine = styles.NewStyle().Background(bgColor).Lipgloss()
	ta.Styles.Focused.Placeholder = styles.NewStyle().Foreground(textMutedColor).Background(bgColor).Lipgloss()
	ta.Styles.Focused.Text = styles.NewStyle().Foreground(textColor).Background(bgColor).Lipgloss()
	ta.Styles.Cursor.Color = t.Primary()

	ta.Prompt = " "
	ta.ShowLineNumbers = false
	ta.CharLimit = -1
	ta.SetWidth(layout.Current.Container.Width - 6)

	// Limit height to 8 lines to prevent excessive growth
	ta.MaxHeight = 8

	if existing != nil {
		ta.SetValue(existing.Value())
		// ta.SetWidth(existing.Width())
		ta.SetHeight(existing.Height())
	}

	// ta.Focus()
	return ta
}

func createSpinner() spinner.Model {
	t := theme.CurrentTheme()
	return spinner.New(
		spinner.WithSpinner(spinner.Ellipsis),
		spinner.WithStyle(
			styles.NewStyle().
				Background(t.Background()).
				Foreground(t.TextMuted()).
				Width(3).
				Lipgloss(),
		),
	)
}

func NewEditorComponent(app *app.App) EditorComponent {
	s := createSpinner()
	ta := createTextArea(nil)

	return &editorComponent{
		app:                    app,
		textarea:               ta,
		history:                []string{},
		historyIndex:           0,
		currentMessage:         "",
		spinner:                s,
		interruptKeyInDebounce: false,
	}
}

// renderEditorScrollbar creates a scrollbar for the editor container
func (m *editorComponent) renderEditorScrollbar() string {
	if m.textarea.MaxHeight <= 0 {
		return ""
	}

	totalLines := m.textarea.LineCount()
	visibleLines := m.textarea.MaxHeight

	if totalLines <= visibleLines {
		return ""
	}

	scrollableLines := totalLines - visibleLines
	scrollOffset := m.textarea.ScrollOffset()

	// Calculate thumb position and size
	thumbSize := max(1, (visibleLines*visibleLines)/totalLines)
	trackSize := visibleLines - thumbSize

	var thumbPosition int
	if trackSize > 0 {
		thumbPosition = (scrollOffset * trackSize) / scrollableLines
	}

	// Build scrollbar
	var scrollbar strings.Builder
	for i := 0; i < visibleLines; i++ {
		if i >= thumbPosition && i < thumbPosition+thumbSize {
			scrollbar.WriteString("█") // Thumb
		} else {
			scrollbar.WriteString("│") // Track
		}
		if i < visibleLines-1 {
			scrollbar.WriteString("\n")
		}
	}

	return scrollbar.String()
}

// handleEditorScrollbarClick handles mouse clicks on the editor-level scrollbar
func (m *editorComponent) handleEditorScrollbarClick(msg tea.MouseClickMsg) bool {
	// Check if we should show scrollbar
	if m.textarea.MaxHeight <= 0 {
		return false
	}

	totalLines := m.textarea.LineCount()
	visibleLines := m.textarea.MaxHeight

	if totalLines <= visibleLines {
		return false
	}

	// Check if click is on the scrollbar column (rightmost of container)
	scrollbarX := m.width - 1
	if msg.X != scrollbarX {
		return false
	}

	// Check if click is within the scrollbar area (account for borders and padding)
	scrollbarStartY := 2 // top border + padding
	scrollbarEndY := scrollbarStartY + visibleLines - 1

	if msg.Y < scrollbarStartY || msg.Y > scrollbarEndY {
		return false
	}

	// Convert to scrollbar-relative coordinates
	clickY := msg.Y - scrollbarStartY

	scrollableLines := totalLines - visibleLines
	scrollOffset := m.textarea.ScrollOffset()

	// Calculate thumb position and size
	thumbSize := max(1, (visibleLines*visibleLines)/totalLines)
	trackSize := visibleLines - thumbSize

	var thumbPosition int
	if trackSize > 0 {
		thumbPosition = (scrollOffset * trackSize) / scrollableLines
	}

	// Check if click is on the thumb (start drag) or track (jump)
	thumbStart := thumbPosition
	thumbEnd := thumbPosition + thumbSize

	if clickY >= thumbStart && clickY <= thumbEnd {
		// Start dragging
		m.isDragging = true
		m.dragStartY = msg.Y
		m.dragStartOffset = scrollOffset
	} else {
		// Jump to position
		targetPosition := float64(clickY) / float64(visibleLines)
		newOffset := int(targetPosition * float64(scrollableLines))
		m.setTextareaScrollOffset(m.clamp(newOffset, 0, scrollableLines))
	}

	return true
}

// handleEditorScrollbarDrag handles mouse drag events on the editor-level scrollbar
func (m *editorComponent) handleEditorScrollbarDrag(msg tea.MouseMotionMsg) {
	if !m.isDragging {
		return
	}

	totalLines := m.textarea.LineCount()
	visibleLines := m.textarea.MaxHeight
	scrollableLines := totalLines - visibleLines

	if scrollableLines <= 0 {
		return
	}

	// Calculate movement
	deltaY := msg.Y - m.dragStartY
	trackSize := visibleLines - max(1, (visibleLines*visibleLines)/totalLines)

	if trackSize <= 0 {
		return
	}

	// Convert pixel movement to scroll offset
	scrollDelta := (deltaY * scrollableLines) / trackSize
	newOffset := m.dragStartOffset + scrollDelta
	m.setTextareaScrollOffset(m.clamp(newOffset, 0, scrollableLines))
}

// setTextareaScrollOffset sets the scroll offset on the textarea
func (m *editorComponent) setTextareaScrollOffset(offset int) {
	// We need to access the textarea's internal scroll offset
	// For now, we'll use a workaround by simulating scroll commands
	currentOffset := m.textarea.ScrollOffset()
	diff := offset - currentOffset

	if diff > 0 {
		// Scroll down
		for i := 0; i < diff; i++ {
			m.textarea.CursorDown()
		}
	} else if diff < 0 {
		// Scroll up
		for i := 0; i < -diff; i++ {
			m.textarea.CursorUp()
		}
	}
}

// clamp constrains a value between low and high bounds
func (m *editorComponent) clamp(v, low, high int) int {
	if high < low {
		low, high = high, low
	}
	return min(high, max(low, v))
}
