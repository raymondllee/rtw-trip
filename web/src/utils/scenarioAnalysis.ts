/**
 * Scenario Cost Analysis & Comparison (Recommendation K)
 * Provides intelligent cost comparison and insights across trip scenarios
 */

import type { TripData, TripCost } from '../types/trip';

export interface ScenarioCostSummary {
  id: string;
  name: string;
  total: number;
  by_category: Record<string, number>;
  by_destination: Record<string, number>;
  cost_per_day: number;
  cost_per_person: number;
  total_days: number;
  num_destinations: number;
}

export interface CostDelta {
  category: string;
  amounts: number[];
  min: number;
  max: number;
  range: number;
  variance: number;
}

export interface ScenarioComparison {
  scenarios: ScenarioCostSummary[];
  cheapest_scenario: string;
  most_expensive_scenario: string;
  cost_range: number;
  category_deltas: Record<string, CostDelta>;
  destination_deltas: Record<string, CostDelta>;
  key_insights: string[];
  recommendations: string[];
}

/**
 * Calculate cost summary for a scenario
 */
export function calculateScenarioCostSummary(
  scenarioId: string,
  scenarioName: string,
  tripData: TripData,
  numTravelers: number = 1
): ScenarioCostSummary {
  const costs = tripData.costs || [];
  const locations = tripData.locations || [];

  // Total cost
  const total = costs.reduce((sum, cost) => {
    return sum + (cost.amount_usd || cost.amount || 0);
  }, 0);

  // By category
  const by_category: Record<string, number> = {};
  costs.forEach(cost => {
    const category = cost.category || 'other';
    const amount = cost.amount_usd || cost.amount || 0;
    by_category[category] = (by_category[category] || 0) + amount;
  });

  // By destination
  const by_destination: Record<string, number> = {};
  costs.forEach(cost => {
    const destId = cost.destination_id || cost.destinationId;
    if (!destId) return;

    const location = locations.find(loc => loc.id === destId);
    const destName = location?.name || location?.city || String(destId);

    const amount = cost.amount_usd || cost.amount || 0;
    by_destination[destName] = (by_destination[destName] || 0) + amount;
  });

  // Calculate total days
  const total_days = locations.reduce((sum, loc) => {
    return sum + (loc.duration_days || 0);
  }, 0);

  return {
    id: scenarioId,
    name: scenarioName,
    total,
    by_category,
    by_destination,
    cost_per_day: total_days > 0 ? total / total_days : 0,
    cost_per_person: numTravelers > 0 ? total / numTravelers : total,
    total_days,
    num_destinations: locations.length
  };
}

/**
 * Calculate variance for a set of numbers
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;

  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((sum, d) => sum + d, 0) / numbers.length;
}

/**
 * Generate cost insights from comparison
 */
function generateCostInsights(comparison: ScenarioComparison): string[] {
  const insights: string[] = [];

  // Price range insight
  const priceDiff = comparison.cost_range;
  const avgPrice = comparison.scenarios.reduce((sum, s) => sum + s.total, 0) / comparison.scenarios.length;
  const diffPct = (priceDiff / avgPrice) * 100;

  insights.push(
    `Price difference between scenarios: $${priceDiff.toFixed(0)} (${diffPct.toFixed(1)}%)`
  );

  // Find biggest cost driver differences
  const sortedDeltas = Object.entries(comparison.category_deltas)
    .map(([category, delta]) => ({ category, range: delta.range }))
    .sort((a, b) => b.range - a.range);

  if (sortedDeltas.length > 0) {
    const biggest = sortedDeltas[0];
    insights.push(
      `Biggest cost difference is in ${biggest.category}: $${biggest.range.toFixed(0)}`
    );
  }

  // Cost per day insights
  const costPerDayValues = comparison.scenarios.map(s => s.cost_per_day);
  const minCostPerDay = Math.min(...costPerDayValues);
  const maxCostPerDay = Math.max(...costPerDayValues);
  const costPerDayScenarioMin = comparison.scenarios.find(s => s.cost_per_day === minCostPerDay);
  const costPerDayScenarioMax = comparison.scenarios.find(s => s.cost_per_day === maxCostPerDay);

  if (costPerDayScenarioMin && costPerDayScenarioMax && costPerDayScenarioMin.id !== costPerDayScenarioMax.id) {
    insights.push(
      `${costPerDayScenarioMin.name} has lowest daily cost ($${minCostPerDay.toFixed(0)}/day) ` +
      `vs ${costPerDayScenarioMax.name} at $${maxCostPerDay.toFixed(0)}/day`
    );
  }

  // Destination-specific insights
  const destinationDeltas = Object.entries(comparison.destination_deltas)
    .map(([dest, delta]) => ({ dest, variance: delta.variance }))
    .sort((a, b) => b.variance - a.variance);

  if (destinationDeltas.length > 0) {
    const mostVariance = destinationDeltas[0];
    if (mostVariance.variance > 1000) {
      insights.push(
        `${mostVariance.dest} has the most cost variation across scenarios`
      );
    }
  }

  return insights;
}

