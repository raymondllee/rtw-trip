// AI Travel Concierge Chat Module
import { db } from './firebase-config.js';
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, updateDoc, deleteDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
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
    this.isColumn = false;
    this.sidebarChatExpandedHeight = null;
    this.isColumnCollapsed = false;
    this.columnExpandedStyles = null;
    this.currentChatId = null; // Current chat conversation ID
    this.messages = []; // In-memory message history
    this.firestoreEnabled = true; // Enable Firestore persistence (will be disabled on errors)
    this.statePersistence = new StatePersistence();
    this.messageHistory = []; // User message history for arrow key navigation
    this.historyIndex = -1; // Current position in history (-1 = not navigating)

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

    // Start in column mode by default
    setTimeout(() => {
      this.moveToColumn();
    }, 100);
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

    // Restore chat mode first
    const chatMode = savedState.chatMode || 'sidebar';
    console.log('🔄 Restoring chat mode:', chatMode);

    // Apply the saved chat mode
    setTimeout(() => {
      switch (chatMode) {
        case 'column':
          this.moveToColumn();
          // Restore column collapse state
          if (savedState.columnCollapsed) {
            setTimeout(() => {
              this.collapseColumn();
            }, 100);
          }
          // Restore column width
          if (savedState.columnWidth) {
            setTimeout(() => {
              if (this.chatColumn) {
                this.chatColumn.style.width = savedState.columnWidth;
              }
            }, 150);
          }
          break;
        case 'floating':
          this.undockChat();
          // Restore floating chat position
          if (savedState.floatingChatPosition && savedState.floatingChatPosition.x !== null) {
            setTimeout(() => {
              if (this.floatingChat) {
                this.floatingChat.style.left = `${savedState.floatingChatPosition.x}px`;
                this.floatingChat.style.top = `${savedState.floatingChatPosition.y}px`;
                this.floatingChat.style.right = 'auto';
                this.floatingChat.style.bottom = 'auto';
              }
            }, 100);
          }
          // Restore floating chat size
          if (savedState.floatingChatSize && savedState.floatingChatSize.width !== null) {
            setTimeout(() => {
              if (this.floatingChat) {
                this.floatingChat.style.width = `${savedState.floatingChatSize.width}px`;
                if (savedState.floatingChatSize.height) {
                  this.floatingChat.style.height = `${savedState.floatingChatSize.height}px`;
                }
              }
            }, 150);
          }
          break;
        default:
          // Sidebar mode - restore sidebar chat height
          if (savedState.sidebarChatHeight) {
            setTimeout(() => {
              if (this.sidebarChat) {
                this.sidebarChat.style.height = savedState.sidebarChatHeight;
              }
            }, 100);
          }
          break;
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
    }, 100);
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
    this.chatMenuBtn = document.getElementById('chat-menu-btn');
    this.chatMenuDropdown = document.getElementById('chat-menu-dropdown');
    this.sidebarChat = document.querySelector('.sidebar-chat');
    this.sidebarResizer = document.getElementById('chat-resizer');

    // Column chat elements
    this.chatColumn = document.getElementById('chat-column');
    this.chatColumnResizer = document.getElementById('chat-column-resizer');
    this.chatColumnMessages = document.getElementById('chat-messages-column');
    this.chatColumnForm = document.getElementById('chat-form-column');
    this.chatColumnInput = document.getElementById('chat-input-column');
    this.chatColumnSendBtn = document.getElementById('chat-send-btn-column');
    this.chatMenuBtnColumn = document.getElementById('chat-menu-btn-column');
    this.chatColumnToggleBtn = document.getElementById('toggle-chat-column');
    this.chatMenuDropdownColumn = document.getElementById('chat-menu-dropdown-column');

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
    this.closeHistoryBtn = document.getElementById('close-history-btn');

    // Chat title elements
    this.chatTitleDisplay = document.getElementById('chat-title-display');
    this.chatTitleDisplayColumn = document.getElementById('chat-title-display-column');
    this.chatTitleDisplayFloating = document.getElementById('chat-title-display-floating');

    // Debug: check if elements are found
    console.log('🔍 Chat elements initialized:', {
      chatInput: !!this.chatInput,
      chatForm: !!this.chatForm,
      sendBtn: !!this.sendBtn,
      chatInputDisabled: this.chatInput?.disabled,
      chatMenuBtn: !!this.chatMenuBtn,
      chatMenuDropdown: !!this.chatMenuDropdown,
      chatMenuBtnColumn: !!this.chatMenuBtnColumn,
      chatMenuDropdownColumn: !!this.chatMenuDropdownColumn
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
      if (!e.target.closest('.chat-menu-btn') && !e.target.closest('.chat-menu-dropdown')) {
        this.toggleChat();
      }
    });
    this.chatForm?.addEventListener('submit', (e) => this.handleSubmit(e));

    // Arrow key history navigation for sidebar
    this.chatInput?.addEventListener('keydown', (e) => this.handleHistoryNavigation(e, this.chatInput));

    // Chat menu listeners (sidebar)
    this.chatMenuBtn?.addEventListener('click', (e) => {
      console.log('🖱️ Chat menu button clicked');
      e.stopPropagation();
      this.toggleChatMenu();
    });
    this.chatMenuDropdown?.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.chat-menu-item');
      if (menuItem) {
        e.stopPropagation();
        this.handleChatMenuAction(menuItem.dataset.action);
        this.chatMenuDropdown.style.display = 'none';
      }
    });

    // Column chat listeners
    this.chatColumnForm?.addEventListener('submit', (e) => this.handleSubmit(e, false, true));

    // Arrow key history navigation for column
    this.chatColumnInput?.addEventListener('keydown', (e) => this.handleHistoryNavigation(e, this.chatColumnInput));

    // Chat menu listeners (column)
    this.chatMenuBtnColumn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleChatMenuColumn();
    });
    this.chatMenuDropdownColumn?.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.chat-menu-item');
      if (menuItem) {
        e.stopPropagation();
        this.handleChatMenuAction(menuItem.dataset.action);
        this.chatMenuDropdownColumn.style.display = 'none';
      }
    });
    this.chatColumnToggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleColumnCollapse();
    });

    // Floating chat listeners
    this.floatingChatForm?.addEventListener('submit', (e) => this.handleSubmit(e, true));

    // Arrow key history navigation for floating
    this.floatingChatInput?.addEventListener('keydown', (e) => this.handleHistoryNavigation(e, this.floatingChatInput));

    this.dockBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dockChat();
    });
    this.toggleFloatingBtn?.addEventListener('click', () => this.toggleFloatingChat());

    // Chat history listeners
    this.closeHistoryBtn?.addEventListener('click', () => this.hideChatHistory());

    // Chat title editing listeners
    this.chatTitleDisplay?.addEventListener('click', () => this.startEditingTitle(false));
    this.chatTitleDisplayColumn?.addEventListener('click', () => this.startEditingTitle(false, true));
    this.chatTitleDisplayFloating?.addEventListener('click', () => this.startEditingTitle(true));

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.chat-menu-btn') && !e.target.closest('.chat-menu-dropdown')) {
        if (this.chatMenuDropdown) this.chatMenuDropdown.style.display = 'none';
        if (this.chatMenuDropdownColumn) this.chatMenuDropdownColumn.style.display = 'none';
      }
    });
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
    if (this.sidebarChat) {
      this.sidebarChat.classList.remove('minimized');
      if (this.sidebarChatExpandedHeight) {
        if (this.sidebarChatExpandedHeight === '__auto__') {
          this.sidebarChat.style.height = '';
        } else {
          this.sidebarChat.style.height = this.sidebarChatExpandedHeight;
        }
        this.sidebarChatExpandedHeight = null;
      }
    }
    if (this.sidebarResizer) {
      this.sidebarResizer.classList.remove('hidden');
    }
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
    if (this.sidebarChat) {
      if (!this.sidebarChatExpandedHeight) {
        const inlineHeight = this.sidebarChat.style.height;
        if (inlineHeight && inlineHeight.trim() !== '') {
          this.sidebarChatExpandedHeight = inlineHeight;
        } else {
          this.sidebarChatExpandedHeight = window.getComputedStyle(this.sidebarChat).height || '__auto__';
        }
      }
      this.sidebarChat.style.height = '';
      this.sidebarChat.classList.add('minimized');
    }
    if (this.sidebarResizer) {
      this.sidebarResizer.classList.add('hidden');
    }
    this.stopPollingForChanges();
    // Persist UI state
    this.statePersistence.saveChatOpenState(false);
  }

  toggleColumnCollapse() {
    if (!this.chatColumn) return;
    if (this.isColumnCollapsed) {
      this.expandColumn();
    } else {
      this.collapseColumn();
    }
  }

  collapseColumn() {
    if (!this.chatColumn || this.isColumnCollapsed) return;

    const computedStyles = window.getComputedStyle(this.chatColumn);
    this.columnExpandedStyles = {
      width: this.chatColumn.style.width || computedStyles.width,
      minWidth: this.chatColumn.style.minWidth || '',
      maxWidth: this.chatColumn.style.maxWidth || '',
      flex: this.chatColumn.style.flex || ''
    };

    this.chatColumn.classList.add('collapsed');
    this.chatColumnToggleBtn?.classList.add('collapsed');
    this.chatColumnToggleBtn?.setAttribute('aria-expanded', 'false');
    if (this.chatColumnToggleBtn) {
      this.chatColumnToggleBtn.title = 'Expand chat';
    }

    this.chatColumn.style.width = '52px';
    this.chatColumn.style.minWidth = '52px';
    this.chatColumn.style.maxWidth = '52px';
    this.chatColumn.style.flex = '0 0 52px';

    if (this.chatColumnResizer) {
      this.chatColumnResizer.classList.add('hidden');
    }

    if (this.chatMenuDropdownColumn) {
      this.chatMenuDropdownColumn.style.display = 'none';
    }

    this.isColumnCollapsed = true;

    // Save column collapse state
    this.statePersistence.saveColumnCollapsed(true);
  }

  expandColumn(suppressFocus = false) {
    if (!this.chatColumn || !this.isColumnCollapsed) return;

    this.chatColumn.classList.remove('collapsed');
    this.chatColumnToggleBtn?.classList.remove('collapsed');
    this.chatColumnToggleBtn?.setAttribute('aria-expanded', 'true');
    if (this.chatColumnToggleBtn) {
      this.chatColumnToggleBtn.title = 'Collapse chat';
    }

    if (this.columnExpandedStyles) {
      this.chatColumn.style.width = this.columnExpandedStyles.width;
      this.chatColumn.style.minWidth = this.columnExpandedStyles.minWidth;
      this.chatColumn.style.maxWidth = this.columnExpandedStyles.maxWidth;
      this.chatColumn.style.flex = this.columnExpandedStyles.flex;
    } else {
      this.chatColumn.style.width = '';
      this.chatColumn.style.minWidth = '';
      this.chatColumn.style.maxWidth = '';
      this.chatColumn.style.flex = '';
    }

    if (this.chatColumnResizer) {
      this.chatColumnResizer.classList.remove('hidden');
    }

    if (this.chatMenuDropdownColumn) {
      this.chatMenuDropdownColumn.style.display = 'none';
    }

    this.isColumnCollapsed = false;
    this.columnExpandedStyles = null;

    // Save column collapse state and width
    this.statePersistence.saveColumnCollapsed(false);
    if (this.chatColumn && this.chatColumn.style.width) {
      this.statePersistence.saveColumnWidth(this.chatColumn.style.width);
    }

    if (!suppressFocus && this.chatColumnInput && this.chatColumn.style.display !== 'none') {
      setTimeout(() => this.chatColumnInput.focus(), 0);
    }
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
    if (this.sidebarResizer) {
      this.sidebarResizer.classList.add('hidden');
    }

    // Show floating chat
    this.floatingChat.style.display = 'flex';
    this.floatingChatContainer.classList.remove('hidden');
    this.floatingChatInput.focus();

    // Save chat mode to persistence
    this.statePersistence.saveChatMode('floating');
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
    this.sidebarChat.classList.remove('minimized');
    if (this.sidebarResizer) {
      this.sidebarResizer.classList.remove('hidden');
    }
    this.chatInput.focus();

    // Save chat mode to persistence
    this.statePersistence.saveChatMode('sidebar');
  }

  moveToColumn() {
    console.log('📋 Moving chat to column...');
    this.isColumn = true;

    // Copy messages from sidebar to column
    this.syncMessages(this.chatMessages, this.chatColumnMessages);

    // Hide sidebar chat
    this.sidebarChat.style.display = 'none';
    if (this.sidebarResizer) {
      this.sidebarResizer.classList.add('hidden');
    }

    // Show column chat and resizer
    this.chatColumn.style.display = 'flex';
    if (this.chatColumnResizer) {
      this.chatColumnResizer.style.display = 'block';
    }
    if (this.chatColumnToggleBtn) {
      this.chatColumnToggleBtn.setAttribute('aria-expanded', String(!this.isColumnCollapsed));
    }
    this.expandColumn(true);
    if (this.chatColumnInput) {
      setTimeout(() => this.chatColumnInput.focus(), 0);
    }

    // Save chat mode to persistence
    this.statePersistence.saveChatMode('column');
  }

  dockFromColumn() {
    console.log('📥 Docking chat from column...');
    this.isColumn = false;

    // Copy messages from column to sidebar
    this.syncMessages(this.chatColumnMessages, this.chatMessages);

    // Ensure column is expanded before hiding so width/layout restore properly next time
    if (this.isColumnCollapsed) {
      this.expandColumn(true);
    }

    if (this.chatColumnToggleBtn) {
      this.chatColumnToggleBtn.setAttribute('aria-expanded', 'true');
    }

    // Hide column chat and resizer
    this.chatColumn.style.display = 'none';
    if (this.chatColumnResizer) {
      this.chatColumnResizer.style.display = 'none';
    }

    // Show sidebar chat
    this.sidebarChat.style.display = 'flex';
    this.isOpen = true;
    this.chatContainer.classList.remove('hidden');
    this.toggleBtn.classList.remove('collapsed');
    this.sidebarChat.classList.remove('minimized');
    if (this.sidebarResizer) {
      this.sidebarResizer.classList.remove('hidden');
    }
    this.chatInput.focus();

    // Save chat mode to persistence
    this.statePersistence.saveChatMode('sidebar');
  }

  toggleChatMenu() {
    console.log('🔧 toggleChatMenu called', {
      dropdown: !!this.chatMenuDropdown,
      currentDisplay: this.chatMenuDropdown?.style.display
    });

    if (!this.chatMenuDropdown) {
      console.error('❌ chatMenuDropdown not found!');
      return;
    }

    const isVisible = this.chatMenuDropdown.style.display === 'block';
    this.chatMenuDropdown.style.display = isVisible ? 'none' : 'block';

    console.log('✅ Menu toggled to:', this.chatMenuDropdown.style.display);

    // Close column menu if open
    if (this.chatMenuDropdownColumn) {
      this.chatMenuDropdownColumn.style.display = 'none';
    }
  }

  toggleChatMenuColumn() {
    const isVisible = this.chatMenuDropdownColumn.style.display === 'block';
    this.chatMenuDropdownColumn.style.display = isVisible ? 'none' : 'block';

    // Close sidebar menu if open
    if (this.chatMenuDropdown) {
      this.chatMenuDropdown.style.display = 'none';
    }
  }

  async handleChatMenuAction(action) {
    switch (action) {
      case 'new-chat':
        this.clearChat();
        await this.createNewChat();

        // Add welcome message to sidebar chat
        this.addMessage(
          "Hi! I'm your AI Travel Concierge. I can help you modify your trip by adding destinations, adjusting dates, managing costs, and optimizing your itinerary. What would you like to do?",
          'bot',
          false,
          false,
          false
        );

        // Sync welcome message to all chat containers
        this.syncMessages(this.chatMessages, this.floatingChatMessages);
        if (this.chatColumnMessages) {
          this.syncMessages(this.chatMessages, this.chatColumnMessages);
        }

        if (!this.isOpen && !this.isColumn) {
          this.openChat();
        }
        break;
      case 'chat-history':
        this.showChatHistory();
        break;
      case 'column-mode':
        this.moveToColumn();
        break;
      case 'dock-sidebar':
        this.dockFromColumn();
        break;
    }
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
        // Get current position of element
        const rect = element.getBoundingClientRect();
        xOffset = rect.left;
        yOffset = rect.top;

        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;

        // Convert to left/top positioning
        element.style.left = `${xOffset}px`;
        element.style.top = `${yOffset}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
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
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        // Save floating chat position when drag ends
        const rect = element.getBoundingClientRect();
        this.statePersistence.saveFloatingChatPosition(rect.left, rect.top);
      }
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
        if (isResizing) {
          // Save floating chat size when resize ends
          this.statePersistence.saveFloatingChatSize(element.offsetWidth, element.offsetHeight);
        }
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
    container.innerHTML = '';
  }

  async handleSubmit(e, isFloating = false, isColumn = false) {
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

      const input = isColumn ? this.chatColumnInput : (isFloating ? this.floatingChatInput : this.chatInput);
    const messages = isColumn ? this.chatColumnMessages : (isFloating ? this.floatingChatMessages : this.chatMessages);
    const sendBtn = isColumn ? this.chatColumnSendBtn : (isFloating ? this.floatingSendBtn : this.sendBtn);

    const message = input.value.trim();
    if (!message) return;

    // Add to message history for arrow key navigation
    this.messageHistory.push(message);
    this.historyIndex = -1; // Reset history navigation

    // Ensure we have a chat session before adding messages
    if (!this.currentChatId) {
      console.log('🆘 No currentChatId, creating new chat before sending message');
      await this.createNewChat();
    } else {
      console.log('✅ Using existing chat session:', this.currentChatId);
    }

    // Add user message to UI
    this.addMessage(message, 'user', false, isFloating, true, isColumn);
    input.value = '';

    // Disable input while processing
    this.setLoading(true, isFloating, isColumn);

    // Add loading message with timer
    const loadingMsgId = this.addMessage('Thinking...', 'bot', true, isFloating, true, isColumn);
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
          id: loc.id,  // Include destination ID for cost tracking
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

      // Create a timeout promise (5 minutes for large itineraries)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout - taking longer than 5 minutes')), 300000)
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
      this.removeMessage(loadingMsgId, isFloating, isColumn);

      // Add bot response
      // ⚠️ NOTE: AI responses may be inconsistent. The AI might claim it cannot access the itinerary
      // even when complete context data was sent. Backend investigation needed for this non-deterministic behavior.
      this.addMessage(data.response || data.response_text || 'Sorry, I could not generate a response.', 'bot', false, isFloating, true, isColumn);

      // If backend saved to Firestore, notify app to refresh cost UI
      if (data.saved_to_firestore) {
        console.log('🎉 Backend saved costs to Firestore, dispatching costs-updated event');
        try {
          window.dispatchEvent(new Event('costs-updated'));
          console.log('✅ costs-updated event dispatched successfully');
        } catch (err) {
          console.error('❌ Failed to dispatch costs-updated event:', err);
        }
      } else {
        console.log('ℹ️ Backend did not save costs (saved_to_firestore was false)');
      }

      // Sync messages to the other views
      if (isColumn) {
        this.syncMessages(this.chatColumnMessages, this.chatMessages);
        this.syncMessages(this.chatColumnMessages, this.floatingChatMessages);
      } else if (isFloating) {
        this.syncMessages(this.floatingChatMessages, this.chatMessages);
        if (this.chatColumnMessages) {
          this.syncMessages(this.floatingChatMessages, this.chatColumnMessages);
        }
      } else {
        this.syncMessages(this.chatMessages, this.floatingChatMessages);
        if (this.chatColumnMessages) {
          this.syncMessages(this.chatMessages, this.chatColumnMessages);
        }
      }

    } catch (error) {
      console.error('Chat error:', error);

      // Clear the timer
      clearInterval(timerInterval);

      // Remove loading message
      this.removeMessage(loadingMsgId, isFloating, isColumn);

      // Show error message with details
      let errorMessage = 'Sorry, I encountered an error. ';

      if (error.message.includes('timeout')) {
        errorMessage += `The request took longer than expected (${elapsedSeconds}s). The AI is processing a large itinerary. This can take several minutes for complex requests.`;
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Connection')) {
        errorMessage += 'Please make sure the backend server is running on http://localhost:5001';
      } else {
        errorMessage += `Error: ${error.message}`;
      }

      this.addMessage(errorMessage, 'bot', false, isFloating, true, isColumn);

      // Sync messages to the other views
      if (isColumn) {
        this.syncMessages(this.chatColumnMessages, this.chatMessages);
        this.syncMessages(this.chatColumnMessages, this.floatingChatMessages);
      } else if (isFloating) {
        this.syncMessages(this.floatingChatMessages, this.chatMessages);
        if (this.chatColumnMessages) {
          this.syncMessages(this.floatingChatMessages, this.chatColumnMessages);
        }
      } else {
        this.syncMessages(this.chatMessages, this.floatingChatMessages);
        if (this.chatColumnMessages) {
          this.syncMessages(this.chatMessages, this.chatColumnMessages);
        }
      }
    } finally {
      this.setLoading(false, isFloating, isColumn);
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
      this.setLoading(false, isFloating, isColumn);
    }
  }

  addMessage(text, sender = 'bot', isLoading = false, isFloating = false, saveToFirestore = true, isColumn = false) {
    // Generate ID without periods (replace decimal point with underscore)
    const baseMessageId = this.generateMessageId();
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}${isLoading ? ' loading' : ''}`;
    messageDiv.dataset.messageId = baseMessageId;
    messageDiv.id = this.getDomMessageId(baseMessageId, isFloating);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Parse and render markdown for bot messages
    if (sender === 'bot' && !isLoading) {
      contentDiv.innerHTML = this.parseMarkdown(text);
    } else {
      contentDiv.textContent = text;
    }

    messageDiv.appendChild(contentDiv);

    const messagesContainer = isColumn ? this.chatColumnMessages : (isFloating ? this.floatingChatMessages : this.chatMessages);
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

  /**
   * Parse markdown text and convert to HTML
   * Supports basic markdown: bold, italic, lists, headers, links, code blocks
   */
  parseMarkdown(text) {
    // Escape HTML first to prevent XSS
    let html = this.escapeHtml(text);
    
    // Code blocks (must be processed first to preserve them)
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="code-block"><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');
    
    // Bold text
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>');
    
    // Italic text
    html = html.replace(/\*(.+?)\*/g, '<em class="md-italic">$1</em>');
    
    // Lists (handle both unordered and ordered)
    html = html.replace(/^\* (.+)$/gim, '<li class="md-li">$1</li>');
    html = html.replace(/^\d+\. (.+)$/gim, '<li class="md-li">$1</li>');
    
    // Wrap consecutive list items in ul/ol tags
    html = html.replace(/(<li class="md-li">.*?<\/li>)/gs, (match) => {
      // Check if this looks like an ordered list (starts with number)
      const isOrdered = /^\d+\./.test(match.replace(/<[^>]*>/g, ''));
      const tag = isOrdered ? 'ol' : 'ul';
      return `<${tag} class="md-list">${match}</${tag}>`;
    });
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p class="md-paragraph">');
    html = html.replace(/\n/g, '<br class="md-br">');
    
    // Wrap in paragraphs
    html = `<p class="md-paragraph">${html}</p>`;
    
    // Clean up empty paragraphs
    html = html.replace(/<p class="md-paragraph"><\/p>/g, '');
    html = html.replace(/<p class="md-paragraph">(.*?)<\/p>/g, (match, content) => {
      // Don't wrap if content already contains block elements
      if (content.includes('<h') || content.includes('<pre') || content.includes('<ul') || content.includes('<ol')) {
        return content;
      }
      return match;
    });
    
    return html;
  }

  /**
   * Escape HTML to prevent XSS attacks
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getMessageElement(messageId, isFloating = false) {
    const messagesContainer = isFloating ? this.floatingChatMessages : this.chatMessages;
    if (!messagesContainer) return null;
    return messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
  }

  removeMessage(messageId, isFloating = false, isColumn = false) {
    const messagesContainer = isColumn ? this.chatColumnMessages : (isFloating ? this.floatingChatMessages : this.chatMessages);
    if (!messagesContainer) return;
    const message = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (message) {
      message.remove();
    }
  }

  setLoading(isLoading, isFloating = false, isColumn = false) {
    if (isColumn) {
      this.chatColumnInput.disabled = isLoading;
      this.chatColumnSendBtn.disabled = isLoading;
    } else if (isFloating) {
      this.floatingChatInput.disabled = isLoading;
      this.floatingSendBtn.disabled = isLoading;
    } else {
      this.chatInput.disabled = isLoading;
      this.sendBtn.disabled = isLoading;
    }
  }

  handleHistoryNavigation(e, inputElement) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();

      if (this.messageHistory.length === 0) return;

      // First time pressing up, start from the end
      if (this.historyIndex === -1) {
        this.historyIndex = this.messageHistory.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }

      inputElement.value = this.messageHistory[this.historyIndex];

      // Move cursor to end
      setTimeout(() => {
        inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
      }, 0);

    } else if (e.key === 'ArrowDown') {
      e.preventDefault();

      if (this.historyIndex === -1) return; // Not navigating

      if (this.historyIndex < this.messageHistory.length - 1) {
        this.historyIndex++;
        inputElement.value = this.messageHistory[this.historyIndex];
      } else {
        // At the end, clear input
        this.historyIndex = -1;
        inputElement.value = '';
      }

      // Move cursor to end
      setTimeout(() => {
        inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
      }, 0);
    } else if (e.key !== 'Enter') {
      // Any other key resets history navigation
      this.historyIndex = -1;
    }
  }

  clearChat() {
    this.resetChatMessages(this.chatMessages);
    this.resetChatMessages(this.floatingChatMessages);
    if (this.chatColumnMessages) {
      this.resetChatMessages(this.chatColumnMessages);
    }
    this.sessionId = null;
    this.currentChatId = null;
    this.messages = [];
    // Note: We keep messageHistory for arrow key navigation even when clearing chat

    // Reset title to default
    this.updateChatTitle('New Chat');

    // Clear chat state from persistence
    this.statePersistence.saveChatState(null, [], null);
  }

  // ==================== CHAT HISTORY METHODS ====================

  /**
   * Create a new chat in Firestore
   */
  async createNewChat(scenarioId = null) {
    console.log('🆕 Creating new chat - current state:', {
      currentChatId: this.currentChatId,
      messagesCount: this.messages?.length || 0,
      sessionId: this.sessionId,
      scenarioId: scenarioId || window.currentScenarioId
    });

    try {
      const chatData = {
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        legName: this.currentLeg || 'All',
        subLegName: this.currentSubLeg || null,
        title: 'New Chat',
        messageCount: 0,
        scenarioId: scenarioId || window.currentScenarioId || null
      };

      const chatRef = await addDoc(collection(db, 'chatHistory'), chatData);

      this.currentChatId = chatRef.id;
      this.messages = [];
      console.log('📝 Created new chat:', this.currentChatId, 'for scenario:', chatData.scenarioId);
      console.log('🆕 Chat state after creation:', {
        currentChatId: this.currentChatId,
        messagesCount: this.messages?.length || 0,
        sessionId: this.sessionId,
        scenarioId: chatData.scenarioId
      });

      // Update UI with new chat title
      this.updateChatTitle('New Chat');

      // Save chat state with scenario association
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
        sessionId: this.sessionId || null,
        scenarioId: window.currentScenarioId || null
      }, { merge: true });

      console.log('💾 Saved message to chat:', this.currentChatId);

      // Save scenario-chat association
      if (window.currentScenarioId) {
        this.statePersistence.saveScenarioChatAssociation(window.currentScenarioId, this.currentChatId);
      }
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
      if (this.chatColumnMessages) {
        this.chatColumnMessages.innerHTML = '';
      }

      // Render messages
      this.messages.forEach(msg => {
        this.addMessage(msg.text, msg.sender, false, false, false, false);
      });

      // Sync to floating and column chat
      this.syncMessages(this.chatMessages, this.floatingChatMessages);
      if (this.chatColumnMessages) {
        this.syncMessages(this.chatMessages, this.chatColumnMessages);
      }

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
  async getChatHistories(scenarioId = null) {
    try {
      let q;
      if (scenarioId) {
        // Filter chats by scenario ID
        q = query(
          collection(db, 'chatHistory'),
          where('scenarioId', '==', scenarioId),
          orderBy('updatedAt', 'desc'),
          limit(50)
        );
      } else {
        // Get all chats (existing behavior)
        q = query(
          collection(db, 'chatHistory'),
          orderBy('updatedAt', 'desc'),
          limit(50)
        );
      }

      const querySnapshot = await getDocs(q);
      const chats = [];

      querySnapshot.forEach((doc) => {
        chats.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('📚 Retrieved', chats.length, 'chat histories' + (scenarioId ? ` for scenario ${scenarioId}` : ''));
      return chats;
    } catch (error) {
      console.error('Error getting chat histories:', error);
      return [];
    }
  }

  /**
   * Get the most recent chat for a specific scenario
   */
  async getChatForScenario(scenarioId) {
    try {
      const q = query(
        collection(db, 'chatHistory'),
        where('scenarioId', '==', scenarioId),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('📭 No chat found for scenario:', scenarioId);
        return null;
      }

      const chatDoc = querySnapshot.docs[0];
      const chatData = {
        id: chatDoc.id,
        ...chatDoc.data()
      };

      console.log('📂 Found chat for scenario:', scenarioId, chatData.id);
      return chatData;
    } catch (error) {
      console.error('Error getting chat for scenario:', error);
      return null;
    }
  }

  /**
   * Switch chat session for a new scenario
   */
  async switchToScenario(scenarioId) {
    console.log('🔄 Switching chat to scenario:', scenarioId);

    // Try to load existing chat for this scenario
    const existingChat = await this.getChatForScenario(scenarioId);
    
    if (existingChat) {
      // Load existing chat
      console.log('📂 Loading existing chat for scenario:', scenarioId);
      await this.loadChat(existingChat.id);
    } else {
      // Create new chat for this scenario
      console.log('🆕 Creating new chat for scenario:', scenarioId);
      await this.createNewChat(scenarioId);
      
      // Add welcome message
      this.addMessage(
        "Hi! I'm your AI Travel Concierge. I can help you modify your trip by adding destinations, adjusting dates, managing costs, and optimizing your itinerary. What would you like to do?",
        'bot',
        false,
        false,
        false
      );

      // Sync welcome message to all chat containers
      this.syncMessages(this.chatMessages, this.floatingChatMessages);
      if (this.chatColumnMessages) {
        this.syncMessages(this.chatMessages, this.chatColumnMessages);
      }
    }

    return this.currentChatId;
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
  async showChatHistory(scenarioId = null) {
    const historyPanel = document.getElementById('chat-history-panel');
    const historyList = document.getElementById('chat-history-list');

    if (!historyPanel || !historyList) {
      console.error('Chat history UI elements not found');
      return;
    }

    // Show loading state
    historyList.innerHTML = '<div class="loading">Loading chat history...</div>';
    historyPanel.classList.remove('hidden');

    // Load chat histories (filtered by scenario if provided)
    const chats = await this.getChatHistories(scenarioId);

    if (chats.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No chat history yet</div>';
      return;
    }

    // Render chat list
    historyList.innerHTML = '';
    chats.forEach(chat => {
      const chatItem = document.createElement('div');
      chatItem.className = 'chat-history-item';
      
      // Add scenario indicator if available
      const scenarioIndicator = chat.scenarioId ? 
        `<div class="chat-history-scenario">Scenario: ${chat.scenarioId.substring(0, 8)}...</div>` : '';

      chatItem.innerHTML = `
        <div class="chat-history-info">
          <div class="chat-history-title-container">
            <div class="chat-history-title" data-chat-id="${chat.id}">${chat.title || 'Untitled Chat'}</div>
            <button class="chat-history-ai-title-btn" data-chat-id="${chat.id}" title="Generate AI title">🤖</button>
          </div>
          ${scenarioIndicator}
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
          await this.showChatHistory(scenarioId); // Refresh list
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
    const displayTitle = title || 'New Chat';

    // Update secondary header in column mode
    const chatTitleSecondary = document.getElementById('chat-title-secondary');
    if (chatTitleSecondary) {
      chatTitleSecondary.textContent = displayTitle;
    }

    // Update floating chat title display
    if (this.chatTitleDisplay) {
      this.chatTitleDisplay.textContent = displayTitle;
    }
    if (this.chatTitleDisplayColumn) {
      this.chatTitleDisplayColumn.textContent = displayTitle;
    }
    if (this.chatTitleDisplayFloating) {
      this.chatTitleDisplayFloating.textContent = displayTitle;
    }
  }

  /**
   * Start editing the chat title
   */
  startEditingTitle(isFloating = false, isColumn = false) {
    if (!this.currentChatId) return;

    const titleElement = isColumn ? this.chatTitleDisplayColumn : (isFloating ? this.chatTitleDisplayFloating : this.chatTitleDisplay);
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
