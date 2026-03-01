# ReadWalk

Navigate static web content using word and paragraph motions — a visual pacer for reading.

## Features

### Normal Mode

| Key | Action |
|-----|--------|
| `w` | Select next word |
| `b` | Select previous word |
| `y` | Yank (copy) selected text |
| `Escape` | Clear selection |

### Visual Mode

| Key | Action |
|-----|--------|
| `v` | Toggle visual mode (extend selection) |
| `w` | Extend selection to next word |
| `b` | Extend selection backward |
| `y` | Yank selection and exit visual mode |
| `Escape` | Exit visual mode (keep selection) |

### Both Modes

| Key | Action |
|-----|--------|
| `{` | Jump to previous paragraph |
| `}` | Jump to next paragraph |

### Mouse Mode

Enable Mouse Mode from the extension popup (click the ReadWalk icon in the browser toolbar).

| Action | Result |
|--------|--------|
| Left click (with selection) | Select next word |
| Right click (with selection) | Select previous word |

**Requirements:**
- A word must already be selected (double-click to select, or use keyboard)
- Works in both Normal and Visual mode

All keys are automatically disabled inside text inputs, textareas, and contenteditable elements.

## Setup

```bash
npm install
```

## Development

```bash
npm start
```

This launches Firefox with the extension loaded. Source changes trigger automatic reload.

**Linux (Snap) users:** If you see a "Profile Missing" error, ensure the local profile directory exists:
```bash
mkdir -p firefox-profile
```

## Build

To build the `.zip` for distribution:

```bash
npm run build
```

## Linting

```bash
npm run lint
```
