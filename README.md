# Text Marker Chrome Extension

A Chrome extension that allows users to select and mark text on webpages for generating Mochi flashcards using Claude AI.

## Features

- Select text on any webpage to automatically mark it
- Process marked text with Claude AI to generate flashcards
- Edit generated flashcards
- Export flashcards as Markdown for use with Mochi
- Visual highlighting of marked text

## Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension directory

## Setup

1. Get a Claude API key from Anthropic
2. Start the local proxy server:
   ```
   npm install
   npm start
   ```
3. Open the extension popup and go to Settings
4. Enter your Claude API key and save

## Usage

1. Click the extension icon in the toolbar to open the popup
2. Click "Enable Marking" to activate text marking
3. Select text on any webpage - it will be automatically marked and highlighted
4. Go to the extension popup and see your marked texts in the first tab
5. Click "Generate Mochi Cards" to process the text with Claude AI
6. View, edit, and export your flashcards in the second tab

## How It Works

Due to browser security restrictions, the extension cannot directly call the Claude API. Instead, it uses a local proxy server to make the API calls. The proxy server is a simple Node.js Express server that forwards the request to Claude's API and returns the response to the extension.

## Required Assets

Before loading the extension, create icons for the extension:
- `/images/icon16.png` (16×16px)
- `/images/icon48.png` (48×48px)
- `/images/icon128.png` (128×128px)

## Troubleshooting

- If you see a message about the proxy server not running, make sure you have started the server with `npm start`
- If you get API errors, check that your Claude API key is valid and has sufficient credits
- If text marking doesn't work, try refreshing the page or reloading the extension