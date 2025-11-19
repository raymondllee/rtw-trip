/**
 * Bulk Cost Editing Component
 * Provides table-based interface for editing multiple costs at once
 */

class CostBulkEdit {
  constructor(apiBaseUrl = 'http://localhost:5001') {
    this.apiBaseUrl = apiBaseUrl;
    this.costs = [];
    this.selectedCostIds = new Set();
    this.editedCosts = new Map(); // Track changes before saving
    this.destinations = [];
    this.sessionId = null;
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.columnWidths = new Map();
    this.resizeHandlersInitialized = false;
  }

  /**
   * Set session ID for API calls
   */
  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Set available destinations for dropdown
   */
  setDestinations(destinations) {
    this.destinations = destinations;
  }

  /**
   * Show bulk edit modal with all costs
   */
  async showBulkEditModal() {
    console.log('📊 showBulkEditModal called');
    try {
      // Fetch all costs
      console.log('Fetching costs...');
      const costs = await this.fetchCosts();
      console.log(`✅ Fetched ${costs.length} costs`);

      this.costs = costs;
      this.selectedCostIds.clear();
      this.editedCosts.clear();
      this.columnWidths.clear();
      this.resizeHandlersInitialized = false;

      console.log('Creating modal...');
      const modal = this.createBulkEditModal();
      console.log('Modal created:', modal);

      console.log('Appending modal to body...');
      document.body.appendChild(modal);
      console.log('Modal appended');

      // Render rows after modal is in DOM (this also attaches event listeners)
      console.log('Rendering table rows...');
      this.renderTableRows();
      console.log('✅ Bulk edit modal ready with', this.costs.length, 'costs');
    } catch (error) {
      console.error('❌ Failed to load costs:', error);
      console.error('Error stack:', error.stack);
      alert(`Failed to load costs: ${error.message}`);
    }
  }

