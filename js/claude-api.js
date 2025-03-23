/**
 * Claude API client for the Text Marker extension
 *
 * Handles API key management and Claude API integration
 */

// Local storage key for API keys
const API_KEY_STORAGE_KEY = "text_marker_api_key";
const SERVER_URL = "http://localhost:3000"; // Local proxy server URL

/**
 * Retrieves stored API keys from chrome.storage
 * @returns {Promise<Object>} Object containing API keys
 */
function getStoredApiKeys() {
  return new Promise((resolve) => {
    chrome.storage.local.get([API_KEY_STORAGE_KEY], function(result) {
      resolve(result[API_KEY_STORAGE_KEY] || { anthropicApiKey: null, mochiApiKey: null });
    });
  });
}

/**
 * Stores API keys in chrome.storage
 * @param {string} anthropicApiKey - Claude API key
 * @param {string} mochiApiKey - Mochi API key
 * @param {boolean} storeLocally - Whether to store keys locally
 * @returns {Promise<boolean>} Success status
 */
function storeApiKeys(anthropicApiKey, mochiApiKey, storeLocally = true) {
  return new Promise((resolve) => {
    if (storeLocally) {
      chrome.storage.local.set({[API_KEY_STORAGE_KEY]: { anthropicApiKey, mochiApiKey }}, function() {
        resolve(true);
      });
    } else {
      chrome.storage.local.remove([API_KEY_STORAGE_KEY], function() {
        resolve(true);
      });
    }
  });
}

/**
 * Validates format of Anthropic API key
 * @param {string} key - API key to validate
 * @returns {boolean} Whether key appears valid
 */
function validateAnthropicApiKey(key) {
  return key && key.startsWith('sk-ant-') && key.length > 20;
}

/**
 * Validates format of Mochi API key (basic validation)
 * @param {string} key - API key to validate
 * @returns {boolean} Whether key appears valid
 */
function validateMochiApiKey(key) {
  // Mochi keys should be non-empty and reasonably long
  // Return true for empty keys (since Mochi API key is optional)
  if (!key) return true;
  return key.length > 10;
}

/**
 * Checks if API key is configured
 * @returns {Promise<boolean>} Whether key is available
 */
async function hasApiKey() {
  const keys = await getStoredApiKeys();
  return !!keys.anthropicApiKey;
}

/**
 * Truncates text to a reasonable size
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 8000) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '... [truncated]';
}

/**
 * Parses Claude's response to extract structured card data
 * @param {Object} responseData - Raw response from Claude API
 * @returns {Array} Array of card objects
 */
