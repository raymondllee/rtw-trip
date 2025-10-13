/**
 * Cost utilities for calculating and displaying trip cost information
 */

// Calculate costs for a specific destination
export function calculateDestinationCosts(destinationId, costs) {
  if (!costs || !Array.isArray(costs)) {
    return {
      total: 0,
      byCategory: {},
      count: 0
    };
  }

  const destinationCosts = costs.filter(cost => cost.destination_id === destinationId);

  const byCategory = {
    accommodation: 0,
    flight: 0,
    activity: 0,
    food: 0,
    transport: 0,
    other: 0
  };

  let total = 0;

  destinationCosts.forEach(cost => {
    const amount = parseFloat(cost.amount_usd) || 0;
    const category = cost.category || 'other';

    if (byCategory.hasOwnProperty(category)) {
      byCategory[category] += amount;
    } else {
      byCategory.other += amount;
    }

    total += amount;
  });

  return {
    total,
    byCategory,
    count: destinationCosts.length
  };
}

// Calculate costs for a leg (multiple destinations)
export function calculateLegCosts(destinationIds, costs) {
  if (!destinationIds || !Array.isArray(destinationIds)) {
    return {
      total: 0,
      byCategory: {},
      count: 0
    };
  }

  const legCosts = costs.filter(cost =>
    destinationIds.includes(cost.destination_id)
  );

  const byCategory = {
    accommodation: 0,
    flight: 0,
    activity: 0,
    food: 0,
    transport: 0,
    other: 0
  };

  let total = 0;

  legCosts.forEach(cost => {
    const amount = parseFloat(cost.amount_usd) || 0;
    const category = cost.category || 'other';

    if (byCategory.hasOwnProperty(category)) {
      byCategory[category] += amount;
    } else {
      byCategory.other += amount;
    }

    total += amount;
  });

  return {
    total,
    byCategory,
    count: legCosts.length
  };
}

// Format currency
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Get category icon
export function getCategoryIcon(category) {
  const icons = {
    accommodation: '🏨',
    flight: '✈️',
    activity: '🎯',
    food: '🍽️',
    transport: '🚗',
    other: '📦'
  };
  return icons[category] || '📦';
}

// Get category display name
export function getCategoryDisplayName(category) {
  const names = {
    accommodation: 'Accommodation',
    flight: 'Flights',
    activity: 'Activities',
    food: 'Food & Dining',
    transport: 'Local Transport',
    other: 'Other'
  };
  return names[category] || 'Other';
}

// Generate cost breakdown HTML
export function generateCostBreakdownHTML(costs, showEmpty = false, destinationName = '') {
  if (!costs || !costs.byCategory) {
    return '<div class="cost-breakdown-empty">No cost data available</div>';
  }

  const categories = [
    'accommodation',
    'flight',
    'activity',
    'food',
    'transport',
    'other'
  ];

  const breakdownItems = categories
    .map(category => {
      const amount = costs.byCategory[category] || 0;
      if (!showEmpty && amount === 0) return null;

      const percentage = costs.total > 0 ? (amount / costs.total * 100).toFixed(1) : 0;

      return `
        <div class="cost-breakdown-item" data-category="${category}">
          <div class="cost-category">
            <span class="cost-icon">${getCategoryIcon(category)}</span>
            <span class="cost-name">${getCategoryDisplayName(category)}</span>
          </div>
          <div class="cost-amount">
            <span class="cost-value">${formatCurrency(amount)}</span>
            <span class="cost-percentage">${percentage}%</span>
          </div>
        </div>
      `;
    })
    .filter(item => item !== null);

  if (breakdownItems.length === 0) {
    return '<div class="cost-breakdown-empty">No cost data available</div>';
  }

  const updateButton = destinationName ? `
    <div class="destination-cost-update">
      <button
        class="update-costs-btn"
        data-destination-name="${destinationName}"
        title="Ask AI to research costs"
      >
        💰 Update costs for ${destinationName}
      </button>
    </div>
  ` : '';

  return `
    ${updateButton}
    <div class="cost-breakdown">
      ${breakdownItems.join('')}
    </div>
  `;
}