/**
 * Generate recommendations based on comparison
 */
function generateRecommendations(comparison: ScenarioComparison): string[] {
  const recommendations: string[] = [];

  const cheapest = comparison.scenarios.find(s => s.id === comparison.cheapest_scenario);
  const mostExpensive = comparison.scenarios.find(s => s.id === comparison.most_expensive_scenario);

  if (!cheapest || !mostExpensive) return recommendations;

  // Recommend cheapest if significant savings
  const savings = mostExpensive.total - cheapest.total;
  const savingsPct = (savings / mostExpensive.total) * 100;

  if (savingsPct > 20) {
    recommendations.push(
      `💰 Choose ${cheapest.name} to save $${savings.toFixed(0)} (${savingsPct.toFixed(0)}%)`
    );
  }

  // Check for best value (cost per day)
  const bestValueScenario = comparison.scenarios.reduce((best, scenario) => {
    return scenario.cost_per_day < best.cost_per_day ? scenario : best;
  });

  if (bestValueScenario.id !== cheapest.id) {
    recommendations.push(
      `📊 ${bestValueScenario.name} offers best value at $${bestValueScenario.cost_per_day.toFixed(0)}/day`
    );
  }

  // Check for accommodation optimization opportunities
  const accomDeltas = comparison.category_deltas['accommodation'];
  if (accomDeltas && accomDeltas.range > 1000) {
    const avgAccom = accomDeltas.amounts.reduce((sum, a) => sum + a, 0) / accomDeltas.amounts.length;
    recommendations.push(
      `🏨 Accommodation varies significantly ($${accomDeltas.range.toFixed(0)} range). ` +
      `Consider mid-range options around $${avgAccom.toFixed(0)}`
    );
  }

  // Check for flight optimization
  const flightDeltas = comparison.category_deltas['flight'];
  if (flightDeltas && flightDeltas.range > 500) {
    recommendations.push(
      `✈️ Flight costs vary by $${flightDeltas.range.toFixed(0)}. ` +
      `Research alternative routes or dates for cheaper options`
    );
  }

  // Duration optimization
  const durationsVary = new Set(comparison.scenarios.map(s => s.total_days)).size > 1;
  if (durationsVary) {
    const shortestDuration = Math.min(...comparison.scenarios.map(s => s.total_days));
    const longestDuration = Math.max(...comparison.scenarios.map(s => s.total_days));

    const shortScenario = comparison.scenarios.find(s => s.total_days === shortestDuration);
    const longScenario = comparison.scenarios.find(s => s.total_days === longestDuration);

    if (shortScenario && longScenario) {
      const extraDays = longestDuration - shortestDuration;
      const extraCost = longScenario.total - shortScenario.total;
      const costPerExtraDay = extraCost / extraDays;

      recommendations.push(
        `📅 ${longScenario.name} is ${extraDays} days longer, costing $${extraCost.toFixed(0)} more ` +
        `($${costPerExtraDay.toFixed(0)}/extra day)`
      );
    }
  }

  return recommendations;
}

/**
 * Compare multiple trip scenarios
 */