function parseClaudeResponse(responseData) {
  let responseText = '';

  // Extract text content from response
  if (responseData.content && Array.isArray(responseData.content)) {
    for (const item of responseData.content) {
      if (item.type === 'text') {
        responseText += item.text;
      }
    }
  } else {
    console.warn('Unexpected response format from Claude API');
    responseText = JSON.stringify(responseData);
  }

  // Try to parse as JSON
  try {
    // First, extract JSON if it's embedded in other text
    const jsonMatch = responseText.match(/(\[\s*\{.*\}\s*\])/s);
    const jsonText = jsonMatch ? jsonMatch[1] : responseText;

    const parsedCards = JSON.parse(jsonText);
    console.log('Successfully parsed JSON cards:', parsedCards);

    if (Array.isArray(parsedCards) && parsedCards.length > 0) {
      const validCards = parsedCards.filter(card => card.front && card.back)
        .map(card => ({
          front: card.front,
          back: card.back,
          deck: card.deck || "General"
        }));

      if (validCards.length > 0) {
        console.log('Returning valid JSON cards:', validCards);
        return validCards;
      }
    }
    console.warn('Parsed JSON did not contain valid cards');
  } catch (error) {
    console.warn('Failed to parse response as JSON:', error);

    // Try searching for JSON inside the text (sometimes Claude wraps JSON in backticks or other text)
    try {
      const jsonRegex = /```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/;
      const match = responseText.match(jsonRegex);
      if (match && match[1]) {
        const extractedJson = match[1];
        const parsedCards = JSON.parse(extractedJson);

        if (Array.isArray(parsedCards) && parsedCards.length > 0) {
          const validCards = parsedCards.filter(card => card.front && card.back)
            .map(card => ({
              front: card.front,
              back: card.back,
              deck: card.deck || "General"
            }));

          if (validCards.length > 0) {
            console.log('Returning valid JSON cards (extracted from code block):', validCards);
            return validCards;
          }
        }
      }
    } catch (innerError) {
      console.warn('Failed to extract JSON from code blocks:', innerError);
    }
  }

  // Fallback: If JSON parsing fails, create a basic fallback card
  console.warn('Could not parse any cards from Claude response, using fallback');
  return [{
    front: "What are the key concepts from this text?",
    back: responseText.length > 300
      ? responseText.substring(0, 300) + "..."
      : responseText,
    deck: "General"
  }];
}

/**
 * Generate example cards as a fallback
 */
function generateExampleCards(text) {
  const excerpt = text.length > 50 ? text.substring(0, 50) + "..." : text;
  return [
    {
      front: `What are the key concepts from: "${excerpt}"?`,
      back: "This text discusses important concepts related to the topic. The main points include understanding the context, analyzing the information, and drawing conclusions.",
      deck: "General"
    },
    {
      front: `How would you summarize: "${excerpt}"?`,
      back: "The text provides an overview of the subject matter, highlighting relevant details and explaining the significance in the broader context.",
      deck: "Summary"
    },
    {
      front: `What questions might arise from: "${excerpt}"?`,
      back: "1. How does this information relate to the broader field?\n2. What evidence supports these claims?\n3. What are the practical applications of this knowledge?",
      deck: "Questions"
    }
  ];
}

/**
 * Checks if the proxy server is running
 * @returns {Promise<boolean>} Whether server is available
 */
async function isProxyServerRunning() {
  try {
    const response = await fetch(`${SERVER_URL}/`, { 
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    return response.ok;
  } catch (error) {
    console.log('Proxy server is not running:', error);
    return false;
  }
}

/**
 * Calls Claude API to generate flashcards from text
 * @param {string} text - The marked text to create cards from
 * @returns {Promise<Array>} - Array of card objects with front, back, and deck properties
 */
async function generateCardsWithClaude(text) {
  try {
    // Get stored API key
    const { anthropicApiKey } = await getStoredApiKeys();

    // Check if we have an API key
    if (!anthropicApiKey) {
      throw new Error('No Claude API key available. Please add your API key in the extension settings.');
    }

    const truncatedText = truncateText(text);
    console.log('Generating cards for text:', truncatedText.substring(0, 100) + '...');
    
    // Check if our proxy server is running
    const serverRunning = await isProxyServerRunning();
    
    if (!serverRunning) {
      console.log('Proxy server is not running, using example cards');
      alert('The proxy server is not running. Please start the server by running:\n\n' +
            'npm install\nnpm start\n\n' +
            'In the meantime, example cards will be shown.');
      return generateExampleCards(text);
    }
    
    // Send the request through our proxy server
    console.log('Sending request to proxy server');
    const response = await fetch(`${SERVER_URL}/proxy/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: truncatedText,
        apiKey: anthropicApiKey
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    return parseClaudeResponse(responseData);
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}

/**
 * NOTE: This function is now moved to mochi-api.js
 * This is just a wrapper to avoid breaking existing code
 * @param {Array} cards - Array of card objects to export 
 * @returns {Promise<Object>} Response status
 */
async function exportCardsToMochi(cards) {
  // Check if MochiApi is available in the global scope
  if (typeof MochiApi !== 'undefined' && MochiApi.exportCardsToMochi) {
    console.log('Using MochiApi.exportCardsToMochi from mochi-api.js');
    return MochiApi.exportCardsToMochi(cards);
  }
  
  // Fallback implementation if MochiApi is not available
  try {
    // Get stored API key
    const { mochiApiKey } = await getStoredApiKeys();

    // Check if we have an API key
    if (!mochiApiKey) {
      throw new Error('No Mochi API key available. Please add your API key in the extension settings.');
    }

    // Check if our proxy server is running
    const serverRunning = await isProxyServerRunning();
    
    if (!serverRunning) {
      throw new Error('The proxy server is not running. Please start the server to export to Mochi.');
    }
    
    // Send the request through our proxy server
    console.log('Sending request to Mochi API via proxy server');
    const response = await fetch(`${SERVER_URL}/proxy/mochi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cards,
        apiKey: mochiApiKey
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mochi API Error: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    return { success: true, data: responseData };
  } catch (error) {
    console.error('Error calling Mochi API:', error);
    throw error;
  }
}

// Export functions
class ClaudeApi {
  static getStoredApiKeys = getStoredApiKeys;
  static storeApiKeys = storeApiKeys;
  static validateAnthropicApiKey = validateAnthropicApiKey;
  static validateMochiApiKey = validateMochiApiKey;
  static hasApiKey = hasApiKey;
  static generateCardsWithClaude = generateCardsWithClaude;
  static exportCardsToMochi = exportCardsToMochi;
}