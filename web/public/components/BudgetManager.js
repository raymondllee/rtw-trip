/**
 * Budget Manager UI Component (Recommendation J)
 * Provides integrated budget tracking, editing, and management interface
 */
import { calculateBudgetStatus, createDefaultBudget } from '../utils/budgetTracker';
export class BudgetManager {
    constructor(container, tripData, budget, onBudgetUpdate) {
        this.container = container;
        this.tripData = tripData;
        this.budget = budget || null;
        this.onBudgetUpdate = onBudgetUpdate;
        this.render();
    }
    updateData(tripData, budget) {
        this.tripData = tripData;
        if (budget !== undefined) {
            this.budget = budget;
        }
        this.render();
    }
    formatCurrency(amount) {
        return `$${Math.round(amount).toLocaleString()}`;
    }
    getAlertIcon(type) {
        switch (type) {
            case 'exceeded': return '🔴';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '📊';
        }
    }
    getCategoryColor(category) {
        const colors = {
            'flight': '#3498db',
            'accommodation': '#e74c3c',
            'activity': '#9b59b6',
            'food': '#f39c12',
            'transport': '#1abc9c',
            'education': '#2ecc71',
            'educational_materials': '#27ae60',
            'educational_activities': '#16a085',
            'other': '#95a5a6'
        };
        return colors[category] || '#95a5a6';
    }
    getCategoryIcon(category) {
        const icons = {
            'flight': '✈️',
            'accommodation': '🏨',
            'activity': '🎯',
            'food': '🍽️',
            'transport': '🚗',
            'education': '📚',
            'educational_materials': '📖',
            'educational_activities': '🎓',
            'other': '📦'
        };
        return icons[category] || '📦';
    }
    renderCostsTableForCountry(country) {
        const countryCosts = (this.tripData.costs || [])
            .filter(c => {
            const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
            return (location === null || location === void 0 ? void 0 : location.country) === country;
        });
        if (countryCosts.length === 0) {
            return '<div class="no-costs-message">No costs recorded for this country yet.</div>';
        }
        // Group costs by destination
        const costsByDestination = {};
        countryCosts.forEach(cost => {
            const location = (this.tripData.locations || []).find(loc => loc.id === cost.destination_id);
            const destName = (location === null || location === void 0 ? void 0 : location.name) || (location === null || location === void 0 ? void 0 : location.city) || 'Unknown';
            if (!costsByDestination[destName]) {
                costsByDestination[destName] = [];
            }
            costsByDestination[destName].push(cost);
        });
        return `
      <div class="country-costs-table">
        ${Object.entries(costsByDestination).map(([destName, costs]) => `
          <div class="destination-costs-section">
            <div class="destination-header">${destName}</div>
            <table class="costs-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th class="text-right">Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${costs.map(cost => {
            var _a;
            const amount = cost.amount_usd || cost.amount || 0;
            const currency = cost.currency || 'USD';
            const displayAmount = currency === 'USD'
                ? this.formatCurrency(amount)
                : `${currency} ${((_a = cost.amount) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || '0.00'} (${this.formatCurrency(amount)})`;
            return `
                    <tr>
                      <td>
                        <span class="category-badge" style="background-color: ${this.getCategoryColor(cost.category || 'other')}">
                          ${this.getCategoryIcon(cost.category || 'other')} ${(cost.category || 'other').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>${cost.description || '-'}</td>
                      <td class="text-right amount-cell">${displayAmount}</td>
                      <td><span class="status-badge status-${cost.status || 'estimated'}">${cost.status || 'estimated'}</span></td>
                      <td>${cost.date || '-'}</td>
                      <td class="notes-cell">${cost.notes || '-'}</td>
                    </tr>
                  `;
        }).join('')}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="2"><strong>Subtotal for ${destName}</strong></td>
                  <td class="text-right"><strong>${this.formatCurrency(costs.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0))}</strong></td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `).join('')}
        <div class="country-total-row">
          <strong>Total for ${country}:</strong>
          <strong>${this.formatCurrency(countryCosts.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0))}</strong>
        </div>
      </div>
    `;
    }
    renderCategoryBreakdown(costs) {
        const categoryTotals = {};
        let total = 0;
        costs.forEach(cost => {
            const cat = cost.category || 'other';
            const amount = cost.amount_usd || cost.amount || 0;
            categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
            total += amount;
        });
        if (total === 0)
            return '';
        return Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amount]) => {
            const pct = (amount / total) * 100;
            const color = this.getCategoryColor(cat);
            return `<div class="cat-breakdown-item" style="background-color: ${color}" title="${cat.replace(/_/g, ' ')}: ${this.formatCurrency(amount)} (${pct.toFixed(0)}%)"></div>`;
        })
            .join('');
    }
    renderNoBudget() {
        const totalCosts = (this.tripData.costs || [])
            .reduce((sum, cost) => sum + (cost.amount_usd || cost.amount || 0), 0);
        return `
      <div class="budget-manager no-budget">
        <div class="budget-header">
          <h3>💰 Budget Management</h3>
          <p class="budget-subtitle">No budget set for this trip</p>
        </div>

        <div class="current-spending">
          <div class="spending-summary">
            <div class="spending-label">Current Total Spending</div>
            <div class="spending-amount">${this.formatCurrency(totalCosts)}</div>
          </div>
        </div>

        <div class="budget-actions">
          <button class="btn-primary" id="create-budget-btn">
            Create Budget (+10% Contingency)
          </button>
          <button class="btn-secondary" id="custom-budget-btn">
            Set Custom Budget
          </button>
        </div>

        <div class="budget-help">
          <p>💡 <strong>Tip:</strong> Setting a budget helps you track spending and receive alerts when approaching limits.</p>
        </div>
      </div>
    `;
    }
    renderBudgetStatus() {
        var _a, _b;
        if (!this.budget)
            return this.renderNoBudget();
        const status = calculateBudgetStatus(this.budget, this.tripData);
        const progressBarClass = status.percentage_used > 100 ? 'over-budget' :
            status.percentage_used > 90 ? 'warning' :
                status.percentage_used > 80 ? 'caution' : '';
        const progressWidth = Math.min(status.percentage_used, 100);
        // Get all categories and countries from trip data
        const categories = new Set();
        const countries = new Set();
        (this.tripData.costs || []).forEach(cost => {
            if (cost.category)
                categories.add(cost.category);
        });
        (this.tripData.locations || []).forEach(loc => {
            if (loc.country)
                countries.add(loc.country);
        });
        const currentBudget = this.budget.total_budget_usd || 0;
        return `
      <div class="budget-manager integrated">
        <div class="budget-header-compact">
          <div class="header-row">
            <h3>💰 Budget Management</h3>
            <button class="btn-primary-sm" id="save-budget-btn">💾 Save</button>
          </div>
          <div class="budget-overview-compact">
            <div class="budget-field">
              <label>Total:</label>
              <input type="number" id="total-budget" value="${currentBudget}" min="0" step="100">
              <span>USD</span>
            </div>
            <div class="budget-field">
              <label>Contingency:</label>
              <input type="number" id="contingency-pct" value="${this.budget.contingency_pct || 0}" min="0" max="100" step="1">
              <span>%</span>
            </div>
            <div class="budget-stat">
              <span class="stat-label">Estimated:</span>
              <span class="stat-value ${progressBarClass}">${this.formatCurrency(status.total_spent)} <span class="stat-pct">(${status.percentage_used.toFixed(1)}%)</span></span>
            </div>
            <div class="budget-stat">
              <span class="stat-label">Remaining:</span>
              <span class="stat-value ${status.total_remaining < 0 ? 'negative' : 'positive'}">
                ${this.formatCurrency(status.total_remaining)}
              </span>
            </div>
          </div>
          <div class="budget-progress-compact">
            <div class="progress-bar ${progressBarClass}">
              <div class="progress-fill" style="width: ${progressWidth}%"></div>
            </div>
          </div>
        </div>

        <!-- Alerts -->
        ${status.alerts.length > 0 ? `
          <div class="budget-alerts">
            <h4>🔔 Alerts</h4>
            ${status.alerts.map(alert => `
              <div class="budget-alert alert-${alert.type}">
                <span class="alert-icon">${this.getAlertIcon(alert.type)}</span>
                <span class="alert-message">${alert.message}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Budget by Country -->
        ${countries.size > 0 ? `
          <div class="budget-edit-section">
            <div class="section-header">
              <h4>🌍 Budget by Country</h4>
              <div class="mode-controls">
                <span class="mode-indicator" id="country-mode-indicator">Mode: Dollar Amounts</span>
                <div class="country-mode-selector">
                  <button class="mode-btn active" data-mode="dollars" id="country-mode-dollars">$</button>
                  <button class="mode-btn" data-mode="percent" id="country-mode-percent">%</button>
                  <button class="mode-btn" data-mode="perday" id="country-mode-perday">$/day</button>
                </div>
              </div>
            </div>

            <!-- Group note for countries -->
            <div class="group-note-section">
              <label class="note-label">📝 Country Budget Notes:</label>
              <textarea class="group-note-input"
                        id="country-group-note"
                        placeholder="Add notes about country budgeting strategy..."
                        rows="2">${((_a = this.budget) === null || _a === void 0 ? void 0 : _a.country_group_note) || ''}</textarea>
            </div>

            <!-- Always-visible budget summary for countries -->
            <div class="budget-summary-box">
              <div class="summary-row">
                <span class="summary-label">Total Budget:</span>
                <span class="summary-value" id="country-total-budget">${this.formatCurrency(currentBudget)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Allocated to Countries:</span>
                <span class="summary-value" id="country-total-allocated">${this.formatCurrency(Array.from(countries).reduce((sum, country) => {
            var _a, _b;
            return sum + (((_b = (_a = this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_country) === null || _b === void 0 ? void 0 : _b[country]) || 0);
        }, 0))}</span>
                <span class="summary-percentage" id="country-total-pct">${currentBudget > 0 ?
            ((Array.from(countries).reduce((sum, country) => { var _a, _b; return sum + (((_b = (_a = this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_country) === null || _b === void 0 ? void 0 : _b[country]) || 0); }, 0) / currentBudget) * 100).toFixed(1) : 0}%</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Unallocated:</span>
                <span class="summary-value" id="country-unallocated">${this.formatCurrency(currentBudget - Array.from(countries).reduce((sum, country) => { var _a, _b; return sum + (((_b = (_a = this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_country) === null || _b === void 0 ? void 0 : _b[country]) || 0); }, 0))}</span>
              </div>
            </div>

            <div id="country-allocation-status" style="display: none;" class="allocation-status">
              <div class="allocation-info">
                <strong>Total Allocated:</strong> <span id="country-total-allocated-pct">0</span>%
              </div>
              <div id="country-allocation-remainder" class="allocation-remainder"></div>
            </div>

            <div class="budget-items-edit">
              ${Array.from(countries).map(country => {
            var _a, _b, _c, _d, _e;
            const countryDays = (this.tripData.locations || [])
                .filter(loc => loc.country === country)
                .reduce((sum, loc) => sum + (loc.duration_days || 0), 0);
            const countryCostsArray = (this.tripData.costs || [])
                .filter(c => {
                const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
                return (location === null || location === void 0 ? void 0 : location.country) === country;
            });
            const countryCosts = countryCostsArray.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);
            const categoryBreakdown = this.renderCategoryBreakdown(countryCostsArray);
            const countryBudget = ((_b = (_a = this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_country) === null || _b === void 0 ? void 0 : _b[country]) || countryCosts * 1.1;
            const budgetPerDay = countryDays > 0 ? countryBudget / countryDays : 0;
            const countryPct = currentBudget > 0 ? (countryBudget / currentBudget * 100) : 0;
            const pct = ((_c = status.by_country[country]) === null || _c === void 0 ? void 0 : _c.percentage) || 0;
            const barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';
            const countryNote = ((_e = (_d = this.budget) === null || _d === void 0 ? void 0 : _d.country_notes) === null || _e === void 0 ? void 0 : _e[country]) || '';
            return `
                  <div class="budget-item-edit">
                    <div class="item-header-row">
                      <div class="item-label-with-note">
                        <span class="item-label-text">${country} <span class="days-label">(${countryDays} day${countryDays !== 1 ? 's' : ''})</span></span>
                        <button class="note-toggle-btn" data-country="${country}" title="${countryNote ? 'Edit Note' : 'Add Note'}">
                          ${countryNote ? '📝' : '📄'}
                        </button>
                        ${countryNote ? `<span class="inline-note">${countryNote}</span>` : ''}
                        <button class="costs-toggle-btn" data-country="${country}" title="View Costs">
                          💰 View Costs (${countryCostsArray.length})
                        </button>
                      </div>
                    </div>
                    <div class="item-input-row">
                      <div class="input-with-unit">
                        <input type="number"
                               class="country-input"
                               data-country="${country}"
                               data-days="${countryDays}"
                               data-dollar-value="${Math.round(countryBudget)}"
                               value="${Math.round(countryBudget)}"
                               min="0"
                               step="10">
                        <span class="input-unit" data-country="${country}">USD</span>
                      </div>
                      <span class="calc-arrow">→</span>
                      <div class="calculated-display">
                        <span class="calc-value" data-country="${country}">${countryPct.toFixed(1)}%</span>
                      </div>
                      <div class="item-status">
                        <span class="country-per-day-display" data-country="${country}">$${Math.round(budgetPerDay)}/day</span>
                        <div class="est-cost-with-breakdown">
                          <span class="current-spend">Est: ${this.formatCurrency(countryCosts)}</span>
                          ${categoryBreakdown ? `<div class="cat-breakdown-bar">${categoryBreakdown}</div>` : ''}
                        </div>
                        <div class="mini-progress-bar ${barClass}">
                          <div class="mini-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                        </div>
                      </div>
                    </div>
                    <div class="item-note-section" data-country="${country}" style="display: none">
                      <textarea class="item-note-input"
                                data-country="${country}"
                                placeholder="Add notes about this country budget..."
                                rows="2">${countryNote}</textarea>
                    </div>
                    <div class="item-costs-section" data-country="${country}" style="display: none">
                      ${this.renderCostsTableForCountry(country)}
                    </div>
                  </div>
                `;
        }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Budget by Category -->
        <div class="budget-edit-section">
          <div class="section-header">
            <h4>📊 Budget by Category</h4>
            <div class="mode-controls">
              <span class="mode-indicator" id="category-mode-indicator">Mode: Dollar Amounts</span>
              <label class="toggle-switch">
                <input type="checkbox" id="category-mode-toggle">
                <span class="toggle-slider"></span>
                <span class="toggle-label">Use %</span>
              </label>
            </div>
          </div>

          <!-- Group note for categories -->
          <div class="group-note-section">
            <label class="note-label">📝 Category Budget Notes:</label>
            <textarea class="group-note-input"
                      id="category-group-note"
                      placeholder="Add notes about category budgeting strategy..."
                      rows="2">${((_b = this.budget) === null || _b === void 0 ? void 0 : _b.category_group_note) || ''}</textarea>
          </div>

          <!-- Always-visible budget summary -->
          <div class="budget-summary-box">
            <div class="summary-row">
              <span class="summary-label">Total Budget:</span>
              <span class="summary-value" id="category-total-budget">${this.formatCurrency(currentBudget)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Allocated to Categories:</span>
              <span class="summary-value" id="category-total-allocated">${this.formatCurrency(Array.from(categories).reduce((sum, cat) => {
            var _a, _b;
            return sum + (((_b = (_a = this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_category) === null || _b === void 0 ? void 0 : _b[cat]) || 0);
        }, 0))}</span>
              <span class="summary-percentage" id="category-total-pct">${currentBudget > 0 ?
            ((Array.from(categories).reduce((sum, cat) => { var _a, _b; return sum + (((_b = (_a = this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_category) === null || _b === void 0 ? void 0 : _b[cat]) || 0); }, 0) / currentBudget) * 100).toFixed(1) : 0}%</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Unallocated:</span>
              <span class="summary-value" id="category-unallocated">${this.formatCurrency(currentBudget - Array.from(categories).reduce((sum, cat) => { var _a, _b; return sum + (((_b = (_a = this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_category) === null || _b === void 0 ? void 0 : _b[cat]) || 0); }, 0))}</span>
            </div>
          </div>

          <div id="allocation-status" style="display: none;" class="allocation-status">
            <div class="allocation-info">
              <strong>Total Allocated:</strong> <span id="total-allocated-pct">0</span>%
            </div>
            <div id="allocation-remainder" class="allocation-remainder"></div>
          </div>

          <div class="budget-items-edit">
            ${Array.from(categories).map(cat => {
            var _a, _b, _c, _d, _e;
            const catCosts = (this.tripData.costs || [])
                .filter(c => c.category === cat)
                .reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);
            const catBudget = ((_b = (_a = this.budget) === null || _a === void 0 ? void 0 : _a.budgets_by_category) === null || _b === void 0 ? void 0 : _b[cat]) || catCosts * 1.1;
            const catPct = currentBudget > 0 ? (catBudget / currentBudget * 100) : 0;
            const pct = ((_c = status.by_category[cat]) === null || _c === void 0 ? void 0 : _c.percentage) || 0;
            const barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';
            const catNote = ((_e = (_d = this.budget) === null || _d === void 0 ? void 0 : _d.category_notes) === null || _e === void 0 ? void 0 : _e[cat]) || '';
            return `
                <div class="budget-item-edit">
                  <div class="item-header-row">
                    <div class="item-label-with-note">
                      <span class="item-label-text">${cat.replace(/_/g, ' ')}</span>
                      <button class="note-toggle-btn" data-category="${cat}" title="${catNote ? 'Edit Note' : 'Add Note'}">
                        ${catNote ? '📝' : '📄'}
                      </button>
                      ${catNote ? `<span class="inline-note">${catNote}</span>` : ''}
                    </div>
                  </div>
                  <div class="item-input-row">
                    <div class="input-with-unit">
                      <input type="number"
                             class="cat-input"
                             data-category="${cat}"
                             data-dollar-value="${Math.round(catBudget)}"
                             value="${Math.round(catBudget)}"
                             min="0"
                             step="10">
                      <span class="input-unit" data-category="${cat}">USD</span>
                    </div>
                    <span class="calc-arrow">→</span>
                    <div class="calculated-display">
                      <span class="calc-value" data-category="${cat}">${catPct.toFixed(1)}%</span>
                    </div>
                    <div class="item-status">
                      <span class="current-spend">Est: ${this.formatCurrency(catCosts)}</span>
                      <div class="mini-progress-bar ${barClass}">
                        <div class="mini-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                      </div>
                    </div>
                  </div>
                  <div class="item-note-section" data-category="${cat}" style="display: none">
                    <textarea class="item-note-input"
                              data-category="${cat}"
                              placeholder="Add notes about this category budget..."
                              rows="2">${catNote}</textarea>
                  </div>
                </div>
              `;
        }).join('')}
          </div>
        </div>

        <div class="budget-footer">
          <button class="btn-primary" id="save-budget-btn-footer">💾 Save Budget</button>
        </div>
      </div>
    `;
    }
    attachEventListeners() {
        // Create budget button
        const createBtn = this.container.querySelector('#create-budget-btn');
        createBtn === null || createBtn === void 0 ? void 0 : createBtn.addEventListener('click', () => {
            var _a;
            const newBudget = createDefaultBudget(this.tripData, 10);
            this.budget = newBudget;
            (_a = this.onBudgetUpdate) === null || _a === void 0 ? void 0 : _a.call(this, newBudget);
            this.render();
        });
        // Custom budget button
        const customBtn = this.container.querySelector('#custom-budget-btn');
        customBtn === null || customBtn === void 0 ? void 0 : customBtn.addEventListener('click', () => {
            var _a;
            const newBudget = createDefaultBudget(this.tripData, 10);
            this.budget = newBudget;
            (_a = this.onBudgetUpdate) === null || _a === void 0 ? void 0 : _a.call(this, newBudget);
            this.render();
        });
        // If budget exists, attach integrated edit listeners
        if (this.budget) {
            this.attachBudgetEditListeners();
        }
    }
    attachBudgetEditListeners() {
        var _a, _b;
        const totalBudgetInput = this.container.querySelector('#total-budget');
        const contingencyInput = this.container.querySelector('#contingency-pct');
        if (!totalBudgetInput)
            return;
        // Category mode toggle logic
        const categoryModeToggle = this.container.querySelector('#category-mode-toggle');
        const categoryModeIndicator = this.container.querySelector('#category-mode-indicator');
        const allocationStatus = this.container.querySelector('#allocation-status');
        const totalAllocatedSpan = this.container.querySelector('#total-allocated-pct');
        const allocationRemainder = this.container.querySelector('#allocation-remainder');
        let isPercentageMode = false;
        // Update budget summary for categories
        const updateCategorySummary = () => {
            const totalBudget = parseFloat(totalBudgetInput.value) || 0;
            let totalAllocated = 0;
            this.container.querySelectorAll('.cat-input').forEach(input => {
                const el = input;
                const dollarValue = parseFloat(el.dataset.dollarValue) || 0;
                totalAllocated += dollarValue;
            });
            const categoryTotalBudgetEl = this.container.querySelector('#category-total-budget');
            const categoryTotalEl = this.container.querySelector('#category-total-allocated');
            const categoryPctEl = this.container.querySelector('#category-total-pct');
            const categoryUnallocatedEl = this.container.querySelector('#category-unallocated');
            // Update total budget display
            if (categoryTotalBudgetEl) {
                categoryTotalBudgetEl.textContent = `$${Math.round(totalBudget).toLocaleString()}`;
            }
            if (categoryTotalEl) {
                categoryTotalEl.textContent = `$${totalAllocated.toLocaleString()}`;
            }
            if (categoryPctEl) {
                const pct = totalBudget > 0 ? (totalAllocated / totalBudget * 100) : 0;
                categoryPctEl.textContent = `${pct.toFixed(1)}%`;
                // Color code based on allocation status
                if (Math.abs(pct - 100) < 0.1) {
                    categoryPctEl.style.color = '#28a745'; // Green for fully allocated
                }
                else if (pct > 100) {
                    categoryPctEl.style.color = '#dc3545'; // Red for over-allocated
                }
                else {
                    categoryPctEl.style.color = '#ffc107'; // Orange for under-allocated
                }
            }
            if (categoryUnallocatedEl) {
                const unallocated = totalBudget - totalAllocated;
                categoryUnallocatedEl.textContent = `$${unallocated.toLocaleString()}`;
                // Color code the unallocated amount
                if (Math.abs(unallocated) < 1) {
                    categoryUnallocatedEl.style.color = '#28a745';
                }
                else if (unallocated < 0) {
                    categoryUnallocatedEl.style.color = '#dc3545';
                }
                else {
                    categoryUnallocatedEl.style.color = '#ffc107';
                }
            }
        };
        // Update calculated displays for categories
        const updateCalculatedDisplays = () => {
            const totalBudget = parseFloat(totalBudgetInput.value) || 0;
            this.container.querySelectorAll('.cat-input').forEach(input => {
                const el = input;
                const category = el.dataset.category;
                const calcValueSpan = this.container.querySelector(`.calc-value[data-category="${category}"]`);
                if (isPercentageMode) {
                    const pct = parseFloat(el.value) || 0;
                    const dollars = Math.round(totalBudget * pct / 100);
                    calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
                    el.dataset.dollarValue = dollars.toString();
                }
                else {
                    const dollars = parseFloat(el.value) || 0;
                    const pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
                    calcValueSpan.textContent = `${pct.toFixed(1)}%`;
                    el.dataset.dollarValue = dollars.toString();
                }
            });
            if (isPercentageMode) {
                updateAllocationStatus();
            }
            updateCategorySummary();
        };
        // Update allocation status for categories
        const updateAllocationStatus = () => {
            let totalPct = 0;
            this.container.querySelectorAll('.cat-input').forEach(input => {
                const el = input;
                totalPct += parseFloat(el.value) || 0;
            });
            totalAllocatedSpan.textContent = totalPct.toFixed(1);
            const remainder = 100 - totalPct;
            const absRemainder = Math.abs(remainder);
            if (Math.abs(remainder) < 0.1) {
                allocationRemainder.textContent = '✓ Fully Allocated';
                allocationRemainder.style.color = '#28a745';
            }
            else if (remainder > 0) {
                allocationRemainder.textContent = `${absRemainder.toFixed(1)}% Unallocated`;
                allocationRemainder.style.color = '#ffc107';
            }
            else {
                allocationRemainder.textContent = `${absRemainder.toFixed(1)}% Over-allocated`;
                allocationRemainder.style.color = '#dc3545';
            }
        };
        // Category toggle between % and $
        categoryModeToggle === null || categoryModeToggle === void 0 ? void 0 : categoryModeToggle.addEventListener('change', () => {
            isPercentageMode = categoryModeToggle.checked;
            const totalBudget = parseFloat(totalBudgetInput.value) || 0;
            categoryModeIndicator.textContent = isPercentageMode ? 'Mode: Percentages' : 'Mode: Dollar Amounts';
            allocationStatus.style.display = isPercentageMode ? 'block' : 'none';
            this.container.querySelectorAll('.cat-input').forEach(input => {
                const el = input;
                const category = el.dataset.category;
                const unitSpan = this.container.querySelector(`.input-unit[data-category="${category}"]`);
                const currentDollarValue = parseFloat(el.dataset.dollarValue) || parseFloat(el.value) || 0;
                if (isPercentageMode) {
                    const pct = totalBudget > 0 ? (currentDollarValue / totalBudget * 100) : 0;
                    el.value = pct.toFixed(1);
                    el.step = '0.1';
                    el.max = '100';
                    unitSpan.textContent = '%';
                }
                else {
                    el.value = Math.round(currentDollarValue).toString();
                    el.step = '10';
                    el.removeAttribute('max');
                    unitSpan.textContent = 'USD';
                }
            });
            updateCalculatedDisplays();
        });
        // Update category displays when inputs change
        this.container.querySelectorAll('.cat-input').forEach(input => {
            input.addEventListener('input', () => {
                updateCalculatedDisplays();
            });
        });
        // Update when total budget changes
        totalBudgetInput.addEventListener('input', () => {
            updateCalculatedDisplays();
            updateCountryCalculatedDisplays();
        });
        // Country mode selector logic
        const countryModeIndicator = this.container.querySelector('#country-mode-indicator');
        const countryAllocationStatus = this.container.querySelector('#country-allocation-status');
        const countryTotalAllocatedSpan = this.container.querySelector('#country-total-allocated-pct');
        const countryAllocationRemainder = this.container.querySelector('#country-allocation-remainder');
        let countryMode = 'dollars';
        // Update budget summary for countries
        const updateCountrySummary = () => {
            const totalBudget = parseFloat(totalBudgetInput.value) || 0;
            let totalAllocated = 0;
            this.container.querySelectorAll('.country-input').forEach(input => {
                const el = input;
                const dollarValue = parseFloat(el.dataset.dollarValue) || 0;
                totalAllocated += dollarValue;
            });
            const countryTotalBudgetEl = this.container.querySelector('#country-total-budget');
            const countryTotalEl = this.container.querySelector('#country-total-allocated');
            const countryPctEl = this.container.querySelector('#country-total-pct');
            const countryUnallocatedEl = this.container.querySelector('#country-unallocated');
            // Update total budget display
            if (countryTotalBudgetEl) {
                countryTotalBudgetEl.textContent = `$${Math.round(totalBudget).toLocaleString()}`;
            }
            if (countryTotalEl) {
                countryTotalEl.textContent = `$${totalAllocated.toLocaleString()}`;
            }
            if (countryPctEl) {
                const pct = totalBudget > 0 ? (totalAllocated / totalBudget * 100) : 0;
                countryPctEl.textContent = `${pct.toFixed(1)}%`;
                // Color code based on allocation status
                if (Math.abs(pct - 100) < 0.1) {
                    countryPctEl.style.color = '#28a745'; // Green for fully allocated
                }
                else if (pct > 100) {
                    countryPctEl.style.color = '#dc3545'; // Red for over-allocated
                }
                else {
                    countryPctEl.style.color = '#ffc107'; // Orange for under-allocated
                }
            }
            if (countryUnallocatedEl) {
                const unallocated = totalBudget - totalAllocated;
                countryUnallocatedEl.textContent = `$${unallocated.toLocaleString()}`;
                // Color code the unallocated amount
                if (Math.abs(unallocated) < 1) {
                    countryUnallocatedEl.style.color = '#28a745';
                }
                else if (unallocated < 0) {
                    countryUnallocatedEl.style.color = '#dc3545';
                }
                else {
                    countryUnallocatedEl.style.color = '#ffc107';
                }
            }
        };
        // Update calculated displays for countries
        const updateCountryCalculatedDisplays = () => {
            const totalBudget = parseFloat(totalBudgetInput.value) || 0;
            this.container.querySelectorAll('.country-input').forEach(input => {
                const el = input;
                const country = el.dataset.country;
                const days = parseFloat(el.dataset.days) || 1;
                const calcValueSpan = this.container.querySelector(`.calc-value[data-country="${country}"]`);
                const perDayDisplay = this.container.querySelector(`.country-per-day-display[data-country="${country}"]`);
                if (countryMode === 'percent') {
                    const pct = parseFloat(el.value) || 0;
                    const dollars = Math.round(totalBudget * pct / 100);
                    const perDay = days > 0 ? Math.round(dollars / days) : 0;
                    calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
                    perDayDisplay.textContent = `$${perDay}/day`;
                    el.dataset.dollarValue = dollars.toString();
                }
                else if (countryMode === 'perday') {
                    const perDay = parseFloat(el.value) || 0;
                    const dollars = Math.round(perDay * days);
                    const pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
                    calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
                    perDayDisplay.textContent = `${pct.toFixed(1)}%`;
                    el.dataset.dollarValue = dollars.toString();
                }
                else {
                    const dollars = parseFloat(el.value) || 0;
                    const pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
                    const perDay = days > 0 ? Math.round(dollars / days) : 0;
                    calcValueSpan.textContent = `${pct.toFixed(1)}%`;
                    perDayDisplay.textContent = `$${perDay}/day`;
                    el.dataset.dollarValue = dollars.toString();
                }
            });
            if (countryMode === 'percent') {
                updateCountryAllocationStatus();
            }
            updateCountrySummary();
        };
        // Update allocation status for countries
        const updateCountryAllocationStatus = () => {
            let totalPct = 0;
            this.container.querySelectorAll('.country-input').forEach(input => {
                const el = input;
                totalPct += parseFloat(el.value) || 0;
            });
            countryTotalAllocatedSpan.textContent = totalPct.toFixed(1);
            const remainder = 100 - totalPct;
            const absRemainder = Math.abs(remainder);
            if (Math.abs(remainder) < 0.1) {
                countryAllocationRemainder.textContent = '✓ Fully Allocated';
                countryAllocationRemainder.style.color = '#28a745';
            }
            else if (remainder > 0) {
                countryAllocationRemainder.textContent = `${absRemainder.toFixed(1)}% Unallocated`;
                countryAllocationRemainder.style.color = '#ffc107';
            }
            else {
                countryAllocationRemainder.textContent = `${absRemainder.toFixed(1)}% Over-allocated`;
                countryAllocationRemainder.style.color = '#dc3545';
            }
        };
        // Country mode selector buttons
        const countryModeBtns = this.container.querySelectorAll('.country-mode-selector .mode-btn');
        countryModeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const newMode = btn.dataset.mode;
                countryMode = newMode;
                const totalBudget = parseFloat(totalBudgetInput.value) || 0;
                // Update button states
                countryModeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Update indicator
                const modeText = newMode === 'dollars' ? 'Dollar Amounts' : newMode === 'percent' ? 'Percentages' : 'Per Day';
                countryModeIndicator.textContent = `Mode: ${modeText}`;
                countryAllocationStatus.style.display = newMode === 'percent' ? 'block' : 'none';
                // Convert all inputs to new mode
                this.container.querySelectorAll('.country-input').forEach(input => {
                    const el = input;
                    const country = el.dataset.country;
                    const days = parseFloat(el.dataset.days) || 1;
                    const unitSpan = this.container.querySelector(`.input-unit[data-country="${country}"]`);
                    const currentDollarValue = parseFloat(el.dataset.dollarValue) || parseFloat(el.value) || 0;
                    if (newMode === 'percent') {
                        const pct = totalBudget > 0 ? (currentDollarValue / totalBudget * 100) : 0;
                        el.value = pct.toFixed(1);
                        el.step = '0.1';
                        el.max = '100';
                        unitSpan.textContent = '%';
                    }
                    else if (newMode === 'perday') {
                        const perDay = days > 0 ? Math.round(currentDollarValue / days) : 0;
                        el.value = perDay.toString();
                        el.step = '1';
                        el.removeAttribute('max');
                        unitSpan.textContent = '$/day';
                    }
                    else {
                        el.value = Math.round(currentDollarValue).toString();
                        el.step = '10';
                        el.removeAttribute('max');
                        unitSpan.textContent = 'USD';
                    }
                });
                updateCountryCalculatedDisplays();
            });
        });
        // Update country displays when inputs change
        this.container.querySelectorAll('.country-input').forEach(input => {
            input.addEventListener('input', () => {
                updateCountryCalculatedDisplays();
            });
        });
        // Note toggle functionality for categories
        this.container.querySelectorAll('.note-toggle-btn[data-category]').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                const noteSection = this.container.querySelector(`.item-note-section[data-category="${category}"]`);
                if (noteSection) {
                    const isVisible = noteSection.style.display !== 'none';
                    noteSection.style.display = isVisible ? 'none' : 'block';
                }
            });
        });
        // Note toggle functionality for countries
        this.container.querySelectorAll('.note-toggle-btn[data-country]').forEach(btn => {
            btn.addEventListener('click', () => {
                const country = btn.dataset.country;
                const noteSection = this.container.querySelector(`.item-note-section[data-country="${country}"]`);
                if (noteSection) {
                    const isVisible = noteSection.style.display !== 'none';
                    noteSection.style.display = isVisible ? 'none' : 'block';
                }
            });
        });
        // Costs toggle functionality for countries
        this.container.querySelectorAll('.costs-toggle-btn[data-country]').forEach(btn => {
            btn.addEventListener('click', () => {
                const country = btn.dataset.country;
                const costsSection = this.container.querySelector(`.item-costs-section[data-country="${country}"]`);
                if (costsSection) {
                    const isVisible = costsSection.style.display !== 'none';
                    costsSection.style.display = isVisible ? 'none' : 'block';
                    // Update button text to indicate state
                    const btnElement = btn;
                    if (isVisible) {
                        btnElement.innerHTML = btnElement.innerHTML.replace('▼', '▶').replace('Hide', 'View');
                    }
                    else {
                        btnElement.innerHTML = btnElement.innerHTML.replace('▶', '▼').replace('View', 'Hide');
                    }
                }
            });
        });
        // Save budget functionality
        const saveBudget = () => {
            var _a, _b, _c;
            const totalBudget = parseFloat(totalBudgetInput.value) || 0;
            const contingency = parseFloat(contingencyInput.value) || 0;
            // Collect category budgets - use stored dollar values
            const budgets_by_category = {};
            this.container.querySelectorAll('.cat-input').forEach(input => {
                const el = input;
                const category = el.dataset.category;
                const dollarValue = parseFloat(el.dataset.dollarValue) || 0;
                budgets_by_category[category] = dollarValue;
            });
            // Collect country budgets - use stored dollar values
            const budgets_by_country = {};
            this.container.querySelectorAll('.country-input').forEach(input => {
                const el = input;
                const country = el.dataset.country;
                const dollarValue = parseFloat(el.dataset.dollarValue) || 0;
                budgets_by_country[country] = dollarValue;
            });
            // Collect category notes
            const category_notes = {};
            this.container.querySelectorAll('.item-note-input[data-category]').forEach(textarea => {
                const el = textarea;
                const category = el.dataset.category;
                const note = el.value.trim();
                if (note) {
                    category_notes[category] = note;
                }
            });
            // Collect country notes
            const country_notes = {};
            this.container.querySelectorAll('.item-note-input[data-country]').forEach(textarea => {
                const el = textarea;
                const country = el.dataset.country;
                const note = el.value.trim();
                if (note) {
                    country_notes[country] = note;
                }
            });
            // Get group notes
            const categoryGroupNote = (_a = this.container.querySelector('#category-group-note')) === null || _a === void 0 ? void 0 : _a.value.trim();
            const countryGroupNote = (_b = this.container.querySelector('#country-group-note')) === null || _b === void 0 ? void 0 : _b.value.trim();
            // Build budget object, only including note fields if they have values
            const newBudget = {
                total_budget_usd: totalBudget,
                budgets_by_category,
                budgets_by_country,
                contingency_pct: contingency,
                alerts: []
            };
            // Only add note fields if they have values (Firestore doesn't accept undefined)
            if (Object.keys(category_notes).length > 0) {
                newBudget.category_notes = category_notes;
            }
            if (Object.keys(country_notes).length > 0) {
                newBudget.country_notes = country_notes;
            }
            if (categoryGroupNote) {
                newBudget.category_group_note = categoryGroupNote;
            }
            if (countryGroupNote) {
                newBudget.country_group_note = countryGroupNote;
            }
            this.budget = newBudget;
            (_c = this.onBudgetUpdate) === null || _c === void 0 ? void 0 : _c.call(this, newBudget);
            this.render();
        };
        // Attach save listeners to both buttons
        (_a = this.container.querySelector('#save-budget-btn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', saveBudget);
        (_b = this.container.querySelector('#save-budget-btn-footer')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', saveBudget);
    }
    render() {
        const html = this.renderBudgetStatus();
        this.container.innerHTML = html;
        this.container.style.display = 'block';
        this.attachEventListeners();
    }
}
// CSS styles for the budget manager
export const budgetManagerStyles = `
<style>
.budget-manager {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin: 20px 0;
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.budget-header h3 {
  margin: 0;
  font-size: 20px;
}

.budget-subtitle {
  color: #666;
  margin: 5px 0 0 0;
}

/* Compact header styles */
.budget-header-compact {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-row h3 {
  margin: 0;
  font-size: 18px;
}

.btn-primary-sm {
  padding: 6px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary-sm:hover {
  background: #0056b3;
}

.budget-overview-compact {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.budget-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.budget-field label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.budget-field input {
  width: 90px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.budget-field span {
  font-size: 12px;
  color: #666;
}

.budget-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.stat-value {
  font-size: 15px;
  font-weight: 700;
  color: #333;
}

.stat-value.positive {
  color: #28a745;
}

.stat-value.negative {
  color: #dc3545;
}

.stat-pct {
  font-size: 13px;
  font-weight: 500;
  color: #666;
  margin-left: 4px;
}

.budget-progress-compact {
  margin-top: 8px;
}

.budget-progress-compact .progress-bar {
  height: 6px;
  border-radius: 3px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 5px 10px;
}

.btn-icon:hover {
  background: #f0f0f0;
  border-radius: 4px;
}

.budget-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.budget-total, .budget-spent, .budget-remaining {
  padding: 15px;
  border-radius: 6px;
  background: #f8f9fa;
}

.budget-spent.over-budget {
  background: #fee;
}

.budget-spent.warning {
  background: #fff3cd;
}

.budget-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  margin-bottom: 5px;
}

.budget-amount {
  font-size: 24px;
  font-weight: bold;
}

.budget-amount.negative {
  color: #dc3545;
}

.budget-progress {
  margin: 20px 0;
}

.progress-bar {
  height: 30px;
  background: #e9ecef;
  border-radius: 15px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: #28a745;
  transition: width 0.3s ease;
}

.progress-bar.caution .progress-fill {
  background: #ffc107;
}

.progress-bar.warning .progress-fill {
  background: #fd7e14;
}

.progress-bar.over-budget .progress-fill {
  background: #dc3545;
}

.progress-label {
  text-align: center;
  margin-top: 5px;
  font-weight: bold;
}

.budget-alerts {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.budget-alerts h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.budget-alert {
  padding: 10px;
  margin: 5px 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-info {
  background: #d1ecf1;
  border-left: 4px solid #0c5460;
}

.alert-warning {
  background: #fff3cd;
  border-left: 4px solid #856404;
}

.alert-exceeded {
  background: #f8d7da;
  border-left: 4px solid #721c24;
}

.budget-breakdown {
  margin: 20px 0;
}

.budget-breakdown h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
}

.budget-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.budget-item {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.item-name {
  font-weight: 500;
  text-transform: capitalize;
}

.item-amounts {
  font-size: 14px;
  color: #666;
}

.item-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mini-progress-bar {
  flex: 1;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.mini-progress-fill {
  height: 100%;
  background: #28a745;
  transition: width 0.3s ease;
}

.mini-progress-bar.warning .mini-progress-fill {
  background: #fd7e14;
}

.mini-progress-bar.over-budget .mini-progress-fill {
  background: #dc3545;
}

.item-percentage {
  font-size: 12px;
  color: #666;
  min-width: 40px;
  text-align: right;
}

.budget-actions {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.budget-help {
  margin-top: 20px;
  padding: 15px;
  background: #e7f3ff;
  border-left: 4px solid #007bff;
  border-radius: 4px;
}

.budget-help p {
  margin: 0;
  font-size: 14px;
}

.current-spending {
  margin: 20px 0;
}

.spending-summary {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 6px;
  text-align: center;
}

.spending-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.spending-amount {
  font-size: 32px;
  font-weight: bold;
  color: #007bff;
}

/* Integrated budget interface styles */
.budget-manager.integrated {
  max-width: 100%;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.budget-edit-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  border: 1px solid #e0e0e0;
}

.budget-edit-section h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-header h4 {
  margin: 0;
}

.mode-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-indicator {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.budget-overview-edit {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.form-group-inline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 200px;
}

.form-group-inline label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.budget-status-display {
  display: flex;
  gap: 20px;
  padding: 15px;
  background: white;
  border-radius: 6px;
  margin: 15px 0;
  flex-wrap: wrap;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.status-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
}

.status-value {
  font-size: 18px;
  font-weight: bold;
}

.status-value.positive {
  color: #28a745;
}

.status-value.negative {
  color: #dc3545;
}

.status-value.over-budget,
.status-value.warning {
  color: #dc3545;
}

.allocation-status {
  padding: 12px;
  background: white;
  border-radius: 6px;
  margin: 15px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.allocation-info {
  font-size: 14px;
}

.allocation-remainder {
  font-weight: 600;
  font-size: 14px;
}

.budget-summary-box {
  padding: 15px;
  background: white;
  border-radius: 6px;
  margin: 15px 0;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.summary-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.summary-label {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.summary-value {
  font-weight: 700;
  color: #333;
  font-size: 16px;
  transition: color 0.2s;
}

.summary-percentage {
  font-weight: 600;
  font-size: 14px;
  margin-left: 10px;
  transition: color 0.2s;
}

.budget-items-edit {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.budget-item-edit {
  background: white;
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.item-label {
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
}

.item-header-row {
  margin-bottom: 10px;
}

.item-label-with-note {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.item-label-text {
  font-weight: 600;
  color: #333;
}

.inline-note {
  flex: 1;
  color: #666;
  font-size: 13px;
  font-style: italic;
  padding: 4px 8px;
  background: #fffbf0;
  border-radius: 4px;
  border: 1px solid #ffe4a3;
  min-width: 200px;
}

.days-label {
  font-weight: normal;
  color: #666;
  font-size: 13px;
}

.item-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.item-status {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 300px;
}

.item-status .mini-progress-bar {
  flex: 1;
  min-width: 100px;
}

.budget-footer {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
}

.input-with-unit {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 180px;
  gap: 8px;
}

.input-with-unit input {
  width: 120px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input-with-unit input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.input-unit {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  min-width: 35px;
  text-align: left;
}

.calc-arrow {
  font-size: 16px;
  color: #999;
  flex-shrink: 0;
}

.calculated-display {
  min-width: 80px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  color: #007bff;
}

.calc-value {
  white-space: nowrap;
}

.current-spend {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

/* Toggle Switch */
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.toggle-switch input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  background-color: #ccc;
  border-radius: 24px;
  transition: background-color 0.3s;
}

.toggle-slider::before {
  content: "";
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #007bff;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

/* Allocation status colors */
#allocation-status,
#country-allocation-status {
  border-left: 4px solid #007bff;
}

/* Country mode selector buttons */
.country-mode-selector {
  display: flex;
  gap: 4px;
  background: #f0f0f0;
  padding: 4px;
  border-radius: 6px;
}

.mode-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: #666;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: #e0e0e0;
}

.mode-btn.active {
  background: #007bff;
  color: white;
}

/* Notes sections */
.group-note-section {
  margin: 15px 0;
  padding: 12px;
  background: #fffbf0;
  border-radius: 6px;
  border: 1px solid #ffe4a3;
}

.note-label {
  display: block;
  font-weight: 600;
  font-size: 13px;
  color: #333;
  margin-bottom: 6px;
}

.group-note-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
}

.group-note-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.note-toggle-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
  margin-left: 8px;
}

.note-toggle-btn:hover {
  opacity: 1;
}

.item-note-section {
  margin-top: 10px;
  padding: 10px;
  background: #fffbf0;
  border-radius: 4px;
  border: 1px solid #ffe4a3;
}

.item-note-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  resize: vertical;
}

.item-note-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

/* Category breakdown visualization */
.est-cost-with-breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cat-breakdown-bar {
  display: flex;
  height: 8px;
  gap: 1px;
  border-radius: 4px;
  overflow: hidden;
}

.cat-breakdown-item {
  flex: 1;
  min-width: 3px;
  transition: transform 0.2s;
}

.cat-breakdown-item:hover {
  transform: scaleY(1.5);
  cursor: help;
}

/* Costs toggle button */
.costs-toggle-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
  margin-left: 8px;
  font-weight: 500;
}

.costs-toggle-btn:hover {
  background: #0056b3;
}

/* Costs section */
.item-costs-section {
  margin-top: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.country-costs-table {
  background: white;
  border-radius: 6px;
  padding: 12px;
}

.destination-costs-section {
  margin-bottom: 20px;
}

.destination-costs-section:last-child {
  margin-bottom: 0;
}

.destination-header {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 10px;
  padding: 8px 12px;
  background: #f0f7ff;
  border-left: 4px solid #007bff;
  border-radius: 4px;
}

.costs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-bottom: 12px;
}

.costs-table thead {
  background: #f8f9fa;
  border-bottom: 2px solid #dee2e6;
}

.costs-table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.costs-table th.text-right {
  text-align: right;
}

.costs-table tbody tr {
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.costs-table tbody tr:hover {
  background: #f8f9fa;
}

.costs-table td {
  padding: 10px 12px;
  color: #333;
}

.costs-table td.text-right {
  text-align: right;
}

.costs-table td.amount-cell {
  font-weight: 600;
  color: #007bff;
  white-space: nowrap;
}

.costs-table td.notes-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #666;
  font-size: 12px;
}

.category-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.status-estimated {
  background: #fff3cd;
  color: #856404;
}

.status-researched {
  background: #d1ecf1;
  color: #0c5460;
}

.status-booked {
  background: #d4edda;
  color: #155724;
}

.status-paid {
  background: #c3e6cb;
  color: #155724;
}

.costs-table tfoot .total-row {
  background: #f8f9fa;
  border-top: 2px solid #dee2e6;
  font-weight: 600;
}

.costs-table tfoot .total-row td {
  padding: 12px;
}

.country-total-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  background: #e7f3ff;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #007bff;
  margin-top: 12px;
  border: 1px solid #b8daff;
}

.no-costs-message {
  padding: 20px;
  text-align: center;
  color: #666;
  font-style: italic;
  background: white;
  border-radius: 6px;
  border: 1px dashed #ddd;
}
</style>
`;
