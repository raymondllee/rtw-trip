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
 * Match a location to costs using enhanced matching logic
 * Handles UUID matching, legacy ID matching, and fallback matching
 */
function matchLocationToCosts(location, costs, allLocations) {
  const matched = [];

  costs.forEach(cost => {
    // Primary matching: exact UUID match
    if (cost.destination_id === location.id) {
      matched.push(cost);
      return;
    }

    // Secondary matching: check if location has legacy ID and cost matches that
    if (location._legacy_id && cost.destination_id === location._legacy_id) {
      matched.push(cost);
      console.log(`  ✓ Matched ${location.name} by legacy ID (${location._legacy_id}): ${cost.category} - ${cost.description?.substring(0, 30)}...`);
      return;
    }

    // Tertiary matching: check if cost has legacy destination_id reference
    if (cost._legacy_destination_id === location.id) {
      matched.push(cost);
      console.log(`  ✓ Matched ${location.name} by cost legacy reference: ${cost.category} - ${cost.description?.substring(0, 30)}...`);
      return;
    }

    // Fallback matching: name-based matching for orphaned costs
    if (!cost.destination_id || cost.destination_id === 'undefined') {
      const locationName = location.name || location.city || '';
      const costDesc = cost.description || '';
      
      // Check if cost description contains location name
      if (locationName && costDesc.toLowerCase().includes(locationName.toLowerCase())) {
        matched.push(cost);
        console.log(`  ✓ Matched ${location.name} by name fallback: ${cost.category} - ${cost.description?.substring(0, 30)}...`);
        return;
      }
    }
  });

  if (matched.length > 0) {
    console.log(`  ✓ Matched ${location.name} (${location.id}): ${matched.length} costs`);
  } else {
    // Debug: show why no costs matched
    console.log(`  ⚠️ No costs matched for ${location.name} (${location.id})`);
    console.log(`     Location legacy ID: ${location._legacy_id || 'none'}`);
    
    // Show first few cost destination_ids for debugging
    const relevantCosts = costs.slice(0, 5);
    console.log(`     Available cost destination_ids: ${relevantCosts.map(c => c.destination_id).join(', ')}`);
  }

  return matched;
}

/**
 * Find orphaned costs that don't have valid destination_ids
 * Returns costs that don't match any known destination UUID
 */
function findOrphanedCosts(costs, allLocations) {
  const validIds = new Set(allLocations.map(loc => loc.id));
  const orphaned = costs.filter(cost => {
    const destId = cost.destination_id;
    return destId && !validIds.has(destId);
  });

  if (orphaned.length > 0) {
    console.warn(`⚠️ Found ${orphaned.length} orphaned costs with invalid destination_ids:`, orphaned);
  }

  return orphaned;
}

const DURATION_SCALE_CATEGORIES = new Set(['accommodation', 'activity', 'food', 'transport', 'other']);

function normalizePositiveNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return num;
}

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function resolveNumericField(source, fields, fallback = 0) {
  if (!source || typeof source !== 'object') {
    return fallback;
  }
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      const value = Number(source[field]);
      if (Number.isFinite(value)) {
        return value;
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
  if (!Number.isFinite(diffDays) || diffDays <= 0) {
    return null;
  }
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

  const { ratio: durationRatio, baseDuration, currentDuration } = getDurationScalingInfo(location);
  const applyDurationScaling = Number.isFinite(durationRatio) && durationRatio !== 1;

  let total = 0;

  const scaledItems = destinationCosts.map(cost => {
    const categoryRaw = (cost.category || 'other').toLowerCase();
    const category = byCategory.hasOwnProperty(categoryRaw) ? categoryRaw : 'other';

    const baseAmountUSD = resolveNumericField(cost, [
      'base_amount_usd',
      'original_amount_usd',
      'amount_usd',
      'amountUSD',
      'total_usd',
      'totalUSD',
      'amount'
    ], 0);

    const baseAmount = resolveNumericField(cost, [
      'base_amount',
      'original_amount',
      'amount',
      'amount_local',
      'amountLocal'
    ], baseAmountUSD);

    const shouldScale = applyDurationScaling && shouldScaleWithDuration(cost, category);
    const scaledAmountUSD = shouldScale ? baseAmountUSD * durationRatio : baseAmountUSD;
    const scaledAmount = shouldScale ? baseAmount * durationRatio : baseAmount;

    if (byCategory.hasOwnProperty(category)) {
      byCategory[category] += scaledAmountUSD;
    } else {
      byCategory.other += scaledAmountUSD;
    }

    total += scaledAmountUSD;

    return {
      ...cost,
      scaled_amount_usd: scaledAmountUSD,
      scaled_amount: scaledAmount,
      base_amount_usd: baseAmountUSD,
      base_amount: baseAmount,
      scaling_applied: shouldScale ? durationRatio : 1
    };
  });

  return {
    total,
    byCategory,
    count: scaledItems.length,
    items: scaledItems,  // Include individual cost items for detailed display
    duration_ratio: durationRatio,
    base_duration_days: baseDuration,
    current_duration_days: currentDuration
  };
}

// Format currency
function formatCurrency(amount, currency = 'USD') {
  // Handle invalid or missing currency codes
  if (!currency || currency === 'N/A' || currency === '' || currency === 'null' || currency === 'undefined') {
    currency = 'USD';
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  } catch (error) {
    // If currency code is still invalid, fallback to USD
    console.warn(`Invalid currency code: ${currency}, using USD instead`);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
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
function generateCostBreakdownHTML(costs, showEmpty = false, destinationName = '') {
  if (!costs || !costs.byCategory) {
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

  // Enhanced detailed view with all metadata
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
        const confidenceColor = cost.confidence === 'high' ? '#22c55e' : cost.confidence === 'low' ? '#f59e0b' : '#3b82f6';
        const confidenceBadge = cost.confidence ? `<span style="background: ${confidenceColor}; color: white; font-size: 9px; padding: 1px 4px; border-radius: 3px; margin-left: 4px; text-transform: capitalize;">${cost.confidence}</span>` : '';

        // Log any invalid currency codes for debugging
        if (!cost.currency || cost.currency === 'N/A' || cost.currency === '' || cost.currency === 'null' || cost.currency === 'undefined') {
          console.warn('⚠️ Found cost with invalid currency (using USD fallback):', {
            id: cost.id,
            description: cost.description,
            currency: cost.currency,
            destination_id: cost.destination_id
          });
        }

        return `
          <div class="cost-breakdown-item-detailed" data-cost-id="${cost.id}" style="border-left: 3px solid ${confidenceColor}; padding: 8px 10px; margin: 6px 0; background: #f8f9fa; border-radius: 4px; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="color: #666; font-size: 12px; font-weight: 600;">
                ${getCategoryIcon(cost.category)} ${getCategoryDisplayName(cost.category)}
                ${confidenceBadge}
              </span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="cost-amount-editable" data-cost-id="${cost.id}" data-original-amount="${amountUSD}" data-currency="${cost.currency || 'USD'}" style="font-weight: 700; color: #333; font-size: 13px; cursor: pointer; padding: 2px 4px; border-radius: 3px; transition: background 0.2s;" title="Click to edit amount">
                  ${formatCurrency(amountUSD)} <span style="font-size: 10px; color: #888;">(${percentage}%)</span>
                </span>
              </div>
            </div>
            ${cost.currency && cost.currency !== 'USD' && cost.currency !== 'N/A'
              ? `<div style="font-size: 10px; color: #888; margin-bottom: 4px;">${formatCurrency(amountLocal, cost.currency)}</div>`
              : ''}
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

    return `${updateButton}<div class="cost-breakdown">${breakdownItems}</div>`;
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
    ${updateButton}
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
    return '';
  }

  const costPerDay = durationDays > 0 ? total / durationDays : 0;

  return `
    <div class="destination-cost-summary">
      <div class="cost-total">
        <span class="cost-icon">💰</span>
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

/**
 * Initialize inline cost editing handlers
 * Call this after rendering cost breakdowns
 */
function initInlineCostEditing() {
  // Prevent multiple initializations
  if (window._inlineCostEditingInitialized) {
    console.log('⚠️ Inline cost editing already initialized, skipping');
    return;
  }
  window._inlineCostEditingInitialized = true;

  console.log('✅ Initializing inline cost editing handlers');

  // Use event delegation to handle dynamically added cost items
  document.addEventListener('click', (e) => {
    // Check if clicked element or its parent has the editable class
    const editableElement = e.target.classList.contains('cost-amount-editable')
      ? e.target
      : e.target.closest('.cost-amount-editable');

    if (editableElement && !editableElement.querySelector('input')) {
      console.log('🖱️ Click detected on editable cost amount:', editableElement.dataset.costId);
      e.stopPropagation();
      startInlineEdit(editableElement);
    }
  }, true); // Use capture phase to catch events early

  // Add hover effect via CSS
  const style = document.createElement('style');
  style.textContent = `
    .cost-amount-editable:hover {
      background: #e3f2fd !important;
      outline: 1px solid #2196f3;
    }
    .cost-amount-editing {
      background: #fff3cd !important;
      outline: 2px solid #ffc107;
    }
  `;
  if (!document.getElementById('inline-cost-editing-styles')) {
    style.id = 'inline-cost-editing-styles';
    document.head.appendChild(style);
  }

  console.log('✅ Inline cost editing handlers initialized');
}

/**
 * Start inline editing for a cost amount
 */
function startInlineEdit(element) {
  console.log('🎯 startInlineEdit called for element:', element);

  const costId = element.dataset.costId;
  const originalAmount = parseFloat(element.dataset.originalAmount);
  const currency = element.dataset.currency || 'USD';

  console.log('📊 Cost data:', { costId, originalAmount, currency });

  // Store original content
  const originalHTML = element.innerHTML;

  // Create input field
  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.01';
  input.min = '0';
  input.value = originalAmount;
  input.style.cssText = 'width: 100px; font-size: 13px; font-weight: 700; padding: 2px 4px; border: 2px solid #2196f3; border-radius: 3px;';

  console.log('✏️ Created input field, replacing content...');

  // Replace content with input
  element.innerHTML = '';
  element.appendChild(input);
  element.classList.add('cost-amount-editing');
  input.focus();
  input.select();

  console.log('✅ Input field should now be visible and focused');

  // Track if save is in progress to prevent multiple saves
  let saveInProgress = false;
  let editCancelled = false;

  // Handle save
  const saveEdit = async () => {
    if (saveInProgress || editCancelled) {
      console.log('⏳ Save already in progress or edit cancelled, skipping...');
      return;
    }
    saveInProgress = true;

    const newAmount = parseFloat(input.value);

    if (isNaN(newAmount) || newAmount < 0) {
      alert('Please enter a valid positive number');
      input.focus();
      saveInProgress = false;
      return;
    }

    if (newAmount === originalAmount) {
      // No change, just restore if element still exists
      if (document.body.contains(element)) {
        try {
          element.innerHTML = originalHTML;
          element.classList.remove('cost-amount-editing');
        } catch (err) {
          console.warn('Could not restore element (no change):', err);
        }
      }
      saveInProgress = false;
      return;
    }

    // Show saving state if element still exists
    if (document.body.contains(element)) {
      try {
        element.innerHTML = '💾 Saving...';
      } catch (err) {
        console.warn('Could not update element to saving state:', err);
      }
    }

    try {
      // Update via API
      await updateCostAmount(costId, newAmount, currency);

      // Trigger refresh to update all displays
      console.log('📢 Dispatching costs-updated event...');
      window.dispatchEvent(new CustomEvent('costs-updated'));

      // Note: Don't wait for the event - the element will be replaced by the refresh
      // which is fine because we already saved successfully

      console.log(`✅ Updated cost ${costId}: ${originalAmount} → ${newAmount}`);
    } catch (error) {
      console.error('Failed to update cost:', error);
      alert(`Failed to update cost: ${error.message}`);
      // Restore original only if element still exists
      if (document.body.contains(element)) {
        try {
          element.innerHTML = originalHTML;
          element.classList.remove('cost-amount-editing');
        } catch (err) {
          console.warn('Could not restore element after error:', err);
        }
      }
    } finally {
      saveInProgress = false;
    }
  };

  // Handle cancel
  const cancelEdit = () => {
    editCancelled = true;
    if (document.body.contains(element) && element.contains(input)) {
      try {
        element.innerHTML = originalHTML;
        element.classList.remove('cost-amount-editing');
      } catch (err) {
        console.warn('Could not restore element during cancel:', err);
      }
    }
  };

  // Event listeners
  input.addEventListener('blur', (e) => {
    // Only save on blur if the element still exists and edit wasn't cancelled
    if (!editCancelled && document.body.contains(element)) {
      saveEdit();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur(); // Let blur handler save it
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });
}

/**
 * Update cost amount via API
 * Uses a workaround: fetches all costs, updates the specific one, and saves back to Firestore
 */
async function updateCostAmount(costId, newAmountUSD, currency = 'USD') {
  const apiBaseUrl = '';

  // Get scenario ID from window
  const scenarioId = window.currentScenarioId;
  if (!scenarioId) {
    throw new Error('No scenario loaded. Please load or create a scenario first.');
  }

  console.log(`🔄 Updating cost ${costId} with amount ${newAmountUSD} in scenario ${scenarioId}`);

  // Step 1: Fetch all costs from Firestore
  const getCostsResponse = await fetch(`${apiBaseUrl}/api/costs?session_id=${scenarioId}`);
  if (!getCostsResponse.ok) {
    throw new Error(`Failed to fetch costs: ${getCostsResponse.statusText}`);
  }

  const costsData = await getCostsResponse.json();
  const allCosts = costsData.costs || [];

  console.log(`📦 Fetched ${allCosts.length} total costs`);

  // Step 2: Find and update the specific cost
  const costIndex = allCosts.findIndex(c => c.id === costId);
  if (costIndex === -1) {
    throw new Error(`Cost with ID ${costId} not found`);
  }

  const updatedCost = {
    ...allCosts[costIndex],
    amount_usd: newAmountUSD,
    source: 'manual_override',
    confidence: 'high'
  };

  console.log(`✏️ Updated cost:`, updatedCost);

  // Step 3: Get the destination_id to use bulk-save
  const destinationId = updatedCost.destination_id;
  if (!destinationId) {
    throw new Error('Cost has no destination_id');
  }

  // Step 4: Get all costs for this destination
  const destinationCosts = allCosts.filter(c => c.destination_id === destinationId);

  // Replace the old cost with the updated one
  const updatedDestinationCosts = destinationCosts.map(c =>
    c.id === costId ? updatedCost : c
  );

  console.log(`💾 Saving ${updatedDestinationCosts.length} costs for destination ${destinationId}`);

  // Step 5: Save back to Firestore using bulk-save
  const bulkSaveResponse = await fetch(`${apiBaseUrl}/api/costs/bulk-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: scenarioId,
      scenario_id: scenarioId,
      destination_id: destinationId,
      destination_name: updatedCost.destination_name || '',
      cost_items: updatedDestinationCosts
    })
  });

  if (!bulkSaveResponse.ok) {
    const errorText = await bulkSaveResponse.text();
    throw new Error(`Failed to save updated cost: ${bulkSaveResponse.statusText} - ${errorText}`);
  }

  const result = await bulkSaveResponse.json();
  console.log(`✅ Cost updated successfully:`, result);

  return result;
}

// Make functions globally available
window.calculateDestinationCosts = calculateDestinationCosts;
window.formatCurrency = formatCurrency;
window.getCategoryIcon = getCategoryIcon;
window.getCategoryDisplayName = getCategoryDisplayName;
window.generateCostBreakdownHTML = generateCostBreakdownHTML;
window.generateCostSummaryHTML = generateCostSummaryHTML;
window.generateSidebarCostSummary = generateSidebarCostSummary;
window.findOrphanedCosts = findOrphanedCosts;
window.initInlineCostEditing = initInlineCostEditing;
window.startInlineEdit = startInlineEdit;

// Debug helper
window.testInlineEdit = function() {
  const editableElements = document.querySelectorAll('.cost-amount-editable');
  console.log('Found', editableElements.length, 'editable cost elements');
  if (editableElements.length > 0) {
    console.log('Testing first element:', editableElements[0]);
    startInlineEdit(editableElements[0]);
  } else {
    console.log('No editable elements found. Make sure cost breakdown is displayed.');
  }
};

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInlineCostEditing);
} else {
  initInlineCostEditing();
}
