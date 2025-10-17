/**
 * Cost utilities for calculating and displaying trip cost information
 */

const DURATION_SCALE_CATEGORIES = new Set(['accommodation', 'activity', 'food', 'transport', 'other']);

function normalizePositiveNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function resolveNumericField(source, fields, fallback = 0) {
  if (!source || typeof source !== 'object') {
    return fallback;
  }
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      const num = Number(source[field]);
      if (Number.isFinite(num)) {
        return num;
      }
    }
  }
  return fallback;
}

function deriveDurationFromDates(location) {
  if (!location) return null;
  const arrival = location.arrival_date || location.arrivalDate || null;
  const departure = location.departure_date || location.departureDate || null;
  if (!arrival || !departure) return null;

  const start = new Date(`${arrival}T00:00:00Z`);
  const end = new Date(`${departure}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(diffDays) || diffDays <= 0) return null;
  return diffDays;
}

function getBaselineDuration(location) {
  if (!location || typeof location !== 'object') return null;

  const candidates = [
    location.__costDurationBaseline,
    location.original_duration_days,
    location.originalDurationDays,
    location.duration_days_original,
    location.durationDaysOriginal,
    location.base_duration_days,
    location.baseDurationDays,
    location.duration_baseline,
    location.durationBaseline
  ];

  for (const candidate of candidates) {
    const normalized = normalizePositiveNumber(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const duration = normalizePositiveNumber(
    location.duration_days ?? location.durationDays
  );
  if (duration) {
    return duration;
  }

  return normalizePositiveNumber(deriveDurationFromDates(location));
}

function getCurrentDuration(location, fallback = null) {
  if (!location || typeof location !== 'object') return fallback;

  const candidates = [
    location.duration_days,
    location.durationDays,
    location.current_duration_days,
    location.currentDurationDays
  ];

  for (const candidate of candidates) {
    const normalized = normalizePositiveNumber(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const fromDates = normalizePositiveNumber(deriveDurationFromDates(location));
  if (fromDates) {
    return fromDates;
  }

  return fallback;
}

function getDurationScalingInfo(location) {
  const baseDuration = getBaselineDuration(location);
  const currentDuration = getCurrentDuration(location, baseDuration);

  if (!baseDuration || !currentDuration) {
    const fallback = normalizePositiveNumber(baseDuration || currentDuration || 1) || 1;
    return {
      ratio: 1,
      baseDuration: fallback,
      currentDuration: fallback
    };
  }

  const ratio = currentDuration / baseDuration;
  return {
    ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 1,
    baseDuration,
    currentDuration
  };
}

function shouldScaleWithDuration(cost, category) {
  if (!cost || typeof cost !== 'object') return false;

  if (cost.duration_invariant === true || cost.durationInvariant === true) return false;
  if (cost.scale_with_duration === false || cost.scaleWithDuration === false) return false;
  if (cost.duration_sensitive === true || cost.durationSensitive === true) return true;
  if (cost.scale_with_duration === true || cost.scaleWithDuration === true) return true;

  const meta = String(
    cost.pricing_model ??
    cost.pricingModel ??
    cost.cost_basis ??
    cost.costBasis ??
    cost.billing_cycle ??
    cost.billingCycle ??
    ''
  ).toLowerCase();

  if (meta.includes('per_day') ||
      meta.includes('perday') ||
      meta.includes('per-night') ||
      meta.includes('per night') ||
      meta.includes('nightly') ||
      meta.includes('daily')) {
    return true;
  }

  const unit = String(cost.unit ?? cost.time_unit ?? cost.period ?? '').toLowerCase();
  if (unit === 'day' ||
      unit === 'night' ||
      unit === 'daily' ||
      unit === 'per_day' ||
      unit === 'per-night' ||
      unit === 'nightly') {
    return true;
  }

  if (cost.amount_per_day != null || cost.amountPerDay != null) return true;
  if (cost.daily_rate != null || cost.dailyRate != null) return true;

  const notes = String(cost.notes ?? '').toLowerCase();
  if (/per\s*day|per-day|daily|per\s*night|per-night|nightly/.test(notes)) return true;

  const description = String(cost.description ?? '').toLowerCase();
  if (/per\s*day|per-day|daily|per\s*night|per-night|nightly/.test(description)) return true;

  const frequency = String(cost.frequency ?? cost.cadence ?? '').toLowerCase();
  if (frequency === 'daily' || frequency === 'nightly') return true;

  if (category && DURATION_SCALE_CATEGORIES.has(category)) return true;

  return false;
}

function normalizeCategory(category) {
  const normalized = String(category || '').toLowerCase();
  switch (normalized) {
    case 'accommodation':
    case 'flight':
    case 'activity':
    case 'food':
    case 'transport':
    case 'other':
      return normalized;
    default:
      return 'other';
  }
}

// Calculate costs for a specific destination
export function calculateDestinationCosts(destinationId, costs, location = null) {
  if (!costs || !Array.isArray(costs)) {
    return {
      total: 0,
      byCategory: {},
      count: 0
    };
  }

  const targetId = location?.id ?? destinationId;
  const destinationCosts = costs.filter(cost => cost.destination_id === targetId);

  const byCategory = {
    accommodation: 0,
    flight: 0,
    activity: 0,
    food: 0,
    transport: 0,
    other: 0
  };

  const { ratio: durationRatio, baseDuration, currentDuration } = getDurationScalingInfo(location);
  const applyDurationScaling = Number.isFinite(durationRatio) && durationRatio !== 1;

  let total = 0;

  const scaledItems = destinationCosts.map(cost => {
    const category = normalizeCategory(cost.category);

    const baseAmountUSD = resolveNumericField(cost, [
      'base_amount_usd',
      'original_amount_usd',
      'amount_usd',
      'amountUSD',
      'total_usd',
      'totalUSD',
      'amount'
    ], 0);

    const baseAmountLocal = resolveNumericField(cost, [
      'base_amount',
      'original_amount',
      'amount',
      'amount_local',
      'amountLocal'
    ], baseAmountUSD);

    const shouldScale = applyDurationScaling && shouldScaleWithDuration(cost, category);
    const scaledAmountUSD = shouldScale ? baseAmountUSD * durationRatio : baseAmountUSD;
    const scaledAmountLocal = shouldScale ? baseAmountLocal * durationRatio : baseAmountLocal;

    if (byCategory.hasOwnProperty(category)) {
      byCategory[category] += scaledAmountUSD;
    } else {
      byCategory.other += scaledAmountUSD;
    }

    total += scaledAmountUSD;

    return {
      ...cost,
      scaled_amount_usd: scaledAmountUSD,
      scaled_amount: scaledAmountLocal,
      base_amount_usd: baseAmountUSD,
      base_amount: baseAmountLocal,
      scaling_applied: shouldScale ? durationRatio : 1
    };
  });

  return {
    total,
    byCategory,
    count: scaledItems.length,
    items: scaledItems,
    duration_ratio: durationRatio,
    base_duration_days: baseDuration,
    current_duration_days: currentDuration
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
    const category = normalizeCategory(cost.category);

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

  if (costs.items && costs.items.length > 0) {
    const breakdownItems = costs.items
      .slice()
      .sort((a, b) => {
        const amountA = resolveNumericField(a, ['scaled_amount_usd', 'amount_usd', 'amountUSD', 'amount'], 0);
        const amountB = resolveNumericField(b, ['scaled_amount_usd', 'amount_usd', 'amountUSD', 'amount'], 0);
        return amountB - amountA;
      })
      .map(cost => {
        const amountUSD = resolveNumericField(cost, ['scaled_amount_usd', 'amount_usd', 'amountUSD', 'amount'], 0);
        const amountLocal = resolveNumericField(cost, ['scaled_amount', 'amount', 'amount_local', 'amountLocal'], amountUSD);
        const percentage = costs.total > 0 ? (amountUSD / costs.total * 100).toFixed(1) : 0;

        return `
          <div class="cost-breakdown-item" data-cost-id="${cost.id || ''}">
            <div class="cost-category">
              <span class="cost-icon">${getCategoryIcon(cost.category)}</span>
              <span class="cost-name">${getCategoryDisplayName(cost.category)}</span>
            </div>
            <div class="cost-amount">
              <span class="cost-value">${formatCurrency(amountUSD)}</span>
              <span class="cost-percentage">${percentage}%</span>
            </div>
            ${cost.currency && cost.currency !== 'USD' && cost.currency !== 'N/A'
              ? `<div class="cost-meta">${formatCurrency(amountLocal, cost.currency)}</div>`
              : ''}
          </div>
        `;
      })
      .join('');

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
        ${breakdownItems}
      </div>
    `;
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
      <div class="cost-breakdown-toggle">
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
