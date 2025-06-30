# OpenCode Enhanced - Personal Development Workspace

This is Jacob's personal development workspace for OpenCode enhancements. All features are developed and tested here before submitting clean PRs upstream.

## 🚀 Quick Start

```bash
# Run development version with ALL features
./opencode-dev-launcher.sh

# Current branch with all features
git checkout personal-main
```

## 📁 Repository Structure

```
opencode-enhanced/
├── packages/
│   ├── opencode/       # Main CLI (TypeScript/Bun)
│   └── tui/           # Terminal UI (Go/Bubble Tea)
├── AGENTS.md          # This file - NEVER include in PRs!
├── opencode-dev-launcher.sh  # Dev script - NEVER include in PRs!
└── .gitignore
```

## 🔄 Git Workflow (CRITICAL)

### Branch Strategy

- **`personal-main`**: Your main branch with ALL features combined
- **Feature branches**: Individual branches for clean PRs to upstream
- **Personal repo**: https://github.com/BurgessTheGamer/opencode

### ⚠️ NEVER Include in PRs

- `AGENTS.md` - Personal documentation
- `opencode-dev-launcher.sh` - Personal dev script
- Any other personal files

### PR Workflow

1. Always work on `personal-main` for development
2. Create clean feature branches from `origin/dev` for PRs
3. Cherry-pick only the specific feature changes
4. NEVER auto-submit PRs - always ask first
5. Each feature gets its own PR

## ✅ Completed Features

### 1. Interactive Scrollbar - PR #486 (MERGED ✅)

- **Location**: `packages/tui/internal/components/chat/messages.go`
- **Features**: Click/drag scrollbar for message area
- **Status**: Successfully merged into main repo

### 2. Text Selection & Copy - PR #518

- **Location**: `packages/tui/internal/components/chat/messages.go`
- **Features**: Click+drag selection, Ctrl+Shift+C to copy
- **Status**: Submitted, pending review

### 3. Aiken LSP Support - PR #547 (Updated ✅)

- **Location**: `packages/opencode/src/lsp/server.ts`
- **Implementation**: Uses `bun x @aiken-lang/aiken lsp` pattern
- **Status**: Updated based on feedback, pending review

### 4. Chat Box Height Limiting - PR #565

- **Location**: `packages/tui/internal/components/textarea/textarea.go`
- **Features**: Grows 1-8 lines, then scrolls with scrollbar
- **Status**: Submitted, pending review

### 5. Text Input Scrollbar (99% Complete)

- **Location**: `packages/tui/internal/components/chat/editor.go`
- **Status**: Works except bottom 1-2 pixels (parent bounds issue)
- **Not yet PR'd**: Saved in personal repo

## 🛠️ Development Commands

```bash
# Test changes
./opencode-dev-launcher.sh

# Build TUI only
cd packages/tui && go build -o opencode-dev ./cmd/opencode

# Run TypeScript CLI directly
cd packages/opencode && bun run ./src/index.ts

# Push to personal repo
git push personal personal-main:main
```

## 📋 Technical Architecture

### TUI System (Go/Bubble Tea)

- **Entry**: `packages/tui/cmd/opencode/main.go`
- **Core Model**: `packages/tui/internal/tui/tui.go`
- **Components**: `packages/tui/internal/components/`
- **Layout System**: Flex layout with overlay support
- **Theme System**: Adaptive colors for light/dark terminals

### CLI System (TypeScript/Bun)

- **Entry**: `packages/opencode/src/index.ts`
- **LSP Support**: `packages/opencode/src/lsp/server.ts`
- **Tools**: `packages/opencode/src/tool/`
- **Pattern**: Use `bun x` for npm packages (no global installs)

### Key Patterns

- **Message Passing**: All UI communication via Bubble Tea messages
- **Component Isolation**: Each component manages its own state
- **Overlay Rendering**: Advanced ANSI-aware overlay system
- **Performance**: Caching, selective updates, viewport optimization

## 🎯 Success Metrics

- **4 major features** implemented
- **3 PRs submitted**, 1 merged
- **Zero breaking changes**
- **100% TypeScript compilation**
- **Clean PR separation**

## 📝 Important Notes

### For AI Assistants

1. ALWAYS save to personal repo first
2. NEVER auto-submit PRs without asking
3. Keep `AGENTS.md` and `opencode-dev-launcher.sh` out of PRs
4. Test on `personal-main`, PR from feature branches
5. Use `bun x` pattern for npm packages

### Common Issues

- **Build errors**: Usually missing layout dependencies
- **Mouse events**: Check parent component bounds
- **LSP issues**: Ensure using `bun x` pattern

## 🔗 Resources

- [Personal Repo](https://github.com/BurgessTheGamer/opencode)
- [OpenCode Main](https://github.com/sst/opencode)
- [Bubble Tea Docs](https://github.com/charmbracelet/bubbletea)

---

_Last updated: After PR #565 submission_
