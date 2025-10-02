// AI Travel Concierge Chat Module
const CHAT_API_URL = 'http://localhost:5001/api/chat';
const CHANGES_API_URL = 'http://localhost:5001/api/itinerary/changes';

class TravelConciergeChat {
  constructor(onItineraryChange) {
    this.sessionId = null;
    this.currentLeg = null;
    this.currentDestinationsData = [];
    this.isOpen = false;
    this.onItineraryChange = onItineraryChange; // Callback to notify parent of changes
    this.pollInterval = null;
    this.isFloating = false;

    this.initElements();
    this.attachEventListeners();
    this.initFloatingChat();
    this.initInputResizers();

    // Check if chat is already visible (not hidden) and start polling
    if (this.chatContainer && !this.chatContainer.classList.contains('hidden')) {
      console.log('💡 Chat container is visible on init, starting polling...');
      this.isOpen = true;
      this.startPollingForChanges();
    }
  }

  initElements() {
    // Sidebar chat elements
    this.chatHeader = document.querySelector('.chat-header-sidebar');
    this.chatContainer = document.getElementById('chat-container-sidebar');
    this.toggleBtn = document.getElementById('toggle-chat-sidebar');
    this.chatForm = document.getElementById('chat-form-sidebar');
    this.chatInput = document.getElementById('chat-input-sidebar');
    this.chatMessages = document.getElementById('chat-messages-sidebar');
    this.sendBtn = document.getElementById('chat-send-btn-sidebar');
    this.undockBtn = document.getElementById('undock-chat-btn');
    this.sidebarChat = document.querySelector('.sidebar-chat');

    // Floating chat elements
    this.floatingChat = document.getElementById('floating-chat');
    this.floatingChatHeader = document.querySelector('.floating-chat-header');
    this.floatingChatContainer = document.getElementById('floating-chat-container');
    this.floatingChatMessages = document.getElementById('floating-chat-messages');
    this.floatingChatForm = document.getElementById('floating-chat-form');
    this.floatingChatInput = document.getElementById('floating-chat-input');
    this.floatingSendBtn = document.getElementById('floating-send-btn');
    this.dockBtn = document.getElementById('dock-chat-btn');
    this.toggleFloatingBtn = document.getElementById('toggle-floating-chat');
  }

