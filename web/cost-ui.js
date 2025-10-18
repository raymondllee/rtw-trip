/**
 * Cost Tracking UI Components
 * Provides interface for adding, editing, and viewing trip costs
 */

class CostUI {
  constructor(costTracker, apiBaseUrl = 'http://localhost:5001') {
    this.costTracker = costTracker;
    this.apiBaseUrl = apiBaseUrl;
    this.sessionId = null;
    this.currentDestinations = [];
  }

  /**
   * Set session ID for API calls
   */
  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Set current destinations for dropdown
   */
  setDestinations(destinations) {
    this.currentDestinations = destinations;
  }

  /**
   * Create cost input form
   * @param {Object} options - Form options (destination, prefill data, etc.)
   * @returns {HTMLElement}
   */
  createCostForm(options = {}) {
    const form = document.createElement('form');
    form.className = 'cost-form';

    const categories = [
      { value: 'flight', label: '✈️ Flight' },
      { value: 'accommodation', label: '🏨 Accommodation' },
      { value: 'activity', label: '🎯 Activity' },
      { value: 'food', label: '🍽️ Food' },
      { value: 'transport', label: '🚗 Transport' },
      { value: 'other', label: '📌 Other' }
    ];

    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'BRL', 'ARS',
                       'IDR', 'PHP', 'SGD', 'MYR', 'TWD', 'KRW', 'NPR'];

    const bookingStatuses = [
      { value: 'estimated', label: 'Estimated' },
      { value: 'researched', label: 'Researched' },
      { value: 'booked', label: 'Booked' },
      { value: 'paid', label: 'Paid' }
    ];

    form.innerHTML = `
      <div class="form-group">
        <label for="cost-category">Category *</label>
        <select id="cost-category" name="category" required>
          ${categories.map(c =>
            `<option value="${c.value}" ${options.category === c.value ? 'selected' : ''}>${c.label}</option>`
          ).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="cost-description">Description *</label>
        <input type="text" id="cost-description" name="description"
               value="${options.description || ''}"
               placeholder="e.g., Flight from Tokyo to Seoul" required>
      </div>

      <div class="form-row">
        <div class="form-group" style="flex: 2;">
          <label for="cost-amount">Amount *</label>
          <input type="number" id="cost-amount" name="amount"
                 value="${options.amount || ''}"
                 step="0.01" min="0" placeholder="0.00" required>
        </div>
        <div class="form-group" style="flex: 1;">
          <label for="cost-currency">Currency</label>
          <select id="cost-currency" name="currency">
            ${currencies.map(curr =>
              `<option value="${curr}" ${(options.currency || 'USD') === curr ? 'selected' : ''}>${curr}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="cost-date">Date *</label>
        <input type="date" id="cost-date" name="date"
               value="${options.date || new Date().toISOString().split('T')[0]}" required>
      </div>

