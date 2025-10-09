// Standalone cost utilities - non-module version for better compatibility

/**
 * Build a mapping of cost destination_id to destination names
 * This allows us to match costs even when IDs change
 */
function buildCostDestinationMapping(costs, allLocations) {
  const mapping = new Map();

  costs.forEach(cost => {
    if (!mapping.has(cost.destination_id)) {
      // Find the original location name from description or try to infer
      const location = allLocations.find(loc => loc.id === cost.destination_id);
      if (location) {
        mapping.set(cost.destination_id, {
          name: location.name,
          country: location.country,
          city: location.city
        });
      } else {
        // Try to extract from description
        const match = cost.description?.match(/in\s+([A-Z][a-zA-Z\s]+)/);
        if (match) {
          mapping.set(cost.destination_id, { name: match[1].trim() });
        }
      }
    }
  });

  return mapping;
}

/**
 * Match a location to costs using flexible matching
 * Priority: exact ID match > name match > country match > city match
 */
function matchLocationToCosts(location, costs, originalData) {
  const matched = [];
  let matchMethod = 'none';

  costs.forEach(cost => {
    // Method 1: Exact ID match
    if (cost.destination_id === location.id) {
      matched.push(cost);
      if (!matchMethod || matchMethod === 'none') matchMethod = 'id';
      return;
    }

    // Method 2: Name-based matching
    const costDesc = (cost.description || '').toLowerCase();
    const locName = (location.name || '').toLowerCase();
    const locCountry = (location.country || '').toLowerCase();
    const locCity = (location.city || '').toLowerCase();

    // Check if cost description mentions this location by name
    if (locName && (
      costDesc.includes(`in ${locName}`) ||
      costDesc.includes(`to ${locName}`) ||
      costDesc.includes(`from ${locName}`) ||
      costDesc.includes(`${locName} `)
    )) {
      matched.push(cost);
      if (!matchMethod || matchMethod === 'none') matchMethod = 'name';
      return;
    }

    // Check if cost description mentions this location's country
    // This handles cases like "Tokyo" matching costs for "in Japan"
    if (locCountry && (
      costDesc.includes(`in ${locCountry}`) ||
      costDesc.includes(`to ${locCountry}`) ||
      costDesc.includes(`from ${locCountry}`)
    )) {
      matched.push(cost);
      if (!matchMethod || matchMethod === 'none') matchMethod = 'country';
      return;
    }

    // Check city match
    if (locCity && (
      costDesc.includes(`in ${locCity}`) ||
      costDesc.includes(`${locCity} `)
    )) {
      matched.push(cost);
      if (!matchMethod || matchMethod === 'none') matchMethod = 'city';
      return;
    }
  });

  if (matched.length > 0) {
    console.log(`  ✓ Matched ${location.name} via ${matchMethod}: ${matched.length} costs`);
  }

  return matched;
}

// Calculate costs for a specific destination
function calculateDestinationCosts(destinationId, costs, location = null, allLocations = []) {
  if (!costs || !Array.isArray(costs)) {
    return {
      total: 0,
      byCategory: {},
      count: 0
    };
  }

  let destinationCosts;

  // If location object provided, use flexible matching
  if (location) {
    destinationCosts = matchLocationToCosts(location, costs, allLocations);
  } else {
    // Fallback to ID-based matching
    destinationCosts = costs.filter(cost => cost.destination_id === destinationId);
  }

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
    count: destinationCosts.length,
    items: destinationCosts  // Include individual cost items for detailed display
  };
}

// Format currency
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Get category icon
function getCategoryIcon(category) {
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
function getCategoryDisplayName(category) {
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
function generateCostBreakdownHTML(costs, showEmpty = false) {
  if (!costs || !costs.byCategory) {
    return '<div class="cost-breakdown-empty">No cost data available</div>';
  }

  // Enhanced detailed view with all metadata
  if (costs.items && costs.items.length > 0) {
    const breakdownItems = costs.items
      .sort((a, b) => (b.amount_usd || b.amount) - (a.amount_usd || a.amount))
      .map(cost => {
        const amount = cost.amount_usd || cost.amount;
        const percentage = costs.total > 0 ? (amount / costs.total * 100).toFixed(1) : 0;
        const confidenceColor = cost.confidence === 'high' ? '#22c55e' : cost.confidence === 'low' ? '#f59e0b' : '#3b82f6';
        const confidenceBadge = cost.confidence ? `<span style="background: ${confidenceColor}; color: white; font-size: 9px; padding: 1px 4px; border-radius: 3px; margin-left: 4px; text-transform: capitalize;">${cost.confidence}</span>` : '';

        return `
          <div class="cost-breakdown-item-detailed" style="border-left: 3px solid ${confidenceColor}; padding: 8px 10px; margin: 6px 0; background: #f8f9fa; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="color: #666; font-size: 12px; font-weight: 600;">
                ${getCategoryIcon(cost.category)} ${getCategoryDisplayName(cost.category)}
                ${confidenceBadge}
              </span>
              <span style="font-weight: 700; color: #333; font-size: 13px;">${formatCurrency(amount)} <span style="font-size: 10px; color: #888;">(${percentage}%)</span></span>
            </div>
            ${cost.currency !== 'USD' ? `<div style="font-size: 10px; color: #888; margin-bottom: 4px;">${formatCurrency(cost.amount, cost.currency)}</div>` : ''}
            ${cost.notes ? `<div style="font-size: 11px; color: #666; margin-top: 4px; line-height: 1.4; font-style: italic;">${cost.notes}</div>` : ''}
            <div style="font-size: 9px; color: #999; margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
              <span style="display: flex; align-items: center; gap: 4px;">
                ${cost.source === 'cost_research' ? '🔍 <span>AI Researched</span>' : '📝 <span>' + (cost.source || 'Manual') + '</span>'}
              </span>
              ${cost.researched_at ? `<span>${new Date(cost.researched_at).toLocaleDateString()}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

    return `<div class="cost-breakdown">${breakdownItems}</div>`;
  }

  // Fallback to category-based summary if no individual items
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

  return `
    <div class="cost-breakdown">
      ${breakdownItems.join('')}
    </div>
  `;
}

// Generate cost summary HTML
function generateCostSummaryHTML(costs, durationDays = 0) {
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
function generateSidebarCostSummary(costs, durationDays = 0, destinationName = '') {
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

// Make functions globally available
window.calculateDestinationCosts = calculateDestinationCosts;
window.formatCurrency = formatCurrency;
window.getCategoryIcon = getCategoryIcon;
window.getCategoryDisplayName = getCategoryDisplayName;
window.generateCostBreakdownHTML = generateCostBreakdownHTML;
window.generateCostSummaryHTML = generateCostSummaryHTML;
window.generateSidebarCostSummary = generateSidebarCostSummary;
