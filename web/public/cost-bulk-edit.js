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
    this.columnWidths = new Map();
    this.resizeHandlersInitialized = false;
    this.saveTimeouts = new Map(); // For debouncing auto-saves


    // Default visible columns
    this.allColumns = [
      { id: 'checkbox', label: '', alwaysVisible: true },
      { id: 'region', label: 'Continent' },
      { id: 'country', label: 'Country' },
      { id: 'destination', label: 'Destination' },
      { id: 'category', label: 'Category' },
      { id: 'modality', label: 'Modality' },
      { id: 'description', label: 'Description' },
      { id: 'amount', label: 'Amount (USD)' },
      { id: 'currency', label: 'Currency' },
      { id: 'date', label: 'Date' },
      { id: 'status', label: 'Status' },
      { id: 'notes', label: 'Notes' },
      { id: 'actions', label: 'Actions', alwaysVisible: true }
    ];

    // Load visible columns from localStorage or default to all
    const savedColumns = localStorage.getItem('costManagerVisibleColumns');
    if (savedColumns) {
      this.visibleColumns = new Set(JSON.parse(savedColumns));
    } else {
      this.visibleColumns = new Set(this.allColumns.map(c => c.id));
    }

    // Load saved filters
    this.savedFilters = this.loadFilterPreferences();
  }

  /**
   * Load filter preferences from localStorage
   */
  loadFilterPreferences() {
    try {
      const saved = localStorage.getItem('costManagerFilters');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn('Failed to load filter preferences:', e);
      return {};
    }
  }

  /**
   * Save filter preferences to localStorage
   */
  saveFilterPreferences() {
    const container = this.container || document;
    const filters = {
      category: container.querySelector('#filter-category')?.value || 'all',
      status: container.querySelector('#filter-status')?.value || 'all',
      region: container.querySelector('#filter-region')?.value || 'all',
      country: container.querySelector('#filter-country')?.value || 'all',
      destination: container.querySelector('#filter-destination')?.value || 'all',
      scope: container.querySelector('#filter-transport-scope')?.value || 'all'
    };
    localStorage.setItem('costManagerFilters', JSON.stringify(filters));
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

      // Apply saved filters initially
      this.applyFilters();

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
        .bulk-edit-table-container {
          overflow-x: auto;
        }
        .actions-col {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 2px;
          white-space: nowrap;
          width: 260px !important;
          min-width: 260px !important;
        }
        .actions-col .btn-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 2px 4px;
          width: 28px;
          height: 28px;
        }
        .country-cell, .destination-cell, .category-cell {
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .description-cell {
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bulk-edit-table tfoot {
          background-color: #f8f9fa;
          font-weight: bold;
          border-top: 2px solid #dee2e6;
        }
        .bulk-edit-table tfoot td {
          padding: 12px 8px;
        }
      </style>
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
            ${categories.map(cat => `<option value="${cat}" ${this.savedFilters.category === cat ? 'selected' : ''}>${cat === 'all' ? 'All Categories' : this.getCategoryIcon(cat) + ' ' + this.capitalize(cat)}</option>`).join('')}
          </select>
          <select id="filter-status" class="bulk-filter">
            ${statuses.map(status => `<option value="${status}" ${this.savedFilters.status === status ? 'selected' : ''}>${status === 'all' ? 'All Statuses' : this.capitalize(status)}</option>`).join('')}
          </select>
          <select id="filter-region" class="bulk-filter">
            <option value="all">All Continents</option>
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
          <select id="filter-transport-scope" class="bulk-filter">
            <option value="all" ${this.savedFilters.scope === 'all' ? 'selected' : ''}>All Scopes</option>
            <option value="inter-destination" ${this.savedFilters.scope === 'inter-destination' ? 'selected' : ''}>Inter-destination</option>
            <option value="local" ${this.savedFilters.scope === 'local' ? 'selected' : ''}>Local</option>
          </select>
          
          <!-- Column Visibility Dropdown -->
          <div class="dropdown" style="position: relative; display: inline-block;">
            <button class="btn btn-sm btn-secondary dropdown-toggle" id="columns-dropdown-btn">
              👁️ Columns
            </button>
            <div class="dropdown-menu" id="columns-dropdown-menu" style="display: none; position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ccc; border-radius: 4px; padding: 8px; z-index: 1000; min-width: 150px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
              ${this.allColumns.filter(c => !c.alwaysVisible).map(col => `
                <div style="margin-bottom: 4px;">
                  <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" class="column-toggle" data-column="${col.id}" ${this.visibleColumns.has(col.id) ? 'checked' : ''} style="margin-right: 8px;">
                    ${col.label}
                  </label>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="bulk-edit-actions">
          <span class="selection-count">0 selected</span>
          <button class="btn btn-sm btn-primary" id="export-csv-btn">📥 Export CSV</button>
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
              ${this.visibleColumns.has('region') ? `
              <th class="sortable resizable" data-sort="region">
                Continent
                <div class="resize-handle"></div>
              </th>` : ''}
              ${this.visibleColumns.has('country') ? `
              <th class="sortable resizable" data-sort="country">
                Country
                <div class="resize-handle"></div>
              </th>` : ''}
              ${this.visibleColumns.has('destination') ? `
              <th class="sortable resizable" data-sort="destination">
                Destination
                <div class="resize-handle"></div>
              </th>` : ''}
              ${this.visibleColumns.has('category') ? `
              <th class="sortable resizable" data-sort="category">
                Category
                <div class="resize-handle"></div>
              </th>` : ''}
              ${this.visibleColumns.has('modality') ? `
              <th class="sortable resizable" data-sort="modality">
                Modality
                <div class="resize-handle"></div>
              </th>` : ''}
              ${this.visibleColumns.has('description') ? `
              <th class="sortable resizable" data-sort="description">
                Description
                <div class="resize-handle"></div>
              </th>` : ''}
              ${this.visibleColumns.has('amount') ? `
              <th class="sortable numeric resizable" data-sort="amount">
                Amount (USD)
                <div class="resize-handle"></div>
              </th>` : ''}
              ${this.visibleColumns.has('currency') ? `
              <th class="resizable">
                Currency
                <div class="resize-handle"></div>
              </th>` : ''}
              ${this.visibleColumns.has('date') ? `
              <th class="sortable resizable" data-sort="date">
                Date
                <div class="resize-handle"></div>
              </th>` : ''}
              ${this.visibleColumns.has('status') ? `
              <th class="sortable resizable" data-sort="status">
                Status
                <div class="resize-handle"></div>
              </th>` : ''}
              ${this.visibleColumns.has('notes') ? `
              <th class="resizable">
                Notes
                <div class="resize-handle"></div>
              </th>` : ''}
              <th class="actions-col resizable">
                Actions
                <div class="resize-handle"></div>
              </th>
            </tr>
          </thead>
          <tbody id="bulk-edit-tbody">
            ${this.costs.length === 0 ? '<tr><td colspan="12" class="empty-state">No costs to display</td></tr>' : ''}
          </tbody>
          <tfoot id="bulk-edit-tfoot">
            <!-- Totals will be injected here -->
          </tfoot>
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

    // Update totals
    this.updateTotals(filteredCosts);
  }

  /**
   * Update totals footer
   */
  updateTotals(costs) {
    const tfoot = document.getElementById('bulk-edit-tfoot');
    if (!tfoot) return;

    const totalAmount = Math.round(costs.reduce((sum, cost) => sum + (cost.amount_usd || cost.amount || 0), 0));

    // Create a row that matches the visible columns
    let html = '<tr>';

    // Checkbox col
    html += '<td></td>';

    // Add cells for visible columns
    if (this.visibleColumns.has('region')) html += '<td></td>';
    if (this.visibleColumns.has('country')) html += '<td></td>';
    if (this.visibleColumns.has('destination')) html += '<td></td>';
    if (this.visibleColumns.has('category')) html += '<td></td>';
    if (this.visibleColumns.has('modality')) html += '<td></td>';
    if (this.visibleColumns.has('description')) html += '<td style="text-align: right;">Total:</td>';

    if (this.visibleColumns.has('amount')) {
      html += `<td class="numeric">${this.formatCurrency(totalAmount)}</td>`;
    }

    if (this.visibleColumns.has('currency')) html += '<td></td>';
    if (this.visibleColumns.has('date')) html += '<td></td>';
    if (this.visibleColumns.has('status')) html += '<td></td>';
    if (this.visibleColumns.has('notes')) html += '<td></td>';

    // Actions col
    html += '<td></td>';

    html += '</tr>';
    tfoot.innerHTML = html;
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
        case 'modality':
          aVal = a.modality || '';
          bVal = b.modality || '';
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
   * Returns continent if available, otherwise region
   */
  getDestinationRegion(destinationId) {
    if (!destinationId) return '—';
    const dest = this.destinations.find(d => d.id === destinationId);
    if (!dest) return '—';
    return dest.continent || dest.region || '—';
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
        ${this.visibleColumns.has('region') ? `<td class="readonly-cell region-cell">${this.escapeHtml(region)}</td>` : ''}
        ${this.visibleColumns.has('country') ? `<td class="readonly-cell country-cell">${this.escapeHtml(country)}</td>` : ''}
        ${this.visibleColumns.has('destination') ? `
        <td class="editable-cell destination-cell">
          <select class="inline-edit" data-field="destination_id">
            <option value="">—</option>
            ${this.destinations.map(dest => `<option value="${dest.id}" ${displayCost.destination_id === dest.id ? 'selected' : ''}>${this.escapeHtml(dest.name || dest.city || 'Unknown')}</option>`).join('')}
          </select>
        </td>` : ''}
        ${this.visibleColumns.has('category') ? `
        <td class="editable-cell category-cell">
          <select class="inline-edit" data-field="category">
            ${categories.map(cat => `<option value="${cat}" ${displayCost.category === cat ? 'selected' : ''}>${this.getCategoryIcon(cat)} ${this.capitalize(cat)}</option>`).join('')}
          </select>
        </td>` : ''}
        ${this.visibleColumns.has('modality') ? `
        <td class="readonly-cell modality-cell" style="text-align: center;">
          ${this.getModalityIcon(displayCost.modality)}
        </td>` : ''}
        ${this.visibleColumns.has('description') ? `
        <td class="editable-cell description-cell">
          <input type="text" class="inline-edit" data-field="description" value="${this.escapeHtml(displayCost.description || '')}" placeholder="Description">
        </td>` : ''}
        ${this.visibleColumns.has('amount') ? `
        <td class="editable-cell numeric">
          <input type="number" class="inline-edit" data-field="amount" value="${Math.round(displayCost.amount_usd || displayCost.amount || 0)}" step="1" min="0">
        </td>` : ''}
        ${this.visibleColumns.has('currency') ? `
        <td class="readonly-cell" style="color: #666; font-size: 12px;">
          USD
        </td>` : ''}
        ${this.visibleColumns.has('date') ? `
        <td class="editable-cell">
          <input type="date" class="inline-edit" data-field="date" value="${displayCost.date || ''}">
        </td>` : ''}
        ${this.visibleColumns.has('status') ? `
        <td class="editable-cell">
          <select class="inline-edit" data-field="booking_status">
            ${statuses.map(status => `<option value="${status}" ${(displayCost.booking_status || displayCost.bookingStatus || 'estimated') === status ? 'selected' : ''}>${this.capitalize(status)}</option>`).join('')}
          </select>
        </td>` : ''}
        ${this.visibleColumns.has('notes') ? `
        <td class="editable-cell notes-cell">
          <textarea class="inline-edit auto-resize" data-field="notes" placeholder="Notes...">${this.escapeHtml(displayCost.notes || '')}</textarea>
        </td>` : ''}
        <td class="actions-col">
          ${cost._isTransportSegment ? `
            <button class="btn-icon research-transport-btn" title="AI Research" data-segment-id="${cost.id}">🤖</button>
            <button class="btn-icon edit-transport-btn" title="Edit Transport Details" data-segment-id="${cost.id}">✏️</button>
          ` : ''}
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

    // Find container for scoped lookups
    this.container = table.closest('.bulk-edit-content') || table.closest('.tab-panel') || document;

    const container = this.container; // Use the scoped container instead of document/modal lookup

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
      // Use 'input' for text/number/textarea to auto-save while typing (debounced)
      // Use 'change' for selects to save immediately on selection
      const eventType = (input.tagName === 'SELECT' || input.type === 'checkbox') ? 'change' : 'input';

      input.addEventListener(eventType, (e) => {
        const row = e.target.closest('.bulk-edit-row');
        const costId = row.dataset.costId;
        const field = e.target.dataset.field;
        const value = e.target.value;

        console.log(`📝 Field changed: ${field} = ${value} (Event: ${eventType})`);

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

    // Research Transport Buttons
    table.querySelectorAll('.research-transport-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const segmentId = btn.dataset.segmentId;
        console.log('🤖 Research transport clicked for segment:', segmentId);

        // Dispatch event for parent to handle
        const event = new CustomEvent('research-transport-segment', {
          detail: { segmentId }
        });
        window.dispatchEvent(event);
      });
    });

    // Edit transport buttons
    table.querySelectorAll('.edit-transport-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const segmentId = e.target.dataset.segmentId;
        console.log('✏️ Edit transport clicked for segment:', segmentId);
        window.dispatchEvent(new CustomEvent('edit-transport-segment', {
          detail: { segmentId: segmentId }
        }));
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

    // Export CSV button
    const exportCsvBtn = container.querySelector('#export-csv-btn');
    if (exportCsvBtn && exportCsvBtn.dataset.bound !== 'true') {
      exportCsvBtn.dataset.bound = 'true';
      exportCsvBtn.addEventListener('click', () => {
        this.exportToCSV();
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
        this.saveFilterPreferences();
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
        // Re-render with new sort (use applyFilters to maintain current filters)
        this.applyFilters();
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

    // Columns Dropdown Logic
    const columnsBtn = container.querySelector('#columns-dropdown-btn');
    const columnsMenu = container.querySelector('#columns-dropdown-menu');

    if (columnsBtn && !columnsBtn.dataset.bound) {
      columnsBtn.dataset.bound = 'true';
      columnsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = columnsMenu.style.display === 'block';
        columnsMenu.style.display = isVisible ? 'none' : 'block';
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!columnsBtn.contains(e.target) && !columnsMenu.contains(e.target)) {
          columnsMenu.style.display = 'none';
        }
      });
    }

    // Column Toggles
    container.querySelectorAll('.column-toggle').forEach(toggle => {
      if (toggle.dataset.bound) return;
      toggle.dataset.bound = 'true';
      toggle.addEventListener('change', (e) => {
        const columnId = e.target.dataset.column;
        this.toggleColumn(columnId, e.target.checked);
      });
    });
  }

  /**
   * Toggle column visibility
   */
  toggleColumn(columnId, isVisible) {
    if (isVisible) {
      this.visibleColumns.add(columnId);
    } else {
      this.visibleColumns.delete(columnId);
    }

    // Save to localStorage
    localStorage.setItem('costManagerVisibleColumns', JSON.stringify(Array.from(this.visibleColumns)));

    // Re-render table (full re-render needed to update headers and cells)
    const container = this.container || document;
    const tableContainer = container.querySelector('.bulk-edit-table-container');
    if (tableContainer) {
      // We need to rebuild the whole table structure to update headers
      tableContainer.outerHTML = this.createBulkEditTable();
      this.renderTableRows(); // This will re-attach listeners
    }
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
      editedCost.amount_usd = Math.round(parseFloat(value) || 0);
      editedCost.amount = editedCost.amount_usd; // Keep both in sync
      console.log(`💰 Updated amount: ${value} → amount_usd: ${editedCost.amount_usd}`);
    }

    // Update change indicator
    const saveBtn = document.getElementById('bulk-save-btn');
    if (saveBtn) {
      saveBtn.textContent = `Save ${this.editedCosts.size} Change${this.editedCosts.size !== 1 ? 's' : ''}`;
      saveBtn.classList.add('btn-warning');
    }

    // Trigger auto-save
    this.triggerAutoSave(costId);
  }

  /**
   * Trigger auto-save for a cost
   */
  triggerAutoSave(costId) {
    // Clear existing timeout
    if (this.saveTimeouts.has(costId)) {
      clearTimeout(this.saveTimeouts.get(costId));
    }

    // Set new timeout (1 second debounce)
    const timeoutId = setTimeout(() => {
      this.saveSingleCost(costId);
      this.saveTimeouts.delete(costId);
    }, 1000);

    this.saveTimeouts.set(costId, timeoutId);

    // Show saving indicator on the row
    const row = document.querySelector(`.bulk-edit-row[data-cost-id="${costId}"]`);
    if (row) {
      row.classList.add('saving');
    }
  }

  /**
   * Save a single cost
   */
  async saveSingleCost(costId) {
    const editedCost = this.editedCosts.get(costId);
    if (!editedCost) {
      console.warn(`⚠️ No edited cost found for ${costId}`);
      return;
    }

    console.log(`💾 Auto-saving cost ${costId}...`, {
      isTransport: editedCost._isTransportSegment,
      hasManager: !!window.transportSegmentManager,
      editedCost: { ...editedCost }
    });

    try {
      if (editedCost._isTransportSegment && window.transportSegmentManager) {
        console.log('🚌 Saving transport segment via manager...');
        // Map fields for transport segment
        const updates = {
          ...editedCost,
          cost: editedCost.amount_usd || editedCost.amount // Ensure cost is mapped
        };
        console.log('   Updates payload:', updates);
        await window.transportSegmentManager.updateSegment(costId, updates, this.sessionId);
        console.log('✅ Manager updateSegment completed');
      } else {
        console.log('💰 Saving regular cost via bulkUpdateCosts...');
        // Reuse bulk update endpoint but for single item
        await this.bulkUpdateCosts([editedCost]);
      }

      // Remove from edited map since it's saved
      this.editedCosts.delete(costId);

      // Update original cost in this.costs
      const index = this.costs.findIndex(c => c.id === costId);
      if (index !== -1) {
        this.costs[index] = { ...editedCost };
      }

      // Update UI
      const row = document.querySelector(`.bulk-edit-row[data-cost-id="${costId}"]`);
      if (row) {
        row.classList.remove('saving', 'edited');
        row.classList.add('saved');
        setTimeout(() => row.classList.remove('saved'), 2000);
      }

      // Update save button
      const saveBtn = document.getElementById('bulk-save-btn');
      if (saveBtn) {
        if (this.editedCosts.size === 0) {
          saveBtn.textContent = 'Save All Changes';
          saveBtn.classList.remove('btn-warning');
        } else {
          saveBtn.textContent = `Save ${this.editedCosts.size} Change${this.editedCosts.size !== 1 ? 's' : ''}`;
        }
      }

      // Refresh totals if amount changed
      this.updateTotals(this.costs); // Note: this might be expensive if we re-calc all, but safe for now

      console.log(`✅ Auto-save complete for ${costId}`);
    } catch (error) {
      console.error(`❌ Auto-save failed for ${costId}:`, error);
      const row = document.querySelector(`.bulk-edit-row[data-cost-id="${costId}"]`);
      if (row) row.classList.add('error');
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
    const container = this.container || document;
    const categoryFilter = container.querySelector('#filter-category')?.value || 'all';
    const statusFilter = container.querySelector('#filter-status')?.value || 'all';
    const regionFilter = container.querySelector('#filter-region')?.value || 'all';
    const countryFilter = container.querySelector('#filter-country')?.value || 'all';
    const destinationFilter = container.querySelector('#filter-destination')?.value || 'all';
    const scopeFilter = container.querySelector('#filter-transport-scope')?.value || 'all';

    console.log('🔍 applyFilters:', {
      category: categoryFilter,
      scope: scopeFilter,
      status: statusFilter,
      container: container === document ? 'document' : (container.className || 'element')
    });

    const filteredCosts = this.costs.filter(cost => {
      if (categoryFilter !== 'all' && cost.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && (cost.booking_status || cost.bookingStatus) !== statusFilter) return false;

      // Scope Filter
      if (scopeFilter !== 'all') {
        const isInterDestination = cost._isTransportSegment === true;
        if (scopeFilter === 'inter-destination' && !isInterDestination) return false;
        if (scopeFilter === 'local' && isInterDestination) return false;
      }

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

  /**
   * Export currently displayed costs to CSV
   */
  exportToCSV() {
    // Get currently filtered costs
    const container = this.container || document;
    const categoryFilter = container.querySelector('#filter-category')?.value || 'all';
    const statusFilter = container.querySelector('#filter-status')?.value || 'all';
    const regionFilter = container.querySelector('#filter-region')?.value || 'all';
    const countryFilter = container.querySelector('#filter-country')?.value || 'all';
    const destinationFilter = container.querySelector('#filter-destination')?.value || 'all';
    const scopeFilter = container.querySelector('#filter-transport-scope')?.value || 'all';

    const filteredCosts = this.costs.filter(cost => {
      if (categoryFilter !== 'all' && cost.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && (cost.booking_status || cost.bookingStatus) !== statusFilter) return false;

      if (scopeFilter !== 'all') {
        const isInterDestination = cost._isTransportSegment === true;
        if (scopeFilter === 'inter-destination' && !isInterDestination) return false;
        if (scopeFilter === 'local' && isInterDestination) return false;
      }

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

    // Apply sorting if active
    let sortedCosts = [...filteredCosts];
    if (this.sortColumn) {
      sortedCosts = this.sortCosts(sortedCosts, this.sortColumn, this.sortDirection);
    }

    // Define CSV headers
    const headers = [
      'Region',
      'Country',
      'Destination',
      'Category',
      'Modality',
      'Description',
      'Amount (USD)',
      'Currency',
      'Date',
      'Status',
      'Notes'
    ];

    // Convert costs to CSV rows
    const rows = sortedCosts.map(cost => {
      const region = this.getDestinationRegion(cost.destination_id);
      const country = this.getDestinationCountry(cost.destination_id);
      const destination = this.getDestinationName(cost.destination_id);
      const category = cost.category || '';
      const description = cost.description || '';
      const amount = cost.amount_usd || cost.amount || 0;
      const currency = 'USD';
      const date = cost.date || '';
      const status = cost.booking_status || cost.bookingStatus || 'estimated';
      const notes = cost.notes || '';

      return [
        region,
        country,
        destination,
        category,
        cost.modality || '',
        description,
        amount,
        currency,
        date,
        status,
        notes
      ];
    });

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => this.escapeCSVCell(cell)).join(','))
    ].join('\n');

    // Create blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `costs-export-${timestamp}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`✅ Exported ${sortedCosts.length} costs to ${filename}`);
  }

  /**
   * Escape CSV cell content to handle commas, quotes, and newlines
   */
  escapeCSVCell(cell) {
    const cellStr = String(cell);

    // If cell contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }

    return cellStr;
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

  getModalityIcon(modality) {
    if (!modality) return '';
    const icons = {
      'plane': '✈️',
      'train': '🚂',
      'car': '🚗',
      'bus': '🚌',
      'ferry': '🚢',
      'walking': '🚶',
      'local': '📍'
    };
    return icons[modality.toLowerCase()] || modality;
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
      const rawRegion = dest.continent != null ? String(dest.continent).trim() : (dest.region != null ? String(dest.region).trim() : '');
      const destRegion = this.normalizeFilterValue(rawRegion);
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
      const rawRegion = dest.continent != null ? String(dest.continent).trim() : (dest.region != null ? String(dest.region).trim() : '');
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
      const rawRegion = dest.continent != null ? String(dest.continent).trim() : (dest.region != null ? String(dest.region).trim() : '');
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