// Generate cost summary HTML
export function generateCostSummaryHTML(costs, durationDays = 0) {
  if (!costs || costs.total === 0) {
    return '<div class="cost-summary-empty">No cost data available</div>';
  }

  const costPerDay = durationDays > 0 ? costs.total / durationDays : 0;
  const costPerPerson = costs.total / 3; // Assuming 3 travelers

  return `
    <div class="cost-summary">
      <div class="cost-summary-row">
        <span class="cost-label">Total Cost:</span>
        <span class="cost-value total">${formatCurrency(costs.total)}</span>
      </div>
      ${durationDays > 0 ? `
        <div class="cost-summary-row">
          <span class="cost-label">Per Day:</span>
          <span class="cost-value">${formatCurrency(costPerDay)}</span>
        </div>
      ` : ''}
      <div class="cost-summary-row">
        <span class="cost-label">Per Person:</span>
        <span class="cost-value">${formatCurrency(costPerPerson)}</span>
      </div>
      <div class="cost-summary-row">
        <span class="cost-label">Items:</span>
        <span class="cost-value">${costs.count}</span>
      </div>
    </div>
  `;
}

// Generate cost summary for sidebar
export function generateSidebarCostSummary(costs, durationDays = 0, destinationName = '') {
  const total = Number(costs?.total ?? 0);
  const hasCostData = Boolean(
    costs &&
    (
      (Number.isFinite(total) && total > 0) ||
      (typeof costs.count === 'number' && costs.count > 0) ||
      (Array.isArray(costs.items) && costs.items.length > 0)
    )
  );

  if (!hasCostData) {
    if (!destinationName) {
      return '';
    }

    return `
      <div class="destination-cost-missing">
        <button
          class="update-costs-btn"
          data-destination-name="${destinationName}"
          title="Ask AI to research costs"
        >
          💰 Update costs for ${destinationName}
        </button>
      </div>
    `;
  }

  const costPerDay = durationDays > 0 ? total / durationDays : 0;

  return `
    <div class="destination-cost-summary">
      <div class="cost-total">
        <span class="cost-amount">${formatCurrency(total)}</span>
        ${durationDays > 0 ? `<span class="cost-per-day">${formatCurrency(costPerDay)}/day</span>` : ''}
      </div>
      <div class="cost-breakdown-toggle" data-destination-id="">
        <span class="toggle-icon">▼</span>
        <span class="toggle-text">Details</span>
      </div>
    </div>
  `;
}

// Find destination IDs for a leg
export function getDestinationIdsForLeg(data, legName) {
  const leg = data.legs?.find(l => l.name === legName);
  if (!leg) return [];

  const destinationIds = new Set();
  leg.sub_legs?.forEach(subLeg => {
    subLeg.destination_ids?.forEach(id => destinationIds.add(id));
  });

  return Array.from(destinationIds);
}

// Calculate budget variance
export function calculateBudgetVariance(actual, budget) {
  if (!budget || budget === 0) {
    return {
      variance: actual,
      percentage: Infinity,
      status: 'no_budget'
    };
  }

  const variance = actual - budget;
  const percentage = (variance / budget) * 100;

  let status;
  if (Math.abs(percentage) <= 10) {
    status = 'on_track';
  } else if (variance > 0) {
    status = 'over_budget';
  } else {
    status = 'under_budget';
  }

  return {
    variance,
    percentage,
    status
  };
}

// Generate budget status HTML
export function generateBudgetStatusHTML(variance, budget) {
  if (!budget || budget === 0) {
    return '';
  }

  const statusIcons = {
    on_track: '✅',
    over_budget: '⚠️',
    under_budget: '💰',
    no_budget: '❓'
  };

  const statusText = {
    on_track: 'On track',
    over_budget: 'Over budget',
    under_budget: 'Under budget',
    no_budget: 'No budget'
  };

  return `
    <div class="budget-status ${variance.status}">
      <span class="status-icon">${statusIcons[variance.status]}</span>
      <span class="status-text">${statusText[variance.status]}</span>
      <span class="variance-amount">${formatCurrency(variance.variance)} (${variance.percentage.toFixed(1)}%)</span>
    </div>
  `;
}
