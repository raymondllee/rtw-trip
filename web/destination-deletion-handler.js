/**
 * Destination Deletion Handler
 * Provides UI and logic for handling destination deletion with cascade options
 */

import { deleteCostsByDestination, normalizeId } from './destination-id-manager.js';

/**
 * Show destination deletion confirmation dialog with cascade options
 * @param {Object} destination - Destination to delete
 * @param {Array} associatedCosts - Costs linked to this destination
 * @param {Function} onConfirm - Callback with deletion options
 */
export function showDestinationDeletionDialog(destination, associatedCosts, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'delete-destination-modal';

  const totalCostAmount = associatedCosts.reduce((sum, cost) =>
    sum + (cost.amount_usd || cost.amountUSD || cost.amount || 0), 0
  );

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h2>🗑️ Delete Destination</h2>
        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>

      <div class="modal-body">
        <div style="padding: 15px; background: #fff3cd; border-radius: 4px; margin-bottom: 20px;">
          <strong>Deleting:</strong> ${destination.name}
          ${destination.city ? `, ${destination.city}` : ''}
          ${destination.country ? `, ${destination.country}` : ''}
        </div>

        ${associatedCosts.length > 0 ? `
          <div class="warning-box" style="padding: 15px; background: #fee; border-left: 3px solid #e74c3c; margin-bottom: 20px;">
            <strong>⚠️ Warning:</strong> This destination has <strong>${associatedCosts.length}</strong> associated costs
            (total: <strong>$${totalCostAmount.toFixed(2)}</strong>)
          </div>

          <h3>What should happen to the associated costs?</h3>

          <div class="deletion-options">
            <label class="radio-option" style="display: block; padding: 12px; border: 2px solid #ddd; border-radius: 4px; margin-bottom: 10px; cursor: pointer;">
              <input type="radio" name="deletion-strategy" value="reassign" style="margin-right: 8px;">
              <strong>Reassign to another destination</strong>
              <div style="font-size: 0.9em; color: #666; margin-left: 24px;">
                Move all costs to a different destination
              </div>
              <div id="reassign-destination-select" style="margin-left: 24px; margin-top: 10px; display: none;">
                <select id="reassign-dest-dropdown" style="width: 100%; padding: 8px;">
                  <option value="">Select destination...</option>
                </select>
              </div>
            </label>

            <label class="radio-option" style="display: block; padding: 12px; border: 2px solid #ddd; border-radius: 4px; margin-bottom: 10px; cursor: pointer;">
              <input type="radio" name="deletion-strategy" value="unassign" style="margin-right: 8px;">
              <strong>Keep as unassigned costs</strong>
              <div style="font-size: 0.9em; color: #666; margin-left: 24px;">
                Remove destination reference but keep the cost items
              </div>
            </label>

            <label class="radio-option" style="display: block; padding: 12px; border: 2px solid #ddd; border-radius: 4px; cursor: pointer;">
              <input type="radio" name="deletion-strategy" value="delete" style="margin-right: 8px;" checked>
              <strong>Delete all associated costs</strong>
              <div style="font-size: 0.9em; color: #666; margin-left: 24px;">
                ⚠️ Permanently delete all ${associatedCosts.length} cost items (cannot be undone)
              </div>
            </label>
          </div>

          <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 4px;">
            <h4 style="margin-top: 0;">Associated Costs Preview:</h4>
            <div style="max-height: 150px; overflow-y: auto;">
              ${associatedCosts.slice(0, 5).map(cost => `
                <div style="padding: 5px 0; border-bottom: 1px solid #eee;">
                  ${cost.description || 'Unnamed'} - $${(cost.amount_usd || cost.amountUSD || cost.amount || 0).toFixed(2)}
                </div>
              `).join('')}
              ${associatedCosts.length > 5 ? `
                <div style="padding: 5px 0; color: #666;">
                  ... and ${associatedCosts.length - 5} more
                </div>
              ` : ''}
            </div>
          </div>
        ` : `
          <div style="padding: 15px; background: #d5f4e6; border-radius: 4px; margin-bottom: 20px;">
            ✅ This destination has no associated costs. Safe to delete.
          </div>
        `}

        <div style="margin-top: 20px; padding: 15px; background: #e8f4f8; border-radius: 4px;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="recalculate-dates-checkbox" checked style="margin-right: 8px;">
            <span>Automatically recalculate dates after deletion</span>
          </label>
        </div>
      </div>

      <div class="modal-footer" style="display: flex; justify-content: space-between; padding: 15px; border-top: 1px solid #ddd;">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
          Cancel
        </button>
        <button class="btn-danger" id="confirm-delete-btn">
          Delete Destination
        </button>
      </div>
    </div>

    <style>
      .radio-option:has(input:checked) {
        border-color: #3498db !important;
        background: #f0f8ff !important;
      }
      .btn-danger {
        background: #e74c3c;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      }
      .btn-danger:hover {
        background: #c0392b;
      }
      .btn-secondary {
        background: #95a5a6;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    </style>
  `;

  document.body.appendChild(modal);

  // Setup reassign destination dropdown if there are other destinations
  const reassignRadio = modal.querySelector('input[value="reassign"]');
  const reassignSelect = modal.querySelector('#reassign-destination-select');
  const reassignDropdown = modal.querySelector('#reassign-dest-dropdown');

  if (reassignRadio && reassignSelect && reassignDropdown) {
    reassignRadio.addEventListener('change', (e) => {
      reassignSelect.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  // Setup confirm button
  const confirmBtn = modal.querySelector('#confirm-delete-btn');
  confirmBtn.addEventListener('click', () => {
    const strategy = modal.querySelector('input[name="deletion-strategy"]:checked')?.value || 'delete';
    const recalculateDates = modal.querySelector('#recalculate-dates-checkbox')?.checked || false;

    let reassignDestId = null;
    if (strategy === 'reassign') {
      reassignDestId = reassignDropdown?.value;
      if (!reassignDestId) {
        alert('Please select a destination to reassign costs to');
        return;
      }
    }

    onConfirm({
      strategy,
      reassignDestId,
      recalculateDates
    });

    modal.remove();
  });
}

/**
 * Handle destination deletion with the specified strategy
 * @param {Object} data - Current itinerary data
 * @param {string|number} destinationId - ID of destination to delete
 * @param {Object} options - Deletion options
 * @param {string} options.strategy - 'delete', 'unassign', or 'reassign'
 * @param {string} options.reassignDestId - Destination ID to reassign to (if strategy is 'reassign')
 * @returns {Object} Updated itinerary data
 */
export function handleDestinationDeletion(data, destinationId, options = {}) {
  const { strategy = 'delete', reassignDestId = null } = options;
  const normalizedDestId = normalizeId(destinationId);

  // Remove the destination from locations array
  const updatedLocations = data.locations.filter(loc =>
    normalizeId(loc.id) !== normalizedDestId
  );

  let updatedCosts = [...(data.costs || [])];

  // Handle costs based on strategy
  switch (strategy) {
    case 'delete':
      // Delete all costs associated with this destination
      updatedCosts = deleteCostsByDestination(updatedCosts, destinationId);
      break;

    case 'unassign':
      // Set destination_id to null for associated costs
      updatedCosts = updatedCosts.map(cost => {
        const costDestId = normalizeId(cost.destination_id || cost.destinationId);
        if (costDestId === normalizedDestId) {
          return {
            ...cost,
            destination_id: null,
            destinationId: null,
            _unassigned_at: new Date().toISOString(),
            _previous_destination_id: cost.destination_id || cost.destinationId
          };
        }
        return cost;
      });
      break;

    case 'reassign':
      // Reassign costs to another destination
      if (!reassignDestId) {
        throw new Error('reassignDestId is required for reassign strategy');
      }

      updatedCosts = updatedCosts.map(cost => {
        const costDestId = normalizeId(cost.destination_id || cost.destinationId);
        if (costDestId === normalizedDestId) {
          return {
            ...cost,
            destination_id: reassignDestId,
            destinationId: reassignDestId,
            _reassigned_at: new Date().toISOString(),
            _previous_destination_id: cost.destination_id || cost.destinationId
          };
        }
        return cost;
      });
      break;

    default:
      throw new Error(`Unknown deletion strategy: ${strategy}`);
  }

  // Update legs if they reference this destination
  const updatedLegs = (data.legs || []).map(leg => {
    const updatedSubLegs = (leg.sub_legs || []).map(subLeg => {
      const updatedDestIds = (subLeg.destination_ids || []).filter(id =>
        normalizeId(id) !== normalizedDestId
      );

      return {
        ...subLeg,
        destination_ids: updatedDestIds
      };
    });

    return {
      ...leg,
      sub_legs: updatedSubLegs
    };
  });

  return {
    ...data,
    locations: updatedLocations,
    costs: updatedCosts,
    legs: updatedLegs
  };
}

/**
 * Populate the reassign dropdown with available destinations
 * @param {HTMLElement} dropdown - The select element
 * @param {Array} locations - Available locations
 * @param {string} excludeId - ID of destination being deleted (to exclude)
 */
export function populateReassignDropdown(dropdown, locations, excludeId) {
  const normalizedExcludeId = normalizeId(excludeId);

  dropdown.innerHTML = '<option value="">Select destination...</option>';

  locations
    .filter(loc => normalizeId(loc.id) !== normalizedExcludeId)
    .forEach(loc => {
      const option = document.createElement('option');
      option.value = loc.id;
      option.textContent = `${loc.name}${loc.city ? ', ' + loc.city : ''}${loc.country ? ', ' + loc.country : ''}`;
      dropdown.appendChild(option);
    });
}

/**
 * Create a delete button for a destination with cascade handling
 * @param {Object} destination - Destination object
 * @param {Array} allCosts - All costs in the itinerary
 * @param {Array} allLocations - All locations
 * @param {Function} onDelete - Callback when deletion is confirmed
 * @returns {HTMLElement} Delete button element
 */
export function createDestinationDeleteButton(destination, allCosts, allLocations, onDelete) {
  const button = document.createElement('button');
  button.className = 'btn-danger btn-small';
  button.textContent = '🗑️ Delete';
  button.style.cssText = `
    padding: 5px 10px;
    font-size: 0.85em;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    background: #e74c3c;
    color: white;
  `;

  button.onclick = (e) => {
    e.stopPropagation();

    // Find associated costs
    const associatedCosts = allCosts.filter(cost => {
      const costDestId = normalizeId(cost.destination_id || cost.destinationId);
      return costDestId === normalizeId(destination.id);
    });

    // Show deletion dialog
    showDestinationDeletionDialog(destination, associatedCosts, (options) => {
      // Populate reassign dropdown if needed
      const modal = document.getElementById('delete-destination-modal');
      if (modal) {
        const dropdown = modal.querySelector('#reassign-dest-dropdown');
        if (dropdown) {
          populateReassignDropdown(dropdown, allLocations, destination.id);
        }
      }

      // Call the onDelete callback with options
      onDelete(options);
    });
  };

  return button;
}
