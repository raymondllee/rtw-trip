/**
 * Data Integrity UI Components
 * Provides UI for managing orphaned costs, validation, and data cleanup
 */

import {
  validateDataIntegrity,
  findOrphanedCosts,
  reassignCosts,
  deleteCostsByDestination,
  getCostsByDestination,
  migrateItineraryData,
  createMigrationReport
} from './destination-id-manager.js';

/**
 * Create and show data integrity panel
 * @param {Object} data - Current itinerary data
 * @param {Function} onUpdate - Callback when data is updated
 */
export function showDataIntegrityPanel(data, onUpdate) {
  const validation = validateDataIntegrity(data);
  const orphanedCosts = findOrphanedCosts(data.costs || [], data.locations || []);

  const panel = document.createElement('div');
  panel.id = 'data-integrity-panel';
  panel.className = 'modal-overlay';
  panel.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <h2>Data Integrity Check</h2>
        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>

      <div class="modal-body">
        <!-- Summary -->
        <div class="integrity-summary" style="margin-bottom: 20px;">
          <h3>Summary</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <div class="stat-box">
              <div class="stat-label">Total Locations</div>
              <div class="stat-value">${validation.summary.total_locations}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Total Costs</div>
              <div class="stat-value">${validation.summary.total_costs}</div>
            </div>
            <div class="stat-box ${orphanedCosts.length > 0 ? 'stat-warning' : ''}">
              <div class="stat-label">Orphaned Costs</div>
              <div class="stat-value">${orphanedCosts.length}</div>
            </div>
            <div class="stat-box ${validation.summary.numeric_ids > 0 ? 'stat-info' : ''}">
              <div class="stat-label">Numeric IDs</div>
              <div class="stat-value">${validation.summary.numeric_ids} / ${validation.summary.uuid_ids} UUIDs</div>
            </div>
          </div>
        </div>

        <!-- Errors -->
        ${validation.errors.length > 0 ? `
          <div class="integrity-section error-section" style="margin-bottom: 20px;">
            <h3 style="color: #e74c3c;">❌ Errors (${validation.errors.length})</h3>
            ${validation.errors.map(error => `
              <div class="error-item" style="padding: 10px; background: #fee; border-left: 3px solid #e74c3c; margin-bottom: 10px;">
                <strong>${error.type}</strong>: ${error.message}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Warnings -->
        ${validation.warnings.length > 0 ? `
          <div class="integrity-section warning-section" style="margin-bottom: 20px;">
            <h3 style="color: #f39c12;">⚠️ Warnings (${validation.warnings.length})</h3>
            ${validation.warnings.map(warning => `
              <div class="warning-item" style="padding: 10px; background: #fef5e7; border-left: 3px solid #f39c12; margin-bottom: 10px;">
                <strong>${warning.type}</strong>: ${warning.message}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Orphaned Costs Management -->
        ${orphanedCosts.length > 0 ? `
          <div class="orphaned-costs-section" style="margin-bottom: 20px;">
            <h3>Manage Orphaned Costs</h3>
            <p>These costs reference destinations that no longer exist:</p>

            <div id="orphaned-costs-list" style="max-height: 300px; overflow-y: auto;">
              ${orphanedCosts.map(cost => `
                <div class="orphaned-cost-item" style="padding: 10px; background: #f9f9f9; border: 1px solid #ddd; margin-bottom: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <strong>${cost.description || 'Unnamed cost'}</strong>
                      <div style="font-size: 0.9em; color: #666;">
                        ${cost.category} • $${cost.amount_usd || cost.amountUSD || cost.amount || 0}
                        • Destination ID: ${cost.destination_id || cost.destinationId}
                      </div>
                    </div>
                    <div>
                      <select class="reassign-select" data-cost-id="${cost.id}" style="margin-right: 5px;">
                        <option value="">Select destination...</option>
                        ${data.locations.map(loc => `
                          <option value="${loc.id}">${loc.name}</option>
                        `).join('')}
                      </select>
                      <button class="btn-small btn-danger" onclick="deleteCost('${cost.id}')">Delete</button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>

            <div style="margin-top: 15px; display: flex; gap: 10px;">
              <button class="btn-primary" onclick="reassignAllOrphaned()">
                Reassign Selected
              </button>
              <button class="btn-danger" onclick="deleteAllOrphaned()">
                Delete All Orphaned
              </button>
            </div>
          </div>
        ` : `
          <div style="padding: 20px; background: #d5f4e6; border-radius: 4px; text-align: center;">
            ✅ All costs are properly linked to destinations
          </div>
        `}

        <!-- Migration Tools -->
        ${validation.summary.numeric_ids > 0 ? `
          <div class="migration-section" style="margin-top: 20px; padding: 15px; background: #e8f4f8; border-radius: 4px;">
            <h3>🔄 ID Migration Available</h3>
            <p>Your data contains ${validation.summary.numeric_ids} locations with legacy numeric IDs.
            Migrate to UUIDs for better stability and prevent ID collisions.</p>
            <button class="btn-primary" onclick="migrateToUUIDs()">
              Migrate to UUIDs
            </button>
          </div>
        ` : ''}
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
          Close
        </button>
      </div>
    </div>

    <style>
      .stat-box {
        padding: 15px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        text-align: center;
      }
      .stat-label {
        font-size: 0.85em;
        color: #666;
        margin-bottom: 5px;
      }
      .stat-value {
        font-size: 1.8em;
        font-weight: bold;
        color: #333;
      }
      .stat-warning .stat-value {
        color: #f39c12;
      }
      .stat-info .stat-value {
        color: #3498db;
      }
      .btn-small {
        padding: 4px 8px;
        font-size: 0.85em;
        border: none;
        border-radius: 3px;
        cursor: pointer;
      }
      .btn-danger {
        background: #e74c3c;
        color: white;
      }
      .btn-primary {
        background: #3498db;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
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

  // Attach event handlers
  const reassignAllBtn = panel.querySelector('[onclick="reassignAllOrphaned()"]');
  if (reassignAllBtn) {
    reassignAllBtn.onclick = () => {
      const selects = panel.querySelectorAll('.reassign-select');
      const reassignments = [];

      selects.forEach(select => {
        if (select.value) {
          reassignments.push({
            costId: select.dataset.costId,
            newDestId: select.value
          });
        }
      });

      if (reassignments.length === 0) {
        alert('Please select destinations for costs you want to reassign');
        return;
      }

      const costIds = reassignments.map(r => r.costId);
      const updatedCosts = reassignCosts(data.costs, costIds, reassignments[0].newDestId);

      onUpdate({ ...data, costs: updatedCosts });
      panel.remove();
    };
  }

  const deleteAllBtn = panel.querySelector('[onclick="deleteAllOrphaned()"]');
  if (deleteAllBtn) {
    deleteAllBtn.onclick = () => {
      if (!confirm(`Delete all ${orphanedCosts.length} orphaned costs? This cannot be undone.`)) {
        return;
      }

      const orphanedIds = new Set(orphanedCosts.map(c => c.id));
      const updatedCosts = data.costs.filter(c => !orphanedIds.has(c.id));

      onUpdate({ ...data, costs: updatedCosts });
      panel.remove();
    };
  }

  const migrateBtn = panel.querySelector('[onclick="migrateToUUIDs()"]');
  if (migrateBtn) {
    migrateBtn.onclick = () => {
      if (!confirm('Migrate all numeric IDs to UUIDs? This is a one-way operation. Make sure you have a backup!')) {
        return;
      }

      const migratedData = migrateItineraryData(data);
      const report = createMigrationReport(data, migratedData);

      console.log('📊 Migration Report:', report);

      onUpdate(migratedData);
      panel.remove();

      // Show success message
      showMigrationSuccessDialog(report);
    };
  }

  document.body.appendChild(panel);
}

/**
 * Show migration success dialog
 * @param {Object} report - Migration report
 */
function showMigrationSuccessDialog(report) {
  const dialog = document.createElement('div');
  dialog.className = 'modal-overlay';
  dialog.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h2>✅ Migration Complete</h2>
      </div>
      <div class="modal-body">
        <p>Successfully migrated to UUID-based destination IDs!</p>
        <ul>
          <li><strong>${report.migrated.locations}</strong> locations migrated</li>
          <li><strong>${report.migrated.costs}</strong> costs updated</li>
          ${report.improvements.orphaned_costs_fixed > 0 ? `
            <li><strong>${report.improvements.orphaned_costs_fixed}</strong> orphaned costs fixed</li>
          ` : ''}
        </ul>
        <p style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 4px;">
          <strong>Note:</strong> Make sure to export and save your updated itinerary!
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
}

/**
 * Show a quick validation badge in the UI
 * @param {Object} validation - Validation result
 * @returns {HTMLElement} Badge element
 */
export function createValidationBadge(validation) {
  const badge = document.createElement('div');
  badge.className = 'validation-badge';

  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;

  if (errorCount > 0) {
    badge.innerHTML = `
      <span style="color: #e74c3c;">❌ ${errorCount} error${errorCount > 1 ? 's' : ''}</span>
    `;
  } else if (warningCount > 0) {
    badge.innerHTML = `
      <span style="color: #f39c12;">⚠️ ${warningCount} warning${warningCount > 1 ? 's' : ''}</span>
    `;
  } else {
    badge.innerHTML = `
      <span style="color: #27ae60;">✅ All OK</span>
    `;
  }

  badge.style.cssText = `
    padding: 5px 10px;
    border-radius: 4px;
    background: #f9f9f9;
    border: 1px solid #ddd;
    font-size: 0.9em;
    cursor: pointer;
  `;

  return badge;
}

/**
 * Add data integrity button to the UI
 * @param {Object} data - Current data
 * @param {Function} onUpdate - Update callback
 * @param {string} containerId - ID of container to add button to
 */
export function addDataIntegrityButton(data, onUpdate, containerId = 'planning-controls') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`Container ${containerId} not found`);
    return;
  }

  const validation = validateDataIntegrity(data);
  const badge = createValidationBadge(validation);

  const button = document.createElement('button');
  button.textContent = 'Data Integrity';
  button.className = 'btn-secondary';
  button.style.marginLeft = '10px';
  button.onclick = () => showDataIntegrityPanel(data, onUpdate);

  const wrapper = document.createElement('div');
  wrapper.style.display = 'inline-flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '8px';

  wrapper.appendChild(button);
  wrapper.appendChild(badge);

  container.appendChild(wrapper);
}
