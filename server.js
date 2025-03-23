// Simple proxy server for Claude API and Mochi API
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Enable CORS for extension requests
app.use(cors());
app.use(bodyParser.json());

// Endpoint to proxy Claude API requests
app.post('/proxy/claude', async (req, res) => {
  try {
    const { text, apiKey } = req.body;
    
    if (!text || !apiKey) {
      return res.status(400).json({ error: 'Missing required parameters: text and apiKey' });
    }
    
    console.log('Proxying request to Claude API');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        temperature: 0.2,
        system: `You are an expert at creating high-quality spaced repetition flashcards from highlighted text. Create 2-5 flashcards based on the provided text, following these guidelines:

• Be EXTREMELY concise - answers should be 1-2 sentences maximum (10-25 words)
• Focus on core concepts, relationships, and techniques rather than trivia or isolated facts
• Break complex ideas into smaller, atomic concepts - each card tests one specific idea
• Front of card should ask a specific question that prompts recall
• Back of card should provide the shortest possible complete answer
• When referencing authors or sources, use their specific names rather than phrases like 'the author' or 'this text'
• Try to cite the author or source when discussing non-established concepts, new theories or predictions
• Questions should be precise and unambiguously exclude alternative correct answers
• Avoid yes/no questions or any questions with binary answers
• Avoid unordered lists of items (especially if they contain many items)
• If quantities are involved, they should be relative, or the unit of measure should be in the question

Format your response as a JSON array of objects: [{"front": "Question?", "back": "Answer", "deck": "General"}].`,
        messages: [{
          role: 'user',
          content: `Please create Mochi flashcards from this text: \n\n${text}`
        }]
      })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error proxying to Claude API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to proxy Mochi API requests
app.post('/proxy/mochi', async (req, res) => {
  try {
    const { cards, apiKey } = req.body;
    
    if (!cards || !apiKey) {
      return res.status(400).json({ error: 'Missing required parameters: cards and apiKey' });
    }
    
    console.log('Proxying request to Mochi API');
    console.log('Cards to send:', JSON.stringify(cards).substring(0, 100) + '...');
    
    // Create Basic Auth header (Mochi uses username:password format where password is empty)
    const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
    
    // Mochi API expects a different format: individual cards with 'content' and 'deck-id' fields
    console.log('Preparing cards for Mochi API...');
    
    // First, get the user's decks to find a valid deck ID
    console.log('Fetching user decks from Mochi...');
    const decksResponse = await fetch('https://app.mochi.cards/api/decks/', {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });
    
    if (!decksResponse.ok) {
      const errorText = await decksResponse.text();
      throw new Error(`Mochi API Error (decks): ${decksResponse.status} - ${errorText}`);
    }
    
    const decksData = await decksResponse.json();
    console.log(`Found ${decksData.docs?.length || 0} decks`);
    
    // Find the first non-trashed, non-archived deck, or use the first deck as fallback
    let defaultDeckId = null;
    if (decksData.docs && decksData.docs.length > 0) {
      // Try to find a non-trashed, non-archived deck
      const activeDeck = decksData.docs.find(deck => !deck['trashed?'] && !deck['archived?']);
      defaultDeckId = activeDeck ? activeDeck.id : decksData.docs[0].id;
      console.log(`Using deck ID: ${defaultDeckId}`);
    } else {
      throw new Error('No decks found in Mochi account. Please create at least one deck.');
    }
    
    // Process cards one by one
    let allResults = [];
    
    for (const card of cards) {
      // Use the card's deck name to find a matching deck, or default to the first deck
      const deckName = card.deck || "General";
      let deckId = defaultDeckId;
      
      // Try to find a deck that matches the card's deck name
      if (decksData.docs) {
        const matchingDeck = decksData.docs.find(
          deck => deck.name.toLowerCase() === deckName.toLowerCase() && 
                 !deck['trashed?'] && 
                 !deck['archived?']
        );
        if (matchingDeck) {
          deckId = matchingDeck.id;
          console.log(`Found matching deck "${deckName}" with ID: ${deckId}`);
        }
      }
      
      // Format card content as markdown for Mochi
      // The key is to use the Mochi-specific format with a separator line (---)
      // Based on reference implementation, this is the required format
      const cardContent = `${card.front}\n---\n${card.back}`;
      
      // Add tags based on deck name if available
      const tags = [];
      if (card.deck && card.deck !== "General") {
        // Create a tag from the deck name (remove spaces, lowercase)
        tags.push(card.deck.replace(/\s+/g, '-').toLowerCase());
      }
      
      // Create the request payload
      const payload = {
        "content": cardContent,
        "deck-id": deckId
      };
      
      // Add optional parameters if we have tags
      if (tags.length > 0) {
        payload["manual-tags"] = tags;
      }
      
      // Log what we're sending
      console.log(`Sending card to Mochi API: ${cardContent.substring(0, 50)}... (deck ID: ${deckId})`);
      console.log('Full payload:', JSON.stringify(payload));
      
      // Make the API request for this individual card
      const response = await fetch('https://app.mochi.cards/api/cards/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(payload)
      });
      
      console.log(`Card upload status: ${response.status}`);
      
      // Process the result
      if (response.ok) {
        try {
          const responseData = await response.json();
          console.log('Success response from Mochi:', JSON.stringify(responseData).substring(0, 200));
          allResults.push({ success: true, id: responseData.id || 'unknown' });
        } catch (err) {
          console.error('Error parsing card upload response:', err);
          allResults.push({ success: false, error: 'Failed to parse response' });
        }
      } else {
        try {
          // Try to get a detailed error message
          const errorText = await response.text();
          let errorDetails = errorText;
          
          // Try to parse as JSON if possible for better error info
          try {
            const errorJson = JSON.parse(errorText);
            errorDetails = JSON.stringify(errorJson);
          } catch (jsonErr) {
            // Not JSON, use as is
          }
          
          console.error(`Error uploading card: ${response.status} - ${errorDetails}`);
          allResults.push({ 
            success: false, 
            error: `API error: ${response.status}`, 
            details: errorDetails 
          });
        } catch (err) {
          console.error('Error processing error response:', err);
          allResults.push({ success: false, error: `API error: ${response.status}` });
        }
      }
    }
    
    // Return a response with all the results
    const successCount = allResults.filter(r => r.success).length;
    
    // Create a mock response to match what the browser extension expects
    const response = {
      ok: successCount > 0,
      status: successCount > 0 ? 200 : 500,
      json: async () => ({ 
        success: successCount > 0,
        totalCards: cards.length,
        totalSuccess: successCount,
        results: allResults
      })
    };
    
    console.log('Mochi API response status:', response.status);
    
    // We've already processed the response status above
    // Now return the aggregated results
    const data = await response.json();
    console.log('Mochi API aggregated results:', JSON.stringify(data).substring(0, 100) + '...');
    res.json(data);
  } catch (error) {
    console.error('Error proxying to Mochi API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch Mochi decks
app.get('/proxy/mochi/decks', async (req, res) => {
  try {
    const { apiKey } = req.query;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing required parameter: apiKey' });
    }
    
    console.log('Fetching Mochi decks');
    
    // Create Basic Auth header
    const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
    
    // Call Mochi API to get decks
    console.log('Making request to get Mochi decks...');
    
    // Try without trailing slash first
    const response = await fetch('https://app.mochi.cards/api/decks', {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mochi API Error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching Mochi decks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('API Proxy Server is running');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('To start using the proxy with your extension, run:');
  console.log('npm install express cors body-parser');
  console.log('node server.js');
});