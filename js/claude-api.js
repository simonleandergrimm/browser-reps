/**
 * Claude API client for the Text Marker extension
 *
 * Handles card generation using Claude API via proxy server
 */

const SERVER_URL = "http://localhost:3000"; // Local proxy server URL

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

  // If all parsing fails, throw an error
  console.warn('Could not parse any cards from Claude response');
  throw new Error('Could not parse flashcards from Claude response. Please try again with different text.');
}

/**
 * Calls Claude API to generate flashcards from text
 * @param {string} text - The marked text to create cards from
 * @returns {Promise<Array>} - Array of card objects with front, back, and deck properties
 */
async function generateCardsWithClaude(text) {
  try {
    const truncatedText = truncateText(text);
    console.log('Generating cards for text:', truncatedText.substring(0, 100) + '...');
    
    // Check if our proxy server is running
    const serverRunning = await isProxyServerRunning();
    
    if (!serverRunning) {
      console.log('Proxy server is not running');
      throw new Error('The proxy server is not running. Please start the server by running:\n\n' +
            'npm install\nnpm start');
    }
    
    // Create the specific prompt for Claude
    const cardGenerationPrompt = `Guidelines for creating excellent flashcards:
• Be EXTREMELY concise - answers should be 1-2 sentences maximum!
• Focus on core concepts, relationships, and techniques rather than trivia or isolated facts
• Break complex ideas into smaller, atomic concepts
• Ensure each card tests one specific idea (atomic)
• Front of card should ask a specific question that prompts recall
• Back of card should provide the shortest possible complete answer
• CRITICAL: Keep answers as brief as possible while maintaining accuracy - aim for 10-25 words max
• When referencing the author or source, use their specific name rather than general phrases like "the author" or "this text" which won't make sense months later when the user is reviewing the cards
• Try to cite the author or the source when discussing something that is not an established concept but rather a new take or theory or prediction.
• The questions should be precise and unambiguously exclude alternative correct answers
• The questions should encode ideas from multiple angles
• Avoid yes/no question, or, in general, questions that admit a binary answer
• Avoid unordered lists of items (especially if they contain many items)
• If quantities are involved, they should be relative, or the unit of measure should be specified in the question

CRITICAL: You MUST ALWAYS output your response as a valid JSON array of card objects. NEVER provide any prose, explanation or markdown formatting.

Each card object must have the following structure:
{
  "front": "The question or prompt text goes here",
  "back": "The answer or explanation text goes here",
  "deck": "General"
}

Generate between 1-5 cards depending on the complexity and amount of content in the highlighted text.
Your response MUST BE ONLY valid JSON - no introduction, no explanation, no markdown formatting.

Here is the text to create flashcards from:
${truncatedText}`;

    console.log('Sending request to proxy server with custom prompt');
    
    // Send the request through our proxy server (no longer sending API key)
    const response = await fetch(`${SERVER_URL}/proxy/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: cardGenerationPrompt // Use our custom prompt instead of just the text
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
 * Exports cards to Mochi using the server proxy
 * @param {Array} cards - Array of card objects to export 
 * @returns {Promise<Object>} Response status
 */
async function exportCardsToMochi(cards) {
  try {
    // Check if our proxy server is running
    const serverRunning = await isProxyServerRunning();
    
    if (!serverRunning) {
      throw new Error('The proxy server is not running. Please start the server to export to Mochi.');
    }
    
    // Send the request through our proxy server (no longer sending API key)
    console.log('Sending request to Mochi API via proxy server');
    const response = await fetch(`${SERVER_URL}/proxy/mochi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cards
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
  static isProxyServerRunning = isProxyServerRunning;
  static generateCardsWithClaude = generateCardsWithClaude;
  static exportCardsToMochi = exportCardsToMochi;
}