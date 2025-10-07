# Chat input box visibility issue
_Exported on 10/7/2025 at 10:07:40 PDT from Cursor (1.7.38)_

---

**User**

why isn't my chat input box visible when I refresh the screen?

---

**Cursor**

I'll scan the frontend files to find how the chat UI/input is created and what conditions hide it, starting with `web/chat.js` and references in HTML. Then I'll look for any state gating or CSS that might hide the input on initial load/refresh.

### Short answer
Because the sidebar chat can start “collapsed” (the container gets the CSS class `hidden`) or covered by another panel, your input isn’t rendered. On refresh, if the chat was toggled closed or a panel is still open, you’ll only see messages but not the input area. Clicking the blue “AI Travel Concierge” header (or the ▼ toggle) re-opens it. If a modal/panel is open, close it.

### What’s happening (in simple terms)
- The chat UI is split into:
  - a messages area
  - a thin resizer bar
  - the input form
- When the chat is closed, a CSS class `hidden` is applied to the whole container, which removes the input from layout.
- On load, the code checks the container’s class to decide whether the chat is open and whether to start polling. It does not force it open.

Key places that control visibility:

```73:90:/Users/ray/Documents/GitHub/rtw-trip/web/chat.js
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
  // ...
}
```

```168:184:/Users/ray/Documents/GitHub/rtw-trip/web/chat.js
toggleChat() {
  if (this.isOpen) {
    this.closeChat();
  } else {
    this.openChat();
  }
}
openChat() {
  this.isOpen = true;
  this.chatContainer.classList.remove('hidden');
  this.toggleBtn.classList.remove('collapsed');
  this.chatInput.focus();
  this.startPollingForChanges();
}
```

```933:937:/Users/ray/Documents/GitHub/rtw-trip/web/styles.css
.chat-container-sidebar.hidden {
  display: none;
}
```

And the DOM does include the input form:

```137:141:/Users/ray/Documents/GitHub/rtw-trip/web/index.html
<div id="chat-input-resizer" class="chat-input-resizer"></div>
<form id="chat-form-sidebar" class="chat-form-sidebar">
  <input type="text" id="chat-input-sidebar" placeholder="Ask to modify your trip..." autocomplete="off" required>
  <button type="submit" id="chat-send-btn-sidebar">→</button>
</form>
```

### How to confirm and fix quickly
- Click the blue “AI Travel Concierge” header or the ▼ button. That calls `openChat()` and removes the `hidden` class.
- If the chat history panel is open (it overlays the sidebar), close it via the ✕ button.
- If you previously undocked the chat, click “⬋ Dock” to return it to the sidebar.
- DevTools quick check:
  - Inspect `#chat-container-sidebar`. If you see class `hidden`, the chat is collapsed.
  - Ensure `.chat-form-sidebar` is present and not `display: none`.

### Code review and feedback
- The logic is sound: visibility is tied to a single `hidden` class. Good separation between UI and behavior.
- Minor UX nit: the app doesn’t persist “open/closed” state, so a refresh may surprise you. Consider persisting the open state in `StatePersistence` and restoring it on load so the input consistently shows when you had it open.
- Also, adding a small “collapsed” status indicator (e.g., rotate the ▼ and change tooltip text) helps users realize the input is hidden, not broken.

### Suggestions for learning/practice
- Practice tracing UI visibility bugs: locate controlling elements, find toggles, and check CSS classes.
- Try adding a simple “remember chat open state” feature:
  - Save a boolean when calling `openChat()`/`closeChat()`.
  - On constructor init, read that value and call `openChat()` if it was open.
- Explore how flex layouts and `display: none` affect children to better reason about why inputs disappear even if the DOM nodes exist.

```javascript
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
  // ...
}
```

```javascript
toggleChat() {
  if (this.isOpen) {
    this.closeChat();
  } else {
    this.openChat();
  }
}
openChat() {
  this.isOpen = true;
  this.chatContainer.classList.remove('hidden');
  this.toggleBtn.classList.remove('collapsed');
  this.chatInput.focus();
  this.startPollingForChanges();
}
```

```css
.chat-container-sidebar.hidden {
  display: none;
}
```

```html
<div id="chat-input-resizer" class="chat-input-resizer"></div>
<form id="chat-form-sidebar" class="chat-form-sidebar">
  <input type="text" id="chat-input-sidebar" placeholder="Ask to modify your trip..." autocomplete="off" required>
  <button type="submit" id="chat-send-btn-sidebar">→</button>
</form>
```

---

**User**

persist the open state in StatePersistence and restoring it on load so the input consistently shows when you had it open.

---

**Cursor**

I'll add persistence for the chat open/closed state using `StatePersistence`: save state on toggle/open/close and restore it during initialization. I'll update `web/chat.js` and, if needed, extend `state-persistence.js`.

I’m going to implement chat open/closed persistence by:
- Extending `web/state-persistence.js` to include a `chatOpen` field and a helper to save it.
- Updating `web/chat.js` to save on open/close and to restore the state on load.

```javascript
// State Persistence Module
// Handles saving and restoring app state across page reloads

const STATE_KEY = 'rtw-app-state';
const STATE_VERSION = 1;

export class StatePersistence {
  constructor() {
    this.state = this.loadState();
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem(STATE_KEY);
      if (!stored) return this.getDefaultState();

      const state = JSON.parse(stored);

      // Validate state version
      if (state.version !== STATE_VERSION) {
        console.warn('State version mismatch, using default state');
        return this.getDefaultState();
      }

      return state;
    } catch (error) {
      console.error('Error loading state:', error);
      return this.getDefaultState();
    }
  }

  /**
   * Save state to localStorage
   */
  saveState(updates = {}) {
    try {
      this.state = {
        ...this.state,
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem(STATE_KEY, JSON.stringify(this.state));
      console.log('💾 State saved:', this.state);
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  /**
   * Get default/empty state
   */
  getDefaultState() {
    return {
      version: STATE_VERSION,
      scenarioId: null,
      selectedLeg: 'all',
      selectedSubLeg: null,
      chatId: null,
      chatMessages: [],
      sessionId: null,
      // Persist whether the sidebar chat is open (default true so input is visible on first load)
      chatOpen: true,
      lastUpdated: null
    };
  }

  /**
   * Clear all persisted state
   */
  clearState() {
    localStorage.removeItem(STATE_KEY);
    this.state = this.getDefaultState();
    console.log('🧹 State cleared');
  }

  /**
   * Save scenario selection
   */
  saveScenarioSelection(scenarioId) {
    this.saveState({ scenarioId });
  }

  /**
   * Save leg/sub-leg selection
   */
  saveLegSelection(legName, subLegName = null) {
    this.saveState({
      selectedLeg: legName,
      selectedSubLeg: subLegName
    });
  }

  /**
   * Save chat state
   */
  saveChatState(chatId, messages = [], sessionId = null) {
    this.saveState({
      chatId,
      chatMessages: messages,
      sessionId
    });
  }

  /**
   * Save chat open/closed UI state
   */
  saveChatOpenState(isOpen) {
    this.saveState({ chatOpen: !!isOpen });
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Check if we have valid state to restore
   */
  hasValidState() {
    return this.state.scenarioId !== null || this.state.selectedLeg !== 'all';
  }
}

```

```javascript
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

    // Restore chat state from localStorage (includes chat open/close state)
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

    // Restore chat open/closed UI state
    if (this.chatContainer) {
      const shouldBeOpen = savedState.chatOpen !== false; // default open if undefined
      if (shouldBeOpen) {
        this.openChat();
      } else {
        this.closeChat();
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
    // Persist UI state
    this.statePersistence.saveChatOpenState(true);
  }

  closeChat() {
    console.log('📁 Closing chat...');
    this.isOpen = false;
    this.chatContainer.classList.add('hidden');
    this.toggleBtn.classList.add('collapsed');
    this.stopPollingForChanges();
    // Persist UI state
    this.statePersistence.saveChatOpenState(false);
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
        // Include current scenario so backend tools can save costs to Firestore
        scenario_id: window.currentScenarioId || null,
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
    }, 4000); // Poll every 4 seconds
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

```

- I added persistence for the chat’s open/closed state and wired it into load/restore.

What I changed
- web/state-persistence.js
  - Added a new field `chatOpen` to the persisted state (default true).
  - Added `saveChatOpenState(isOpen)` to write the UI state.
- web/chat.js
  - On restore, after restoring IDs/messages, it now reads `savedState.chatOpen` and calls `openChat()` or `closeChat()` accordingly.
  - `openChat()` and `closeChat()` now call `this.statePersistence.saveChatOpenState(true/false)` so your choice is remembered across refreshes.

How to use it
- Open or collapse the chat via the header or ▼ button; refresh the page. The input should appear or remain hidden exactly as you left it.

Summary
- Persisted `chatOpen` in state and restore it on load; the chat input now consistently shows or hides after refresh based on your last action.

---

**User**

why is this issue happening in my code?  don't fix it, just analyze the issue and propose a fix, but dont' code anything 

---

**Cursor**

### Answer
The error is happening because your model is calling a tool named “DestinationCostResearch”, but that tool isn’t registered in the backend tool registry the model is allowed to use. In other words: the tool name in the LLM function call does not match anything in the ADK tools_dict that your server passes to the model, so ADK throws “Function DestinationCostResearch is not found in the tools_dict.”

