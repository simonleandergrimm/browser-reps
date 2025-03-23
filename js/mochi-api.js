/**
 * Mochi API client for the Text Marker extension
 *
 * Handles Mochi API integration for exporting flashcards
 */

// Local storage key for API key (shared with Claude API)
const API_KEY_STORAGE_KEY = "text_marker_api_key";

/**
 * Retrieves stored API keys from chrome.storage
 * @returns {Promise<Object>} Object containing API keys
 */
function getStoredMochiApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get([API_KEY_STORAGE_KEY], function(result) {
      console.log('Retrieved API keys from storage:', result);
      resolve(result[API_KEY_STORAGE_KEY] || { anthropicApiKey: null, mochiApiKey: null });
    });
  });
}

/**
 * Validates format of Mochi API key (basic validation)
 * @param {string} key - API key to validate
 * @returns {boolean} Whether key appears valid
 */
function validateMochiApiKey(key) {
  // Mochi keys should be non-empty and reasonably long
  return key && key.length > 10;
}

/**
 * Checks if Mochi API key is configured
 * @returns {Promise<boolean>} Whether key is available
 */
async function hasMochiApiKey() {
  const keys = await getStoredMochiApiKey();
  return !!keys.mochiApiKey;
}

/**
 * Exports cards to Mochi using the Mochi API
 * @param {Array} cards - Array of card objects to export
 * @returns {Promise<Object>} Response from Mochi API
 */
async function exportCardsToMochi(cards) {
  try {
    // Get stored API key
    const { mochiApiKey } = await getStoredMochiApiKey();

    // Check if we have an API key
    if (!mochiApiKey) {
      throw new Error('No Mochi API key available. Please add your API key in the extension settings.');
    }

    // The Mochi API expects this format:
    // Each card has front, back properties
    const formattedCards = cards.map(card => ({
      front: card.front,
      back: card.back,
      deck: card.deck || "General"
    }));
    
    console.log('Formatted cards for Mochi:', formattedCards);
    
    // Create Basic Auth header (Mochi uses username:password format where password is empty)
    const authHeader = `Basic ${btoa(`${mochiApiKey}:`)}`;
    
    // Call the Mochi API to create cards through the proxy server
    // Make sure the proxy server is running at http://localhost:3000
    console.log('Sending cards to proxy server at http://localhost:3000/proxy/mochi');
    const response = await fetch('http://localhost:3000/proxy/mochi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cards: formattedCards,
        apiKey: mochiApiKey
      })
    });
    
    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mochi API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return { success: true, result };
  } catch (error) {
    console.error('Error exporting to Mochi:', error);
    throw error;
  }
}

// Export functions
class MochiApi {
  static getStoredMochiApiKey = getStoredMochiApiKey;
  static validateMochiApiKey = validateMochiApiKey;
  static hasMochiApiKey = hasMochiApiKey;
  static exportCardsToMochi = exportCardsToMochi;
}