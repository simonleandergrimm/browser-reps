let selectedText = '';

console.log('Flashcard Generator content script loaded');

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Content script received message:', message);
  
  if (message.action === 'getSelectedText') {
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

// Handle text selection
document.addEventListener('mouseup', function(event) {
  const selection = window.getSelection();
  selectedText = selection.toString().trim();
  
  if (selectedText.length > 0) {
    console.log('Text selected:', selectedText.substring(0, 50) + '...');
  }
});

// Process text from keyboard shortcut and immediately create cards
function processTextAndCreateCards() {
  if (!selectedText) {
    console.log('No text selected to process');
    return;
  }
  
  console.log('Processing text and creating cards:', selectedText.substring(0, 50) + '...');
  
  // Send the text to the background script for Claude API processing
  console.log('Sending selected text to background script for card creation:', selectedText.substring(0, 50) + '...');
  
  // Show confirmation to the user
  showConfirmation('Creating flashcards...', '#2196F3'); // Blue color
  
  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'processSelectedText',
    text: selectedText,
    createCards: true // Signal to directly create cards for this text
  }, function(response) {
    console.log('Background script response:', response);
    
    if (response && response.error) {
      // Show an error message if there was an issue
      showConfirmation(`Error: ${response.error}`, '#F44336'); // Red color for errors
    }
  });
}

// Show a brief confirmation message
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