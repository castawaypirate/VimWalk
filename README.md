# VimWalk

Navigate static web content using Vim's `w`, `b`, `}`, `{` motions.

## Prerequisites

To run this project, you need:

*   **Node.js**: (You have v24.13.1 installed)
*   **npm**: (You have v11.8.0 installed)
*   **Firefox**: (You have it installed at `/usr/bin/firefox`)

## Setup

Install dependencies:
```bash
npm install
```

## Development

To run the extension in a temporary Firefox instance:

```bash
npm start
```

This will launch Firefox with the extension loaded. The extension will automatically reload if you change source files.

**Note for Linux (Snap) Users:**
If you see a "Profile Missing" error, it's likely because the Snap version of Firefox cannot access `/tmp`. This project is configured to use a local `firefox-profile` directory to workaround this issue. Ensure this directory exists:
```bash
mkdir -p firefox-profile
```

## Build

To build the extension for distribution (creates a `.zip` file in `web-ext-artifacts`):

```bash
npm run build
```

## Linting

To check the code for issues:

```bash
npm run lint
```