  /**
   * Create bulk edit modal
   */
  createBulkEditModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay bulk-edit-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content bulk-edit-content">
        <div class="modal-header">
          <h3>Bulk Edit Costs</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
        </div>
        <div class="modal-body bulk-edit-body">
          ${this.createBulkEditToolbar()}
          ${this.createBulkEditTable()}
        </div>
        <div class="modal-footer bulk-edit-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-primary" id="bulk-save-btn">Save All Changes</button>
        </div>
      </div>
    `;

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (this.editedCosts.size > 0) {
          if (confirm('You have unsaved changes. Are you sure you want to close?')) {
            modal.remove();
          }
        } else {
          modal.remove();
        }
      }
    });

    // Save button handler
    modal.querySelector('#bulk-save-btn').addEventListener('click', () => {
      this.saveAllChanges(modal);
    });

    return modal;
  }

  /**
   * Create toolbar with filters and batch actions
   */
  createBulkEditToolbar() {
    const categories = ['all', 'flight', 'accommodation', 'activity', 'food', 'transport', 'other'];
    const statuses = ['all', 'estimated', 'researched', 'booked', 'paid'];
    const regions = this.getUniqueRegions();
    const countries = this.getUniqueCountries();

    const regionOptions = regions
      .map(({ value, label }) => `<option value="${this.escapeHtml(value)}">${this.escapeHtml(label)}</option>`)
      .join('');

    const countryOptions = countries
      .map(({ value, label }) => `<option value="${this.escapeHtml(value)}">${this.escapeHtml(label)}</option>`)
      .join('');

    const hasUnassignedCosts = this.hasUnassignedDestinationCosts();

    const destinationOptions = this.destinations
      .filter(dest => dest.id != null && `${dest.id}`.trim().length > 0)
      .map(dest => {
        const destId = dest.id != null ? String(dest.id) : '';
        const destLabel = dest.name || dest.city || 'Unknown';
        return `<option value="${this.escapeHtml(destId)}">${this.escapeHtml(destLabel)}</option>`;
      })
      .join('');
    const unassignedDestinationOption = hasUnassignedCosts ? '<option value="__none__">Unassigned</option>' : '';

    return `
      <div class="bulk-edit-toolbar">
        <div class="bulk-edit-filters">
          <select id="filter-category" class="bulk-filter">
            ${categories.map(cat => `<option value="${cat}">${cat === 'all' ? 'All Categories' : this.getCategoryIcon(cat) + ' ' + this.capitalize(cat)}</option>`).join('')}
          </select>
          <select id="filter-status" class="bulk-filter">
            ${statuses.map(status => `<option value="${status}">${status === 'all' ? 'All Statuses' : this.capitalize(status)}</option>`).join('')}
          </select>
          <select id="filter-region" class="bulk-filter">
            <option value="all">All Regions</option>
            ${regionOptions}
          </select>
          <select id="filter-country" class="bulk-filter">
            <option value="all">All Countries</option>
            ${countryOptions}
          </select>
          <select id="filter-destination" class="bulk-filter">
            <option value="all">All Destinations</option>
            ${destinationOptions}${unassignedDestinationOption}
          </select>
        </div>
        <div class="bulk-edit-actions">
          <span class="selection-count">0 selected</span>
          <button class="btn btn-sm btn-danger" id="delete-selected-btn" disabled>Delete Selected</button>
        </div>
      </div>
    `;
  }

  /**
   * Create editable table
   */
  createBulkEditTable() {
    return `
      <div class="bulk-edit-table-container">
        <table class="bulk-edit-table" id="bulk-edit-table">
          <thead>
            <tr>
              <th class="checkbox-col resizable">
                <input type="checkbox" id="select-all-checkbox" title="Select All">
                <div class="resize-handle"></div>
              </th>
              <th class="sortable resizable" data-sort="region">
                Region
                <div class="resize-handle"></div>
              </th>
              <th class="sortable resizable" data-sort="country">
                Country
                <div class="resize-handle"></div>
              </th>
              <th class="sortable resizable" data-sort="destination">
                Destination
                <div class="resize-handle"></div>
              </th>
              <th class="sortable resizable" data-sort="category">
                Category
                <div class="resize-handle"></div>
              </th>
              <th class="sortable resizable" data-sort="description">
                Description
                <div class="resize-handle"></div>
              </th>
              <th class="sortable numeric resizable" data-sort="amount">
                Amount (USD)
                <div class="resize-handle"></div>
              </th>
              <th class="resizable">
                Currency
                <div class="resize-handle"></div>
              </th>
              <th class="sortable resizable" data-sort="date">
                Date
                <div class="resize-handle"></div>
              </th>
              <th class="sortable resizable" data-sort="status">
                Status
                <div class="resize-handle"></div>
              </th>
              <th class="resizable">
                Notes
                <div class="resize-handle"></div>
              </th>
              <th class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody id="bulk-edit-tbody">
            ${this.costs.length === 0 ? '<tr><td colspan="12" class="empty-state">No costs to display</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render table rows
   */
  renderTableRows(filteredCosts = this.costs) {
    const tbody = document.getElementById('bulk-edit-tbody');
    if (!tbody) return;

    if (filteredCosts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" class="empty-state">No costs match the filters</td></tr>';
      this.attachRowEventListeners();
      return;
    }

    // Apply sorting if sortColumn is set
    let sortedCosts = [...filteredCosts];
    if (this.sortColumn) {
      sortedCosts = this.sortCosts(sortedCosts, this.sortColumn, this.sortDirection);
    } else {
      // Default sort by destination, then date
      sortedCosts.sort((a, b) => {
        const destA = this.getDestinationName(a.destination_id);
        const destB = this.getDestinationName(b.destination_id);
        const destCompare = destA.localeCompare(destB);
        if (destCompare !== 0) return destCompare;
        return (a.date || '').localeCompare(b.date || '');
      });
    }

    tbody.innerHTML = sortedCosts.map(cost => this.createTableRow(cost)).join('');

    // Attach event listeners
    this.attachRowEventListeners();
  }

  /**
   * Sort costs by column
   */
  sortCosts(costs, column, direction = 'asc') {
    return [...costs].sort((a, b) => {
      let aVal, bVal;

      switch (column) {
        case 'category':
          aVal = a.category || '';
          bVal = b.category || '';
          break;
        case 'description':
          aVal = a.description || '';
          bVal = b.description || '';
          break;
        case 'amount':
          aVal = a.amount_usd || a.amount || 0;
          bVal = b.amount_usd || b.amount || 0;
          break;
        case 'date':
          aVal = a.date || '';
          bVal = b.date || '';
          break;
        case 'destination':
          aVal = this.getDestinationName(a.destination_id);
          bVal = this.getDestinationName(b.destination_id);
          break;
        case 'country':
          aVal = this.getDestinationCountry(a.destination_id);
          bVal = this.getDestinationCountry(b.destination_id);
          break;
        case 'region':
          aVal = this.getDestinationRegion(a.destination_id);
          bVal = this.getDestinationRegion(b.destination_id);
          break;
        case 'status':
          aVal = a.booking_status || a.bookingStatus || '';
          bVal = b.booking_status || b.bookingStatus || '';
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const compare = aVal.toString().localeCompare(bVal.toString());
      return direction === 'asc' ? compare : -compare;
    });
  }

  /**
   * Get destination name from ID
   */
  getDestinationName(destinationId) {
    if (!destinationId) return '—';
    const dest = this.destinations.find(d => d.id === destinationId);
    return dest ? (dest.name || dest.city || '—') : '—';
  }

  /**
   * Get destination country from ID
   */
  getDestinationCountry(destinationId) {
    if (!destinationId) return '—';
    const dest = this.destinations.find(d => d.id === destinationId);
    return dest ? (dest.country || '—') : '—';
  }

  /**
   * Get destination region from ID
   */
  getDestinationRegion(destinationId) {
    if (!destinationId) return '—';
    const dest = this.destinations.find(d => d.id === destinationId);
    return dest ? (dest.region || '—') : '—';
  }

  /**
   * Format currency
   */
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Create a single table row
   */
  createTableRow(cost) {
    const isSelected = this.selectedCostIds.has(cost.id);
    const isEdited = this.editedCosts.has(cost.id);
    const displayCost = isEdited ? this.editedCosts.get(cost.id) : cost;

    const categories = ['flight', 'accommodation', 'activity', 'food', 'transport', 'other'];
    const statuses = ['estimated', 'researched', 'booked', 'paid'];
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'BRL', 'ARS', 'IDR', 'PHP', 'SGD', 'MYR', 'TWD', 'KRW', 'NPR'];

    const country = this.getDestinationCountry(displayCost.destination_id);
    const region = this.getDestinationRegion(displayCost.destination_id);

    return `
      <tr class="bulk-edit-row ${isSelected ? 'selected' : ''} ${isEdited ? 'edited' : ''}" data-cost-id="${cost.id}">
        <td class="checkbox-col">
          <input type="checkbox" class="row-checkbox" ${isSelected ? 'checked' : ''}>
        </td>
        <td class="readonly-cell region-cell">${this.escapeHtml(region)}</td>
        <td class="readonly-cell country-cell">${this.escapeHtml(country)}</td>
        <td class="editable-cell destination-cell">
          <select class="inline-edit" data-field="destination_id">
            <option value="">—</option>
            ${this.destinations.map(dest => `<option value="${dest.id}" ${displayCost.destination_id === dest.id ? 'selected' : ''}>${this.escapeHtml(dest.name || dest.city || 'Unknown')}</option>`).join('')}
          </select>
        </td>
        <td class="editable-cell category-cell">
          <select class="inline-edit" data-field="category">
            ${categories.map(cat => `<option value="${cat}" ${displayCost.category === cat ? 'selected' : ''}>${this.getCategoryIcon(cat)} ${this.capitalize(cat)}</option>`).join('')}
          </select>
        </td>
        <td class="editable-cell">
          <input type="text" class="inline-edit" data-field="description" value="${this.escapeHtml(displayCost.description || '')}" placeholder="Description">
        </td>
        <td class="editable-cell numeric">
          <input type="number" class="inline-edit" data-field="amount" value="${displayCost.amount_usd || displayCost.amount || 0}" step="0.01" min="0">
        </td>
        <td class="readonly-cell" style="color: #666; font-size: 12px;">
          USD
        </td>
        <td class="editable-cell">
          <input type="date" class="inline-edit" data-field="date" value="${displayCost.date || ''}">
        </td>
        <td class="editable-cell">
          <select class="inline-edit" data-field="booking_status">
            ${statuses.map(status => `<option value="${status}" ${(displayCost.booking_status || displayCost.bookingStatus || 'estimated') === status ? 'selected' : ''}>${this.capitalize(status)}</option>`).join('')}
          </select>
        </td>
        <td class="editable-cell notes-cell">
          <textarea class="inline-edit auto-resize" data-field="notes" placeholder="Notes...">${this.escapeHtml(displayCost.notes || '')}</textarea>
        </td>
        <td class="actions-col">
          <button class="btn-icon delete-row-btn" title="Delete" data-cost-id="${cost.id}">🗑️</button>
        </td>
      </tr>
    `;
  }

  /**
   * Attach event listeners to table rows
   */
  attachRowEventListeners() {
    const table = document.getElementById('bulk-edit-table');
    if (!table) return;

    const container = table.closest('.bulk-edit-modal') || document;

    if (!this.resizeHandlersInitialized) {
      this.setupColumnResizing(container);
    }

    const regionSelect = container.querySelector('#filter-region');
    if (regionSelect) {
      this.updateCountryFilterOptions(regionSelect.value, container);
    }

    const refreshedCountrySelect = container.querySelector('#filter-country');
    const regionValue = regionSelect?.value || 'all';
    const countryValue = refreshedCountrySelect?.value || 'all';
    this.updateDestinationFilterOptions(regionValue, countryValue, container);

    this.applyColumnWidths(container);

    // Select all checkbox
    const selectAllCheckbox = container.querySelector('#select-all-checkbox');
    if (selectAllCheckbox && selectAllCheckbox.dataset.bound !== 'true') {
      selectAllCheckbox.dataset.bound = 'true';
      selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const visibleRows = table.querySelectorAll('.bulk-edit-row:not([style*="display: none"])');
        visibleRows.forEach(row => {
          const costId = row.dataset.costId;
          const checkbox = row.querySelector('.row-checkbox');
          if (checkbox) {
            checkbox.checked = isChecked;
            if (isChecked) {
              this.selectedCostIds.add(costId);
              row.classList.add('selected');
            } else {
              this.selectedCostIds.delete(costId);
              row.classList.remove('selected');
            }
          }
        });
        this.updateSelectionCount();
      });
    }