      <div class="form-group">
        <label for="cost-destination">Destination</label>
        <select id="cost-destination" name="destination_id">
          <option value="">General / Multiple</option>
          ${this.currentDestinations.map(dest =>
            `<option value="${dest.id}" ${options.destinationId === dest.id ? 'selected' : ''}>${dest.name}</option>`
          ).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="cost-status">Status</label>
        <select id="cost-status" name="booking_status">
          ${bookingStatuses.map(s =>
            `<option value="${s.value}" ${(options.bookingStatus || 'estimated') === s.value ? 'selected' : ''}>${s.label}</option>`
          ).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="cost-notes">Notes</label>
        <textarea id="cost-notes" name="notes" rows="2"
                  placeholder="Additional notes...">${options.notes || ''}</textarea>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">
          ${options.costId ? 'Update' : 'Add'} Cost
        </button>
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').style.display='none'">
          Cancel
        </button>
      </div>
    `;

    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const costData = Object.fromEntries(formData.entries());

      // Normalize destination_id as string (Place IDs are non-numeric)
      if (costData.destination_id) {
        const trimmed = costData.destination_id.trim();
        costData.destination_id = trimmed.length > 0 ? trimmed : null;
      } else {
        costData.destination_id = null;
      }
      costData.amount = parseFloat(costData.amount);
      costData.session_id = this.sessionId || 'default';

      try {
        if (options.costId) {
          await this.updateCost(options.costId, costData);
        } else {
          await this.addCost(costData);
        }

        // Close modal and refresh display
        const modal = form.closest('.modal');
        if (modal) modal.style.display = 'none';

        // Trigger refresh event
        window.dispatchEvent(new CustomEvent('costs-updated'));
      } catch (error) {
        alert(`Error saving cost: ${error.message}`);
      }
    });

    return form;
  }

  /**
   * Create cost summary widget
   * @param {Object} summary - Cost summary from API
   * @returns {HTMLElement}
   */
  createSummaryWidget(summary) {
    const widget = document.createElement('div');
    widget.className = 'cost-summary-widget';

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    };

    widget.innerHTML = `
      <div class="cost-summary-header">
        <h3>Trip Costs</h3>
        <div class="cost-summary-total">${formatCurrency(summary.totalUSD)}</div>
      </div>

      <div class="cost-summary-breakdown">
        <div class="cost-category-row">
          <span>✈️ Flights</span>
          <span>${formatCurrency(summary.costsByCategory.flight)}</span>
        </div>
        <div class="cost-category-row">
          <span>🏨 Accommodation</span>
          <span>${formatCurrency(summary.costsByCategory.accommodation)}</span>
        </div>
        <div class="cost-category-row">
          <span>🎯 Activities</span>
          <span>${formatCurrency(summary.costsByCategory.activity)}</span>
        </div>
        <div class="cost-category-row">
          <span>🍽️ Food</span>
          <span>${formatCurrency(summary.costsByCategory.food)}</span>
        </div>
        <div class="cost-category-row">
          <span>🚗 Transport</span>
          <span>${formatCurrency(summary.costsByCategory.transport)}</span>
        </div>
        <div class="cost-category-row">
          <span>📌 Other</span>
          <span>${formatCurrency(summary.costsByCategory.other)}</span>
        </div>
      </div>

      ${summary.costPerPerson ? `
        <div class="cost-summary-per-person">
          Per Person: ${formatCurrency(summary.costPerPerson)}
        </div>
      ` : ''}

      ${summary.costPerDay ? `
        <div class="cost-summary-per-day">
          Per Day: ${formatCurrency(summary.costPerDay)}
        </div>
      ` : ''}

      <button class="btn btn-sm btn-outline" onclick="costUI.showCostDetails()">
        View Details
      </button>
    `;

    return widget;
  }

  /**
   * Create destination cost breakdown
   * @param {Array} destinationCosts - Array of DestinationCost objects
   * @returns {HTMLElement}
   */
  createDestinationBreakdown(destinationCosts) {
    const container = document.createElement('div');
    container.className = 'destination-cost-breakdown';

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    };

    container.innerHTML = `
      <h4>Costs by Destination</h4>
      <div class="destination-cost-list">
        ${destinationCosts.map(dest => `
          <div class="destination-cost-item" onclick="costUI.filterByDestination(${dest.destinationId})">
            <div class="destination-cost-name">${dest.destinationName}</div>
            <div class="destination-cost-amount">${formatCurrency(dest.totalUSD)}</div>
            <div class="destination-cost-per-day">${formatCurrency(dest.costPerDay)}/day</div>
          </div>
        `).join('')}
      </div>
    `;

    return container;
  }

  /**
   * Show add cost modal
   */
  showAddCostModal(options = {}) {
    const modal = this.createModal('Add Cost', this.createCostForm(options));
    document.body.appendChild(modal);
    modal.style.display = 'flex';
  }

  /**
   * Show cost details modal
   */
  async showCostDetails() {
    // Fetch costs from API
    const costs = await this.fetchCosts();

    const modal = this.createModal('Cost Details', this.createCostList(costs));
    document.body.appendChild(modal);
    modal.style.display = 'flex';
  }

  /**
   * Create cost list view
   * @param {Array} costs - Array of cost items
   * @returns {HTMLElement}
   */
  createCostList(costs) {
    const container = document.createElement('div');
    container.className = 'cost-list';

    const formatCurrency = (amount, currency) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    };

    const getCategoryIcon = (category) => {
      const icons = {
        flight: '✈️',
        accommodation: '🏨',
        activity: '🎯',
        food: '🍽️',
        transport: '🚗',
        other: '📌'
      };
      return icons[category] || '📌';
    };

    container.innerHTML = `
      <div class="cost-list-header">
        <button class="btn btn-primary" onclick="costUI.showAddCostModal()">+ Add Cost</button>
        <button class="btn btn-secondary" onclick="costUI.showBulkEdit()">📊 Bulk Edit</button>
      </div>
      <div class="cost-items">
        ${costs.length === 0 ? '<p class="empty-state">No costs recorded yet</p>' : ''}
        ${costs.map(cost => `
          <div class="cost-item" data-cost-id="${cost.id}">
            <div class="cost-item-icon">${getCategoryIcon(cost.category)}</div>
            <div class="cost-item-details">
              <div class="cost-item-description">${cost.description}</div>
              <div class="cost-item-meta">
                ${cost.date} · ${cost.bookingStatus}
              </div>
            </div>
            <div class="cost-item-amount">
              ${formatCurrency(cost.amount, cost.currency)}
              ${cost.currency !== 'USD' ? `<br><small>(${formatCurrency(cost.amountUSD, 'USD')})</small>` : ''}
            </div>
            <div class="cost-item-actions">
              <button class="btn-icon" onclick="costUI.editCost('${cost.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="costUI.deleteCostConfirm('${cost.id}')" title="Delete">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    return container;
  }

  /**
   * Create modal dialog
   */
  createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body"></div>
    `;

    modalContent.querySelector('.modal-body').appendChild(content);
    modal.appendChild(modalContent);

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    return modal;
  }

  // ============================================================================
  // API Methods
  // ============================================================================

  async addCost(costData) {
    const response = await fetch(`${this.apiBaseUrl}/api/costs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(costData)
    });

    if (!response.ok) {
      throw new Error(`Failed to add cost: ${response.statusText}`);
    }

    const result = await response.json();
    this.costTracker.costs.push(result.cost);
    return result.cost;
  }

  async updateCost(costId, updates) {
    const response = await fetch(`${this.apiBaseUrl}/api/costs/${costId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, session_id: this.sessionId || 'default' })
    });

    if (!response.ok) {
      throw new Error(`Failed to update cost: ${response.statusText}`);
    }

    const result = await response.json();
    const index = this.costTracker.costs.findIndex(c => c.id === costId);
    if (index !== -1) {
      this.costTracker.costs[index] = result.cost;
    }
    return result.cost;
  }

  async deleteCost(costId) {
    const response = await fetch(`${this.apiBaseUrl}/api/costs/${costId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: this.sessionId || 'default' })
    });

    if (!response.ok) {
      throw new Error(`Failed to delete cost: ${response.statusText}`);
    }

    this.costTracker.costs = this.costTracker.costs.filter(c => c.id !== costId);
  }

  async deleteCostConfirm(costId) {
    if (!confirm('Are you sure you want to delete this cost item?')) return;

    try {
      await this.deleteCost(costId);
      window.dispatchEvent(new CustomEvent('costs-updated'));
    } catch (error) {
      alert(`Error deleting cost: ${error.message}`);
    }
  }

  async fetchCosts(filters = {}) {
    const params = new URLSearchParams({
      session_id: this.sessionId || 'default',
      ...filters
    });

    const response = await fetch(`${this.apiBaseUrl}/api/costs?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch costs: ${response.statusText}`);
    }

    const result = await response.json();
    return result.costs;
  }

  async fetchSummary(options = {}) {
    const response = await fetch(`${this.apiBaseUrl}/api/costs/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: this.sessionId || 'default',
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch summary: ${response.statusText}`);
    }

    const result = await response.json();
    return result.summary;
  }

  async editCost(costId) {
    const cost = this.costTracker.costs.find(c => c.id === costId);
    if (!cost) return;

    this.showAddCostModal({
      costId: cost.id,
      category: cost.category,
      description: cost.description,
      amount: cost.amount,
      currency: cost.currency,
      date: cost.date,
      destinationId: cost.destinationId,
      bookingStatus: cost.bookingStatus,
      notes: cost.notes
    });
  }

  filterByDestination(destinationId) {
    // This would integrate with the main app filtering
    console.log('Filter by destination:', destinationId);
  }

  /**
   * Show bulk edit interface
   */
  showBulkEdit() {
    console.log('🔧 showBulkEdit called');

    // Check if CostBulkEdit is loaded
    if (typeof CostBulkEdit === 'undefined') {
      console.error('CostBulkEdit not loaded. Make sure cost-bulk-edit.js is included.');
      alert('Bulk edit feature not available. Please reload the page.');
      return;
    }

    console.log('✅ CostBulkEdit is defined');

    // Create or reuse bulk edit instance
    if (!window.costBulkEditor) {
      console.log('Creating new CostBulkEdit instance...');
      window.costBulkEditor = new CostBulkEdit(this.apiBaseUrl);
    }

    console.log('Current session ID:', this.sessionId);
    console.log('Current destinations:', this.currentDestinations?.length || 0);

    // Set session ID and destinations (these should already be set by the caller)
    if (this.sessionId) {
      window.costBulkEditor.setSessionId(this.sessionId);
    }
    if (this.currentDestinations && this.currentDestinations.length > 0) {
      window.costBulkEditor.setDestinations(this.currentDestinations);
    }

    // Show bulk edit modal
    console.log('Calling showBulkEditModal...');
    window.costBulkEditor.showBulkEditModal();
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.CostUI = CostUI;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CostUI };
}
