// Background script for Text Marker extension

// Store data for marked text and generated cards
let markedTexts = [];
let generatedCards = [];

console.log('Background script initialized');

// Debug function to log current state
function logState() {
  console.log('Current state:', {
    markedTextsCount: markedTexts.length,
    markedTexts: markedTexts,
    generatedCardsCount: generatedCards.length
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Background received message:', message);
  
  if (message.action === 'processMarkedText') {
    // Store the marked text
    const newItem = {
      text: message.text,
      url: sender && sender.tab ? sender.tab.url : 'unknown',
      title: sender && sender.tab ? sender.tab.title : 'Unknown page',
      timestamp: new Date().toISOString()
    };
    
    console.log('Storing new marked text:', newItem);
    markedTexts.push(newItem);
    
    // Store in local storage as backup
    chrome.storage.local.set({markedTexts: markedTexts}, function() {
      console.log('Marked texts saved to storage, count:', markedTexts.length);
    });
    
    // Check if we should immediately create cards for this text
    if (message.createCards) {
      console.log('Auto-generating cards for the marked text...');
      
      // We'll wait for the popup to do the actual processing,
      // since that's where the Claude API client is loaded
      chrome.storage.local.set({autoGenerateCards: true, lastMarkedTextIndex: markedTexts.length - 1}, function() {
        console.log('Set auto-generate flag for the popup');
      });
      
      // After a delay, open the popup to show the results
      setTimeout(() => {
        try {
          chrome.action.openPopup();
        } catch (e) {
          console.log('Could not open popup programmatically:', e);
        }
      }, 500);
    }
    
    // Notify the popup that new text has been marked
    try {
      chrome.runtime.sendMessage({
        action: 'textMarked',
        count: markedTexts.length,
        autoGenerateCards: !!message.createCards
      });
      console.log('Notification sent to popup');
    } catch (e) {
      console.log('Could not notify popup, it might not be open:', e);
    }
    
    logState();
    return true;
  } else if (message.action === 'getMarkedTexts') {
    console.log('Sending marked texts, count:', markedTexts.length);
    // Load from local storage to ensure persistence between restarts
    chrome.storage.local.get(['markedTexts'], function(result) {
      if (result.markedTexts && result.markedTexts.length > 0) {
        // If storage has texts and background memory doesn't, restore from storage
        if (markedTexts.length === 0) {
          markedTexts = result.markedTexts;
          console.log('Restored marked texts from storage, count:', markedTexts.length);
        }
        sendResponse({ markedTexts: result.markedTexts });
      } else {
        sendResponse({ markedTexts });
      }
    });
    return true; // Keep channel open for async response
  } else if (message.action === 'clearMarkedTexts') {
    console.log('Clearing all marked texts');
    markedTexts = [];
    chrome.storage.local.remove(['markedTexts']);
    sendResponse({ success: true });
    logState();
    return true;
  } else if (message.action === 'setMarkedTexts') {
    console.log('Updating marked texts list, new count:', message.texts.length);
    markedTexts = message.texts;
    chrome.storage.local.set({markedTexts: markedTexts});
    sendResponse({ success: true });
    logState();
    return true;
  } else if (message.action === 'removeMarkedText') {
    console.log('Removing marked text at index:', message.index);
    if (message.index >= 0 && message.index < markedTexts.length) {
      markedTexts.splice(message.index, 1);
      chrome.storage.local.set({markedTexts: markedTexts});
      sendResponse({ success: true, markedTexts: markedTexts });
      logState();
    } else {
      sendResponse({ success: false, error: 'Invalid index' });
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
  console.log('Text Marker extension installed or updated');
  
  // Initialize storage
  chrome.storage.local.get(['markingEnabled', 'markedTexts', 'generatedCards'], function(result) {
    if (result.markingEnabled === undefined) {
      chrome.storage.local.set({markingEnabled: true}); // Enable marking by default
    }
    
    // Restore saved texts and cards if any
    if (result.markedTexts && result.markedTexts.length > 0) {
      markedTexts = result.markedTexts;
      console.log('Restored marked texts from storage on startup, count:', markedTexts.length);
    }
    
    if (result.generatedCards && result.generatedCards.length > 0) {
      generatedCards = result.generatedCards;
      console.log('Restored generated cards from storage on startup, count:', generatedCards.length);
    }
    
    logState();
  });
});
