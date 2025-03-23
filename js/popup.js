document.addEventListener('DOMContentLoaded', async function() {
  console.log('Popup opened');
  
  // DOM Elements
  const cardsList = document.getElementById('cardsList');
  const cardsCount = document.getElementById('cardsCount');
  const exportCardsButton = document.getElementById('exportCards');
  const clearCardsButton = document.getElementById('clearCards');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const cardEditorModal = document.getElementById('cardEditorModal');
  const cardFrontInput = document.getElementById('cardFront');
  const cardBackInput = document.getElementById('cardBack');
  const cardDeckInput = document.getElementById('cardDeck');
  const saveCardButton = document.getElementById('saveCard');
  const cancelEditButton = document.getElementById('cancelEdit');
  const closeModalBtn = document.querySelectorAll('.close');
  
  // App State
  let generatedCards = [];
  let currentEditingCardIndex = -1;
  
  // Load stored cards
  const loadStoredData = async () => {
    try {
      console.log('Loading stored data...');
      
      // First try to load from local storage directly (faster)
      chrome.storage.local.get(['generatedCards', 'autoGenerateCards', 'selectedText'], function(result) {
        console.log('Data from local storage:', result);
        
        if (result.generatedCards && result.generatedCards.length > 0) {
          generatedCards = result.generatedCards;
          updateCardsList();
        }
        
        // Check if we should auto-generate cards (from keyboard shortcut)
        if (result.autoGenerateCards && result.selectedText) {
          console.log('Auto-generate flag detected');
          
          // Generate cards for the selected text
          const textToProcess = result.selectedText;
          console.log('Auto-generating cards for text:', textToProcess.substring(0, 50) + '...');
          
          // Generate cards (with a slight delay to let UI initialize)
          setTimeout(async () => {
            try {
              await generateCardsForText(textToProcess);
            } catch (error) {
              console.error('Failed to generate cards:', error);
              // Add an error card
              const errorCard = {
                front: "Error generating flashcards",
                back: `There was an error while generating flashcards: ${error.message}. Please check your connection to the server.`,
                deck: "Error"
              };
              generatedCards = [errorCard, ...generatedCards];
              chrome.runtime.sendMessage({action: 'setGeneratedCards', cards: generatedCards});
              updateCardsList();
              switchTab('generated-cards');
            }
          }, 500);
          
          // Clear the flag
          chrome.storage.local.remove(['autoGenerateCards', 'selectedText']);
        }
      });
      
      // Then try to load from background script (more updated)
      chrome.runtime.sendMessage({action: 'getGeneratedCards'}, function(response) {
        console.log('Generated cards response from background:', response);
        if (response && response.generatedCards) {
          generatedCards = response.generatedCards;
          updateCardsList();
        }
      });
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  };
  
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to selected tab
      this.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Export cards button - directly exports to Mochi
  exportCardsButton.addEventListener('click', async function() {
    if (generatedCards.length === 0) return;
    
    // Show a quick inline notification
    this.disabled = true;
    const originalText = this.textContent;
    this.textContent = 'Exporting...';
    
    try {
      // Export to Mochi directly
      const result = await ClaudeApi.exportCardsToMochi(generatedCards);
      console.log('Mochi export result:', result);
      
      if (result.success) {
        this.textContent = 'Exported!';
        setTimeout(() => {
          this.textContent = originalText;
          this.disabled = false;
        }, 2000);
      } else {
        throw new Error('Failed to export to Mochi');
      }
    } catch (error) {
      console.error('Error exporting cards:', error);
      alert(`Error exporting to Mochi: ${error.message}`);
      this.textContent = originalText;
      this.disabled = false;
    }
  });
  
  // Clear cards button
  clearCardsButton.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all generated cards?')) {
      generatedCards = [];
      chrome.runtime.sendMessage({action: 'clearGeneratedCards'});
      updateCardsList();
    }
  });
  
  // Card editor modal
  function openCardEditor(cardIndex) {
    currentEditingCardIndex = cardIndex;
    const card = generatedCards[cardIndex];
    
    cardFrontInput.value = card.front;
    cardBackInput.value = card.back;
    cardDeckInput.value = card.deck || 'General';
    
    cardEditorModal.style.display = 'block';
  }
  
  // Save edited card
  saveCardButton.addEventListener('click', function() {
    if (currentEditingCardIndex < 0 || currentEditingCardIndex >= generatedCards.length) {
      return;
    }
    
    // Validate inputs
    const front = cardFrontInput.value.trim();
    const back = cardBackInput.value.trim();
    const deck = cardDeckInput.value.trim() || 'General';
    
    if (!front || !back) {
      alert('Both front and back are required!');
      return;
    }
    
    // Update card
    generatedCards[currentEditingCardIndex] = { front, back, deck };
    
    // Save to background storage
    chrome.runtime.sendMessage({action: 'setGeneratedCards', cards: generatedCards});
    
    // Update UI
    updateCardsList();
    
    // Close modal
    cardEditorModal.style.display = 'none';
  });
  
  // Cancel editing
  cancelEditButton.addEventListener('click', function() {
    cardEditorModal.style.display = 'none';
  });
  
  // Close modal when clicking on X
  closeModalBtn.forEach(btn => {
    btn.addEventListener('click', function() {
      cardEditorModal.style.display = 'none';
    });
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === cardEditorModal) {
      cardEditorModal.style.display = 'none';
    }
  });
  
  // Function to generate cards for a specific text
  async function generateCardsForText(text) {
    try {
      console.log('Generating cards for text:', text.substring(0, 50) + '...');
      
      // Create loading card
      const loadingCard = {
        front: "Generating flashcards...",
        back: "Claude is analyzing your text and creating flashcards. Please wait a moment.",
        deck: "Loading"
      };
      
      // Add the loading card and update UI immediately to show progress
      generatedCards = [loadingCard, ...generatedCards];
      chrome.runtime.sendMessage({action: 'setGeneratedCards', cards: generatedCards});
      updateCardsList();
      
      // Switch to cards tab
      switchTab('generated-cards');
      
      // Generate cards using Claude API
      const cards = await ClaudeApi.generateCardsWithClaude(text);
      
      // Remove the loading card
      generatedCards.shift();
      
      // Store generated cards - add the new cards to the beginning of the array
      generatedCards = [...cards, ...generatedCards];
      chrome.runtime.sendMessage({action: 'setGeneratedCards', cards: generatedCards});
      
      // Update UI
      updateCardsList();
      
      console.log('Cards generated successfully:', cards.length, 'cards');
      
      // Return the cards for potential further processing
      return cards;
    } catch (error) {
      console.error('Error generating cards:', error);
      
      // Remove loading card if it exists
      if (generatedCards.length > 0 && generatedCards[0].deck === "Loading") {
        generatedCards.shift();
      }
      
      // Add an error card
      const errorCard = {
        front: "Error generating flashcards",
        back: `There was an error while generating flashcards: ${error.message}. Please check your connection to the server.`,
        deck: "Error"
      };
      
      generatedCards = [errorCard, ...generatedCards];
      chrome.runtime.sendMessage({action: 'setGeneratedCards', cards: generatedCards});
      updateCardsList();
      
      // Rethrow so caller can handle if needed
      throw error;
    }
  }
  
  // Update cards list UI
  function updateCardsList() {
    console.log('Updating cards list with', generatedCards.length, 'items');
    cardsCount.textContent = generatedCards.length;
    cardsList.innerHTML = '';
    
    if (generatedCards.length === 0) {
      cardsList.innerHTML = '<div class="empty-message">No cards yet. Select text on a webpage and press Cmd+Shift+F to create flashcards.</div>';
      exportCardsButton.disabled = true;
      return;
    }
    
    exportCardsButton.disabled = false;
    
    generatedCards.forEach((card, index) => {
      const cardItem = document.createElement('div');
      cardItem.className = 'card-item';
      
      // Add special styling for loading and error cards
      if (card.deck === "Loading") {
        cardItem.classList.add('loading-card');
        cardItem.style.cursor = 'default';
      } else if (card.deck === "Error") {
        cardItem.classList.add('error-card');
        cardItem.style.cursor = 'default';
      } else {
        cardItem.style.cursor = 'pointer';
        
        // Make regular cards clickable for editing
        cardItem.addEventListener('click', (e) => {
          // Only trigger if we didn't click the remove button
          if (!e.target.classList.contains('remove-btn')) {
            openCardEditor(index);
          }
        });
      }
      
      const cardFront = document.createElement('div');
      cardFront.className = 'card-front';
      cardFront.textContent = card.front;
      
      const cardBack = document.createElement('div');
      cardBack.className = 'card-back';
      cardBack.textContent = card.back.length > 300 ? card.back.substring(0, 300) + '...' : card.back;
      
      const cardDeck = document.createElement('div');
      cardDeck.className = 'card-deck';
      cardDeck.textContent = `Deck: ${card.deck || 'General'}`;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.innerHTML = '&times;'; // HTML entity for the multiplication sign (×)
      removeBtn.title = 'Remove card';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card edit modal from opening
        generatedCards.splice(index, 1);
        chrome.runtime.sendMessage({action: 'setGeneratedCards', cards: generatedCards});
        updateCardsList();
      });
      
      cardItem.appendChild(cardFront);
      cardItem.appendChild(cardBack);
      cardItem.appendChild(cardDeck);
      cardItem.appendChild(removeBtn);
      cardsList.appendChild(cardItem);
    });
  }
  
  // Function to switch between tabs programmatically
  function switchTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    // Find the tab button
    const tabButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (tabButton) {
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to selected tab
      tabButton.classList.add('active');
      
      // Show selected tab content
      const activeContent = document.getElementById(tabId);
      if (activeContent) {
        activeContent.classList.add('active');
      }
    }
  }
  
  // Initialize
  loadStoredData();
});