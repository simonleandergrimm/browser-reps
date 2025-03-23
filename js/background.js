// Background script for Flashcard Generator extension

// Store data for generated cards
let generatedCards = [];

console.log('Background script initialized');

// Debug function to log current state
function logState() {
  console.log('Current state:', {
    generatedCardsCount: generatedCards.length,
    generatedCards: generatedCards
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Background received message:', message);
  
  if (message.action === 'processSelectedText') {
    // Store the selected text info for potential use
    const textInfo = {
      text: message.text,
      url: sender && sender.tab ? sender.tab.url : 'unknown',
      title: sender && sender.tab ? sender.tab.title : 'Unknown page',
      timestamp: new Date().toISOString()
    };
    
    console.log('Processing selected text:', textInfo);
    
    // If createCards flag is set, automatically generate cards
    if (message.createCards) {
      console.log('Auto-generating cards for the selected text...');
      
      // Make sure we have enough text to generate cards
      if (!message.text || message.text.length < 10) {
        console.warn('Text too short for generating cards');
        sendResponse({ 
          success: false, 
          error: 'Selected text is too short for generating flashcards' 
        });
        return true;
      }
      
      // We'll wait for the popup to do the actual processing,
      // since that's where the Claude API client is loaded
      chrome.storage.local.set({
        autoGenerateCards: true, 
        selectedText: message.text,
        selectedTextInfo: textInfo
      }, function() {
        console.log('Set auto-generate flag for the popup');
        
        // Send a success response
        sendResponse({ success: true });
        
        // After a delay, open the popup to show the results
        setTimeout(() => {
          try {
            chrome.action.openPopup();
          } catch (e) {
            console.log('Could not open popup programmatically:', e);
            // Can't send another response because the channel is closed
          }
        }, 500);
      });
      
      return true; // Keep channel open for async response
    }
    
    return true;
  } else if (message.action === 'getGeneratedCards') {
    console.log('Sending generated cards, count:', generatedCards.length);
    // Load from local storage to ensure persistence between restarts
    chrome.storage.local.get(['generatedCards'], function(result) {
      if (result.generatedCards && result.generatedCards.length > 0) {
        // If storage has cards and background memory doesn't, restore from storage
        if (generatedCards.length === 0) {
          generatedCards = result.generatedCards;
          console.log('Restored generated cards from storage, count:', generatedCards.length);
        }
        sendResponse({ generatedCards: result.generatedCards });
      } else {
        sendResponse({ generatedCards });
      }
    });
    return true; // Keep channel open for async response
  } else if (message.action === 'setGeneratedCards') {
    console.log('Updating generated cards, new count:', message.cards.length);
    generatedCards = message.cards;
    chrome.storage.local.set({generatedCards: generatedCards});
    sendResponse({ success: true });
    logState();
    return true;
  } else if (message.action === 'clearGeneratedCards') {
    console.log('Clearing all generated cards');
    generatedCards = [];
    chrome.storage.local.remove(['generatedCards']);
    sendResponse({ success: true });
    logState();
    return true;
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
  console.log('Command received:', command);
  
  if (command === 'create-flashcards') {
    // Get the active tab to send a message to the content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs && tabs[0]) {
        console.log('Sending create-flashcards command to tab:', tabs[0].id);
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'createFlashcardsFromSelection'
        });
        
        // After a short delay, open the popup to show the generated cards
        setTimeout(() => {
          chrome.action.openPopup();
        }, 1500); // Wait for the cards to be generated
      }
    });
  }
});

// When extension is installed or updated
chrome.runtime.onInstalled.addListener(function() {
  console.log('Flashcard Generator extension installed or updated');
  
  // Initialize storage
  chrome.storage.local.get(['generatedCards'], function(result) {
    // Restore saved cards if any
    if (result.generatedCards && result.generatedCards.length > 0) {
      generatedCards = result.generatedCards;
      console.log('Restored generated cards from storage on startup, count:', generatedCards.length);
    }
    
    logState();
  });
});