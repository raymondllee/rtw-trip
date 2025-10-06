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
    count: destinationCosts.length
  };
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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
function generateSidebarCostSummary(costs, durationDays = 0) {
  if (!costs || costs.total === 0) {
    return '';
  }

  const costPerDay = durationDays > 0 ? costs.total / durationDays : 0;

  return `
    <div class="destination-cost-summary">
      <div class="cost-total">
        <span class="cost-amount">${formatCurrency(costs.total)}</span>
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