You can also see a secondary issue: “Session already exists: session_43ae47be4d33.” That’s harmless-but-noisy and separate from the missing-tool problem. It just means your code tried to create a session that already exists; you should treat 400 here as “ok, reuse existing.”

Why you’re seeing it now
- Your chat front end is correctly sending messages; the backend is streaming SSE events.
- The LLM decided to call DestinationCostResearch (good).
- ADK tried to resolve that tool by name in the tools_dict (the list/map of allowed tools) but couldn’t find it (bad).
- ADK therefore raises a ValueError and you get no response content (“No response generated”).

Typical root causes
- Tool name mismatch: the registered tool is called something like cost_research or destination_cost_research, but the LLM is emitting DestinationCostResearch.
- Tool not registered: the function exists in code, but you never add it to the tools_dict for this agent/route.
- Wrong agent path: you spin up an agent that doesn’t include the cost tools (e.g., you created/selected a “planning” agent without cost tools).
- Environment/profile mismatch: a different config (dev vs test) includes different tools; your running process doesn’t match your code edits.
- Import/decorator missing: the tool function isn’t decorated/typed in the way ADK expects, so auto-registration never happened.

Proposed fix (no code yet — step-by-step plan)
- Verify the exact tool name:
  - Search your Python code for the tool implementation you expect (likely in `python/agents/travel-concierge/travel_concierge/tools/` or the cost sub-agent). Confirm the intended public tool name is exactly “DestinationCostResearch”. If the function or decorator uses a different name, update either the code or the model prompt/tool list so names match.
- Ensure the tool is in the tools_dict for this endpoint:
  - Find where the agent is constructed (likely `python/agents/travel-concierge/api_server.py` or `travel_concierge/agent.py`). Look for where ADK’s agent is built with a `tools` or `tools_dict` and confirm your cost tool is included.
  - If you rely on auto-discovery, confirm the module containing the tool is imported before agent creation so ADK can see it.
- Keep the schema simple and valid:
  - If you use ADK tool decorators, ensure the function’s signature matches what the model emits (fields like `destination_name`, `destination_id`, etc.). If the LLM is calling with `destination_id`, make sure your tool schema accepts it or mark it optional.
- Align prompts and available tools:
  - The system/prompt should advertise tools that exactly match the tools_dict names. If your prompts mention “DestinationCostResearch”, that must exist in tools_dict as “DestinationCostResearch”.
- Restart the backend:
  - After adding/aligning the tool registration, restart the Python server so ADK rebuilds the tools_dict.
- Handle the session 400 cleanly (separate issue):
  - When create-session returns 400 “already exists”, switch to “use existing session” without logging it as an error. This reduces noise and avoids misleading error flows.

How to test quickly
- Add a temporary debug print of the tools_dict keys on server start to confirm “DestinationCostResearch” is present.
- Send a simple, deterministic prompt that forces a call to the tool (e.g., “Research costs for Okinawa for 3 days”).
- Watch the logs: the SSE event should show a functionCall whose name exactly matches a key in tools_dict, and the handler should execute.

Code review and feedback
- You’re doing the right thing by surfacing detailed logs in both the front end and backend; that made the diagnosis straightforward.
- The “unexpected_tool_call” is a clear sign of a tool registry mismatch — great that you’re logging the raw SSE event; it confirms the tool name and arguments.
- Consider centralizing tool registration in a single module and importing it from all agents, to avoid drift between agent variants.

Suggestions for further learning or practice
- Read a short section on “function calling” and tool schemas: learn how tooling name, schema, and registration must align exactly for reliable execution.
- Practice creating a minimal ADK agent with a single tool and add/remove it from the tools_dict to see the exact failure modes you just hit.
- Add a startup assertion: if your prompts list tools that aren’t in tools_dict, log a loud warning. This catches drift before you test the UI.

---

**User**

Still not working. is the before_model_callback causing issues? It came from this thread: https://github.com/google/adk-python/issues/701.

---

**Cursor**

Let me search the backend for any before_model_callback usage and how tools are registered, so I can see if it alters tools or function calling behavior.

- Quick update: I looked for where callbacks and tools are set in your backend. I found a callback that clears the tool registry at runtime inside the cost research sub-agent. That explains the “Function DestinationCostResearch is not found in the tools_dict.” error you see right after an SSE event that carries a functionCall for DestinationCostResearch.

### Why this is happening
- Your cost research agent defines a before_model_callback named `structured_output_callback`.
- That callback counts prior tool responses and, once it thinks “research is done,” it does:
  - `llm_request.tools_dict.clear()` and `llm_request.config.tools = None`
  - `llm_request.set_output_schema(types.DestinationCostResearch)`
  - Sets `FunctionCallingConfig(mode="none")`
- The model then returns a function call named `DestinationCostResearch` (this is how ADK represents structured output schemas — they often come back as a functionCall with the schema name).
- But because `tools_dict` was cleared, ADK tries to look up that function name and can’t find it, producing exactly the error you’re seeing: “Function DestinationCostResearch is not found in the tools_dict.”
- That’s why the finish reason shows “UNEXPECTED_TOOL_CALL” and why you get “No response generated.”

So yes — the before_model_callback is the proximate cause.

### Proposed fixes (no code, just the plan)
Pick one of these patterns that matches how you want the agent to behave:

- Keep tools while enabling structured output
  - Don’t clear `tools_dict`. Keep your search tools registered even when switching to a structured output schema.
  - Set the output schema with `set_output_schema(...)` and leave function calling in “auto/appropriate” mode so ADK can accept the schema function call without needing the registry wiped.
  - This is the smallest, safest change: it avoids the mismatch between the schema “function” and an empty tool map.

- Switch to pure JSON (no function calling) for the final step
  - If you want a strict “no more tools” phase, set the output schema and also ensure the model won’t emit a function call.
  - That means either:
    - Use the ADK-recommended way to enforce JSON output (e.g., response MIME type + schema) so the model returns raw JSON, not a functionCall; or
    - If the model still insists on functionCall, register a lightweight “schema handler” in `tools_dict` whose name matches `DestinationCostResearch` and simply returns the JSON payload as-is. Then you can still keep `FunctionCallingConfig(mode='none')` off or allow “auto” only for the schema call.

- Make the gating condition more conservative
  - Your callback switches modes when it sees 3 tool responses. That can easily flip too early, especially if the model is mid-reasoning. Bump the threshold or key off a clearer signal (e.g., presence of specific content) so you don’t prematurely clear tools.

- Log and validate preflight
  - At agent invocation, log the current `tools_dict.keys()` pre- and post-callback.
  - If `output_schema` is set, also log the schema name and verify it matches a callable tool or that function-calling is disabled in a way that prevents function calls from being emitted.

### About the “Session already exists” 400
- That’s a separate, benign issue. Treat 400 as “reuse the existing session” rather than an error. It does not cause the missing-tool error.

### What I would do next (minimal risk)
- Remove the `tools_dict.clear()` step and keep tool calling enabled while setting the output schema. Retest. If the model still emits a `DestinationCostResearch` functionCall, ADK will be able to handle it without error.
- If you truly want to disable tools at that point, either:
  - Ensure the model returns raw JSON (no function call), or
  - Register a schema-named “no-op” handler so that the function call is resolvable.

This aligns with patterns discussed in the ADK thread you referenced, but avoids the exact failure mode you’re hitting: output schema emitted as a functionCall while the registry is empty.

---

**User**

ok, let's implement the recommended next step Remove the tools_dict.clear() 

---

**Cursor**

I'll remove the single call to clear the tool registry in the cost research agent's callback, leaving the rest of the logic intact. Then I'll check for linter issues.

```python
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Cost Research Agent - Researches accurate pricing for destinations using web search."""

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.genai.types import GenerateContentConfig, ToolConfig, FunctionCallingConfig

from travel_concierge.shared_libraries import types
from travel_concierge.sub_agents.cost_research import prompt
from travel_concierge.tools.search import google_search_grounding


def structured_output_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
):
    """
    Callback to enable structured output after tools have been used.
    After research is complete (indicated by conversation history),
    remove tools and set output schema for structured JSON response.
    """
    # Check if we have tool responses in the conversation (research is done)
    def _has_tool_response(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionResponse"))
        return bool(getattr(part, "function_response", None))

    tool_response_count = sum(
        1 for msg in llm_request.contents
        if hasattr(msg, 'parts')
        for part in msg.parts
        if _has_tool_response(part)
    )

    if tool_response_count >= 3:
        # Switch to structured output phase (keep tools_dict intact to avoid ADK lookup errors)
        llm_request.config.tools = None
        # Set output schema for structured response
        llm_request.set_output_schema(types.DestinationCostResearch)
        llm_request.config.tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(mode="none")
        )


cost_research_agent = Agent(
    model="gemini-2.5-flash",
    name="cost_research_agent",
    description=(
        "Research accurate, real-world travel costs for destinations using web search. "
        "Returns structured JSON with cost breakdowns for accommodation, flights, food, "
        "transport, and activities with low/mid/high estimates and source citations."
    ),
    instruction=prompt.COST_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding],
    before_model_callback=structured_output_callback,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5
    )
)

```

