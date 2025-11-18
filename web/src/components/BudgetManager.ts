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

    const budgetValue = prompt(
      'Enter total budget (USD):',
      Math.round(currentBudget).toString()
    );

    if (budgetValue) {
      const amount = parseFloat(budgetValue);
      if (!isNaN(amount) && amount > 0) {
        const contingencyPct = ((amount - totalCosts) / totalCosts) * 100;
        const newBudget = createDefaultBudget(this.tripData, Math.max(0, contingencyPct));
        newBudget.total_budget_usd = amount;

        this.budget = newBudget;
        this.onBudgetUpdate?.(newBudget);
        this.render();
      }
    }
  }

  render() {
    const html = this.renderBudgetStatus();
    this.container.innerHTML = html;
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
</style>
`;
