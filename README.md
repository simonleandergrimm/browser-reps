# Flashcard Generator Chrome Extension

A Chrome extension that generates flashcards from selected webpage text using Claude AI, and exports them to Mochi. Entirely vibe-coded, buyer beware.

## Features

- Select text on any webpage and generate flashcards with one keyboard shortcut
- Uses Claude AI to create high-quality, concise flashcards
- Edit flashcards before exporting
- Export directly to Mochi

## Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension directory

## Setup

1. Get a Claude API key from [Anthropic Console](https://console.anthropic.com/)
2. Get a Mochi API key from your Mochi account
3. Create a `.env` file in the project root (copy from `.env.example`):
   ```
   CLAUDE_API_KEY=sk-ant-your-api-key-here
   MOCHI_API_KEY=your-mochi-api-key-here
   ```
4. Start the proxy server:
   ```
   npm install
   npm start
   ```
5. The server must be running whenever you use the extension

## Usage

1. Start the proxy server on your local machine
2. Select text on any webpage
3. Press `Cmd+Shift+F` (Mac) or `Ctrl+Shift+F` (Windows) to generate flashcards
4. Edit flashcards if needed
5. Click "Export to Mochi" to send cards to your Mochi account

## How It Works

1. You select text in your browser
2. The extension captures the selected text
3. The proxy server securely manages API keys (stored in the .env file)
4. The server sends the text to Claude with a specialized prompt
5. Claude creates 1-5 flashcards depending on text complexity
6. Cards are returned as structured JSON objects
7. You can edit cards before exporting to Mochi
8. When exported, cards are formatted specifically for Mochi (front/back format with separator)

## Security

API keys are stored securely in the `.env` file on your local machine, not in the browser. The browser extension never has direct access to your API keys.

## Troubleshooting

- If you see "Proxy server not running" - make sure you've started the server with `npm start`
- If cards fail to generate - check your Claude API key and available credits
- If export fails - check your Mochi API key and connection