export function compareScenarios(summaries: ScenarioCostSummary[]): ScenarioComparison {
  if (summaries.length === 0) {
    throw new Error('No scenarios to compare');
  }

  // Find cheapest and most expensive
  const sortedByTotal = [...summaries].sort((a, b) => a.total - b.total);
  const cheapest = sortedByTotal[0];
  const mostExpensive = sortedByTotal[sortedByTotal.length - 1];

  // Calculate category deltas
  const category_deltas: Record<string, CostDelta> = {};
  const allCategories = new Set<string>();

  summaries.forEach(summary => {
    Object.keys(summary.by_category).forEach(cat => allCategories.add(cat));
  });

  allCategories.forEach(category => {
    const amounts = summaries.map(s => s.by_category[category] || 0);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);

    category_deltas[category] = {
      category,
      amounts,
      min,
      max,
      range: max - min,
      variance: calculateVariance(amounts)
    };
  });

  // Calculate destination deltas
  const destination_deltas: Record<string, CostDelta> = {};
  const allDestinations = new Set<string>();

  summaries.forEach(summary => {
    Object.keys(summary.by_destination).forEach(dest => allDestinations.add(dest));
  });

  allDestinations.forEach(destination => {
    const amounts = summaries.map(s => s.by_destination[destination] || 0);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);

    destination_deltas[destination] = {
      category: destination,
      amounts,
      min,
      max,
      range: max - min,
      variance: calculateVariance(amounts)
    };
  });

  // Create base comparison
  const comparison: ScenarioComparison = {
    scenarios: summaries,
    cheapest_scenario: cheapest.id,
    most_expensive_scenario: mostExpensive.id,
    cost_range: mostExpensive.total - cheapest.total,
    category_deltas,
    destination_deltas,
    key_insights: [],
    recommendations: []
  };

  // Generate insights and recommendations
  comparison.key_insights = generateCostInsights(comparison);
  comparison.recommendations = generateRecommendations(comparison);

  return comparison;
}

/**
 * Format comparison results for display
 */
export function formatComparisonHTML(comparison: ScenarioComparison): string {
  const cheapest = comparison.scenarios.find(s => s.id === comparison.cheapest_scenario);
  const mostExpensive = comparison.scenarios.find(s => s.id === comparison.most_expensive_scenario);

  return `
    <div class="scenario-comparison">
      <div class="comparison-header">
        <h2>💼 Scenario Cost Comparison</h2>
        <p class="comparison-subtitle">Comparing ${comparison.scenarios.length} trip scenarios</p>
      </div>

      <!-- Summary Cards -->
      <div class="comparison-summary">
        <div class="summary-card best">
          <div class="card-icon">🏆</div>
          <div class="card-label">Cheapest Option</div>
          <div class="card-value">${cheapest?.name}</div>
          <div class="card-amount">$${cheapest?.total.toFixed(0)}</div>
        </div>

        <div class="summary-card">
          <div class="card-icon">💰</div>
          <div class="card-label">Price Range</div>
          <div class="card-amount">$${comparison.cost_range.toFixed(0)}</div>
        </div>

        <div class="summary-card">
          <div class="card-icon">💸</div>
          <div class="card-label">Most Expensive</div>
          <div class="card-value">${mostExpensive?.name}</div>
          <div class="card-amount">$${mostExpensive?.total.toFixed(0)}</div>
        </div>
      </div>

      <!-- Key Insights -->
      <div class="comparison-section">
        <h3>💡 Key Insights</h3>
        <ul class="insights-list">
          ${comparison.key_insights.map(insight => `<li>${insight}</li>`).join('')}
        </ul>
      </div>

      <!-- Recommendations -->
      <div class="comparison-section recommendations">
        <h3>🎯 Recommendations</h3>
        <ul class="recommendations-list">
          ${comparison.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>

      <!-- Side-by-side Comparison -->
      <div class="comparison-section">
        <h3>📊 Detailed Comparison</h3>
        <div class="scenarios-grid">
          ${comparison.scenarios.map(scenario => `
            <div class="scenario-card ${scenario.id === cheapest?.id ? 'cheapest' : ''}">
              <h4>${scenario.name}</h4>
              <div class="scenario-total">$${scenario.total.toFixed(0)}</div>
              <div class="scenario-stats">
                <div class="stat">
                  <span class="stat-label">Per Day</span>
                  <span class="stat-value">$${scenario.cost_per_day.toFixed(0)}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Duration</span>
                  <span class="stat-value">${scenario.total_days} days</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Destinations</span>
                  <span class="stat-value">${scenario.num_destinations}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Category Breakdown -->
      <div class="comparison-section">
        <h3>📈 Cost by Category</h3>
        <div class="category-comparison">
          ${Object.entries(comparison.category_deltas)
            .filter(([_, delta]) => delta.max > 0)
            .sort((a, b) => b[1].range - a[1].range)
            .map(([category, delta]) => `
              <div class="category-row">
                <div class="category-name">${category}</div>
                <div class="category-range">
                  <span class="range-label">$${delta.min.toFixed(0)} - $${delta.max.toFixed(0)}</span>
                  <span class="range-diff">(±$${delta.range.toFixed(0)})</span>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    </div>
  `;
}
