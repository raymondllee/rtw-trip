/**
 * Budget Manager UI Component (Recommendation J)
 * Provides budget tracking, alerts, and management interface
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

    return `
      <div class="budget-manager">
        <div class="budget-header">
          <h3>💰 Budget Management</h3>
          <button class="btn-icon" id="edit-budget-btn" title="Edit Budget">✏️</button>
        </div>

        <!-- Total Budget Overview -->
        <div class="budget-overview">
          <div class="budget-total">
            <div class="budget-label">Total Budget</div>
            <div class="budget-amount">${this.formatCurrency(status.total_budget)}</div>
          </div>
          <div class="budget-spent ${progressBarClass}">
            <div class="budget-label">Total Spent</div>
            <div class="budget-amount">${this.formatCurrency(status.total_spent)}</div>
          </div>
          <div class="budget-remaining">
            <div class="budget-label">Remaining</div>
            <div class="budget-amount ${status.total_remaining < 0 ? 'negative' : ''}">
              ${this.formatCurrency(status.total_remaining)}
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="budget-progress">
          <div class="progress-bar ${progressBarClass}">
            <div class="progress-fill" style="width: ${progressWidth}%"></div>
          </div>
          <div class="progress-label">${status.percentage_used.toFixed(1)}% used</div>
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

        <!-- Category Breakdown -->
        <div class="budget-breakdown">
          <h4>📊 By Category</h4>
          <div class="budget-items">
            ${Object.entries(status.by_category).map(([category, data]) => {
              const pct = data.percentage;
              const barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';
              return `
                <div class="budget-item">
                  <div class="item-header">
                    <span class="item-name">${category}</span>
                    <span class="item-amounts">
                      ${this.formatCurrency(data.spent)} / ${this.formatCurrency(data.budget)}
                    </span>
                  </div>
                  <div class="item-progress">
                    <div class="mini-progress-bar ${barClass}">
                      <div class="mini-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                    </div>
                    <span class="item-percentage">${pct.toFixed(0)}%</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Destination Breakdown -->
        ${Object.keys(status.by_destination).length > 0 ? `
          <div class="budget-breakdown">
            <h4>🌍 By Destination</h4>
            <div class="budget-items">
              ${Object.entries(status.by_destination).map(([destination, data]) => {
                const pct = data.percentage;
                const barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';
                return `
                  <div class="budget-item">
                    <div class="item-header">
                      <span class="item-name">${destination}</span>
                      <span class="item-amounts">
                        ${this.formatCurrency(data.spent)} / ${this.formatCurrency(data.budget)}
                      </span>
                    </div>
                    <div class="item-progress">
                      <div class="mini-progress-bar ${barClass}">
                        <div class="mini-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                      </div>
                      <span class="item-percentage">${pct.toFixed(0)}%</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
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
      this.showCustomBudgetDialog();
    });

    // Edit budget button
    const editBtn = this.container.querySelector('#edit-budget-btn');
    editBtn?.addEventListener('click', () => {
      this.showCustomBudgetDialog();
    });
  }

  private showCustomBudgetDialog() {
    const totalCosts = (this.tripData.costs || [])
      .reduce((sum, cost) => sum + (cost.amount_usd || cost.amount || 0), 0);

    const currentBudget = this.budget?.total_budget_usd || totalCosts * 1.1;
    const currentContingency = this.budget?.contingency_pct || 10;

    // Get all unique categories and destinations
    const categories = new Set<string>();
    const destinations = new Map<string, string>();

    (this.tripData.costs || []).forEach(cost => {
      if (cost.category) categories.add(cost.category);
      if (cost.destination_id) {
        const location = (this.tripData.locations || []).find(loc => loc.id === cost.destination_id);
        if (location) {
          destinations.set(cost.destination_id, location.name || location.city || cost.destination_id);
        }
      }
    });

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'budget-edit-modal';
    modal.innerHTML = `
      <div class="budget-edit-dialog">
        <div class="dialog-header">
          <h3>Edit Budget</h3>
          <button class="close-btn" id="close-edit-dialog">×</button>
        </div>

        <div class="dialog-body">
          <div class="form-section">
            <h4>Overall Budget</h4>
            <div class="form-group">
              <label for="total-budget">Total Budget (USD)</label>
              <input type="number" id="total-budget" value="${Math.round(currentBudget)}" min="0" step="100">
            </div>
            <div class="form-group">
              <label for="contingency-pct">Contingency (%)</label>
              <input type="number" id="contingency-pct" value="${currentContingency}" min="0" max="100" step="1">
              <small>Percentage above current costs for buffer</small>
            </div>
          </div>

          <div class="form-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h4 style="margin: 0;">Budget by Category</h4>
              <label class="toggle-switch">
                <input type="checkbox" id="category-mode-toggle">
                <span class="toggle-slider"></span>
                <span class="toggle-label">Use %</span>
              </label>
            </div>

            <div id="allocation-status" style="display: none; padding: 12px; background: #f8f9fa; border-radius: 6px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong>Total Allocated:</strong> <span id="total-allocated-pct">0</span>%
                </div>
                <div id="allocation-remainder" style="font-weight: 600;"></div>
              </div>
            </div>

            <div id="category-budgets">
              ${Array.from(categories).map(cat => {
                const catCosts = (this.tripData.costs || [])
                  .filter(c => c.category === cat)
                  .reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);
                const catBudget = this.budget?.budgets_by_category?.[cat] || catCosts * 1.1;
                const catPct = currentBudget > 0 ? (catBudget / currentBudget * 100) : 0;
                return `
                  <div class="form-group">
                    <label for="cat-${cat}">${cat.replace(/_/g, ' ')}</label>
                    <div class="budget-input-group">
                      <div class="dual-input-container">
                        <input type="number"
                               class="cat-dollar-input"
                               id="cat-${cat}"
                               data-category="${cat}"
                               value="${Math.round(catBudget)}"
                               min="0"
                               step="10">
                        <input type="number"
                               class="cat-pct-input"
                               id="cat-pct-${cat}"
                               data-category="${cat}"
                               value="${catPct.toFixed(1)}"
                               min="0"
                               max="100"
                               step="0.1"
                               style="display: none;">
                        <span class="input-suffix dollar-suffix">USD</span>
                        <span class="input-suffix pct-suffix" style="display: none;">%</span>
                      </div>
                      <span class="calculated-amount" style="display: none;"></span>
                      <span class="current-spend">Current: $${Math.round(catCosts).toLocaleString()}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="form-section">
            <h4>Budget by Destination</h4>
            <div id="destination-budgets">
              ${Array.from(destinations).map(([id, name]) => {
                const destCosts = (this.tripData.costs || [])
                  .filter(c => c.destination_id === id)
                  .reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);
                const destBudget = this.budget?.budgets_by_destination?.[id] || destCosts * 1.1;
                return `
                  <div class="form-group">
                    <label for="dest-${id}">${name}</label>
                    <div class="budget-input-group">
                      <input type="number" id="dest-${id}" data-destination="${id}" value="${Math.round(destBudget)}" min="0" step="10">
                      <span class="current-spend">Current: $${Math.round(destCosts).toLocaleString()}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn-secondary" id="cancel-edit-btn">Cancel</button>
          <button class="btn-primary" id="save-budget-btn">Save Budget</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeDialog = () => {
      modal.remove();
    };

    modal.querySelector('#close-edit-dialog')?.addEventListener('click', closeDialog);
    modal.querySelector('#cancel-edit-btn')?.addEventListener('click', closeDialog);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeDialog();
    });

    // Category percentage/dollar toggle logic
    const categoryModeToggle = modal.querySelector('#category-mode-toggle') as HTMLInputElement;
    const allocationStatus = modal.querySelector('#allocation-status') as HTMLElement;
    const totalAllocatedSpan = modal.querySelector('#total-allocated-pct') as HTMLElement;
    const allocationRemainder = modal.querySelector('#allocation-remainder') as HTMLElement;
    const totalBudgetInput = modal.querySelector('#total-budget') as HTMLInputElement;

    let isPercentageMode = false;

    const updateAllocationStatus = () => {
      if (!isPercentageMode) return;

      let totalPct = 0;
      modal.querySelectorAll('.cat-pct-input').forEach(input => {
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

    const updateCalculatedAmounts = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      modal.querySelectorAll('.cat-pct-input').forEach(input => {
        const el = input as HTMLInputElement;
        const pct = parseFloat(el.value) || 0;
        const amount = (totalBudget * pct / 100);

        const category = el.dataset.category!;
        const dollarInput = modal.querySelector(`#cat-${category}`) as HTMLInputElement;
        const calculatedSpan = el.closest('.budget-input-group')?.querySelector('.calculated-amount') as HTMLElement;

        // Update dollar input (hidden in % mode)
        dollarInput.value = Math.round(amount).toString();

        // Update calculated amount display
        if (calculatedSpan) {
          calculatedSpan.textContent = `= $${Math.round(amount).toLocaleString()}`;
        }
      });
    };

    categoryModeToggle.addEventListener('change', () => {
      isPercentageMode = categoryModeToggle.checked;

      // Toggle visibility
      modal.querySelectorAll('.cat-dollar-input').forEach(el => {
        (el as HTMLElement).style.display = isPercentageMode ? 'none' : 'block';
      });
      modal.querySelectorAll('.cat-pct-input').forEach(el => {
        (el as HTMLElement).style.display = isPercentageMode ? 'block' : 'none';
      });
      modal.querySelectorAll('.dollar-suffix').forEach(el => {
        (el as HTMLElement).style.display = isPercentageMode ? 'none' : 'inline';
      });
      modal.querySelectorAll('.pct-suffix').forEach(el => {
        (el as HTMLElement).style.display = isPercentageMode ? 'inline' : 'none';
      });
      modal.querySelectorAll('.calculated-amount').forEach(el => {
        (el as HTMLElement).style.display = isPercentageMode ? 'inline' : 'none';
      });

      allocationStatus.style.display = isPercentageMode ? 'block' : 'none';

      if (isPercentageMode) {
        // Convert current dollar values to percentages
        const totalBudget = parseFloat(totalBudgetInput.value) || 0;
        if (totalBudget > 0) {
          modal.querySelectorAll('.cat-dollar-input').forEach(dollarInput => {
            const el = dollarInput as HTMLInputElement;
            const category = el.dataset.category!;
            const amount = parseFloat(el.value) || 0;
            const pct = (amount / totalBudget * 100);
            const pctInput = modal.querySelector(`#cat-pct-${category}`) as HTMLInputElement;
            if (pctInput) {
              pctInput.value = pct.toFixed(1);
            }
          });
        }
        updateAllocationStatus();
        updateCalculatedAmounts();
      }
    });

    // Update calculated amounts when percentage changes
    modal.querySelectorAll('.cat-pct-input').forEach(input => {
      input.addEventListener('input', () => {
        updateAllocationStatus();
        updateCalculatedAmounts();
      });
    });

    // Update percentages when total budget changes (in % mode)
    totalBudgetInput.addEventListener('input', () => {
      if (isPercentageMode) {
        updateCalculatedAmounts();
      }
    });

    modal.querySelector('#save-budget-btn')?.addEventListener('click', () => {
      const totalBudgetInput = modal.querySelector('#total-budget') as HTMLInputElement;
      const contingencyInput = modal.querySelector('#contingency-pct') as HTMLInputElement;

      const totalBudget = parseFloat(totalBudgetInput.value) || 0;
      const contingency = parseFloat(contingencyInput.value) || 0;

      // Collect category budgets
      const budgets_by_category: Record<string, number> = {};
      modal.querySelectorAll('[data-category]').forEach(input => {
        const el = input as HTMLInputElement;
        const category = el.dataset.category!;
        budgets_by_category[category] = parseFloat(el.value) || 0;
      });

      // Collect destination budgets
      const budgets_by_destination: Record<string, number> = {};
      modal.querySelectorAll('[data-destination]').forEach(input => {
        const el = input as HTMLInputElement;
        const destId = el.dataset.destination!;
        budgets_by_destination[destId] = parseFloat(el.value) || 0;
      });

      const newBudget: TripBudget = {
        total_budget_usd: totalBudget,
        budgets_by_category,
        budgets_by_destination,
        contingency_pct: contingency,
        alerts: []
      };

      this.budget = newBudget;
      this.onBudgetUpdate?.(newBudget);
      this.render();
      closeDialog();
    });
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

/* Budget Edit Modal */
.budget-edit-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.budget-edit-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f0f0f0;
}

.dialog-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.form-section {
  margin-bottom: 24px;
}

.form-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  padding-bottom: 8px;
  border-bottom: 2px solid #007bff;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
  color: #333;
  text-transform: capitalize;
}

.form-group input[type="number"] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input[type="number"]:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-group small {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}

.budget-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.budget-input-group input {
  flex: 1;
}

.budget-input-group .current-spend {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
}

.dialog-footer .btn-primary,
.dialog-footer .btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
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

/* Dual Input Container */
.dual-input-container {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.dual-input-container input {
  width: 100%;
  padding-right: 45px;
}

.input-suffix {
  position: absolute;
  right: 12px;
  font-size: 13px;
  color: #666;
  font-weight: 500;
  pointer-events: none;
}

.calculated-amount {
  font-size: 13px;
  color: #007bff;
  font-weight: 600;
  white-space: nowrap;
  margin-left: 8px;
}

/* Allocation status colors */
#allocation-status {
  border-left: 4px solid #007bff;
}
</style>
`;