```python
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Cost Research Agent

Researches accurate pricing for destinations using web search.
"""

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.genai.types import (
    GenerateContentConfig,
    ToolConfig,
    FunctionCallingConfig,
)

from travel_concierge.shared_libraries import types
from travel_concierge.sub_agents.cost_research import prompt
from travel_concierge.tools.search import google_search_grounding


def structured_output_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
):
    """
    Callback to enable structured output after tools have been used.
    After research is complete (indicated by conversation history),
    remove tools and set output schema for structured JSON response.
    """
    # Check if we have tool responses in the conversation (research is done)
    def _has_tool_response(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionResponse"))
        return bool(getattr(part, "function_response", None))

    tool_response_count = sum(
        1 for msg in llm_request.contents
        if hasattr(msg, 'parts')
        for part in msg.parts
        if _has_tool_response(part)
    )

    if tool_response_count >= 3:
        # Switch to structured output phase (keep tools_dict intact to avoid
        # ADK lookup errors)
        llm_request.config.tools = None
        # Set output schema for structured response
        llm_request.set_output_schema(types.DestinationCostResearch)
        llm_request.config.tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(mode="none")
        )


cost_research_agent = Agent(
    model="gemini-2.5-flash",
    name="cost_research_agent",
    description=(
        "Research accurate, real-world travel costs for destinations using web search. "
        "Returns structured JSON with cost breakdowns for accommodation, flights, food, "
        "transport, and activities with low/mid/high estimates and source citations."
    ),
    instruction=prompt.COST_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding],
    before_model_callback=structured_output_callback,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5
    )
)

```

```python
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Cost Research Agent

Researches accurate pricing for destinations using web search.
"""

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.genai.types import (
    GenerateContentConfig,
    ToolConfig,
    FunctionCallingConfig,
)

from travel_concierge.shared_libraries import types
from travel_concierge.sub_agents.cost_research import prompt
from travel_concierge.tools.search import google_search_grounding


def structured_output_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
):
    """
    Callback to enable structured output after tools have been used.
    After research is complete (indicated by conversation history),
    remove tools and set output schema for structured JSON response.
    """
    # Check if we have tool responses in the conversation (research is done)
    def _has_tool_response(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionResponse"))
        return bool(getattr(part, "function_response", None))

    tool_response_count = sum(
        1 for msg in llm_request.contents
        if hasattr(msg, 'parts')
        for part in msg.parts
        if _has_tool_response(part)
    )

    if tool_response_count >= 3:
        # Switch to structured output phase (keep tools_dict intact to avoid
        # ADK lookup errors)
        llm_request.config.tools = None
        # Set output schema for structured response
        llm_request.set_output_schema(types.DestinationCostResearch)
        llm_request.config.tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(mode="none")
        )


cost_research_agent = Agent(
    model="gemini-2.5-flash",
    name="cost_research_agent",
    description=(
        "Research accurate, real-world travel costs for destinations using web search."
        " Returns structured JSON with cost breakdowns for accommodation, flights,"
        " food, transport, and activities with low/mid/high estimates and"
        " source citations."
    ),
    instruction=prompt.COST_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding],
    before_model_callback=structured_output_callback,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5
    )
)

```

```python
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Cost Research Agent

Researches accurate pricing for destinations using web search.
"""

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.genai.types import (
    GenerateContentConfig,
    ToolConfig,
    FunctionCallingConfig,
)

from travel_concierge.shared_libraries import types
from travel_concierge.sub_agents.cost_research import prompt
from travel_concierge.tools.search import google_search_grounding


def structured_output_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
):
    """
    Callback to enable structured output after tools have been used.
    After research is complete (indicated by conversation history),
    remove tools and set output schema for structured JSON response.
    """
    # Check if we have tool responses in the conversation (research is done)
    def _has_tool_response(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionResponse"))
        return bool(getattr(part, "function_response", None))

    tool_response_count = sum(
        1 for msg in llm_request.contents
        if hasattr(msg, 'parts')
        for part in msg.parts
        if _has_tool_response(part)
    )

    if tool_response_count >= 3:
        # Switch to structured output phase (keep tools_dict intact to avoid
        # ADK lookup errors)
        llm_request.config.tools = None
        # Set output schema for structured response
        llm_request.set_output_schema(types.DestinationCostResearch)
        llm_request.config.tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(mode="none")
        )


cost_research_agent = Agent(
    model="gemini-2.5-flash",
    name="cost_research_agent",
    description=(
        "Research accurate, real-world travel costs for destinations using web search."
        " Returns structured JSON with cost breakdowns for accommodation, flights,"
        " food, transport, and activities with low/mid/high estimates and"
        " source citations."
    ),
    instruction=prompt.COST_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding],
    before_model_callback=structured_output_callback,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5,
    )
)

```

```python
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Cost Research Agent

Researches accurate pricing for destinations using web search.
"""

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.genai.types import (
    GenerateContentConfig,
    ToolConfig,
    FunctionCallingConfig,
)

from travel_concierge.shared_libraries import types
from travel_concierge.sub_agents.cost_research import prompt
from travel_concierge.tools.search import google_search_grounding


def structured_output_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
):
    """
    Callback to enable structured output after tools have been used.
    After research is complete (indicated by conversation history),
    remove tools and set output schema for structured JSON response.
    """
    # Check if we have tool responses in the conversation (research is done)
    def _has_tool_response(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionResponse"))
        return bool(getattr(part, "function_response", None))

    tool_response_count = sum(
        1 for msg in llm_request.contents
        if hasattr(msg, 'parts')
        for part in msg.parts
        if _has_tool_response(part)
    )

    if tool_response_count >= 3:
        # Switch to structured output phase (keep tools_dict intact to avoid
        # ADK lookup errors)
        llm_request.config.tools = None
        # Set output schema for structured response
        llm_request.set_output_schema(types.DestinationCostResearch)
        llm_request.config.tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(mode="none")
        )


cost_research_agent = Agent(
    model="gemini-2.5-flash",
    name="cost_research_agent",
    description=(
        "Research accurate, real-world travel costs for destinations using web search."
        " Returns structured JSON with cost breakdowns for accommodation, flights,"
        " food, transport, and activities with low/mid/high estimates and"
        " source citations."
    ),
    instruction=prompt.COST_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding],
    before_model_callback=structured_output_callback,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5,
    )
)

```

```python
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Cost Research Agent

Researches accurate pricing for destinations using web search.
"""

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.genai.types import (
    GenerateContentConfig,
    ToolConfig,
    FunctionCallingConfig,
)

from travel_concierge.shared_libraries import types
from travel_concierge.sub_agents.cost_research import prompt
from travel_concierge.tools.search import google_search_grounding


def structured_output_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
):
    """
    Callback to enable structured output after tools have been used.
    After research is complete (indicated by conversation history),
    remove tools and set output schema for structured JSON response.
    """
    # Check if we have tool responses in the conversation (research is done)
    def _has_tool_response(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionResponse"))
        return bool(getattr(part, "function_response", None))

    tool_response_count = sum(
        1 for msg in llm_request.contents
        if hasattr(msg, 'parts')
        for part in msg.parts
        if _has_tool_response(part)
    )

    if tool_response_count >= 3:
        # Switch to structured output phase (keep tools_dict intact to avoid
        # ADK lookup errors)
        llm_request.config.tools = None
        # Set output schema for structured response
        llm_request.set_output_schema(types.DestinationCostResearch)
        llm_request.config.tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(mode="none")
        )


cost_research_agent = Agent(
    model="gemini-2.5-flash",
    name="cost_research_agent",
    description=(
        "Research accurate, real-world travel costs for destinations using web"
        " search. Returns structured JSON with cost breakdowns for accommodation,"
        " flights, food, transport, and activities with low/mid/high estimates"
        " and source citations."
    ),
    instruction=prompt.COST_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding],
    before_model_callback=structured_output_callback,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5,
    )
)

```

```python
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Cost Research Agent

Researches accurate pricing for destinations using web search.
"""

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.genai.types import (
    GenerateContentConfig,
    ToolConfig,
    FunctionCallingConfig,
)

from travel_concierge.shared_libraries import types
from travel_concierge.sub_agents.cost_research import prompt
from travel_concierge.tools.search import google_search_grounding


def structured_output_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
):
    """
    Callback to enable structured output after tools have been used.
    After research is complete (indicated by conversation history),
    remove tools and set output schema for structured JSON response.
    """
    # Check if we have tool responses in the conversation (research is done)
    def _has_tool_response(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionResponse"))
        return bool(getattr(part, "function_response", None))

    tool_response_count = sum(
        1 for msg in llm_request.contents
        if hasattr(msg, 'parts')
        for part in msg.parts
        if _has_tool_response(part)
    )

    if tool_response_count >= 3:
        # Switch to structured output phase (keep tools_dict intact to avoid
        # ADK lookup errors)
        llm_request.config.tools = None
        # Set output schema for structured response
        llm_request.set_output_schema(types.DestinationCostResearch)
        llm_request.config.tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(mode="none")
        )


cost_research_agent = Agent(
    model="gemini-2.5-flash",
    name="cost_research_agent",
    description=(
        "Research accurate, real-world travel costs for destinations using web"
        " search. Returns structured JSON with cost breakdowns for accommodation,"
        " flights, food, transport, and activities with low/mid/high"
        " estimates and source citations."
    ),
    instruction=prompt.COST_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding],
    before_model_callback=structured_output_callback,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5,
    )
)

```

