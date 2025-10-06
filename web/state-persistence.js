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
