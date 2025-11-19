/**
 * Budget Manager UI Component (Recommendation J)
 * Provides integrated budget tracking, editing, and management interface
 */

import type { TripBudget, TripData } from '../types/trip';
import { calculateBudgetStatus, createDefaultBudget } from '../utils/budgetTracker';

export class BudgetManager {
  private container: HTMLElement;
  private tripData: TripData;
  private budget: TripBudget | null;
  private onBudgetUpdate?: (budget: TripBudget) => void;

  constructor(
    container: HTMLElement,
    tripData: TripData,
    budget?: TripBudget,
    onBudgetUpdate?: (budget: TripBudget) => void
  ) {
    this.container = container;
    this.tripData = tripData;
    this.budget = budget || null;
    this.onBudgetUpdate = onBudgetUpdate;

    this.render();
  }

  updateData(tripData: TripData, budget?: TripBudget) {
    this.tripData = tripData;
    if (budget !== undefined) {
      this.budget = budget;
    }
    this.render();
  }

  private formatCurrency(amount: number): string {
    return `$${Math.round(amount).toLocaleString()}`;
  }

  private getAlertIcon(type: string): string {
    switch (type) {
      case 'exceeded': return '🔴';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📊';
    }
  }

  private renderNoBudget(): string {
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

  private renderBudgetStatus(): string {
    if (!this.budget) return this.renderNoBudget();

    const status = calculateBudgetStatus(this.budget, this.tripData);
    const progressBarClass = status.percentage_used > 100 ? 'over-budget' :
                            status.percentage_used > 90 ? 'warning' :
                            status.percentage_used > 80 ? 'caution' : '';
    const progressWidth = Math.min(status.percentage_used, 100);

    // Get all categories and countries from trip data
    const categories = new Set<string>();
    const countries = new Set<string>();

    (this.tripData.costs || []).forEach(cost => {
      if (cost.category) categories.add(cost.category);
    });

    (this.tripData.locations || []).forEach(loc => {
      if (loc.country) countries.add(loc.country);
    });

    const currentBudget = this.budget.total_budget_usd || 0;

    return `
      <div class="budget-manager integrated">
        <div class="budget-header">
          <h3>💰 Budget Management</h3>
          <div class="header-actions">
            <button class="btn-primary" id="save-budget-btn">💾 Save Budget</button>
          </div>
        </div>

        <!-- Overall Budget Section -->
        <div class="budget-edit-section">
          <h4>Overall Budget</h4>
          <div class="budget-overview-edit">
            <div class="form-group-inline">
              <label for="total-budget">Total Budget</label>
              <div class="input-with-unit">
                <input type="number" id="total-budget" value="${currentBudget}" min="0" step="100">
                <span class="input-unit">USD</span>
              </div>
            </div>
            <div class="form-group-inline">
              <label for="contingency-pct">Contingency</label>
              <div class="input-with-unit">
                <input type="number" id="contingency-pct" value="${this.budget.contingency_pct || 0}" min="0" max="100" step="1">
                <span class="input-unit">%</span>
              </div>
            </div>
          </div>

          <!-- Budget Status Display -->
          <div class="budget-status-display">
            <div class="status-item">
              <span class="status-label">Total Spent:</span>
              <span class="status-value ${progressBarClass}">${this.formatCurrency(status.total_spent)}</span>
            </div>
            <div class="status-item">
              <span class="status-label">Remaining:</span>
              <span class="status-value ${status.total_remaining < 0 ? 'negative' : 'positive'}">
                ${this.formatCurrency(status.total_remaining)}
              </span>
            </div>
            <div class="status-item">
              <span class="status-label">Used:</span>
              <span class="status-value">${status.percentage_used.toFixed(1)}%</span>
            </div>
          </div>

          <div class="budget-progress">
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

          <!-- Always-visible budget summary -->
          <div class="budget-summary-box">
            <div class="summary-row">
              <span class="summary-label">Total Budget:</span>
              <span class="summary-value">${this.formatCurrency(currentBudget)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Allocated to Categories:</span>
              <span class="summary-value" id="category-total-allocated">${this.formatCurrency(
                Array.from(categories).reduce((sum, cat) => {
                  return sum + (this.budget?.budgets_by_category?.[cat] || 0);
                }, 0)
              )}</span>
              <span class="summary-percentage" id="category-total-pct">${currentBudget > 0 ?
                ((Array.from(categories).reduce((sum, cat) => sum + (this.budget?.budgets_by_category?.[cat] || 0), 0) / currentBudget) * 100).toFixed(1) : 0}%</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Unallocated:</span>
              <span class="summary-value" id="category-unallocated">${this.formatCurrency(
                currentBudget - Array.from(categories).reduce((sum, cat) => sum + (this.budget?.budgets_by_category?.[cat] || 0), 0)
              )}</span>
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
              const catCosts = (this.tripData.costs || [])
                .filter(c => c.category === cat)
                .reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);
              const catBudget = this.budget?.budgets_by_category?.[cat] || catCosts * 1.1;
              const catPct = currentBudget > 0 ? (catBudget / currentBudget * 100) : 0;
              const pct = status.by_category[cat]?.percentage || 0;
              const barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';

              return `
                <div class="budget-item-edit">
                  <div class="item-label">${cat.replace(/_/g, ' ')}</div>
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
                      <span class="current-spend">Spent: ${this.formatCurrency(catCosts)}</span>
                      <div class="mini-progress-bar ${barClass}">
                        <div class="mini-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Budget by Country -->
        ${countries.size > 0 ? `
          <div class="budget-edit-section">
            <div class="section-header">
              <h4>🌍 Budget by Country</h4>
              <div class="mode-controls">
                <span class="mode-indicator" id="country-mode-indicator">Mode: Dollar Amounts</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="country-mode-toggle">
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">Use %</span>
                </label>
              </div>
            </div>

            <!-- Always-visible budget summary for countries -->
            <div class="budget-summary-box">
              <div class="summary-row">
                <span class="summary-label">Total Budget:</span>
                <span class="summary-value">${this.formatCurrency(currentBudget)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Allocated to Countries:</span>
                <span class="summary-value" id="country-total-allocated">${this.formatCurrency(
                  Array.from(countries).reduce((sum, country) => {
                    return sum + (this.budget?.budgets_by_country?.[country] || 0);
                  }, 0)
                )}</span>
                <span class="summary-percentage" id="country-total-pct">${currentBudget > 0 ?
                  ((Array.from(countries).reduce((sum, country) => sum + (this.budget?.budgets_by_country?.[country] || 0), 0) / currentBudget) * 100).toFixed(1) : 0}%</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Unallocated:</span>
                <span class="summary-value" id="country-unallocated">${this.formatCurrency(
                  currentBudget - Array.from(countries).reduce((sum, country) => sum + (this.budget?.budgets_by_country?.[country] || 0), 0)
                )}</span>
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
                const countryDays = (this.tripData.locations || [])
                  .filter(loc => loc.country === country)
                  .reduce((sum, loc) => sum + (loc.duration_days || 0), 0);

                const countryCosts = (this.tripData.costs || [])
                  .filter(c => {
                    const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
                    return location?.country === country;
                  })
                  .reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);

                const countryBudget = this.budget?.budgets_by_country?.[country] || countryCosts * 1.1;
                const budgetPerDay = countryDays > 0 ? countryBudget / countryDays : 0;
                const countryPct = currentBudget > 0 ? (countryBudget / currentBudget * 100) : 0;
                const pct = status.by_country[country]?.percentage || 0;
                const barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';

                return `
                  <div class="budget-item-edit">
                    <div class="item-label">${country} <span class="days-label">(${countryDays} day${countryDays !== 1 ? 's' : ''})</span></div>
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
                        <span class="current-spend">Spent: ${this.formatCurrency(countryCosts)}</span>
                        <div class="mini-progress-bar ${barClass}">
                          <div class="mini-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div class="budget-footer">
          <button class="btn-primary" id="save-budget-btn-footer">💾 Save Budget</button>
        </div>
      </div>
    `;
  }

  private attachEventListeners() {
    // Create budget button
    const createBtn = this.container.querySelector('#create-budget-btn');
    createBtn?.addEventListener('click', () => {
      const newBudget = createDefaultBudget(this.tripData, 10);
      this.budget = newBudget;
      this.onBudgetUpdate?.(newBudget);
      this.render();
    });

    // Custom budget button
    const customBtn = this.container.querySelector('#custom-budget-btn');
    customBtn?.addEventListener('click', () => {
      const newBudget = createDefaultBudget(this.tripData, 10);
      this.budget = newBudget;
      this.onBudgetUpdate?.(newBudget);
      this.render();
    });

    // If budget exists, attach integrated edit listeners
    if (this.budget) {
      this.attachBudgetEditListeners();
    }
  }

  private attachBudgetEditListeners() {
    const totalBudgetInput = this.container.querySelector('#total-budget') as HTMLInputElement;
    const contingencyInput = this.container.querySelector('#contingency-pct') as HTMLInputElement;

    if (!totalBudgetInput) return;

    // Category mode toggle logic
    const categoryModeToggle = this.container.querySelector('#category-mode-toggle') as HTMLInputElement;
    const categoryModeIndicator = this.container.querySelector('#category-mode-indicator') as HTMLElement;
    const allocationStatus = this.container.querySelector('#allocation-status') as HTMLElement;
    const totalAllocatedSpan = this.container.querySelector('#total-allocated-pct') as HTMLElement;
    const allocationRemainder = this.container.querySelector('#allocation-remainder') as HTMLElement;

    let isPercentageMode = false;

    // Update budget summary for categories
    const updateCategorySummary = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;
      let totalAllocated = 0;

      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        totalAllocated += dollarValue;
      });

      const categoryTotalEl = this.container.querySelector('#category-total-allocated') as HTMLElement;
      const categoryPctEl = this.container.querySelector('#category-total-pct') as HTMLElement;
      const categoryUnallocatedEl = this.container.querySelector('#category-unallocated') as HTMLElement;

      if (categoryTotalEl) {
        categoryTotalEl.textContent = `$${totalAllocated.toLocaleString()}`;
      }
      if (categoryPctEl) {
        const pct = totalBudget > 0 ? (totalAllocated / totalBudget * 100) : 0;
        categoryPctEl.textContent = `${pct.toFixed(1)}%`;

        // Color code based on allocation status
        if (Math.abs(pct - 100) < 0.1) {
          categoryPctEl.style.color = '#28a745'; // Green for fully allocated
        } else if (pct > 100) {
          categoryPctEl.style.color = '#dc3545'; // Red for over-allocated
        } else {
          categoryPctEl.style.color = '#ffc107'; // Orange for under-allocated
        }
      }
      if (categoryUnallocatedEl) {
        const unallocated = totalBudget - totalAllocated;
        categoryUnallocatedEl.textContent = `$${unallocated.toLocaleString()}`;

        // Color code the unallocated amount
        if (Math.abs(unallocated) < 1) {
          categoryUnallocatedEl.style.color = '#28a745';
        } else if (unallocated < 0) {
          categoryUnallocatedEl.style.color = '#dc3545';
        } else {
          categoryUnallocatedEl.style.color = '#ffc107';
        }
      }
    };

    // Update calculated displays for categories
    const updateCalculatedDisplays = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const category = el.dataset.category!;
        const calcValueSpan = this.container.querySelector(`.calc-value[data-category="${category}"]`) as HTMLElement;

        if (isPercentageMode) {
          const pct = parseFloat(el.value) || 0;
          const dollars = Math.round(totalBudget * pct / 100);
          calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
          el.dataset.dollarValue = dollars.toString();
        } else {
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
        const el = input as HTMLInputElement;
        totalPct += parseFloat(el.value) || 0;
      });

      totalAllocatedSpan.textContent = totalPct.toFixed(1);

      const remainder = 100 - totalPct;
      const absRemainder = Math.abs(remainder);

      if (Math.abs(remainder) < 0.1) {
        allocationRemainder.textContent = '✓ Fully Allocated';
        allocationRemainder.style.color = '#28a745';
      } else if (remainder > 0) {
        allocationRemainder.textContent = `${absRemainder.toFixed(1)}% Unallocated`;
        allocationRemainder.style.color = '#ffc107';
      } else {
        allocationRemainder.textContent = `${absRemainder.toFixed(1)}% Over-allocated`;
        allocationRemainder.style.color = '#dc3545';
      }
    };

    // Category toggle between % and $
    categoryModeToggle?.addEventListener('change', () => {
      isPercentageMode = categoryModeToggle.checked;
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      categoryModeIndicator.textContent = isPercentageMode ? 'Mode: Percentages' : 'Mode: Dollar Amounts';
      allocationStatus.style.display = isPercentageMode ? 'block' : 'none';

      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const category = el.dataset.category!;
        const unitSpan = this.container.querySelector(`.input-unit[data-category="${category}"]`) as HTMLElement;
        const currentDollarValue = parseFloat(el.dataset.dollarValue!) || parseFloat(el.value) || 0;

        if (isPercentageMode) {
          const pct = totalBudget > 0 ? (currentDollarValue / totalBudget * 100) : 0;
          el.value = pct.toFixed(1);
          el.step = '0.1';
          el.max = '100';
          unitSpan.textContent = '%';
        } else {
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

    // Country mode toggle logic
    const countryModeToggle = this.container.querySelector('#country-mode-toggle') as HTMLInputElement;
    const countryModeIndicator = this.container.querySelector('#country-mode-indicator') as HTMLElement;
    const countryAllocationStatus = this.container.querySelector('#country-allocation-status') as HTMLElement;
    const countryTotalAllocatedSpan = this.container.querySelector('#country-total-allocated-pct') as HTMLElement;
    const countryAllocationRemainder = this.container.querySelector('#country-allocation-remainder') as HTMLElement;

    let isCountryPercentageMode = false;

    // Update budget summary for countries
    const updateCountrySummary = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;
      let totalAllocated = 0;

      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        totalAllocated += dollarValue;
      });

      const countryTotalEl = this.container.querySelector('#country-total-allocated') as HTMLElement;
      const countryPctEl = this.container.querySelector('#country-total-pct') as HTMLElement;
      const countryUnallocatedEl = this.container.querySelector('#country-unallocated') as HTMLElement;

      if (countryTotalEl) {
        countryTotalEl.textContent = `$${totalAllocated.toLocaleString()}`;
      }
      if (countryPctEl) {
        const pct = totalBudget > 0 ? (totalAllocated / totalBudget * 100) : 0;
        countryPctEl.textContent = `${pct.toFixed(1)}%`;

        // Color code based on allocation status
        if (Math.abs(pct - 100) < 0.1) {
          countryPctEl.style.color = '#28a745'; // Green for fully allocated
        } else if (pct > 100) {
          countryPctEl.style.color = '#dc3545'; // Red for over-allocated
        } else {
          countryPctEl.style.color = '#ffc107'; // Orange for under-allocated
        }
      }
      if (countryUnallocatedEl) {
        const unallocated = totalBudget - totalAllocated;
        countryUnallocatedEl.textContent = `$${unallocated.toLocaleString()}`;

        // Color code the unallocated amount
        if (Math.abs(unallocated) < 1) {
          countryUnallocatedEl.style.color = '#28a745';
        } else if (unallocated < 0) {
          countryUnallocatedEl.style.color = '#dc3545';
        } else {
          countryUnallocatedEl.style.color = '#ffc107';
        }
      }
    };

    // Update calculated displays for countries
    const updateCountryCalculatedDisplays = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        const country = el.dataset.country!;
        const days = parseFloat(el.dataset.days!) || 1;
        const calcValueSpan = this.container.querySelector(`.calc-value[data-country="${country}"]`) as HTMLElement;
        const perDayDisplay = this.container.querySelector(`.country-per-day-display[data-country="${country}"]`) as HTMLElement;

        if (isCountryPercentageMode) {
          const pct = parseFloat(el.value) || 0;
          const dollars = Math.round(totalBudget * pct / 100);
          const perDay = days > 0 ? Math.round(dollars / days) : 0;
          calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
          perDayDisplay.textContent = `$${perDay}/day`;
          el.dataset.dollarValue = dollars.toString();
        } else {
          const dollars = parseFloat(el.value) || 0;
          const pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
          const perDay = days > 0 ? Math.round(dollars / days) : 0;
          calcValueSpan.textContent = `${pct.toFixed(1)}%`;
          perDayDisplay.textContent = `$${perDay}/day`;
          el.dataset.dollarValue = dollars.toString();
        }
      });

      if (isCountryPercentageMode) {
        updateCountryAllocationStatus();
      }

      updateCountrySummary();
    };

    // Update allocation status for countries
    const updateCountryAllocationStatus = () => {
      let totalPct = 0;
      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        totalPct += parseFloat(el.value) || 0;
      });

      countryTotalAllocatedSpan.textContent = totalPct.toFixed(1);

      const remainder = 100 - totalPct;
      const absRemainder = Math.abs(remainder);

      if (Math.abs(remainder) < 0.1) {
        countryAllocationRemainder.textContent = '✓ Fully Allocated';
        countryAllocationRemainder.style.color = '#28a745';
      } else if (remainder > 0) {
        countryAllocationRemainder.textContent = `${absRemainder.toFixed(1)}% Unallocated`;
        countryAllocationRemainder.style.color = '#ffc107';
      } else {
        countryAllocationRemainder.textContent = `${absRemainder.toFixed(1)}% Over-allocated`;
        countryAllocationRemainder.style.color = '#dc3545';
      }
    };

    // Country toggle between % and $
    countryModeToggle?.addEventListener('change', () => {
      isCountryPercentageMode = countryModeToggle.checked;
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      countryModeIndicator.textContent = isCountryPercentageMode ? 'Mode: Percentages' : 'Mode: Dollar Amounts';
      countryAllocationStatus.style.display = isCountryPercentageMode ? 'block' : 'none';

      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        const country = el.dataset.country!;
        const unitSpan = this.container.querySelector(`.input-unit[data-country="${country}"]`) as HTMLElement;
        const currentDollarValue = parseFloat(el.dataset.dollarValue!) || parseFloat(el.value) || 0;

        if (isCountryPercentageMode) {
          const pct = totalBudget > 0 ? (currentDollarValue / totalBudget * 100) : 0;
          el.value = pct.toFixed(1);
          el.step = '0.1';
          el.max = '100';
          unitSpan.textContent = '%';
        } else {
          el.value = Math.round(currentDollarValue).toString();
          el.step = '10';
          el.removeAttribute('max');
          unitSpan.textContent = 'USD';
        }
      });

      updateCountryCalculatedDisplays();
    });

    // Update country displays when inputs change
    this.container.querySelectorAll('.country-input').forEach(input => {
      input.addEventListener('input', () => {
        updateCountryCalculatedDisplays();
      });
    });

    // Save budget functionality
    const saveBudget = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;
      const contingency = parseFloat(contingencyInput.value) || 0;

      // Collect category budgets - use stored dollar values
      const budgets_by_category: Record<string, number> = {};
      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const category = el.dataset.category!;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        budgets_by_category[category] = dollarValue;
      });

      // Collect country budgets - use stored dollar values
      const budgets_by_country: Record<string, number> = {};
      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        const country = el.dataset.country!;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        budgets_by_country[country] = dollarValue;
      });

      const newBudget: TripBudget = {
        total_budget_usd: totalBudget,
        budgets_by_category,
        budgets_by_country,
        contingency_pct: contingency,
        alerts: []
      };

      this.budget = newBudget;
      this.onBudgetUpdate?.(newBudget);
      this.render();
    };

    // Attach save listeners to both buttons
    this.container.querySelector('#save-budget-btn')?.addEventListener('click', saveBudget);
    this.container.querySelector('#save-budget-btn-footer')?.addEventListener('click', saveBudget);
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
</style>
`;