```python
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Cost Research Agent

Researches accurate pricing for destinations using web search.
"""

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.genai.types import (
    GenerateContentConfig,
    ToolConfig,
    FunctionCallingConfig,
)

from travel_concierge.shared_libraries import types
from travel_concierge.sub_agents.cost_research import prompt
from travel_concierge.tools.search import google_search_grounding


def structured_output_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
):
    """
    Callback to enable structured output after tools have been used.
    After research is complete (indicated by conversation history),
    remove tools and set output schema for structured JSON response.
    """
    # Check if we have tool responses in the conversation (research is done)
    def _has_tool_response(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionResponse"))
        return bool(getattr(part, "function_response", None))

    tool_response_count = sum(
        1 for msg in llm_request.contents
        if hasattr(msg, 'parts')
        for part in msg.parts
        if _has_tool_response(part)
    )

    if tool_response_count >= 3:
        # Switch to structured output phase (keep tools_dict intact to avoid
        # ADK lookup errors)
        llm_request.config.tools = None
        # Set output schema for structured response
        llm_request.set_output_schema(types.DestinationCostResearch)
        llm_request.config.tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(mode="none")
        )


cost_research_agent = Agent(
    model="gemini-2.5-flash",
    name="cost_research_agent",
    description=(
        "Research accurate, real-world travel costs for destinations using web"
        " search. Returns structured JSON with cost breakdowns for"
        " accommodation, flights, food, transport, and activities with"
        " low/mid/high estimates and source citations."
    ),
    instruction=prompt.COST_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding],
    before_model_callback=structured_output_callback,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5,
    )
)

```

- I found the callback that was clearing the tool registry and removed only the `tools_dict.clear()` behavior while keeping the structured-output switch. I also fixed long lines flagged by the linter.

What I changed
- python/agents/travel-concierge/travel_concierge/sub_agents/cost_research/agent.py
  - In `structured_output_callback`, removed the line that cleared the tool registry and left `llm_request.config.tools = None` in place.
  - Kept setting the output schema and disabling function calling for the final phase.
  - Reformatted imports and the long description string to satisfy the linter.

What to do next
- Restart the backend so the agent picks up the change.
- Re-run your chat flow. If the model still emits a functionCall for the schema name during the “structured output” phase, ADK can now resolve it (tools_dict is intact), or it will return plain JSON if function-calling is truly disabled.

If you still see a schema functionCall with function-calling disabled, we can:
- Allow function-calling in “auto” during the output phase, or
- Register a lightweight handler matching the schema name to accept the payload.

---

**User**

good new is that I got a message back, but it looks like it's the structured response.  what i want is this to be saved against the destination in firestore and reflect in the UI.why isn't this happening?

---

**Cursor**

- I see the structured JSON now, which means the cost research agent returned the schema successfully. The reason it isn’t being saved to Firestore or reflected in the UI is twofold.

### Why it’s not saving
- The request invokes the sub‑agent `cost_research_agent` directly. That agent’s tool list only contains the search tool, not `save_researched_costs`. The save tool is attached to the `root_agent`.
- Your callback switches to “structured output” mode and disables function-calling. Even if `save_researched_costs` were available, the model wouldn’t be allowed to call it in that phase.
- In `api_server.py`, you only consider it “saved” if the SSE stream contains a functionCall/functionResponse named `save_researched_costs`. Because the sub-agent doesn’t have that tool, the flag `saved_to_firestore` never becomes true, so no Firestore write is happening.

### Why the UI doesn’t update (even if we save)
- The sidebar cost widgets are calculated from `workingData.costs` loaded at app init. They don’t auto-refresh after the backend writes.
- The UI updates costs when a `'costs-updated'` event is dispatched (see `app-final.js: window.addEventListener('costs-updated', ...)`). The chat flow never dispatches that event.
- The chat’s polling is for itinerary changes, not cost updates, so nothing triggers a re-fetch/render after costs are saved.

### Proposed fixes (choose one primary path)
- Recommended A: Invoke the root agent instead of the sub‑agent
  - In `api_server.py`, set `agent_name` to `root_agent`. The root agent includes `cost_research_agent` as a sub-agent AND has `save_researched_costs` in its `tools`.
  - Keep passing `scenario_id`, `destination_id`, `duration_days`, `num_travelers` via state. Your `ROOT_AGENT_INSTR` already says: after research JSON, call `save_researched_costs`.
  - In the SSE handler, keep watching for `save_researched_costs` calls/responses to confirm the save.

- Alternative B: Also attach `save_researched_costs` to the cost research agent
  - Add the save tool to `cost_research_agent.tools` and ensure your callback does not disable function-calling before the save call can happen (or set mode to “auto” during that final step).
  - Update the cost research prompt to include the exact arguments needed by the tool.

- Alternative C: Save server-side when structured JSON arrives
  - If the model emits the `DestinationCostResearch` JSON but no tool call, parse the JSON in `api_server.py` and call your existing `/api/costs/bulk-save` directly with the right payload.
  - This is the most robust because it doesn’t rely on the LLM calling a tool.

### Make the UI reflect the change
- After a successful save, notify the UI:
  - From the chat path: when the chat API response includes `saved_to_firestore: true`, dispatch a `'costs-updated'` event in `web/chat.js`. That will trigger `updateCostSummary()` and re-render the cost widgets using the latest Firestore data.
  - Or, add a lightweight fetch on success to reload the latest scenario version (or just pull fresh costs) before re-rendering.

### Minimal sequence (most likely to work quickly)
1) Change the chat backend to invoke `root_agent` (so `save_researched_costs` is available).
2) Don’t disable function-calling for the final step until after the save tool call (or allow “auto” in the output phase).
3) When the backend sees `save_researched_costs` called successfully, include `saved_to_firestore: true` in the HTTP response to the front end.
4) In the front end, on receiving `saved_to_firestore: true`, dispatch `'costs-updated'` so `app-final.js` recomputes and re-renders the cost UI.

If you prefer not to rely on tool-calling at all, use Alternative C and do the save in `api_server.py` once the structured JSON appears, then trigger the same `'costs-updated'` path.

---

**User**

lets try alternative C.  however, have the root agent summarize the results and give that chat response back as well as emitting the JSON.  does that makes sense?  We can have the LLM do what it's good and then the server do what it's good at.

---

**Cursor**

I'm going to implement Alternative C: the server will save the structured research JSON to Firestore and also call the root agent to produce a human summary. Then I'll dispatch a 'costs-updated' event on the frontend when the save succeeds. I'll update the backend endpoint in `api_server.py` and add a small check in `web/chat.js`.

