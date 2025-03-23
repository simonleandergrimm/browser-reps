let markingEnabled = false;
let selectedText = '';

console.log('Content script loaded');

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Content script received message:', message);
  
  if (message.action === 'updateMarkingState') {
    markingEnabled = message.enabled;
    console.log('Marking state updated:', markingEnabled);
    if (!markingEnabled) {
      removeMarkingUI();
    }
  } else if (message.action === 'getSelectedText') {
    sendResponse({ text: selectedText });
    return true; // Required for asynchronous response
  } else if (message.action === 'createFlashcardsFromSelection') {
    console.log('Creating flashcards from current selection');
    // Get the current selection
    const selection = window.getSelection();
    selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
      console.log('Creating flashcards from text:', selectedText.substring(0, 50) + '...');
      processTextAndCreateCards();
    } else {
      console.log('No text selected');
      showConfirmation('Please select text first!', '#F44336'); // Red color
    }
    return true;
  }
});

// Check initial state
chrome.storage.local.get(['markingEnabled'], function(result) {
  markingEnabled = result.markingEnabled || false;
  console.log('Initial marking state:', markingEnabled);
});

// Handle text selection
document.addEventListener('mouseup', function(event) {
  if (!markingEnabled) return;
  
  const selection = window.getSelection();
  selectedText = selection.toString().trim();
  
  if (selectedText.length > 0) {
    console.log('Text selected:', selectedText.substring(0, 50) + '...');
    // Use a short timeout to ensure the selection is complete
    setTimeout(() => {
      processTextDirectly();
    }, 50);
  }
});

// Process the selected text directly without showing a UI button
// Used for manual selection + clicking mode
function processTextDirectly() {
  if (!selectedText) {
    console.log('No text selected to process');
    return;
  }
  
  console.log('Processing text directly:', selectedText.substring(0, 50) + '...');
  
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    console.log('No selection range');
    return;
  }
  
  const range = selection.getRangeAt(0);
  const markedSpan = document.createElement('span');
  markedSpan.className = 'text-marker-highlight';
  markedSpan.dataset.markedText = selectedText;
  
  try {
    // First store the text we need to send
    const textToSend = selectedText;
    
    // Highlight the text
    range.surroundContents(markedSpan);
    selection.removeAllRanges();
    console.log('Text highlighted successfully');
    
    // Send the text to the background script for Claude API processing
    console.log('Sending marked text to background script:', textToSend.substring(0, 50) + '...');
    chrome.runtime.sendMessage({
      action: 'processMarkedText',
      text: textToSend
    }, function(response) {
      console.log('Background script response:', response);
      // Show a confirmation message
      showConfirmation('Text marked and sent!');
    });
  } catch (e) {
    console.error('Error highlighting text:', e);
    
    // Even if highlighting fails, still send the text for processing
    console.log('Sending marked text to background script (highlight failed):', selectedText.substring(0, 50) + '...');
    chrome.runtime.sendMessage({
      action: 'processMarkedText',
      text: selectedText
    }, function(response) {
      console.log('Background script response:', response);
      // Show a confirmation message
      showConfirmation('Text sent!');
    });
  }
}

// Process text from keyboard shortcut and immediately create cards
// Used with Ctrl+Shift+F keyboard shortcut
function processTextAndCreateCards() {
  if (!selectedText) {
    console.log('No text selected to process');
    return;
  }
  
  console.log('Processing text and creating cards:', selectedText.substring(0, 50) + '...');
  
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    console.log('No selection range');
    return;
  }
  
  const range = selection.getRangeAt(0);
  const markedSpan = document.createElement('span');
  markedSpan.className = 'text-marker-highlight';
  markedSpan.dataset.markedText = selectedText;
  
  try {
    // First store the text we need to send
    const textToSend = selectedText;
    
    // Highlight the text
    range.surroundContents(markedSpan);
    selection.removeAllRanges();
    console.log('Text highlighted successfully');
    
    // Send the text to the background script for Claude API processing
    console.log('Sending marked text to background script for card creation:', textToSend.substring(0, 50) + '...');
    chrome.runtime.sendMessage({
      action: 'processMarkedText', 
      text: textToSend,
      createCards: true // Signal to directly create cards for this text
    }, function(response) {
      console.log('Background script response:', response);
      // Show a confirmation message
      showConfirmation('Creating flashcards...', '#2196F3'); // Blue color
    });
  } catch (e) {
    console.error('Error highlighting text:', e);
    
    // Even if highlighting fails, still send the text for processing
    console.log('Sending marked text to background script (highlight failed):', selectedText.substring(0, 50) + '...');
    chrome.runtime.sendMessage({
      action: 'processMarkedText',
      text: selectedText,
      createCards: true // Signal to directly create cards for this text
    }, function(response) {
      console.log('Background script response:', response);
      // Show a confirmation message
      showConfirmation('Creating flashcards...', '#2196F3'); // Blue color
    });
  }
}

// Show a brief confirmation message that text was marked
function showConfirmation(message, bgColor = '#4CAF50') { // Default green
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.backgroundColor = bgColor;
  notification.style.color = 'white';
  notification.style.padding = '10px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '10000';
  notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
  notification.style.fontFamily = 'Arial, sans-serif';
  notification.style.fontSize = '14px';
  notification.style.fontWeight = 'bold';
  
  document.body.appendChild(notification);
  
  // Remove after a short delay
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      notification.remove();
    }, 500);
  }, 2000);
}

// Old functions kept for reference but not used
function showMarkingUI(x, y) {
  removeMarkingUI();
  
  const markerButton = document.createElement('button');
  markerButton.id = 'text-marker-button';
  markerButton.textContent = 'Mark Text';
  markerButton.style.position = 'fixed';
  markerButton.style.left = `${x}px`;
  markerButton.style.top = `${y + 10}px`;
  markerButton.style.zIndex = '9999';
  markerButton.style.border = 'none';
  markerButton.style.borderRadius = '4px';
  markerButton.style.padding = '5px 10px';
  markerButton.style.backgroundColor = '#4285f4';
  markerButton.style.color = 'white';
  markerButton.style.fontSize = '14px';
  markerButton.style.cursor = 'pointer';
  markerButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
  
  document.body.appendChild(markerButton);
  console.log('Marking UI displayed');
}

function removeMarkingUI() {
  const existingButton = document.getElementById('text-marker-button');
  if (existingButton) {
    existingButton.remove();
    console.log('Marking UI removed');
  }
}