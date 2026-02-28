# ReadWalk

Navigate static web content using word and paragraph motions — a visual pacer for reading.

## Features

| Key | Action |
|-----|--------|
| `w` | Jump to next word |
| `b` | Jump to previous word |
| `}` | Jump to next paragraph |
| `{` | Jump to previous paragraph |
| `v` | Toggle visual mode (extend selection) |
| `y` | Yank (copy) selection to clipboard |
| `Escape` | Exit visual mode |

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
