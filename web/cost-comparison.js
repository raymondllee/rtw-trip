/**
 * Cost Comparison View
 * Compare costs across different trip scenarios
 */

class CostComparison {
  constructor(apiBaseUrl = '') {
    this.apiBaseUrl = apiBaseUrl;
    this.scenarios = [];
  }

  /**
   * Load multiple scenarios for comparison
   * @param {Array} scenarios - Array of scenario objects with costs
   */
  async loadScenarios(scenarios) {
    this.scenarios = scenarios;

    // Fetch cost summaries for each scenario
    for (const scenario of this.scenarios) {
      scenario.costSummary = await this.fetchScenarioCosts(scenario);
    }
  }

  /**
   * Fetch costs for a specific scenario
   * @param {Object} scenario - Scenario object with itinerary data
   */
  async fetchScenarioCosts(scenario) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/costs/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: scenario.id || 'default',
          destinations: scenario.itinerary?.locations || [],
          traveler_count: scenario.itinerary?.trip?.travelers?.length || 1,
          total_days: this.calculateTotalDays(scenario.itinerary)
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result.summary;
      }
    } catch (error) {
      console.error('Error fetching scenario costs:', error);
    }

    return this.getEmptySummary();
  }

  /**
   * Calculate total days for a scenario
   */
  calculateTotalDays(itinerary) {
    if (!itinerary?.trip?.start_date || !itinerary?.trip?.end_date) return 0;

    const start = new Date(itinerary.trip.start_date);
    const end = new Date(itinerary.trip.end_date);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Get empty cost summary
   */
  getEmptySummary() {
    return {
      totalUSD: 0,
      costsByCategory: {
        flight: 0,
        accommodation: 0,
        activity: 0,
        food: 0,
        transport: 0,
        other: 0
      },
      costPerPerson: 0,
      costPerDay: 0
    };
  }

  /**
   * Create comparison view
   * @returns {HTMLElement}
   */
  createComparisonView() {
    const container = document.createElement('div');
    container.className = 'cost-comparison-container';

    if (this.scenarios.length < 2) {
      container.innerHTML = `
        <div class="comparison-empty-state">
          <h3>No Scenarios to Compare</h3>
          <p>Create multiple trip scenarios to compare their costs.</p>
        </div>
      `;
      return container;
    }

    container.innerHTML = `
      <div class="comparison-header">
        <h2>Scenario Cost Comparison</h2>
        <p>Compare costs across ${this.scenarios.length} different trip scenarios</p>
      </div>
      <div class="comparison-content"></div>
    `;

    const content = container.querySelector('.comparison-content');

    // Overview table
    content.appendChild(this.createOverviewTable());

    // Category breakdown charts
    content.appendChild(this.createCategoryComparison());

    // Detailed breakdown
    content.appendChild(this.createDetailedBreakdown());

    return container;
  }

  /**
   * Create overview comparison table
   */
  createOverviewTable() {
    const table = document.createElement('div');
    table.className = 'comparison-overview';

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    };

    table.innerHTML = `
      <h3>Overview</h3>
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Total Cost</th>
            <th>Per Person</th>
            <th>Per Day</th>
            <th>Duration</th>
            <th>Destinations</th>
          </tr>
        </thead>
        <tbody>
          ${this.scenarios.map((scenario, index) => {
            const summary = scenario.costSummary || this.getEmptySummary();
            const duration = this.calculateTotalDays(scenario.itinerary);
            const destCount = scenario.itinerary?.locations?.length || 0;

            // Determine if this is the cheapest/most expensive
            const totals = this.scenarios.map(s => s.costSummary?.totalUSD || 0);
            const minCost = Math.min(...totals);
            const maxCost = Math.max(...totals);
            const isCheapest = summary.totalUSD === minCost && summary.totalUSD > 0;
            const isExpensive = summary.totalUSD === maxCost && summary.totalUSD > 0;

            return `
              <tr class="${isCheapest ? 'cheapest-row' : ''} ${isExpensive ? 'expensive-row' : ''}">
                <td class="scenario-name">
                  ${scenario.name || `Scenario ${index + 1}`}
                  ${isCheapest ? '<span class="badge badge-success">Cheapest</span>' : ''}
                  ${isExpensive ? '<span class="badge badge-warning">Most Expensive</span>' : ''}
                </td>
                <td class="cost-total">${formatCurrency(summary.totalUSD)}</td>
                <td>${formatCurrency(summary.costPerPerson || 0)}</td>
                <td>${formatCurrency(summary.costPerDay || 0)}</td>
                <td>${duration} days</td>
                <td>${destCount} destinations</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    return table;
  }

  /**
   * Create category comparison
   */
  createCategoryComparison() {
    const section = document.createElement('div');
    section.className = 'category-comparison';

    const categories = ['flight', 'accommodation', 'activity', 'food', 'transport', 'other'];
    const categoryLabels = {
      flight: '✈️ Flights',
      accommodation: '🏨 Accommodation',
      activity: '🎯 Activities',
      food: '🍽️ Food',
      transport: '🚗 Transport',
      other: '📌 Other'
    };

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    };

    section.innerHTML = `
      <h3>Cost Breakdown by Category</h3>
      <div class="category-bars">
        ${categories.map(category => {
          // Get max value for this category across scenarios for scaling
          const values = this.scenarios.map(s =>
            s.costSummary?.costsByCategory?.[category] || 0
          );
          const maxValue = Math.max(...values);

          return `
            <div class="category-bar-group">
              <div class="category-label">${categoryLabels[category]}</div>
              <div class="category-bars-container">
                ${this.scenarios.map((scenario, index) => {
                  const value = scenario.costSummary?.costsByCategory?.[category] || 0;
                  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

                  return `
                    <div class="scenario-bar-row">
                      <div class="scenario-bar-label">${scenario.name || `Scenario ${index + 1}`}</div>
                      <div class="scenario-bar-wrapper">
                        <div class="scenario-bar" style="width: ${percentage}%"></div>
                      </div>
                      <div class="scenario-bar-value">${formatCurrency(value)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    return section;
  }

  /**
   * Create detailed breakdown section
   */
  createDetailedBreakdown() {
    const section = document.createElement('div');
    section.className = 'detailed-breakdown';

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    };

    section.innerHTML = `
      <h3>Detailed Breakdown</h3>
      <div class="scenario-cards">
        ${this.scenarios.map((scenario, index) => {
          const summary = scenario.costSummary || this.getEmptySummary();

          return `
            <div class="scenario-card">
              <h4>${scenario.name || `Scenario ${index + 1}`}</h4>
              <div class="scenario-card-total">${formatCurrency(summary.totalUSD)}</div>

              <div class="scenario-card-breakdown">
                <div class="breakdown-row">
                  <span>✈️ Flights</span>
                  <span>${formatCurrency(summary.costsByCategory.flight)}</span>
                </div>
                <div class="breakdown-row">
                  <span>🏨 Accommodation</span>
                  <span>${formatCurrency(summary.costsByCategory.accommodation)}</span>
                </div>
                <div class="breakdown-row">
                  <span>🎯 Activities</span>
                  <span>${formatCurrency(summary.costsByCategory.activity)}</span>
                </div>
                <div class="breakdown-row">
                  <span>🍽️ Food</span>
                  <span>${formatCurrency(summary.costsByCategory.food)}</span>
                </div>
                <div class="breakdown-row">
                  <span>🚗 Transport</span>
                  <span>${formatCurrency(summary.costsByCategory.transport)}</span>
                </div>
                <div class="breakdown-row">
                  <span>📌 Other</span>
                  <span>${formatCurrency(summary.costsByCategory.other)}</span>
                </div>
              </div>

              <div class="scenario-card-stats">
                <div class="stat">
                  <div class="stat-label">Per Person</div>
                  <div class="stat-value">${formatCurrency(summary.costPerPerson || 0)}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Per Day</div>
                  <div class="stat-value">${formatCurrency(summary.costPerDay || 0)}</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    return section;
  }

  /**
   * Show comparison modal
   */
  async showComparisonModal(scenarios) {
    await this.loadScenarios(scenarios);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content comparison-modal';

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3>Cost Comparison</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body"></div>
    `;

    modalContent.querySelector('.modal-body').appendChild(this.createComparisonView());
    modal.appendChild(modalContent);

    document.body.appendChild(modal);

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.CostComparison = CostComparison;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CostComparison };
}