```python
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Simple Flask API server for the travel concierge agent"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import json
import uuid
import requests
from datetime import datetime

from travel_concierge.tools.cost_tracker import CostTrackerService

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# ADK API Server endpoint (you need to run: adk api_server travel_concierge)
ADK_API_URL = "http://127.0.0.1:8000"
APP_NAME = "travel_concierge"
USER_ID = "web_user"

# Store sessions in memory (use Redis/DB for production)
sessions = {}

# Cost tracker service (one instance per session - in production use DB)
cost_trackers = {}

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Handle chat requests with optional context about current trip leg.

    Expected request body:
    {
        "message": "user message",
        "context": {
            "leg_name": "Southeast Asia",
            "destinations": ["Bangkok", "Chiang Mai", "Phuket"],
            "start_date": "2024-01-15",
            "end_date": "2024-02-10"
        },
        "session_id": "optional-session-id"
    }
    """
    data = request.json
    message = data.get('message', '')
    context = data.get('context', {})
    session_id = data.get('session_id')
    initialize_itinerary = data.get('initialize_itinerary', False)
    scenario_id = data.get('scenario_id')

    # Generate session ID if not provided
    if not session_id or session_id == 'null':
        session_id = f"session_{uuid.uuid4().hex[:12]}"

    print(f"Received message: {message}")
    print(f"Received context: {json.dumps(context, indent=2)}")
    print(f"Session ID: {session_id}")
    print(f"Scenario ID: {scenario_id}")
    print(f"Initialize itinerary: {initialize_itinerary}")

    # Build context-aware message - keep it concise to avoid timeouts
    if context and context.get('destinations'):
        destinations = context.get('destinations', [])
        leg_name = context.get('leg_name', 'Unknown')
        sub_leg_name = context.get('sub_leg_name', None)

        # Create compact itinerary JSON for tool parsing
        itinerary_json = json.dumps({
            "locations": destinations,
            "trip": {
                "start_date": context.get('start_date', ''),
                "end_date": context.get('end_date', ''),
                "leg_name": leg_name,
                "sub_leg_name": sub_leg_name
            }
        }, separators=(',', ':'))  # Compact JSON without spaces

        # Just get the destination names for user-friendly summary
        dest_names = [d.get('name', 'Unknown') if isinstance(d, dict) else d for d in destinations]

        # Add context about filtering to help LLM understand scope
        if sub_leg_name:
            scope_info = f"{sub_leg_name} ({len(destinations)} destinations)"
        elif leg_name and leg_name != 'All':
            scope_info = f"{leg_name} ({len(destinations)} destinations)"
        else:
            scope_info = f"Full itinerary ({len(destinations)} destinations)"

        context_prompt = f"""
I'm planning a trip. Currently viewing: {scope_info}

Destinations: {', '.join(dest_names[:5])}{'...' if len(dest_names) > 5 else ''}

CURRENT_ITINERARY_DATA:
```json
{itinerary_json}
```

User question: {message}
"""
    else:
        context_prompt = message

    try:
        # Create or verify session exists in ADK and update state
        session_endpoint = f"{ADK_API_URL}/apps/{APP_NAME}/users/{USER_ID}/sessions/{session_id}"
        try:
            # Create/verify session exists
            session_resp = requests.post(session_endpoint)
            print(f"Session creation response: {session_resp.status_code}")

            if session_resp.status_code == 200:
                print(f"✅ Session created: {session_id}")

                # Log what we're about to pass in state
                if initialize_itinerary:
                    destinations = context.get('destinations', [])
                    if destinations:
                        print(f"✅ Will pass itinerary with {len(destinations)} destinations in run payload state")
                        print(f"   First destination: {destinations[0].get('name', 'unknown')}")
                    else:
                        print(f"⚠️ Warning: initialize_itinerary=True but no destinations in context!")
            else:
                print(f"❌ Session creation failed: {session_resp.text}")
        except Exception as e:
            print(f"Session creation warning: {e}")

        # Prepare the message for ADK API
        adk_payload = {
            "session_id": session_id,
            "app_name": APP_NAME,
            "user_id": USER_ID,
            "new_message": {
                "role": "user",
                "parts": [
                    {
                        "text": context_prompt,
                    }
                ],
            },
        }

        # Always pass web_session_id in state so tools can access it
        adk_payload["state"] = {
            "web_session_id": session_id
        }
        if scenario_id:
            adk_payload["state"]["scenario_id"] = scenario_id

        # ALWAYS pass itinerary data when context has destinations
        # This ensures tools like generate_itinerary_summary can access the itinerary
        if context.get('destinations'):
            itinerary_data = {
                "locations": context.get('destinations', []),
                "trip": {
                    "start_date": context.get('start_date', ''),
                    "end_date": context.get('end_date', ''),
                    "leg_name": context.get('leg_name', 'Current Leg')
                }
            }
            adk_payload["state"]["itinerary"] = itinerary_data
            print(f"✅ Passing itinerary with {len(context.get('destinations', []))} destinations in state")

            # Only set initialized flag on first message
            if initialize_itinerary:
                adk_payload["state"]["itinerary_initialized"] = True

        print(f"Sending to ADK: {context_prompt[:100]}...")

        # Call the ADK API server
        run_endpoint = f"{ADK_API_URL}/run_sse"
        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "Accept": "text/event-stream",
        }

        response_text = ""
        with requests.post(
            run_endpoint,
            data=json.dumps(adk_payload),
            headers=headers,
            stream=True,
            timeout=120  # Increased timeout for complex requests
        ) as r:
            for chunk in r.iter_lines():
                if not chunk:
                    continue
                json_string = chunk.decode("utf-8").removeprefix("data: ").strip()
                try:
                    event = json.loads(json_string)

                    # Log the full event for debugging
                    print(f"\n{'='*80}")
                    print(f"📨 SSE EVENT RECEIVED:")
                    print(f"{'='*80}")
                    print(json.dumps(event, indent=2))
                    print(f"{'='*80}\n")

                    # Extract text from agent response
                    if "content" in event and "parts" in event["content"]:
                        for part in event["content"]["parts"]:
                            if "text" in part:
                                response_text += part["text"]
                                print(f"💬 AGENT TEXT: {part['text']}")

                            # Log function/tool calls
                            if "function_call" in part:
                                func_call = part["function_call"]
                                print(f"\n🔧 TOOL CALL:")
                                print(f"   Tool: {func_call.get('name', 'unknown')}")
                                print(f"   Args: {json.dumps(func_call.get('args', {}), indent=6)}")

                            # Log function responses
                            if "function_response" in part:
                                func_resp = part["function_response"]
                                print(f"\n✅ TOOL RESPONSE:")
                                print(f"   Tool: {func_resp.get('name', 'unknown')}")
                                resp_data = func_resp.get('response', {})
                                print(f"   Response: {json.dumps(resp_data, indent=6)[:500]}...")

                            # Log thought signatures (reasoning)
                            if "thought_signature" in part:
                                print(f"\n💭 AGENT REASONING:")
                                print(f"   {json.dumps(part['thought_signature'], indent=6)}")

                except json.JSONDecodeError:
                    continue

        return jsonify({
            'response': response_text or 'No response generated',
            'session_id': session_id,
            'status': 'success'
        })

    except requests.exceptions.ConnectionError:
        import traceback
        error_details = traceback.format_exc()
        print(f"Connection error: {error_details}")
        return jsonify({
            'error': 'Could not connect to ADK API server. Please run: adk api_server travel_concierge',
            'status': 'error'
        }), 500
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in chat endpoint: {error_details}")
        return jsonify({
            'error': str(e),
            'error_details': error_details,
            'status': 'error'
        }), 500

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a session"""
    if session_id in sessions:
        del sessions[session_id]
    return jsonify({'status': 'success'})

# Itinerary modification endpoints
# These are called by the agent's tools to modify the user's itinerary

@app.route('/api/itinerary/add', methods=['POST'])
def add_destination_endpoint():
    """Add a destination to the itinerary"""
    data = request.json
    destination = data.get('destination', {})
    insert_after = data.get('insert_after')
    session_id = data.get('session_id')

    print(f"📍 ADD DESTINATION called:")
    print(f"   Session ID: {session_id}")
    print(f"   Destination: {destination.get('name')}")
    print(f"   Insert after: {insert_after}")

    # Store the change to be picked up by the frontend
    if session_id not in sessions:
        sessions[session_id] = {'changes': []}
        print(f"   Created new session entry for {session_id}")

    change = {
        'type': 'add',
        'destination': destination,
        'insert_after': insert_after,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    sessions[session_id]['changes'].append(change)

    print(f"   ✅ Change stored. Total changes pending: {len(sessions[session_id]['changes'])}")

    return jsonify({
        'status': 'success',
        'destination': destination,
        'message': f"Added {destination.get('name')} to itinerary"
    })

@app.route('/api/itinerary/remove', methods=['POST'])
def remove_destination_endpoint():
    """Remove a destination from the itinerary"""
    data = request.json
    destination_name = data.get('destination_name')
    session_id = data.get('session_id')

    if session_id not in sessions:
        sessions[session_id] = {'changes': []}

    change = {
        'type': 'remove',
        'destination_name': destination_name,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    sessions[session_id]['changes'].append(change)

    print(f"Removed destination: {destination_name}")

    return jsonify({
        'status': 'success',
        'message': f"Removed {destination_name} from itinerary"
    })

@app.route('/api/itinerary/update-duration', methods=['POST'])
def update_duration_endpoint():
    """Update the duration of a destination"""
    data = request.json
    destination_name = data.get('destination_name')
    new_duration_days = data.get('new_duration_days')
    session_id = data.get('session_id')

    if session_id not in sessions:
        sessions[session_id] = {'changes': []}

    change = {
        'type': 'update_duration',
        'destination_name': destination_name,
        'new_duration_days': new_duration_days,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    sessions[session_id]['changes'].append(change)

    print(f"Updated duration for {destination_name}: {new_duration_days} days")

    return jsonify({
        'status': 'success',
        'message': f"Updated {destination_name} to {new_duration_days} days"
    })

@app.route('/api/itinerary/update', methods=['POST'])
def update_destination_endpoint():
    """Update various attributes of a destination"""
    data = request.json
    destination_name = data.get('destination_name')
    updates = data.get('updates', {})
    session_id = data.get('session_id')

    if session_id not in sessions:
        sessions[session_id] = {'changes': []}

    change = {
        'type': 'update',
        'destination_name': destination_name,
        'updates': updates,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    sessions[session_id]['changes'].append(change)

    print(f"Updated destination {destination_name}: {updates}")

    return jsonify({
        'status': 'success',
        'message': f"Updated {destination_name}",
        'updates': updates
    })

@app.route('/api/itinerary/changes/<session_id>', methods=['GET'])
def get_changes(session_id):
    """Get pending changes for a session (polled by frontend)"""
    if session_id in sessions and 'changes' in sessions[session_id]:
        changes = sessions[session_id]['changes']
        # Clear changes after sending
        sessions[session_id]['changes'] = []
        return jsonify({
            'status': 'success',
            'changes': changes
        })
    return jsonify({
        'status': 'success',
        'changes': []
    })

@app.route('/api/generate-title', methods=['POST'])
def generate_title():
    """
    Generate an AI title for a chat conversation based on the message history.

    Expected request body:
    {
        "messages": [
            {"text": "user message", "sender": "user"},
            {"text": "bot response", "sender": "bot"}
        ],
        "currentTitle": "Current chat title (optional)"
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        messages = data.get('messages', [])
        current_title = data.get('currentTitle', 'Untitled Chat')

        if not messages:
            return jsonify({'error': 'No messages provided'}), 400

        # Create a summary of the conversation for title generation
        # Focus on user messages to understand the main topics
        user_messages = [msg['text'] for msg in messages if msg['sender'] == 'user']

        if not user_messages:
            # If no user messages, use the first bot message
            user_messages = [messages[0]['text'] if messages else 'General conversation']

        # Create a conversation summary
        conversation_text = "\n".join([f"- {msg}" for msg in user_messages[:5]])  # Limit to first 5 user messages

        # Create a temporary session for title generation
        temp_session_id = f"title_generation_{uuid.uuid4().hex[:8]}"

        # Prepare the prompt for title generation
        title_prompt = f"""Based on the following conversation messages, generate a short, descriptive title (maximum 5 words) that captures the main topic or theme of this travel-related conversation.

Current title: {current_title}

Conversation summary:
{conversation_text}

Requirements:
- Generate a short, catchy title (2-5 words maximum)
- Make it travel-related if applicable
- Focus on the main destination, activity, or travel topic
- Use descriptive and engaging language
- Output ONLY the title, no quotes or extra text

Examples of good titles:
- "Japan Trip Planning"
- "Beach Vacation Ideas"
- "Europe Itinerary Help"
- "Travel Insurance Questions"
- "Flight Booking Advice"

Please generate an appropriate title:"""

        # Create session and generate title
        session_endpoint = f"{ADK_API_URL}/apps/{APP_NAME}/users/{USER_ID}/sessions/{temp_session_id}"

        try:
            # Create session
            session_resp = requests.post(session_endpoint)
            if session_resp.status_code != 200:
                print(f"Failed to create session for title generation: {session_resp.text}")
                # Fallback: return a simple generated title
                fallback_title = generate_fallback_title(user_messages)
                return jsonify({'title': fallback_title})

            # Send message to ADK
            adk_payload = {
                "session_id": temp_session_id,
                "app_name": APP_NAME,
                "user_id": USER_ID,
                "new_message": {
                    "role": "user",
                    "parts": [{"text": title_prompt}],
                },
            }

            adk_response = requests.post(
                f"{ADK_API_URL}/apps/{APP_NAME}/users/{USER_ID}/sessions/{temp_session_id}/run",
                json=adk_payload,
                headers={"Content-Type": "application/json"}
            )

            if adk_response.status_code == 200:
                response_data = adk_response.json()

                # Extract the AI response
                if ('candidates' in response_data and
                    response_data['candidates'] and
                    len(response_data['candidates']) > 0 and
                    'content' in response_data['candidates'][0] and
                    'parts' in response_data['candidates'][0]['content'] and
                    len(response_data['candidates'][0]['content']['parts']) > 0):

                    ai_response = response_data['candidates'][0]['content']['parts'][0].get('text', '').strip()

                    # Clean up the response - remove quotes and extra whitespace
                    generated_title = ai_response.strip('"').strip().strip("'").strip()

                    # Ensure it's not too long
                    if len(generated_title) > 50:
                        generated_title = ' '.join(generated_title.split()[:5])

                    print(f"✅ Generated AI title: {generated_title}")
                    return jsonify({'title': generated_title})
                else:
                    print(f"Unexpected ADK response format: {response_data}")
                    fallback_title = generate_fallback_title(user_messages)
                    return jsonify({'title': fallback_title})
            else:
                print(f"ADK API error: {adk_response.status_code} - {adk_response.text}")
                fallback_title = generate_fallback_title(user_messages)
                return jsonify({'title': fallback_title})

        except Exception as e:
            print(f"Error calling ADK for title generation: {e}")
            fallback_title = generate_fallback_title(user_messages)
            return jsonify({'title': fallback_title})

    except Exception as e:
        print(f"Error in generate_title endpoint: {e}")
        return jsonify({'error': 'Failed to generate title'}), 500

def generate_fallback_title(user_messages):
    """Generate a simple fallback title based on user messages"""
    if not user_messages:
        return "Travel Planning"

    # Simple keyword-based title generation
    first_message = user_messages[0].lower()

    # Look for destination keywords
    destinations = ['japan', 'thailand', 'europe', 'asia', 'america', 'france', 'italy', 'spain',
                   'china', 'india', 'brazil', 'mexico', 'canada', 'australia', 'uk', 'germany']

    for dest in destinations:
        if dest in first_message:
            return f"{dest.title()} Trip Planning"

    # Look for activity keywords
    activities = ['flight', 'hotel', 'booking', 'itinerary', 'visa', 'insurance', 'transport',
                 'accommodation', 'restaurant', 'tour', 'museum', 'beach', 'mountain', 'city']

    for activity in activities:
        if activity in first_message:
            return f"{activity.title()} Questions"

    # Default title
    return "Travel Planning"

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

# ============================================================================
# Cost Tracking API Endpoints
# ============================================================================

def get_cost_tracker(session_id):
    """Get or create cost tracker for a session."""
    if session_id not in cost_trackers:
        cost_trackers[session_id] = CostTrackerService()
    return cost_trackers[session_id]

@app.route('/api/costs', methods=['POST'])
def add_cost():
    """Add a new cost item."""
    try:
        data = request.json
        session_id = data.get('session_id', 'default')

        tracker = get_cost_tracker(session_id)

        cost_item = tracker.add_cost(
            category=data.get('category'),
            description=data.get('description'),
            amount=float(data.get('amount')),
            currency=data.get('currency', 'USD'),
            date=data.get('date'),
            destination_id=data.get('destination_id'),
            booking_status=data.get('booking_status', 'estimated'),
            source=data.get('source', 'manual'),
            notes=data.get('notes')
        )

        return jsonify({
            'status': 'success',
            'cost': cost_item.model_dump()
        })
    except Exception as e:
        print(f"Error adding cost: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/<cost_id>', methods=['PUT'])
def update_cost(cost_id):
    """Update an existing cost item."""
    try:
        data = request.json
        session_id = data.get('session_id', 'default')

        tracker = get_cost_tracker(session_id)

        updates = {k: v for k, v in data.items() if k not in ['session_id', 'cost_id']}
        cost_item = tracker.update_cost(cost_id, **updates)

        if cost_item:
            return jsonify({
                'status': 'success',
                'cost': cost_item.model_dump()
            })
        else:
            return jsonify({'status': 'error', 'error': 'Cost not found'}), 404
    except Exception as e:
        print(f"Error updating cost: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/<cost_id>', methods=['DELETE'])
def delete_cost(cost_id):
    """Delete a cost item."""
    try:
        data = request.json or {}
        session_id = data.get('session_id', 'default')

        tracker = get_cost_tracker(session_id)
        success = tracker.delete_cost(cost_id)

        if success:
            return jsonify({'status': 'success'})
        else:
            return jsonify({'status': 'error', 'error': 'Cost not found'}), 404
    except Exception as e:
        print(f"Error deleting cost: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs', methods=['GET'])
def get_costs():
    """Get all costs or filtered costs."""
    try:
        session_id = request.args.get('session_id', 'default')
        destination_id = request.args.get('destination_id', type=int)
        category = request.args.get('category')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        tracker = get_cost_tracker(session_id)

        if any([destination_id, category, start_date, end_date]):
            costs = tracker.filter_costs(
                destination_id=destination_id,
                category=category,
                start_date=start_date,
                end_date=end_date
            )
        else:
            costs = tracker.costs

        return jsonify({
            'status': 'success',
            'costs': [cost.model_dump() for cost in costs]
        })
    except Exception as e:
        print(f"Error getting costs: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/summary', methods=['POST'])
def get_cost_summary():
    """Get comprehensive cost summary."""
    try:
        data = request.json or {}
        session_id = data.get('session_id', 'default')
        destinations = data.get('destinations')
        traveler_count = data.get('traveler_count')
        total_days = data.get('total_days')

        tracker = get_cost_tracker(session_id)
        summary = tracker.get_cost_summary(
            destinations=destinations,
            traveler_count=traveler_count,
            total_days=total_days
        )

        return jsonify({
            'status': 'success',
            'summary': summary.model_dump()
        })
    except Exception as e:
        print(f"Error getting cost summary: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/export', methods=['GET'])
def export_costs():
    """Export all costs as JSON."""
    try:
        session_id = request.args.get('session_id', 'default')
        tracker = get_cost_tracker(session_id)

        return jsonify({
            'status': 'success',
            'costs': tracker.export_costs()
        })
    except Exception as e:
        print(f"Error exporting costs: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/import', methods=['POST'])
def import_costs():
    """Import costs from JSON."""
    try:
        data = request.json
        session_id = data.get('session_id', 'default')
        costs_data = data.get('costs', [])

        tracker = get_cost_tracker(session_id)
        tracker.load_costs(costs_data)

        return jsonify({
            'status': 'success',
            'message': f'Imported {len(costs_data)} cost items'
        })
    except Exception as e:
        print(f"Error importing costs: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/bulk-save', methods=['POST'])
def bulk_save_costs():
    """
    Bulk save cost items to Firestore.
    This endpoint is called by the cost_research_agent after researching costs.

    Expected request body:
    {
        "session_id": "session_abc123",
        "scenario_id": "scenario_xyz789",
        "destination_id": 10,
        "destination_name": "Tokyo, Japan",
        "cost_items": [
            {
                "id": "10_tokyo_accommodation",
                "category": "accommodation",
                "description": "Hotel in Tokyo",
                "amount": 1750.0,
                "currency": "USD",
                "amount_usd": 1750.0,
                "destination_id": 10,
                "booking_status": "estimated",
                "source": "web_research",
                "notes": "7 nights for 3 people"
            },
            ...
        ]
    }
    """
    try:
        from google.cloud import firestore

        data = request.json
        session_id = data.get('session_id')
        scenario_id = data.get('scenario_id')
        destination_id = data.get('destination_id')
        destination_name = data.get('destination_name')
        cost_items = data.get('cost_items', [])

        # Validate required fields
        if not all([scenario_id, destination_id, cost_items]):
            return jsonify({
                'status': 'error',
                'error': 'Missing required fields: scenario_id, destination_id, cost_items'
            }), 400

        print(f"💾 Bulk saving {len(cost_items)} costs for {destination_name} (ID: {destination_id})")

        # Initialize Firestore
        db = firestore.Client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get current scenario
        scenario_doc = scenario_ref.get()
        if not scenario_doc.exists:
            return jsonify({
                'status': 'error',
                'error': f'Scenario {scenario_id} not found'
            }), 404

        scenario_data = scenario_doc.to_dict()
        # Update the latest version's itineraryData (this is what the UI loads!)
        current_version = scenario_data.get('currentVersion', 0)

        # Get the latest version by highest versionNumber
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if versions:
            latest_version_ref = versions[0].reference
            latest_version_data = versions[0].to_dict() or {}

            # Get itineraryData from the version
            itinerary_data = latest_version_data.get('itineraryData', {}) or {}
            version_costs = itinerary_data.get('costs', []) or []

            # Remove existing costs for this destination from version
            version_filtered_costs = [
                c for c in version_costs
                if c.get('destination_id') != destination_id
            ]

            # Add new costs
            version_filtered_costs.extend(cost_items)

            # If no change in costs, skip creating a new version
            try:
                import json as _json
                def _stable(obj):
                    return _json.dumps(obj, sort_keys=True, separators=(",", ":"))
                if _stable(version_costs) == _stable(version_filtered_costs):
                    scenario_ref.update({
                        'updatedAt': firestore.SERVER_TIMESTAMP,
                    })
                    print(f"ℹ️ No cost changes detected; skipped new version creation")
                    return jsonify({
                        'status': 'success',
                        'message': 'No changes in costs; latest version left unchanged',
                        'costs_saved': 0,
                        'total_costs': len(version_filtered_costs)
                    })
            except Exception as _:
                pass

            # Prepare new version payload (create a new version instead of mutating latest)
            new_version_number = max(int(scenario_data.get('currentVersion', 0) or 0), int(latest_version_data.get('versionNumber', 0) or 0)) + 1
            new_version_ref = scenario_ref.collection('versions').document()
            new_itinerary_data = dict(itinerary_data)
            new_itinerary_data['costs'] = version_filtered_costs

            new_version_ref.set({
                'versionNumber': new_version_number,
                'versionName': '',
                'isNamed': False,
                'itineraryData': new_itinerary_data,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'itineraryDataHash': None,
                'isAutosave': True,
            })

            # Update scenario's currentVersion
            scenario_ref.update({
                'currentVersion': new_version_number,
                'updatedAt': firestore.SERVER_TIMESTAMP,
            })

            print(f"✅ Created new version v{new_version_number} with updated itineraryData")
            print(f"   Total costs in new version: {len(version_filtered_costs)}")
        else:
            print(f"⚠️ Warning: No versions found for scenario {scenario_id}")

        # Lightweight snapshot summary on the scenario document (no full costs array)
        try:
            totals_by_category = {}
            for item in version_filtered_costs:
                cat = item.get('category', 'other')
                totals_by_category[cat] = totals_by_category.get(cat, 0.0) + float(item.get('amount_usd', 0) or 0)
            scenario_ref.update({
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'costsCount': len(version_filtered_costs),
                'totalsByCategory': totals_by_category,
            })
            print(f"🧮 Updated scenario summary: {len(version_filtered_costs)} items")
        except Exception as e:
            print(f"Warning: failed to update scenario summary: {e}")

        return jsonify({
            'status': 'success',
            'message': f'Saved {len(cost_items)} costs for {destination_name}',
            'costs_saved': len(cost_items),
            'total_costs': len(version_filtered_costs)
        })

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in bulk-save endpoint: {error_details}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'error_details': error_details
        }), 500

@app.route('/api/itinerary/summary', methods=['POST'])
def generate_summary():
    """
    Generate a formatted itinerary summary using the generate_itinerary_summary tool.

    Expected request body:
    {
        "itinerary": {
            "locations": [...],
            "trip": {...},
            "legs": [...],
            "costs": [...]
        },
        "session_id": "optional-session-id"
    }
    """
    try:
        from travel_concierge.tools.itinerary_summary_generator import generate_itinerary_summary as gen_summary_tool

        data = request.json
        itinerary_data = data.get('itinerary', {})
        session_id = data.get('session_id')

        if not itinerary_data or not itinerary_data.get('locations'):
            return jsonify({
                'status': 'error',
                'error': 'No itinerary data provided'
            }), 400

        print(f"📄 Generating summary for itinerary with {len(itinerary_data.get('locations', []))} locations")

        # Call the summary generator tool directly
        result = gen_summary_tool(
            itinerary_json=json.dumps(itinerary_data),
            tool_context=None  # We're passing data directly as JSON
        )

        if result.get('status') == 'success':
            print(f"✅ Summary generated successfully ({len(result.get('summary', ''))} characters)")
            return jsonify({
                'status': 'success',
                'summary': result.get('summary'),
                'itinerary_data': result.get('itinerary_data'),
                'message': result.get('message')
            })
        else:
            print(f"❌ Summary generation failed: {result.get('message')}")
            return jsonify({
                'status': 'error',
                'error': result.get('message'),
                'prompt': result.get('prompt')  # Return prompt for debugging
            }), 500

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in summary generation endpoint: {error_details}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'error_details': error_details
        }), 500

@app.route('/api/costs/research', methods=['POST'])
def research_costs():
    """
    Research costs for a destination using the cost_research_agent.

    Expected request body:
    {
        "session_id": "session_abc123",
        "scenario_id": "scenario_xyz789",  # REQUIRED for saving to Firestore
        "destination_name": "Bangkok, Thailand",
        "destination_id": 5,
        "duration_days": 7,
        "arrival_date": "2026-07-15",
        "departure_date": "2026-07-22",
        "num_travelers": 2,
        "travel_style": "mid-range",
        "previous_destination": "Singapore",  # optional
        "next_destination": "Chiang Mai"  # optional
    }
    """
    try:
        data = request.json
        session_id = data.get('session_id', 'default')
        scenario_id = data.get('scenario_id')

        # Build the research request message
        destination_name = data.get('destination_name')
        destination_id = data.get('destination_id')
        duration_days = data.get('duration_days')
        arrival_date = data.get('arrival_date')
        departure_date = data.get('departure_date')
        num_travelers = data.get('num_travelers', 1)
        travel_style = data.get('travel_style', 'mid-range')
        previous_destination = data.get('previous_destination')
        next_destination = data.get('next_destination')

        # Validate required fields
        if not all([scenario_id, destination_name, destination_id, duration_days, arrival_date, departure_date]):
            return jsonify({
                'status': 'error',
                'error': 'Missing required fields: scenario_id, destination_name, destination_id, duration_days, arrival_date, departure_date'
            }), 400

        # Create context for the agent
        research_prompt = f"""Please research accurate, real-world costs for the following destination:

Destination: {destination_name}
Destination ID: {destination_id}
Duration: {duration_days} days
Arrival Date: {arrival_date}
Departure Date: {departure_date}
Number of Travelers: {num_travelers}
Travel Style: {travel_style}
"""

        if previous_destination:
            research_prompt += f"Previous Destination: {previous_destination} (for flight pricing)\n"
        if next_destination:
            research_prompt += f"Next Destination: {next_destination} (for flight pricing)\n"

        research_prompt += """
Please provide comprehensive cost research including:
1. Accommodation costs (total for stay)
2. Flight costs (if applicable)
3. Daily food costs per person
4. Daily local transport costs per person
5. Activity and attraction costs

For each category, provide low/mid/high estimates with sources.
"""

        # Create or get session
        session_endpoint = f"{ADK_API_URL}/apps/{APP_NAME}/users/{USER_ID}/sessions/{session_id}"
        try:
            session_resp = requests.post(session_endpoint)
            if session_resp.status_code != 200:
                print(f"Warning: Session creation response: {session_resp.status_code}")
        except Exception as e:
            print(f"Session creation warning: {e}")

        # Prepare ADK payload to invoke cost_research_agent
        adk_payload = {
            "session_id": session_id,
            "app_name": APP_NAME,
            "user_id": USER_ID,
            # Call the cost research agent directly to improve reliability
            "agent_name": "cost_research_agent",
            "new_message": {
                "role": "user",
                "parts": [{"text": research_prompt}],
            },
            "state": {
                "web_session_id": session_id,
                "scenario_id": scenario_id,  # Pass scenario_id so agent can save to Firestore
                "destination_id": destination_id,
                "duration_days": duration_days,
                "num_travelers": num_travelers,
            }
        }

        print(f"🔍 Triggering cost research for: {destination_name}")

        # Call ADK API
        run_endpoint = f"{ADK_API_URL}/run_sse"
        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "Accept": "text/event-stream",
        }

        research_result = None
        response_text = ""
        save_tool_called = False

        with requests.post(
            run_endpoint,
            data=json.dumps(adk_payload),
            headers=headers,
            stream=True,
            timeout=180  # Cost research may take longer due to multiple searches
        ) as r:
            for chunk in r.iter_lines():
                if not chunk:
                    continue
                json_string = chunk.decode("utf-8").removeprefix("data: ").strip()
                try:
                    event = json.loads(json_string)

                    # Extract text responses
                    if "content" in event and "parts" in event["content"]:
                        for part in event["content"]["parts"]:
                            if "text" in part:
                                response_text += part["text"]

                            # Check if save_researched_costs tool was called
                            if "function_call" in part:
                                func_call = part["function_call"]
                                if func_call.get("name") == "save_researched_costs":
                                    save_tool_called = True
                                    # Extract research data from the tool call args
                                    research_result = func_call.get("args", {}).get("research_data")

                            # Also check function responses for save confirmation
                            if "function_response" in part:
                                func_resp = part["function_response"]
                                if func_resp.get("name") == "save_researched_costs":
                                    # Tool was successfully called
                                    save_tool_called = True

                except json.JSONDecodeError:
                    continue

        # Try to extract JSON from response_text if we don't have structured data
        if not research_result and response_text:
            # Look for JSON in the response text
            import re
            json_match = re.search(r'\{[\s\S]*"destination_name"[\s\S]*\}', response_text)
            if json_match:
                try:
                    research_result = json.loads(json_match.group())
                    print(f"✅ Extracted JSON from response text")
                except:
                    pass

        # Alternative C: If we have structured research JSON but no save tool call,
        # save the data server-side via /api/costs/bulk-save and also generate a
        # concise human summary using the root agent.
        saved_via_server = False
        summary_text = None

        if research_result and not save_tool_called:
            try:
                # Build cost_items similar to save_researched_costs tool
                categories_map = {
                    'accommodation': 'accommodation',
                    'flights': 'flight',
                    'activities': 'activity',
                    'food_daily': 'food',
                    'transport_daily': 'transport'
                }

                cost_items = []
                for research_cat, itinerary_cat in categories_map.items():
                    if research_cat not in research_result:
                        continue
                    cat_data = research_result.get(research_cat) or {}

                    base_usd = float(cat_data.get('amount_mid', 0) or 0)
                    base_local = float(cat_data.get('amount_local', 0) or 0)
                    currency_local = cat_data.get('currency_local', 'USD')

                    multiplier = 1
                    if research_cat in ('food_daily', 'transport_daily'):
                        multiplier = max(1, int(duration_days)) * max(1, int(num_travelers))
                    elif research_cat == 'flights':
                        multiplier = max(1, int(num_travelers))

                    amount_usd = base_usd * multiplier
                    amount_local = base_local * multiplier if base_local else amount_usd

                    stable_dest = (
                        destination_name.lower()
                        .replace(' ', '_')
                        .replace(',', '')
                        .replace('/', '-')
                        .replace(':', '-')
                    )

                    cost_items.append({
                        'id': f"{destination_id}_{stable_dest}_{itinerary_cat}",
                        'category': itinerary_cat,
                        'description': f"{cat_data.get('category', research_cat).title()} in {destination_name}",
                        'amount': amount_local,
                        'currency': currency_local,
                        'amount_usd': amount_usd,
                        'date': datetime.now().strftime("%Y-%m-%d"),
                        'destination_id': destination_id,
                        'booking_status': 'researched',
                        'source': 'web_research',
                        'notes': cat_data.get('notes', ''),
                        'confidence': cat_data.get('confidence', 'medium'),
                        'sources': cat_data.get('sources', []),
                        'researched_at': cat_data.get('researched_at', datetime.now().isoformat()),
                    })

                # Save to Firestore via our own endpoint
                try:
                    save_resp = requests.post(
                        f"{ADK_API_URL.replace('/adk', '')}/api/costs/bulk-save",  # same Flask server
                        json={
                            'session_id': session_id,
                            'scenario_id': scenario_id,
                            'destination_id': destination_id,
                            'destination_name': destination_name,
                            'cost_items': cost_items,
                        },
                        timeout=30,
                    )
                    saved_via_server = save_resp.status_code == 200
                except Exception:
                    saved_via_server = False

                # Ask root agent to summarize for the chat response
                try:
                    summary_prompt = (
                        f"Summarize these researched costs for {destination_name} in 3-5 sentences "
                        f"for a family of {num_travelers} traveling {duration_days} days. "
                        f"Focus on total, per-day, and major categories.\n\n" 
                        f"JSON:\n{json.dumps(research_result)}"
                    )
                    run_payload = {
                        'session_id': session_id,
                        'app_name': APP_NAME,
                        'user_id': USER_ID,
                        'agent_name': 'root_agent',
                        'new_message': {
                            'role': 'user',
                            'parts': [{'text': summary_prompt}],
                        },
                    }
                    with requests.post(
                        run_endpoint,
                        data=json.dumps(run_payload),
                        headers=headers,
                        stream=True,
                        timeout=60,
                    ) as r2:
                        for chunk in r2.iter_lines():
                            if not chunk:
                                continue
                            s = chunk.decode('utf-8').removeprefix('data: ').strip()
                            try:
                                ev = json.loads(s)
                                if 'content' in ev and 'parts' in ev['content']:
                                    for p in ev['content']['parts']:
                                        if 'text' in p:
                                            summary_text = (summary_text or '') + p['text']
                            except json.JSONDecodeError:
                                continue
                except Exception:
                    summary_text = None

            except Exception as e:
                print(f"Error during server-side save of research JSON: {e}")

        if research_result or save_tool_called or saved_via_server:
            print(f"✅ Cost research completed for {destination_name}")
            return jsonify({
                'status': 'success',
                'research': research_result,
                'response_text': summary_text or response_text,
                'saved_to_firestore': save_tool_called or saved_via_server
            })
        else:
            print(f"⚠️ Cost research returned no structured data")
            return jsonify({
                'status': 'partial',
                'response_text': response_text,
                'message': 'Research completed but no structured data returned'
            })

    except requests.exceptions.Timeout:
        return jsonify({
            'status': 'error',
            'error': 'Cost research timed out. This process can take 2-3 minutes due to extensive web searches.'
        }), 504
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in cost research endpoint: {error_details}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'error_details': error_details
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)

```

