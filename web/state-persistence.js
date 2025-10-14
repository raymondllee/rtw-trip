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
      // Enhanced chat UI state persistence
      chatMode: 'sidebar', // 'sidebar', 'column', 'floating'
      columnCollapsed: false,
      columnWidth: null, // Custom column width when set
      floatingChatPosition: { x: null, y: null }, // Position of floating chat
      floatingChatSize: { width: null, height: null }, // Size of floating chat
      sidebarChatHeight: null, // Custom height for sidebar chat
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
   * Save scenario-chat association
   */
  saveScenarioChatAssociation(scenarioId, chatId) {
    const scenarioChatMap = this.state.scenarioChatMap || {};
    scenarioChatMap[scenarioId] = chatId;
    this.saveState({ scenarioChatMap });
  }

  /**
   * Get chat ID for a scenario
   */
  getChatIdForScenario(scenarioId) {
    const scenarioChatMap = this.state.scenarioChatMap || {};
    return scenarioChatMap[scenarioId] || null;
  }

  /**
   * Clear scenario-chat association
   */
  clearScenarioChatAssociation(scenarioId) {
    const scenarioChatMap = this.state.scenarioChatMap || {};
    delete scenarioChatMap[scenarioId];
    this.saveState({ scenarioChatMap });
  }

  /**
   * Save chat open/closed UI state
   */
  saveChatOpenState(isOpen) {
    this.saveState({ chatOpen: !!isOpen });
  }

  /**
   * Save chat mode (sidebar, column, floating)
   */
  saveChatMode(mode) {
    this.saveState({ chatMode: mode });
  }

  /**
   * Save column collapse state
   */
  saveColumnCollapsed(collapsed) {
    this.saveState({ columnCollapsed: collapsed });
  }

  /**
   * Save column width
   */
  saveColumnWidth(width) {
    this.saveState({ columnWidth: width });
  }

  /**
   * Save floating chat position
   */
  saveFloatingChatPosition(x, y) {
    this.saveState({ 
      floatingChatPosition: { x, y }
    });
  }

  /**
   * Save floating chat size
   */
  saveFloatingChatSize(width, height) {
    this.saveState({ 
      floatingChatSize: { width, height }
    });
  }

  /**
   * Save sidebar chat height
   */
  saveSidebarChatHeight(height) {
    this.saveState({ sidebarChatHeight: height });
  }

  /**
   * Save all chat UI state at once
   */
  saveChatUIState(chatState) {
    this.saveState(chatState);
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
