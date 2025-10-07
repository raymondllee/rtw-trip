// AI Travel Concierge Chat Module
import { db } from './firebase-config.js';
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, orderBy, limit, updateDoc, deleteDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { StatePersistence } from './state-persistence.js';

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
    this.currentChatId = null; // Current chat conversation ID
    this.messages = []; // In-memory message history
    this.firestoreEnabled = true; // Enable Firestore persistence (will be disabled on errors)
    this.statePersistence = new StatePersistence();

    // ⚠️ KNOWN ISSUE: Non-deterministic behavior in AI responses
    // The AI backend sometimes responds with "I don't have access to your itinerary"
    // even when complete context data is properly sent. This appears to be a backend
    // processing issue where the AI intermittently fails to parse or utilize the
    // itinerary context data. Changes may still be applied asynchronously via polling
    // despite the error response. This behavior needs investigation in the Python backend.

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

    // Restore chat state from localStorage
    this.restoreChatState();
  }

  /**
   * Restore chat state from localStorage (session ID and last chat)
   */
  async restoreChatState() {
    const savedState = this.statePersistence.getState();
    console.log('📂 Restoring chat state:', savedState);

    if (savedState.sessionId) {
      this.sessionId = savedState.sessionId;
      console.log('✅ Restored session ID:', this.sessionId);
    }

    if (savedState.chatId) {
      try {
        const loaded = await this.loadChat(savedState.chatId);
        if (loaded) {
          console.log('✅ Restored chat:', savedState.chatId);
        } else {
          console.warn('⚠️ Failed to restore chat, it may have been deleted');
          this.statePersistence.saveChatState(null, [], null);
        }
      } catch (error) {
        console.error('Error restoring chat:', error);
      }
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

    // Chat history elements
    this.newChatBtn = document.getElementById('new-chat-btn');
    this.historyBtn = document.getElementById('chat-history-btn');
    this.closeHistoryBtn = document.getElementById('close-history-btn');

    // Chat title elements
    this.chatTitleDisplay = document.getElementById('chat-title-display');
    this.chatTitleDisplayFloating = document.getElementById('chat-title-display-floating');

    // Debug: check if elements are found
    console.log('🔍 Chat elements initialized:', {
      chatInput: !!this.chatInput,
      chatForm: !!this.chatForm,
      sendBtn: !!this.sendBtn,
      chatInputDisabled: this.chatInput?.disabled
    });

    // Ensure inputs are enabled on initialization
    if (this.chatInput) {
      this.chatInput.disabled = false;
    }
    if (this.sendBtn) {
      this.sendBtn.disabled = false;
    }
    if (this.floatingChatInput) {
      this.floatingChatInput.disabled = false;
    }
    if (this.floatingSendBtn) {
      this.floatingSendBtn.disabled = false;
    }

    this.normalizeExistingMessages();
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

    // Chat history listeners
    this.newChatBtn?.addEventListener('click', () => {
      this.clearChat();
      this.createNewChat();
      // Ensure chat is open when starting a new chat
      if (!this.isOpen) {
        this.openChat();
      }
    });
    this.historyBtn?.addEventListener('click', () => this.showChatHistory());
    this.closeHistoryBtn?.addEventListener('click', () => this.hideChatHistory());

    // Chat title editing listeners
    this.chatTitleDisplay?.addEventListener('click', () => this.startEditingTitle(false));
    this.chatTitleDisplayFloating?.addEventListener('click', () => this.startEditingTitle(true));
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

  updateContext(legName, destinationsData, startDate, endDate, subLegName = null) {
    console.log('🔄 updateContext called:', {
      legName,
      subLegName,
      destinationsCount: destinationsData?.length || 0,
      oldDestinationsCount: this.currentDestinationsData?.length || 0
    });

    this.currentLeg = legName;
    this.currentSubLeg = subLegName;
    this.currentDestinationsData = destinationsData; // Full location objects
    this.currentStartDate = startDate;
    this.currentEndDate = endDate;

    console.log('✅ Chat context updated - now has', this.currentDestinationsData?.length || 0, 'destinations');
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
    if (!source || !target) return;

    const isFloatingTarget = target === this.floatingChatMessages;
    target.innerHTML = '';

    Array.from(source.children).forEach(child => {
      const isFloatingSource = source === this.floatingChatMessages;
      const baseId = this.assignMessageIdentifiers(child, isFloatingSource);
      const clone = child.cloneNode(true);
      clone.dataset.messageId = baseId;
      this.assignMessageIdentifiers(clone, isFloatingTarget);
      target.appendChild(clone);
    });
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

  generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  getDomMessageId(baseId, isFloating) {
    return `${baseId}-${isFloating ? 'floating' : 'sidebar'}`;
  }

  assignMessageIdentifiers(messageElement, isFloating) {
    if (!messageElement) return null;

    let baseId = messageElement.dataset?.messageId;
    if (!baseId) {
      baseId = this.generateMessageId();
      messageElement.dataset.messageId = baseId;
    }

    messageElement.id = this.getDomMessageId(baseId, isFloating);
    return baseId;
  }

  normalizeExistingMessages() {
    [this.chatMessages, this.floatingChatMessages].forEach(container => {
      if (!container) return;
      const isFloating = container === this.floatingChatMessages;
      Array.from(container.querySelectorAll('.chat-message')).forEach(msg => {
        this.assignMessageIdentifiers(msg, isFloating);
      });
    });
  }

  resetChatMessages(container) {
    if (!container) return;
    const isFloating = container === this.floatingChatMessages;
    Array.from(container.querySelectorAll('.chat-message')).forEach((msg, index) => {
      if (index === 0) {
        this.assignMessageIdentifiers(msg, isFloating);
      } else {
        msg.remove();
      }
    });
  }

  async handleSubmit(e, isFloating = false) {
    console.log('🚨 handleSubmit called');

    try {
      e.preventDefault();
      e.stopPropagation();

      console.log('🚨 === CHAT SUBMIT START ===');
      console.log('🚨 Current app state before sending:', {
        currentMarkers: window.currentMarkers?.length || 0,
        currentLocations: window.currentLocations?.length || 0,
        workingDataLocations: window.workingData?.locations?.length || 0
      });

      const input = isFloating ? this.floatingChatInput : this.chatInput;
    const messages = isFloating ? this.floatingChatMessages : this.chatMessages;
    const sendBtn = isFloating ? this.floatingSendBtn : this.sendBtn;

    const message = input.value.trim();
    if (!message) return;

    // Ensure we have a chat session before adding messages
    if (!this.currentChatId) {
      console.log('🆘 No currentChatId, creating new chat before sending message');
      await this.createNewChat();
    } else {
      console.log('✅ Using existing chat session:', this.currentChatId);
    }

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
        sub_leg_name: this.currentSubLeg || null,
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

      console.log('🚀 Sending chat request with context:');
      console.log('   Leg:', context.leg_name);
      console.log('   Sub-Leg:', context.sub_leg_name);
      console.log('   Destinations count:', context.destinations.length);
      console.log('   Destinations data:', context.destinations);
      console.log('   CurrentDestinationsData source:', this.currentDestinationsData);
      console.log('   Full context:', context);

      const payload = {
        message,
        context,
        session_id: this.sessionId,
        // Only send initialize_itinerary flag on actual first message (no session and no chat history)
        initialize_itinerary: !this.sessionId && this.messages.length === 0
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
        this.persistSessionId(this.sessionId);

        // Save session ID to state persistence
        this.statePersistence.saveChatState(this.currentChatId, this.messages, this.sessionId);
      } else {
        console.warn('⚠️ No session_id in response!', data);
      }

      // Clear the timer
      clearInterval(timerInterval);

      // Remove loading message
      this.removeMessage(loadingMsgId, isFloating);

      // Add bot response
      // ⚠️ NOTE: AI responses may be inconsistent. The AI might claim it cannot access the itinerary
      // even when complete context data was sent. Backend investigation needed for this non-deterministic behavior.
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
      console.log('🚨 === CHAT SUBMIT END ===');
      setTimeout(() => {
        console.log('🚨 App state after sending:', {
          currentMarkers: window.currentMarkers?.length || 0,
          currentLocations: window.currentLocations?.length || 0,
          workingDataLocations: window.workingData?.locations?.length || 0
        });
      }, 1000);
    }
    } catch (error) {
      console.error('🔥 CRITICAL ERROR in handleSubmit - this might be causing the page reload:', error);
      console.error('🔥 Error details:', error.message, error.stack);
      alert(`An error occurred while sending your message: ${error.message}`);
      this.setLoading(false, isFloating);
    }
  }

  addMessage(text, sender = 'bot', isLoading = false, isFloating = false, saveToFirestore = true) {
    // Generate ID without periods (replace decimal point with underscore)
    const baseMessageId = this.generateMessageId();
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}${isLoading ? ' loading' : ''}`;
    messageDiv.dataset.messageId = baseMessageId;
    messageDiv.id = this.getDomMessageId(baseMessageId, isFloating);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);

    const messagesContainer = isFloating ? this.floatingChatMessages : this.chatMessages;
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Save to Firestore (unless it's a loading message) - but make it optional to avoid permission errors
    if (saveToFirestore && !isLoading && this.firestoreEnabled) {
      this.saveMessage(text, sender).catch(err => {
        console.warn('Failed to save message to Firestore (continuing without persistence):', err);
        // Disable Firestore for this session to avoid repeated errors
        this.firestoreEnabled = false;
      });
    }

    return baseMessageId;
  }

  getMessageElement(messageId, isFloating = false) {
    const messagesContainer = isFloating ? this.floatingChatMessages : this.chatMessages;
    if (!messagesContainer) return null;
    return messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
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
    this.resetChatMessages(this.chatMessages);
    this.resetChatMessages(this.floatingChatMessages);
    this.sessionId = null;
    this.currentChatId = null;
    this.messages = [];

    // Reset title to default
    this.updateChatTitle('AI Travel Concierge');

    // Clear chat state from persistence
    this.statePersistence.saveChatState(null, [], null);
  }

  // ==================== CHAT HISTORY METHODS ====================

  /**
   * Create a new chat in Firestore
   */
  async createNewChat() {
    console.log('🆕 Creating new chat - current state:', {
      currentChatId: this.currentChatId,
      messagesCount: this.messages?.length || 0,
      sessionId: this.sessionId
    });

    try {
      const chatRef = await addDoc(collection(db, 'chatHistory'), {
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        legName: this.currentLeg || 'All',
        subLegName: this.currentSubLeg || null,
        title: 'New Chat',
        messageCount: 0
      });

      this.currentChatId = chatRef.id;
      this.messages = [];
      console.log('📝 Created new chat:', this.currentChatId);
      console.log('🆕 Chat state after creation:', {
        currentChatId: this.currentChatId,
        messagesCount: this.messages?.length || 0,
        sessionId: this.sessionId
      });

      // Save chat state
      this.statePersistence.saveChatState(this.currentChatId, this.messages, this.sessionId);

      return chatRef.id;
    } catch (error) {
      console.error('🔥 Error creating new chat:', error);
      console.trace('Stack trace for createNewChat error:');
      return null;
    }
  }

  /**
   * Save a message to Firestore
   */
  async saveMessage(text, sender) {
    if (!this.currentChatId) {
      console.warn('⚠️ No currentChatId when saving message - this should not happen');
      return;
    }

    console.log('💾 Saving message to Firestore:', { text, sender, chatId: this.currentChatId });

    try {
      const message = {
        text,
        sender,
        timestamp: Timestamp.now()
      };

      this.messages.push(message);

      // Update chat document with new message
      const chatRef = doc(db, 'chatHistory', this.currentChatId);

      // Generate title from first user message
      let title = 'New Chat';
      if (sender === 'user' && this.messages.filter(m => m.sender === 'user').length === 1) {
        title = text.substring(0, 50) + (text.length > 50 ? '...' : '');
      } else {
        const chatDoc = await getDoc(chatRef);
        if (chatDoc.exists()) {
          title = chatDoc.data().title || 'New Chat';
        }
      }

      await setDoc(chatRef, {
        messages: this.messages.map(m => ({
          text: m.text,
          sender: m.sender,
          timestamp: m.timestamp
        })),
        updatedAt: Timestamp.now(),
        legName: this.currentLeg || 'All',
        subLegName: this.currentSubLeg || null,
        title: title,
        messageCount: this.messages.length,
        sessionId: this.sessionId || null
      }, { merge: true });

      console.log('💾 Saved message to chat:', this.currentChatId);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  }

  async persistSessionId(sessionId) {
    if (!this.currentChatId) return;

    try {
      const chatRef = doc(db, 'chatHistory', this.currentChatId);
      await updateDoc(chatRef, { sessionId: sessionId || null });
      console.log('🗂️ Persisted session ID for chat:', this.currentChatId, sessionId);
    } catch (error) {
      console.error('Error persisting session ID:', error);
    }
  }

  /**
   * Load a chat from Firestore
   */
  async loadChat(chatId) {
    try {
      const chatRef = doc(db, 'chatHistory', chatId);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists()) {
        console.error('Chat not found:', chatId);
        return false;
      }

      const chatData = chatDoc.data();
      this.currentChatId = chatId;
      this.messages = chatData.messages || [];
      this.sessionId = chatData.sessionId || null;

      // Clear current chat UI
      this.chatMessages.innerHTML = '';
      this.floatingChatMessages.innerHTML = '';

      // Render messages
      this.messages.forEach(msg => {
        this.addMessage(msg.text, msg.sender, false, false, false);
      });

      // Sync to floating chat
      this.syncMessages(this.chatMessages, this.floatingChatMessages);

      // Update the displayed title
      this.updateChatTitle(chatData.title || 'New Chat');

      // Auto-expand chat box when loading a previous thread
      if (!this.isOpen) {
        this.openChat();
      }

      // Save chat state
      this.statePersistence.saveChatState(this.currentChatId, this.messages, this.sessionId);

      console.log('📂 Loaded chat:', chatId, 'with', this.messages.length, 'messages');
      return true;
    } catch (error) {
      console.error('Error loading chat:', error);
      return false;
    }
  }

  /**
   * Get all chat histories from Firestore
   */
  async getChatHistories() {
    try {
      const q = query(
        collection(db, 'chatHistory'),
        orderBy('updatedAt', 'desc'),
        limit(50)
      );

      const querySnapshot = await getDocs(q);
      const chats = [];

      querySnapshot.forEach((doc) => {
        chats.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('📚 Retrieved', chats.length, 'chat histories');
      return chats;
    } catch (error) {
      console.error('Error getting chat histories:', error);
      return [];
    }
  }

  /**
   * Delete a chat from Firestore
   */
  async deleteChat(chatId) {
    try {
      await deleteDoc(doc(db, 'chatHistory', chatId));
      console.log('🗑️ Deleted chat:', chatId);

      if (this.currentChatId === chatId) {
        this.clearChat();
        // Clear chat state from persistence
        this.statePersistence.saveChatState(null, [], null);
      }

      return true;
    } catch (error) {
      console.error('Error deleting chat:', error);
      return false;
    }
  }

  /**
   * Show chat history panel
   */
  async showChatHistory() {
    const historyPanel = document.getElementById('chat-history-panel');
    const historyList = document.getElementById('chat-history-list');

    if (!historyPanel || !historyList) {
      console.error('Chat history UI elements not found');
      return;
    }

    // Show loading state
    historyList.innerHTML = '<div class="loading">Loading chat history...</div>';
    historyPanel.classList.remove('hidden');

    // Load chat histories
    const chats = await this.getChatHistories();

    if (chats.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No chat history yet</div>';
      return;
    }

    // Render chat list
    historyList.innerHTML = '';
    chats.forEach(chat => {
      const chatItem = document.createElement('div');
      chatItem.className = 'chat-history-item';
      chatItem.innerHTML = `
        <div class="chat-history-info">
          <div class="chat-history-title-container">
            <div class="chat-history-title" data-chat-id="${chat.id}">${chat.title || 'Untitled Chat'}</div>
            <button class="chat-history-ai-title-btn" data-chat-id="${chat.id}" title="Generate AI title">🤖</button>
          </div>
          <div class="chat-history-meta">
            ${chat.legName || 'All Legs'} • ${chat.messageCount || 0} messages
          </div>
          <div class="chat-history-time">
            Last active: ${this.formatDate(chat.updatedAt, true)}
          </div>
        </div>
        <div class="chat-history-actions">
          <button class="chat-history-load-btn" data-chat-id="${chat.id}">Load</button>
          <button class="chat-history-delete-btn" data-chat-id="${chat.id}">Delete</button>
        </div>
      `;

      // Add event listeners
      const loadBtn = chatItem.querySelector('.chat-history-load-btn');
      const deleteBtn = chatItem.querySelector('.chat-history-delete-btn');
      const titleElement = chatItem.querySelector('.chat-history-title');
      const aiTitleBtn = chatItem.querySelector('.chat-history-ai-title-btn');

      loadBtn.addEventListener('click', async () => {
        await this.loadChat(chat.id);
        historyPanel.classList.add('hidden');
      });

      deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this chat?')) {
          await this.deleteChat(chat.id);
          await this.showChatHistory(); // Refresh list
        }
      });

      titleElement.addEventListener('click', () => this.startEditingChatTitle(chat.id, titleElement));
      aiTitleBtn.addEventListener('click', () => this.generateAITitle(chat.id, titleElement));

      historyList.appendChild(chatItem);
    });
  }

  /**
   * Hide chat history panel
   */
  hideChatHistory() {
    const historyPanel = document.getElementById('chat-history-panel');
    if (historyPanel) {
      historyPanel.classList.add('hidden');
    }
  }

  /**
   * Format timestamp for display
   */
  formatDate(timestamp, detailed = false) {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (detailed) {
      // Return detailed date/time for conversation list
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });

      if (diffMins < 1) return `Just now`;
      if (diffMins < 60) return `${diffMins}m ago • ${timeStr}`;
      if (diffHours < 24) return `${diffHours}h ago • ${timeStr}`;
      if (diffDays < 7) return `${diffDays}d ago • ${dateStr}`;

      return `${dateStr} • ${timeStr}`;
    } else {
      // Return simple relative time for other uses
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    }
  }

  /**
   * Update the displayed chat title
   */
  updateChatTitle(title) {
    const displayTitle = title || 'AI Travel Concierge';
    if (this.chatTitleDisplay) {
      this.chatTitleDisplay.textContent = displayTitle;
    }
    if (this.chatTitleDisplayFloating) {
      this.chatTitleDisplayFloating.textContent = displayTitle;
    }
  }

  /**
   * Start editing the chat title
   */
  startEditingTitle(isFloating = false) {
    if (!this.currentChatId) return;

    const titleElement = isFloating ? this.chatTitleDisplayFloating : this.chatTitleDisplay;
    if (!titleElement || titleElement.classList.contains('editing')) return;

    const currentTitle = titleElement.textContent;
    titleElement.classList.add('editing');
    titleElement.contentEditable = true;
    titleElement.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(titleElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Handle save/cancel
    const saveTitle = () => {
      titleElement.contentEditable = false;
      titleElement.classList.remove('editing');

      const newTitle = titleElement.textContent.trim();
      if (newTitle && newTitle !== currentTitle) {
        this.saveChatTitle(newTitle);
      } else {
        titleElement.textContent = currentTitle; // Restore if empty or unchanged
      }
    };

    const cancelEdit = (e) => {
      if (e.key === 'Escape') {
        titleElement.textContent = currentTitle;
        titleElement.contentEditable = false;
        titleElement.classList.remove('editing');
        titleElement.blur();
      }
    };

    titleElement.addEventListener('blur', saveTitle, { once: true });
    titleElement.addEventListener('keydown', cancelEdit);
    titleElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleElement.blur(); // This will trigger the save
      }
    });
  }

  /**
   * Save the updated chat title to Firestore
   */
  async saveChatTitle(newTitle) {
    if (!this.currentChatId || !newTitle.trim()) return;

    try {
      const chatRef = doc(db, 'chatHistory', this.currentChatId);
      await updateDoc(chatRef, {
        title: newTitle.trim(),
        updatedAt: Timestamp.now()
      });

      // Update in-memory messages title if first message
      if (this.messages.length > 0) {
        const firstUserMessage = this.messages.find(m => m.sender === 'user');
        if (firstUserMessage) {
          // Update the title in memory (optional, for consistency)
          console.log('Updated chat title to:', newTitle);
        }
      }

      this.updateChatTitle(newTitle);
      console.log('✅ Saved chat title:', newTitle);
    } catch (error) {
      console.error('Error saving chat title:', error);
      // Revert the title display on error
      this.updateChatTitle(this.getCurrentChatTitle());
    }
  }

  /**
   * Generate an AI title for a chat conversation
   */
  async generateAITitle(chatId, titleElement) {
    if (!chatId || !titleElement) return;

    // Show loading state
    const originalTitle = titleElement.textContent;
    titleElement.textContent = '🤖 Generating title...';
    titleElement.style.opacity = '0.7';

    try {
      // Fetch the chat data from Firestore
      const chatRef = doc(db, 'chatHistory', chatId);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists()) {
        throw new Error('Chat not found');
      }

      const chatData = chatDoc.data();
      const messages = chatData.messages || [];

      if (messages.length === 0) {
        throw new Error('No messages to analyze');
      }

      // Call the backend API to generate title
      const response = await fetch('http://localhost:5001/api/generate-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            text: msg.text,
            sender: msg.sender
          })),
          currentTitle: chatData.title || 'Untitled Chat'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const generatedTitle = data.title || 'Generated Title';

      // Save the generated title to Firestore
      await this.saveChatHistoryTitle(chatId, generatedTitle);

      // Update the display
      titleElement.textContent = generatedTitle;
      titleElement.style.opacity = '1';

      // If this is the current chat, update the display too
      if (chatId === this.currentChatId) {
        this.updateChatTitle(generatedTitle);
      }

      console.log('✅ AI generated title:', generatedTitle);

    } catch (error) {
      console.error('Error generating AI title:', error);

      // Show error state and revert
      titleElement.textContent = originalTitle;
      titleElement.style.opacity = '1';

      // Optionally show error message to user
      if (error.message.includes('Failed to fetch')) {
        titleElement.textContent = '❌ Backend unavailable';
        setTimeout(() => {
          titleElement.textContent = originalTitle;
        }, 2000);
      } else {
        titleElement.textContent = '❌ Generation failed';
        setTimeout(() => {
          titleElement.textContent = originalTitle;
        }, 2000);
      }
    }
  }

  /**
   * Start editing a chat title from the history list
   */
  startEditingChatTitle(chatId, titleElement) {
    if (titleElement.classList.contains('editing')) return;

    const currentTitle = titleElement.textContent;
    titleElement.classList.add('editing');
    titleElement.contentEditable = true;
    titleElement.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(titleElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Handle save/cancel
    const saveTitle = async () => {
      titleElement.contentEditable = false;
      titleElement.classList.remove('editing');

      const newTitle = titleElement.textContent.trim();
      if (newTitle && newTitle !== currentTitle) {
        await this.saveChatHistoryTitle(chatId, newTitle);

        // If this is the current chat, update the display too
        if (chatId === this.currentChatId) {
          this.updateChatTitle(newTitle);
        }
      } else {
        titleElement.textContent = currentTitle; // Restore if empty or unchanged
      }
    };

    const cancelEdit = (e) => {
      if (e.key === 'Escape') {
        titleElement.textContent = currentTitle;
        titleElement.contentEditable = false;
        titleElement.classList.remove('editing');
        titleElement.blur();
      }
    };

    titleElement.addEventListener('blur', saveTitle, { once: true });
    titleElement.addEventListener('keydown', cancelEdit);
    titleElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleElement.blur(); // This will trigger the save
      }
    });
  }

  /**
   * Save a chat title from the history list to Firestore
   */
  async saveChatHistoryTitle(chatId, newTitle) {
    if (!chatId || !newTitle.trim()) return;

    try {
      const chatRef = doc(db, 'chatHistory', chatId);
      await updateDoc(chatRef, {
        title: newTitle.trim(),
        updatedAt: Timestamp.now()
      });

      console.log('✅ Saved chat history title:', chatId, newTitle);
    } catch (error) {
      console.error('Error saving chat history title:', error);
      throw error; // Re-throw so the calling function can handle it
    }
  }

  /**
   * Get current chat title from Firestore data
   */
  getCurrentChatTitle() {
    // This would need to be called when loading a chat
    // For now, return the current display text
    return this.chatTitleDisplay?.textContent || 'AI Travel Concierge';
  }

  startPollingForChanges() {
    // Poll for itinerary changes every 2 seconds when chat is active
    // ⚠️ WORKAROUND: Due to non-deterministic AI responses, we rely on polling to detect changes
    // that the AI may have applied even when it claims it cannot access the itinerary.
    if (this.pollInterval) {
      // console.log('⚠️ Polling already active');
      return; // Already polling
    }

    // console.log('🔄 Starting polling for itinerary changes...');
    this.pollInterval = setInterval(async () => {
      try {
        // Poll the active session queue; fall back to default until one exists
        const sessionIds = this.sessionId ? [this.sessionId] : ['default_session'];

        for (const sid of sessionIds) {
          const response = await fetch(`${CHANGES_API_URL}/${sid}`);
          if (!response.ok) {
            // console.log(`Poll failed for session ${sid}: ${response.status}`);
            continue;
          }

          const data = await response.json();
          // console.log(`Poll response for session ${sid}:`, data);
          // console.log(`  - data.status: ${data.status}`);
          // console.log(`  - data.changes: ${data.changes}`);
          // console.log(`  - data.changes.length: ${data.changes?.length}`);

          if (data.status === 'success' && data.changes && data.changes.length > 0) {
            console.log(`🚨 !!! POLLING RECEIVED CHANGES !!!`);
            console.log(`🚨 This might be causing the app reset!`);
            console.log(`✅ Received ${data.changes.length} itinerary changes from session ${sid}:`, data.changes);
            console.trace('🚨 Stack trace for polling changes:');

            // Notify parent to apply changes
            if (this.onItineraryChange) {
              // console.log('📞 Calling onItineraryChange callback with changes:', data.changes);
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

// Global error handler to catch any unhandled errors that might cause page reload
window.addEventListener('error', function(event) {
  console.error('🔥 GLOBAL ERROR CAUGHT - this might be causing the page reload:', event.error);
  console.error('🔥 Error details:', event.error.message, event.error.stack);
  event.preventDefault();
});

window.addEventListener('unhandledrejection', function(event) {
  console.error('🔥 UNHANDLED PROMISE REJECTION - this might be causing the page reload:', event.reason);
  event.preventDefault();
});

// Export for use in main app
window.TravelConciergeChat = TravelConciergeChat;