```javascript
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

    // Restore chat state from localStorage (includes chat open/close state)
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

    // Restore chat open/closed UI state
    if (this.chatContainer) {
      const shouldBeOpen = savedState.chatOpen !== false; // default open if undefined
      if (shouldBeOpen) {
        this.openChat();
      } else {
        this.closeChat();
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
    // Persist UI state
    this.statePersistence.saveChatOpenState(true);
  }

  closeChat() {
    console.log('📁 Closing chat...');
    this.isOpen = false;
    this.chatContainer.classList.add('hidden');
    this.toggleBtn.classList.add('collapsed');
    this.stopPollingForChanges();
    // Persist UI state
    this.statePersistence.saveChatOpenState(false);
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
        // Include current scenario so backend tools can save costs to Firestore
        scenario_id: window.currentScenarioId || null,
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
      this.addMessage(data.response || data.response_text || 'Sorry, I could not generate a response.', 'bot', false, isFloating);

      // If backend saved to Firestore, notify app to refresh cost UI
      if (data.saved_to_firestore) {
        try {
          window.dispatchEvent(new Event('costs-updated'));
        } catch {}
      }

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
    }, 4000); // Poll every 4 seconds
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

```

- I parsed the structured JSON on the server, saved it to Firestore, and also asked the root agent to produce a concise human summary. I then wired the frontend to refresh costs when the backend reports a save.

