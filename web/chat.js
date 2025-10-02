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

    this.initElements();
    this.attachEventListeners();

    // Check if chat is already visible (not hidden) and start polling
    if (this.chatContainer && !this.chatContainer.classList.contains('hidden')) {
      console.log('💡 Chat container is visible on init, starting polling...');
      this.isOpen = true;
      this.startPollingForChanges();
    }
  }

  initElements() {
    this.chatHeader = document.querySelector('.chat-header-sidebar');
    this.chatContainer = document.getElementById('chat-container-sidebar');
    this.toggleBtn = document.getElementById('toggle-chat-sidebar');
    this.chatForm = document.getElementById('chat-form-sidebar');
    this.chatInput = document.getElementById('chat-input-sidebar');
    this.chatMessages = document.getElementById('chat-messages-sidebar');
    this.sendBtn = document.getElementById('chat-send-btn-sidebar');
  }

  attachEventListeners() {
    this.chatHeader?.addEventListener('click', () => this.toggleChat());
    this.chatForm?.addEventListener('submit', (e) => this.handleSubmit(e));
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

  async handleSubmit(e) {
    e.preventDefault();

    const message = this.chatInput.value.trim();
    if (!message) return;

    // Add user message to UI
    this.addMessage(message, 'user');
    this.chatInput.value = '';

    // Disable input while processing
    this.setLoading(true);

    // Add loading message
    const loadingMsgId = this.addMessage('Thinking...', 'bot', true);

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

      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📨 Chat API response:', data);

      // Store session ID for continuity
      if (data.session_id) {
        console.log(`🔑 Setting session ID: ${data.session_id} (was: ${this.sessionId})`);
        this.sessionId = data.session_id;
      } else {
        console.warn('⚠️ No session_id in response!', data);
      }

      // Remove loading message
      this.removeMessage(loadingMsgId);

      // Add bot response
      this.addMessage(data.response || 'Sorry, I could not generate a response.', 'bot');

    } catch (error) {
      console.error('Chat error:', error);

      // Remove loading message
      this.removeMessage(loadingMsgId);

      // Show error message
      this.addMessage(
        'Sorry, I encountered an error. Please make sure the backend server is running on http://localhost:5001',
        'bot'
      );
    } finally {
      this.setLoading(false);
    }
  }

  addMessage(text, sender = 'bot', isLoading = false) {
    const messageId = `msg-${Date.now()}-${Math.random()}`;
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}${isLoading ? ' loading' : ''}`;
    messageDiv.id = messageId;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);
    this.chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    return messageId;
  }

  removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
      message.remove();
    }
  }

  setLoading(isLoading) {
    this.chatInput.disabled = isLoading;
    this.sendBtn.disabled = isLoading;
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