  attachEventListeners() {
    // Sidebar chat listeners
    this.chatHeader?.addEventListener('click', (e) => {
      if (e.target !== this.undockBtn && !this.undockBtn.contains(e.target)) {
        this.toggleChat();
      }
    });
    this.chatForm?.addEventListener('submit', (e) => this.handleSubmit(e));
    this.undockBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.undockChat();
    });

    // Floating chat listeners
    this.floatingChatForm?.addEventListener('submit', (e) => this.handleSubmit(e, true));
    this.dockBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dockChat();
    });
    this.toggleFloatingBtn?.addEventListener('click', () => this.toggleFloatingChat());
  }

  toggleChat() {
    console.log(`🔀 Toggling chat. Currently: ${this.isOpen ? 'open' : 'closed'}`);
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  openChat() {
    console.log('📂 Opening chat...');
    this.isOpen = true;
    this.chatContainer.classList.remove('hidden');
    this.toggleBtn.classList.remove('collapsed');
    this.chatInput.focus();
    this.startPollingForChanges();
  }

  closeChat() {
    console.log('📁 Closing chat...');
    this.isOpen = false;
    this.chatContainer.classList.add('hidden');
    this.toggleBtn.classList.add('collapsed');
    this.stopPollingForChanges();
  }

  updateContext(legName, destinationsData, startDate, endDate) {
    this.currentLeg = legName;
    this.currentDestinationsData = destinationsData; // Full location objects
    this.currentStartDate = startDate;
    this.currentEndDate = endDate;
  }

  undockChat() {
    console.log('📤 Undocking chat...');
    this.isFloating = true;

    // Copy messages from sidebar to floating
    this.syncMessages(this.chatMessages, this.floatingChatMessages);

    // Hide sidebar chat
    this.sidebarChat.style.display = 'none';

    // Show floating chat
    this.floatingChat.style.display = 'flex';
    this.floatingChatContainer.classList.remove('hidden');
    this.floatingChatInput.focus();
  }

  dockChat() {
    console.log('📥 Docking chat...');
    this.isFloating = false;

    // Copy messages from floating to sidebar
    this.syncMessages(this.floatingChatMessages, this.chatMessages);

    // Hide floating chat
    this.floatingChat.style.display = 'none';

    // Show sidebar chat
    this.sidebarChat.style.display = 'flex';
    this.isOpen = true;
    this.chatContainer.classList.remove('hidden');
    this.toggleBtn.classList.remove('collapsed');
    this.chatInput.focus();
  }

  toggleFloatingChat() {
    const isCollapsed = this.floatingChatContainer.classList.contains('hidden');
    if (isCollapsed) {
      this.floatingChatContainer.classList.remove('hidden');
      this.toggleFloatingBtn.classList.remove('collapsed');
    } else {
      this.floatingChatContainer.classList.add('hidden');
      this.toggleFloatingBtn.classList.add('collapsed');
    }
  }

  syncMessages(source, target) {
    // Copy all messages from source to target
    target.innerHTML = source.innerHTML;
  }

  initFloatingChat() {
    // Make floating chat draggable
    this.makeDraggable(this.floatingChat, this.floatingChatHeader);

    // Make floating chat resizable
    this.makeResizable(this.floatingChat);
  }

  makeDraggable(element, handle) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    handle.addEventListener('mousedown', (e) => {
      if (e.target === handle || e.target === handle.querySelector('h4')) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;

        element.style.left = `${currentX}px`;
        element.style.top = `${currentY}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  makeResizable(element) {
    const handles = element.querySelectorAll('.resize-handle');

    handles.forEach(handle => {
      let isResizing = false;
      let startX, startY, startWidth, startHeight, startLeft, startTop;

      handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = element.offsetWidth;
        startHeight = element.offsetHeight;
        startLeft = element.offsetLeft;
        startTop = element.offsetTop;
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (handle.classList.contains('resize-handle-e')) {
          element.style.width = `${startWidth + dx}px`;
        } else if (handle.classList.contains('resize-handle-w')) {
          element.style.width = `${startWidth - dx}px`;
          element.style.left = `${startLeft + dx}px`;
        } else if (handle.classList.contains('resize-handle-s')) {
          element.style.height = `${startHeight + dy}px`;
        } else if (handle.classList.contains('resize-handle-n')) {
          element.style.height = `${startHeight - dy}px`;
          element.style.top = `${startTop + dy}px`;
        } else if (handle.classList.contains('resize-handle-se')) {
          element.style.width = `${startWidth + dx}px`;
          element.style.height = `${startHeight + dy}px`;
        } else if (handle.classList.contains('resize-handle-sw')) {
          element.style.width = `${startWidth - dx}px`;
          element.style.height = `${startHeight + dy}px`;
          element.style.left = `${startLeft + dx}px`;
        } else if (handle.classList.contains('resize-handle-ne')) {
          element.style.width = `${startWidth + dx}px`;
          element.style.height = `${startHeight - dy}px`;
          element.style.top = `${startTop + dy}px`;
        } else if (handle.classList.contains('resize-handle-nw')) {
          element.style.width = `${startWidth - dx}px`;
          element.style.height = `${startHeight - dy}px`;
          element.style.left = `${startLeft + dx}px`;
          element.style.top = `${startTop + dy}px`;
        }
      });

      document.addEventListener('mouseup', () => {
        isResizing = false;
      });
    });
  }

  initInputResizers() {
    // Sidebar chat input resizer
    const sidebarInputResizer = document.getElementById('chat-input-resizer');
    this.makeInputResizable(sidebarInputResizer, this.chatForm);

    // Floating chat input resizer
    const floatingInputResizer = document.getElementById('floating-input-resizer');
    this.makeInputResizable(floatingInputResizer, this.floatingChatForm);
  }

  makeInputResizable(resizer, formElement) {
    if (!resizer || !formElement) return;

    let isResizing = false;
    let startY, startHeight;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = formElement.offsetHeight;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const dy = e.clientY - startY;
      const newHeight = startHeight - dy; // Subtract because we're resizing from top

      if (newHeight >= 60 && newHeight <= 200) {
        formElement.style.height = `${newHeight}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      isResizing = false;
    });
  }

  async handleSubmit(e, isFloating = false) {
    e.preventDefault();

    const input = isFloating ? this.floatingChatInput : this.chatInput;
    const messages = isFloating ? this.floatingChatMessages : this.chatMessages;
    const sendBtn = isFloating ? this.floatingSendBtn : this.sendBtn;

    const message = input.value.trim();
    if (!message) return;

    // Add user message to UI
    this.addMessage(message, 'user', false, isFloating);
    input.value = '';

    // Disable input while processing
    this.setLoading(true, isFloating);

    // Add loading message with timer
    const loadingMsgId = this.addMessage('Thinking...', 'bot', true, isFloating);
    let elapsedSeconds = 0;
    const timerInterval = setInterval(() => {
      elapsedSeconds++;
      const loadingMsg = this.getMessageElement(loadingMsgId, isFloating);
      if (loadingMsg) {
        const contentDiv = loadingMsg.querySelector('.message-content');
        if (contentDiv) {
          contentDiv.textContent = `Thinking... (${elapsedSeconds}s)`;
        }
      }
    }, 1000);

    try {
      // Build rich context from current leg with full destination details
      const context = {
        leg_name: this.currentLeg || 'All',
        start_date: this.currentStartDate || '',
        end_date: this.currentEndDate || '',
        destinations: (this.currentDestinationsData || []).map(loc => ({
          name: loc.name,
          city: loc.city,
          country: loc.country,
          arrival_date: loc.arrival_date,
          departure_date: loc.departure_date,
          duration_days: loc.duration_days,
          activity_type: loc.activity_type,
          description: loc.description,
          highlights: loc.highlights
        }))
      };

      console.log('Sending chat request with context:', context);

      const payload = {
        message,
        context,
        session_id: this.sessionId,
        // Always send initialize_itinerary flag on first message (when no session ID)
        initialize_itinerary: !this.sessionId
      };

      console.log('Session ID:', this.sessionId, 'Initialize:', payload.initialize_itinerary);

      console.log('🚀 Sending request to chat API...');

      // Create a timeout promise (2 minutes)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout - taking longer than 2 minutes')), 120000)
      );

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(CHAT_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }),
        timeoutPromise
      ]);

      console.log(`📡 Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const responseText = await response.text();
      console.log('📨 Raw response:', responseText.substring(0, 200));

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('✅ Parsed response:', data);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        console.error('Raw response text:', responseText);
        throw new Error('Failed to parse response as JSON');
      }

      // Store session ID for continuity
      if (data.session_id) {
        console.log(`🔑 Setting session ID: ${data.session_id} (was: ${this.sessionId})`);
        this.sessionId = data.session_id;
      } else {
        console.warn('⚠️ No session_id in response!', data);
      }

      // Clear the timer
      clearInterval(timerInterval);

      // Remove loading message
      this.removeMessage(loadingMsgId, isFloating);

      // Add bot response
      this.addMessage(data.response || 'Sorry, I could not generate a response.', 'bot', false, isFloating);

      // Sync messages to the other view
      if (isFloating) {
        this.syncMessages(this.floatingChatMessages, this.chatMessages);
      } else {
        this.syncMessages(this.chatMessages, this.floatingChatMessages);
      }

    } catch (error) {
      console.error('Chat error:', error);

      // Clear the timer
      clearInterval(timerInterval);

      // Remove loading message
      this.removeMessage(loadingMsgId, isFloating);

      // Show error message with details
      let errorMessage = 'Sorry, I encountered an error. ';

      if (error.message.includes('timeout')) {
        errorMessage += `The request took longer than expected (${elapsedSeconds}s). The AI is processing a large itinerary with 43 destinations. Try asking about a specific region instead.`;
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Connection')) {
        errorMessage += 'Please make sure the backend server is running on http://localhost:5001';
      } else {
        errorMessage += `Error: ${error.message}`;
      }

      this.addMessage(errorMessage, 'bot', false, isFloating);

      // Sync messages to the other view
      if (isFloating) {
        this.syncMessages(this.floatingChatMessages, this.chatMessages);
      } else {
        this.syncMessages(this.chatMessages, this.floatingChatMessages);
      }
    } finally {
      this.setLoading(false, isFloating);
    }
  }

  addMessage(text, sender = 'bot', isLoading = false, isFloating = false) {
    // Generate ID without periods (replace decimal point with underscore)
    const messageId = `msg-${Date.now()}-${Math.random()}`.replace(/\./g, '_');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}${isLoading ? ' loading' : ''}`;
    messageDiv.id = messageId;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);

    const messagesContainer = isFloating ? this.floatingChatMessages : this.chatMessages;
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageId;
  }

  getMessageElement(messageId, isFloating = false) {
    const messagesContainer = isFloating ? this.floatingChatMessages : this.chatMessages;
    // Use getElementById on the container's ownerDocument or just find by ID directly
    return document.getElementById(messageId);
  }

  removeMessage(messageId, isFloating = false) {
    const message = this.getMessageElement(messageId, isFloating);
    if (message) {
      message.remove();
    }
  }

  setLoading(isLoading, isFloating = false) {
    if (isFloating) {
      this.floatingChatInput.disabled = isLoading;
      this.floatingSendBtn.disabled = isLoading;
    } else {
      this.chatInput.disabled = isLoading;
      this.sendBtn.disabled = isLoading;
    }
  }

  clearChat() {
    // Keep only the welcome message
    const messages = this.chatMessages.querySelectorAll('.chat-message:not(:first-child)');
    messages.forEach(msg => msg.remove());
    this.sessionId = null;
  }

  startPollingForChanges() {
    // Poll for itinerary changes every 2 seconds when chat is active
    if (this.pollInterval) {
      console.log('⚠️ Polling already active');
      return; // Already polling
    }

    console.log('🔄 Starting polling for itinerary changes...');
    this.pollInterval = setInterval(async () => {
      try {
        // Always check default_session first, then the actual session ID
        const sessionIds = this.sessionId ? ['default_session', this.sessionId] : ['default_session'];

        for (const sid of sessionIds) {
          const response = await fetch(`${CHANGES_API_URL}/${sid}`);
          if (!response.ok) {
            console.log(`Poll failed for session ${sid}: ${response.status}`);
            continue;
          }

          const data = await response.json();
          console.log(`Poll response for session ${sid}:`, data);
          console.log(`  - data.status: ${data.status}`);
          console.log(`  - data.changes: ${data.changes}`);
          console.log(`  - data.changes.length: ${data.changes?.length}`);

          if (data.status === 'success' && data.changes && data.changes.length > 0) {
            console.log(`✅ Received ${data.changes.length} itinerary changes from session ${sid}:`, data.changes);

            // Notify parent to apply changes
            if (this.onItineraryChange) {
              console.log('📞 Calling onItineraryChange callback with changes:', data.changes);
              this.onItineraryChange(data.changes);
            } else {
              console.warn('⚠️ No onItineraryChange callback registered!');
            }
          }
        }
      } catch (error) {
        console.error('Error polling for changes:', error);
      }
    }, 2000); // Poll every 2 seconds
  }

  stopPollingForChanges() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

// Export for use in main app
window.TravelConciergeChat = TravelConciergeChat;