    // Row checkboxes
    table.querySelectorAll('.row-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const row = e.target.closest('.bulk-edit-row');
        const costId = row.dataset.costId;
        if (e.target.checked) {
          this.selectedCostIds.add(costId);
          row.classList.add('selected');
        } else {
          this.selectedCostIds.delete(costId);
          row.classList.remove('selected');
        }
        this.updateSelectionCount();
      });
    });

    // Inline edits
    table.querySelectorAll('.inline-edit').forEach(input => {
      input.addEventListener('change', (e) => {
        const row = e.target.closest('.bulk-edit-row');
        const costId = row.dataset.costId;
        const field = e.target.dataset.field;
        const value = e.target.value;

        this.updateCostField(costId, field, value);
        row.classList.add('edited');

        if (field === 'destination_id') {
          this.updateRowDestinationFields(row, value);
        }
      });
    });

    // Delete row buttons
    table.querySelectorAll('.delete-row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const costId = e.target.dataset.costId;
        if (confirm('Are you sure you want to delete this cost?')) {
          this.deleteCost(costId, container);
        }
      });
    });

    // Delete selected button
    const deleteSelectedBtn = container.querySelector('#delete-selected-btn');
    if (deleteSelectedBtn && deleteSelectedBtn.dataset.bound !== 'true') {
      deleteSelectedBtn.dataset.bound = 'true';
      deleteSelectedBtn.addEventListener('click', () => {
        if (this.selectedCostIds.size === 0) return;
        if (confirm(`Are you sure you want to delete ${this.selectedCostIds.size} selected cost(s)?`)) {
          this.deleteSelectedCosts(container);
        }
      });
    }

    // Filters
    container.querySelectorAll('.bulk-filter').forEach(filter => {
      if (filter.dataset.bound === 'true') return;
      filter.dataset.bound = 'true';
      filter.addEventListener('change', () => {
        if (filter.id === 'filter-region') {
          this.updateCountryFilterOptions(filter.value, container);
          const currentCountry = container.querySelector('#filter-country')?.value || 'all';
          this.updateDestinationFilterOptions(filter.value, currentCountry, container);
        } else if (filter.id === 'filter-country') {
          const currentRegion = container.querySelector('#filter-region')?.value || 'all';
          this.updateDestinationFilterOptions(currentRegion, filter.value, container);
        }
        this.applyFilters();
      });
    });

    // Column sorting
    table.querySelectorAll('th.sortable').forEach(th => {
      if (th.dataset.bound === 'true') return;
      th.dataset.bound = 'true';
      th.addEventListener('click', () => {
        const column = th.dataset.sort;
        if (this.sortColumn === column) {
          // Toggle direction
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumn = column;
          this.sortDirection = 'asc';
        }

        // Update sort indicators
        container.querySelectorAll('th.sortable').forEach(header => {
          header.classList.remove('sort-asc', 'sort-desc');
        });
        th.classList.add(`sort-${this.sortDirection}`);

        // Re-render with new sort
        this.renderTableRows();
      });
    });

    // Auto-resize textareas
    table.querySelectorAll('textarea.auto-resize').forEach(textarea => {
      const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      };

      // Initial resize
      autoResize();

      // Resize on input
      textarea.addEventListener('input', autoResize);
    });
  }

  /**
   * Update derived region/country cells when destination changes
   */
  updateRowDestinationFields(row, destinationId) {
    const countryCell = row.querySelector('.country-cell');
    const regionCell = row.querySelector('.region-cell');

    if (countryCell) {
      countryCell.textContent = this.getDestinationCountry(destinationId);
    }

    if (regionCell) {
      regionCell.textContent = this.getDestinationRegion(destinationId);
    }
  }

  /**
   * Update cost field in memory
   */
  updateCostField(costId, field, value) {
    const cost = this.costs.find(c => c.id === costId);
    if (!cost) return;

    // Get or create edited copy
    let editedCost = this.editedCosts.get(costId);
    if (!editedCost) {
      editedCost = { ...cost };
      this.editedCosts.set(costId, editedCost);
    }

    // Update field
    editedCost[field] = value;

    // Special handling: if amount changes, also update amount_usd
    if (field === 'amount') {
      editedCost.amount_usd = parseFloat(value) || 0;
      console.log(`💰 Updated amount: ${value} → amount_usd: ${editedCost.amount_usd}`);
    }

    // Update change indicator
    const saveBtn = document.getElementById('bulk-save-btn');
    if (saveBtn) {
      saveBtn.textContent = `Save ${this.editedCosts.size} Change${this.editedCosts.size !== 1 ? 's' : ''}`;
      saveBtn.classList.add('btn-warning');
    }
  }

  /**
   * Update selection count display
   */
  updateSelectionCount() {
    const countEl = document.querySelector('.selection-count');
    const deleteBtn = document.querySelector('#delete-selected-btn');

    if (countEl) {
      countEl.textContent = `${this.selectedCostIds.size} selected`;
    }

    if (deleteBtn) {
      deleteBtn.disabled = this.selectedCostIds.size === 0;
    }
  }

  /**
   * Apply filters to table
   */
  applyFilters() {
    const categoryFilter = document.getElementById('filter-category')?.value || 'all';
    const statusFilter = document.getElementById('filter-status')?.value || 'all';
    const regionFilter = document.getElementById('filter-region')?.value || 'all';
    const countryFilter = document.getElementById('filter-country')?.value || 'all';
    const destinationFilter = document.getElementById('filter-destination')?.value || 'all';

    const filteredCosts = this.costs.filter(cost => {
      if (categoryFilter !== 'all' && cost.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && (cost.booking_status || cost.bookingStatus) !== statusFilter) return false;
      if (regionFilter !== 'all') {
        const normalizedRegion = this.normalizeFilterValue(this.getDestinationRegion(cost.destination_id));
        if (normalizedRegion !== regionFilter) return false;
      }
      if (countryFilter !== 'all') {
        const normalizedCountry = this.normalizeFilterValue(this.getDestinationCountry(cost.destination_id));
        if (normalizedCountry !== countryFilter) return false;
      }
      const costDestinationId = cost.destination_id != null ? String(cost.destination_id) : '';
      if (destinationFilter === '__none__') {
        if (costDestinationId) return false;
      } else if (destinationFilter !== 'all' && costDestinationId !== destinationFilter) {
        return false;
      }
      return true;
    });

    this.renderTableRows(filteredCosts);
  }

  /**
   * Save all changes to backend
   */
  async saveAllChanges(modal) {
    if (this.editedCosts.size === 0) {
      alert('No changes to save');
      return;
    }

    const saveBtn = modal.querySelector('#bulk-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const updates = Array.from(this.editedCosts.values());

      await this.bulkUpdateCosts(updates);

      // Clear edited state
      this.editedCosts.clear();

      // Refresh display - add a flag so inline edit doesn't re-save
      window.dispatchEvent(new CustomEvent('costs-updated', {
        detail: { source: 'bulk-edit', skipInlineEditSave: true }
      }));

      // Close modal
      modal.remove();

      alert(`Successfully saved ${updates.length} change${updates.length !== 1 ? 's' : ''}!`);
    } catch (error) {
      console.error('Failed to save changes:', error);
      alert(`Failed to save changes: ${error.message}`);
      saveBtn.disabled = false;
      saveBtn.textContent = `Save ${this.editedCosts.size} Change${this.editedCosts.size !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Delete a single cost
   */
  async deleteCost(costId, modal) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/costs/${costId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: this.sessionId || 'default' })
      });

      if (!response.ok) {
        throw new Error(`Failed to delete cost: ${response.statusText}`);
      }

      // Remove from local state
      this.costs = this.costs.filter(c => c.id !== costId);
      this.editedCosts.delete(costId);
      this.selectedCostIds.delete(costId);

      // Re-render table
      this.applyFilters();
      this.updateSelectionCount();

      // Trigger refresh
      window.dispatchEvent(new CustomEvent('costs-updated'));
    } catch (error) {
      console.error('Failed to delete cost:', error);
      alert(`Failed to delete cost: ${error.message}`);
    }
  }

  /**
   * Delete selected costs
   */
  async deleteSelectedCosts(modal) {
    const deletePromises = Array.from(this.selectedCostIds).map(costId =>
      this.deleteCost(costId, modal)
    );

    try {
      await Promise.all(deletePromises);
      alert(`Successfully deleted ${deletePromises.length} cost${deletePromises.length !== 1 ? 's' : ''}!`);
    } catch (error) {
      console.error('Failed to delete some costs:', error);
      alert('Some costs could not be deleted. Please try again.');
    }
  }

  /**
   * Fetch costs from API
   */
  async fetchCosts() {
    console.log('🔍 fetchCosts called with sessionId:', this.sessionId);

    const params = new URLSearchParams({
      session_id: this.sessionId || 'default'
    });

    const response = await fetch(`${this.apiBaseUrl}/api/costs?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch costs: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('📦 fetchCosts response:', {
      costsCount: result.costs?.length,
      costIds: result.costs?.map(c => c.id).slice(0, 5)
    });
    return result.costs || [];
  }

  /**
   * Bulk update costs via API
   */
  async bulkUpdateCosts(costs) {
    console.log('🔧 bulkUpdateCosts called with:', {
      sessionId: this.sessionId,
      costsCount: costs.length,
      costIds: costs.map(c => c.id)
    });

    const response = await fetch(`${this.apiBaseUrl}/api/costs/bulk-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: this.sessionId || 'default',
        costs: costs
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Bulk update failed:', response.status, errorText);
      throw new Error(`Failed to update costs: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Bulk update response:', result);

    // Verify the update succeeded
    if (result.updated_count > 0) {
      console.log(`✅ Server confirmed ${result.updated_count} cost(s) were updated`);
      console.log(`   Total costs in database: ${result.total_costs}`);
    } else {
      console.warn('⚠️ Server reported 0 costs were updated - changes may not have been saved!');
    }

    return result;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  getCategoryIcon(category) {
    const icons = {
      flight: '✈️',
      accommodation: '🏨',
      activity: '🎯',
      food: '🍽️',
      transport: '🚗',
      other: '📌'
    };
    return icons[category] || '📌';
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Enable column resizing via resize handles
   */
  setupColumnResizing(container) {
    const table = container.querySelector('#bulk-edit-table');
    if (!table) return;

    const headers = table.querySelectorAll('thead th.resizable');

    headers.forEach((th, index) => {
      const handle = th.querySelector('.resize-handle');
      if (!handle || handle.dataset.bound === 'true') return;

      handle.dataset.bound = 'true';
      handle.addEventListener('click', (event) => event.stopPropagation());

      handle.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const startX = event.pageX;
        const startWidth = th.offsetWidth;
        const columnIndex = index;
        const minWidth = th.classList.contains('checkbox-col') ? 40 : 80;
        const initialCursor = document.body.style.cursor;
        const initialUserSelect = document.body.style.userSelect;

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        handle.classList.add('resizing');

        const onMouseMove = (moveEvent) => {
          const delta = moveEvent.pageX - startX;
          const newWidth = Math.max(minWidth, startWidth + delta);
          this.columnWidths.set(columnIndex, newWidth);
          if (table.style.tableLayout !== 'fixed') {
            table.style.tableLayout = 'fixed';
          }
          this.applyColumnWidths(container);
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.body.style.cursor = initialCursor;
          document.body.style.userSelect = initialUserSelect;
          handle.classList.remove('resizing');
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    this.resizeHandlersInitialized = true;
  }

  /**
   * Apply stored column widths across header and rows
   */
  applyColumnWidths(container = document) {
    const table = container?.querySelector('#bulk-edit-table');
    if (!table) return;

    table.style.tableLayout = this.columnWidths.size > 0 ? 'fixed' : '';

    this.columnWidths.forEach((width, columnIndex) => {
      const headerCell = table.querySelector(`thead th:nth-child(${columnIndex + 1})`);
      if (headerCell) {
        headerCell.style.width = `${width}px`;
        headerCell.style.minWidth = `${width}px`;
      }

      table.querySelectorAll(`tbody td:nth-child(${columnIndex + 1})`).forEach(cell => {
        cell.style.width = `${width}px`;
        cell.style.minWidth = `${width}px`;
      });
    });
  }

  /**
   * Refresh available country filter options when region changes
   */
  updateCountryFilterOptions(regionValue = 'all', container = document) {
    const countrySelect = container.querySelector('#filter-country');
    if (!countrySelect) return;

    const previousValue = countrySelect.value;
    const countries = this.getUniqueCountries(regionValue);

    countrySelect.innerHTML = [
      '<option value="all">All Countries</option>',
      ...countries.map(({ value, label }) => `<option value="${this.escapeHtml(value)}">${this.escapeHtml(label)}</option>`)
    ].join('');

    const hasPrevious = countries.some(country => country.value === previousValue);
    countrySelect.value = hasPrevious ? previousValue : 'all';
  }

  /**
   * Refresh destination filter options based on region/country selections
   */
  updateDestinationFilterOptions(regionValue = 'all', countryValue = 'all', container = document) {
    const destinationSelect = container.querySelector('#filter-destination');
    if (!destinationSelect) return;

    const previousValue = destinationSelect.value;
    const normalizedRegion = regionValue;
    const normalizedCountry = countryValue;

    const matchingDestinations = this.destinations.filter(dest => {
      const destRegion = this.normalizeFilterValue(dest.region);
      if (normalizedRegion !== 'all' && destRegion !== normalizedRegion) return false;

      const destCountry = this.normalizeFilterValue(dest.country);
      if (normalizedCountry !== 'all' && destCountry !== normalizedCountry) return false;

      return dest.id != null && `${dest.id}`.trim().length > 0;
    });

    const destinationOptions = matchingDestinations.map(dest => {
      const destId = `${dest.id}`.trim();
      const label = dest.name || dest.city || 'Unknown';
      return `<option value="${this.escapeHtml(destId)}">${this.escapeHtml(label)}</option>`;
    }).join('');

    const hasUnassignedCosts = this.hasUnassignedDestinationCosts();
    const unassignedOption = hasUnassignedCosts ? '<option value="__none__">Unassigned</option>' : '';

    destinationSelect.innerHTML = [
      '<option value="all">All Destinations</option>',
      destinationOptions,
      unassignedOption
    ].join('');

    const isPreviousValid =
      matchingDestinations.some(dest => `${dest.id}`.trim() === previousValue) ||
      (previousValue === '__none__' && hasUnassignedCosts);

    destinationSelect.value = isPreviousValid ? previousValue : 'all';
  }

  /**
   * Gather unique regions for filter dropdown
   */
  getUniqueRegions() {
    const regions = new Map();

    this.destinations.forEach(dest => {
      const rawRegion = dest.region != null ? String(dest.region).trim() : '';
      const value = this.normalizeFilterValue(rawRegion);
      const label = rawRegion ? rawRegion : 'Unassigned';
      if (!regions.has(value)) {
        regions.set(value, label);
      }
    });

    const hasUnassignedCosts = this.hasUnassignedDestinationCosts();

    if (!regions.has('__none__') && hasUnassignedCosts) {
      regions.set('__none__', 'Unassigned');
    }

    return Array.from(regions.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Gather unique countries for filter dropdown, optionally filtered by region
   */
  getUniqueCountries(regionValue = 'all') {
    const countries = new Map();
    const targetRegion = regionValue;

    this.destinations.forEach(dest => {
      const rawRegion = dest.region != null ? String(dest.region).trim() : '';
      const destinationRegion = this.normalizeFilterValue(rawRegion);
      if (targetRegion !== 'all' && destinationRegion !== targetRegion) {
        return;
      }

      const rawCountry = dest.country != null ? String(dest.country).trim() : '';
      const value = this.normalizeFilterValue(rawCountry);
      const label = rawCountry ? rawCountry : 'Unassigned';

      if (!countries.has(value)) {
        countries.set(value, label);
      }
    });

    const hasUnassignedCosts = this.hasUnassignedDestinationCosts();

    if (!countries.has('__none__') && hasUnassignedCosts) {
      countries.set('__none__', 'Unassigned');
    }

    return Array.from(countries.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Determine if any costs lack a destination mapping
   */
  hasUnassignedDestinationCosts() {
    return this.costs.some(cost => {
      const costDestId = cost.destination_id;
      if (costDestId === undefined || costDestId === null || `${costDestId}`.trim().length === 0) {
        return true;
      }

      const normalizedCostId = `${costDestId}`.trim();
      return !this.destinations.some(dest => {
        if (dest.id === undefined || dest.id === null) return false;
        return `${dest.id}`.trim() === normalizedCostId;
      });
    });
  }

  /**
   * Normalize filter display values to stable keys
   */
  normalizeFilterValue(value) {
    if (value === undefined || value === null) return '__none__';
    const trimmed = value.toString().trim();
    if (!trimmed || trimmed === '—') {
      return '__none__';
    }
    return trimmed;
  }
}

// Make available globally for use in other pages
if (typeof window !== 'undefined') {
  window.CostBulkEdit = CostBulkEdit;
}

// Export for use in CommonJS modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CostBulkEdit };
}