What changed conceptually
- Backend (Alternative C):
  - If the SSE stream doesn’t show a call to save_researched_costs but does include structured research JSON, the server now:
    - Converts the JSON to cost_items and POSTs them to /api/costs/bulk-save.
    - Calls the root_agent with a short prompt to generate a human-readable summary, and returns that as the chat response text.
    - Sets saved_to_firestore=true when the save succeeds.
- Frontend:
  - `web/chat.js`: uses response_text if present and dispatches a 'costs-updated' event when saved_to_firestore is true, so `app-final.js` refreshes the UI.

Why this satisfies your goal
- The LLM produces the research and natural language summary (its strength).
- The server performs deterministic saving to Firestore (its strength).
- The UI gets notified to re-render costs automatically.

Next step for you
- Restart the backend. Send a “recalculate Okinawa costs” message again.
- You should see:
  - A human summary in the chat.
  - saved_to_firestore: true in the console response object.
  - Costs updated in the sidebar shortly after, due to the dispatched 'costs-updated' event.

If anything still doesn’t update:
- Check server logs for “✅ Cost research completed” and the bulk-save HTTP status.
- Confirm your scenario_id is present in the request (it’s required for saving).
- Verify that the 'costs-updated' listener in `app-final.js` is present and that `updateCostSummary()` runs.

---

**User**

i dont think this worked as the cost UI hasn't updated, please check logs.  the message is still showing all of the response including a human summary; i just wanted the human summary ini chat and the rest stored in firestore.

