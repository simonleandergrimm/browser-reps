document.addEventListener('DOMContentLoaded', async function() {
  console.log('Popup opened');
  
  // DOM Elements
  const enableButton = document.getElementById('enableMarking');
  const disableButton = document.getElementById('disableMarking');
  const statusText = document.getElementById('status');
  const markedCount = document.getElementById('markedCount');
  const markedTextsList = document.getElementById('markedTextsList');
  const generateCardsButton = document.getElementById('generateCards');
  const clearTextsButton = document.getElementById('clearTexts');
  const cardsList = document.getElementById('cardsList');
  const cardsCount = document.getElementById('cardsCount');
  const exportCardsButton = document.getElementById('exportCards');
  const clearCardsButton = document.getElementById('clearCards');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const anthropicApiKeyInput = document.getElementById('anthropicApiKey');
  const mochiApiKeyInput = document.getElementById('mochiApiKey');
  const storeLocallyCheckbox = document.getElementById('storeLocally');
  const saveSettingsButton = document.getElementById('saveSettings');
  const claudeApiKeyError = document.getElementById('claudeApiKeyError');
  const mochiApiKeyError = document.getElementById('mochiApiKeyError');
  const cardEditorModal = document.getElementById('cardEditorModal');
  const cardFrontInput = document.getElementById('cardFront');
  const cardBackInput = document.getElementById('cardBack');
  const cardDeckInput = document.getElementById('cardDeck');
  const saveCardButton = document.getElementById('saveCard');
  const cancelEditButton = document.getElementById('cancelEdit');
  const closeModalBtn = document.querySelectorAll('.close');
  const exportModal = document.getElementById('exportModal');
  const exportMarkdownOption = document.getElementById('exportMarkdown');
  const exportMochiOption = document.getElementById('exportMochi');
  const confirmExportButton = document.getElementById('confirmExport');
  const cancelExportButton = document.getElementById('cancelExport');
  const exportStatus = document.getElementById('exportStatus');
  
  // App State
  let markedTexts = [];
  let generatedCards = [];
  let currentEditingCardIndex = -1;
  let selectedExportOption = 'markdown'; // Default export option
  
  // Check current state
  chrome.storage.local.get(['markingEnabled'], function(result) {
    const enabled = result.markingEnabled || false;
    updateStatus(enabled);
  });
  
  // Load API keys
  const loadApiKeys = async () => {
    try {
      const { anthropicApiKey, mochiApiKey } = await ClaudeApi.getStoredApiKeys();
      if (anthropicApiKey) {
        anthropicApiKeyInput.value = anthropicApiKey;
      }
      if (mochiApiKey) {
        mochiApiKeyInput.value = mochiApiKey;
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };
  
  // Load stored data
  const loadStoredData = async () => {
    try {
      console.log('Loading stored data...');
      
      // First try to load from local storage directly (faster)
      chrome.storage.local.get(['markedTexts', 'generatedCards', 'autoGenerateCards', 'lastMarkedTextIndex'], function(result) {
        console.log('Data from local storage:', result);
        
        if (result.markedTexts && result.markedTexts.length > 0) {
          markedTexts = result.markedTexts;
          updateMarkedTextsList();
          
          // Check if we should auto-generate cards (from keyboard shortcut)
          if (result.autoGenerateCards && result.lastMarkedTextIndex !== undefined) {
            console.log('Auto-generate flag detected for index:', result.lastMarkedTextIndex);
            
            // Switch to the marked texts tab
            switchTab('markedTexts');
            
            // Generate cards for the specified text
            if (result.lastMarkedTextIndex >= 0 && result.lastMarkedTextIndex < markedTexts.length) {
              const textToProcess = markedTexts[result.lastMarkedTextIndex];
              console.log('Auto-generating cards for text:', textToProcess.text.substring(0, 50) + '...');
              
              // Generate cards (with a slight delay to let UI initialize)
              setTimeout(() => {
                generateCardsForText(textToProcess.text);
              }, 500);
            }
            
            // Clear the flag
            chrome.storage.local.remove(['autoGenerateCards', 'lastMarkedTextIndex']);
          }
        }
        
        if (result.generatedCards && result.generatedCards.length > 0) {
          generatedCards = result.generatedCards;
          updateCardsList();
        }
      });
      
      // Then try to load from background script (more updated)
      chrome.runtime.sendMessage({action: 'getMarkedTexts'}, function(response) {
        console.log('Marked texts response from background:', response);
        if (response && response.markedTexts) {
          markedTexts = response.markedTexts;
          updateMarkedTextsList();
        }
      });
      
      chrome.runtime.sendMessage({action: 'getGeneratedCards'}, function(response) {
        console.log('Generated cards response from background:', response);
        if (response && response.generatedCards) {
          generatedCards = response.generatedCards;
          updateCardsList();
        }
      });
      
      // Load API keys
      await loadApiKeys();
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  };
  
  // Enable marking
  enableButton.addEventListener('click', function() {
    chrome.storage.local.set({markingEnabled: true}, function() {
      updateStatus(true);
      notifyContentScript(true);
    });
  });
  
  // Disable marking
  disableButton.addEventListener('click', function() {
    chrome.storage.local.set({markingEnabled: false}, function() {
      updateStatus(false);
      notifyContentScript(false);
    });
  });
  
  // Tab navigation
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      
      // Update button states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      // Update tab content visibility
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
          content.classList.add('active');
        }
      });
    });
  });
  
  // Generate cards button
  generateCardsButton.addEventListener('click', async function() {
    if (markedTexts.length === 0) return;
    
    try {
      this.disabled = true;
      this.textContent = 'Generating...';
      
      // Combine all marked texts
      const combinedText = markedTexts.map(item => item.text).join('\n\n');
      
      // Generate cards using Claude API
      const cards = await ClaudeApi.generateCardsWithClaude(combinedText);
      
      // Store generated cards - but don't replace existing ones
      // Add the new cards to the beginning of the array instead
      generatedCards = [...cards, ...generatedCards];
      chrome.runtime.sendMessage({action: 'setGeneratedCards', cards: generatedCards});
      
      // Update UI
      updateCardsList();
      
      // Switch to cards tab
      switchTab('generated-cards');
    } catch (error) {
      console.error('Error generating cards:', error);
      alert(`Error generating cards: ${error.message}`);
    } finally {
      this.disabled = false;
      this.textContent = 'Generate Mochi Cards';
    }
  });
  
  // Clear texts button
  clearTextsButton.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all marked texts?')) {
      markedTexts = [];
      chrome.runtime.sendMessage({action: 'clearMarkedTexts'});
      updateMarkedTextsList();
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
  
  // Export cards button - directly exports to Mochi
  exportCardsButton.addEventListener('click', async function() {
    if (generatedCards.length === 0) return;
    
    // Check if Mochi API key is available
    try {
      const { mochiApiKey } = await ClaudeApi.getStoredApiKeys();
      
      if (!mochiApiKey) {
        alert('Please add your Mochi API key in the Settings tab to enable export to Mochi.');
        // Show settings tab if no API key
        switchTab('settings');
        return;
      }
      
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
    } catch (error) {
      console.error('Error checking API keys:', error);
      alert('Could not check Mochi API key. Please try again.');
    }
  });
  
  // Update export options based on API key availability
  async function updateExportOptions() {
    try {
      const { mochiApiKey } = await ClaudeApi.getStoredApiKeys();
      
      // Select Markdown option by default
      exportMarkdownOption.classList.add('selected');
      exportMochiOption.classList.remove('selected');
      selectedExportOption = 'markdown';
      
      // Enable/disable Mochi option based on API key
      if (mochiApiKey) {
        exportMochiOption.style.opacity = '1';
        exportMochiOption.style.cursor = 'pointer';
      } else {
        exportMochiOption.style.opacity = '0.5';
        exportMochiOption.style.cursor = 'not-allowed';
        exportMochiOption.setAttribute('title', 'Add a Mochi API key in Settings to enable direct export');
      }
    } catch (error) {
      console.error('Error updating export options:', error);
    }
  }
  
  // Export option selection
  exportMarkdownOption.addEventListener('click', function() {
    exportMarkdownOption.classList.add('selected');
    exportMochiOption.classList.remove('selected');
    selectedExportOption = 'markdown';
  });
  
  exportMochiOption.addEventListener('click', async function() {
    // Check if Mochi API key is available
    const { mochiApiKey } = await ClaudeApi.getStoredApiKeys();
    if (!mochiApiKey) {
      alert('Please add your Mochi API key in the Settings tab to enable direct export to Mochi.');
      return;
    }
    
    exportMochiOption.classList.add('selected');
    exportMarkdownOption.classList.remove('selected');
    selectedExportOption = 'mochi';
  });
  
  // Confirm export button
  confirmExportButton.addEventListener('click', async function() {
    this.disabled = true;
    exportStatus.textContent = 'Processing...';
    
    try {
      if (selectedExportOption === 'markdown') {
        // Export as markdown
        const markdown = generatedCards.map(card => {
          return `# ${card.front}\n\n${card.back}\n\nDeck: ${card.deck}\n\n---\n\n`;
        }).join('');
        
        // Create a blob and download link
        const blob = new Blob([markdown], {type: 'text/markdown'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mochi_cards.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        exportStatus.textContent = 'Cards exported successfully as Markdown!';
        exportStatus.style.color = '#4caf50';
      } else if (selectedExportOption === 'mochi') {
        // Export to Mochi
        const result = await ClaudeApi.exportCardsToMochi(generatedCards);
        console.log('Mochi export result:', result);
        
        if (result.success) {
          exportStatus.textContent = 'Cards exported successfully to Mochi!';
          exportStatus.style.color = '#4caf50';
        } else {
          throw new Error('Failed to export to Mochi');
        }
      }
    } catch (error) {
      console.error('Error exporting cards:', error);
      exportStatus.textContent = `Error: ${error.message}`;
      exportStatus.style.color = '#f44336';
    } finally {
      this.disabled = false;
      setTimeout(() => {
        // Close modal after delay if successful
        if (exportStatus.style.color === 'rgb(76, 175, 80)') { // #4caf50
          exportModal.style.display = 'none';
        }
      }, 2000);
    }
  });
  
  // Cancel export
  cancelExportButton.addEventListener('click', function() {
    exportModal.style.display = 'none';
  });
  
  // Save settings button
  saveSettingsButton.addEventListener('click', async function() {
    const anthropicKey = anthropicApiKeyInput.value.trim();
    const mochiKey = mochiApiKeyInput.value.trim();
    const storeLocally = storeLocallyCheckbox.checked;
    
    // Reset error messages
    claudeApiKeyError.textContent = '';
    mochiApiKeyError.textContent = '';
    
    // Validate Claude API key
    if (!ClaudeApi.validateAnthropicApiKey(anthropicKey)) {
      claudeApiKeyError.textContent = 'Please enter a valid Claude API key (starts with sk-ant-)';
      return;
    }
    
    // Validate Mochi API key if provided
    if (mochiKey && !ClaudeApi.validateMochiApiKey(mochiKey)) {
      mochiApiKeyError.textContent = 'Please enter a valid Mochi API key';
      return;
    }
    
    try {
      // Save API keys
      await ClaudeApi.storeApiKeys(anthropicKey, mochiKey, storeLocally);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      claudeApiKeyError.textContent = 'Error saving settings: ' + error.message;
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
      exportModal.style.display = 'none';
    });
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === cardEditorModal) {
      cardEditorModal.style.display = 'none';
    } else if (event.target === exportModal) {
      exportModal.style.display = 'none';
    }
  });
  
  // Listen for new marked text
  chrome.runtime.onMessage.addListener(function(message) {
    console.log('Popup received message:', message);
    if (message.action === 'textMarked') {
      console.log('Text marked notification received, reloading texts...');
      // Reload marked texts
      chrome.runtime.sendMessage({action: 'getMarkedTexts'}, function(response) {
        console.log('getMarkedTexts response:', response);
        if (response && response.markedTexts) {
          markedTexts = response.markedTexts;
          updateMarkedTextsList();
        }
      });
    }
  });
  
  // Helper functions
  function updateStatus(enabled) {
    statusText.textContent = enabled ? 'Enabled' : 'Disabled';
    statusText.className = enabled ? 'enabled' : 'disabled';
    enableButton.disabled = enabled;
    disableButton.disabled = !enabled;
  }
  
  function notifyContentScript(enabled) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'updateMarkingState', enabled: enabled});
      }
    });
  }
  
  function updateMarkedTextsList() {
    console.log('Updating marked texts list with', markedTexts.length, 'items');
    markedCount.textContent = markedTexts.length;
    markedTextsList.innerHTML = '';
    
    if (markedTexts.length === 0) {
      markedTextsList.innerHTML = '<div class="empty-message">No marked texts yet. Enable marking and select text on webpages.</div>';
      generateCardsButton.disabled = true;
      return;
    }
    
    generateCardsButton.disabled = false;
    
    markedTexts.forEach((item, index) => {
      const textItem = document.createElement('div');
      textItem.className = 'marked-item';
      
      const textContent = document.createElement('div');
      textContent.className = 'marked-text';
      textContent.textContent = item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text;
      
      const textSource = document.createElement('div');
      textSource.className = 'marked-source';
      textSource.textContent = item.title || item.url || 'Unknown source';
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Use the dedicated removeMarkedText action
        chrome.runtime.sendMessage({action: 'removeMarkedText', index: index}, function(response) {
          console.log('Remove response:', response);
          if (response && response.success) {
            markedTexts = response.markedTexts || [];
            updateMarkedTextsList();
          }
        });
      });
      
      textItem.appendChild(textContent);
      textItem.appendChild(textSource);
      textItem.appendChild(removeBtn);
      markedTextsList.appendChild(textItem);
    });
  }
  
  function updateCardsList() {
    console.log('Updating cards list with', generatedCards.length, 'items');
    cardsCount.textContent = generatedCards.length;
    cardsList.innerHTML = '';
    
    if (generatedCards.length === 0) {
      cardsList.innerHTML = '<div class="empty-message">No cards generated yet. Mark text and click "Generate Mochi Cards".</div>';
      exportCardsButton.disabled = true;
      return;
    }
    
    exportCardsButton.disabled = false;
    
    generatedCards.forEach((card, index) => {
      const cardItem = document.createElement('div');
      cardItem.className = 'card-item';
      cardItem.style.cursor = 'pointer';
      
      // Make the entire card clickable for editing
      cardItem.addEventListener('click', (e) => {
        // Only trigger if we didn't click the remove button
        if (!e.target.classList.contains('remove-btn')) {
          openCardEditor(index);
        }
      });
      
      const cardFront = document.createElement('div');
      cardFront.className = 'card-front';
      cardFront.textContent = card.front;
      
      const cardBack = document.createElement('div');
      cardBack.className = 'card-back';
      cardBack.textContent = card.back.length > 300 ? card.back.substring(0, 300) + '...' : card.back;
      
      const cardDeck = document.createElement('div');
      cardDeck.className = 'card-deck';
      cardDeck.textContent = `Deck: ${card.deck || 'General'}`;
      
      // No longer need a separate Edit button
      // const editBtn = document.createElement('button');
      // editBtn.className = 'edit-btn';
      // editBtn.textContent = 'Edit';
      // editBtn.addEventListener('click', () => {
      //   openCardEditor(index);
      // });
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '×';
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
      // cardItem.appendChild(editBtn); // No longer needed
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
  
  // Function to generate cards for a specific text
  async function generateCardsForText(text) {
    try {
      // Disable the button to show processing
      generateCardsButton.disabled = true;
      generateCardsButton.textContent = 'Generating...';
      
      console.log('Generating cards for text:', text.substring(0, 50) + '...');
      
      // Generate cards using Claude API
      const cards = await ClaudeApi.generateCardsWithClaude(text);
      
      // Store generated cards - but don't replace existing ones
      // Add the new cards to the beginning of the array instead
      generatedCards = [...cards, ...generatedCards];
      chrome.runtime.sendMessage({action: 'setGeneratedCards', cards: generatedCards});
      
      // Update UI
      updateCardsList();
      
      // Switch to cards tab
      switchTab('generated-cards');
      
      console.log('Cards generated successfully');
    } catch (error) {
      console.error('Error generating cards:', error);
      alert(`Error generating cards: ${error.message}`);
    } finally {
      generateCardsButton.disabled = false;
      generateCardsButton.textContent = 'Generate Mochi Cards';
    }
  }
  
  // Initialize
  loadStoredData();
});