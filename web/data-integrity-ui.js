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
  createMigrationReport,
  normalizeId
} from './destination-id-manager.js';
import {
  findDestinationsWithoutCosts,
  generateBulkCostPrompt
} from './cost-backlog.js';

// Re-export validateDataIntegrity for use by app-final.js
export { validateDataIntegrity };

const ALLOWED_COST_CATEGORIES = new Set([
  'flight',
  'accommodation',
  'activity',
  'food',
  'transport',
  'other'
]);

const ALLOWED_BOOKING_STATUSES = new Set([
  'estimated',
  'researched',
  'booked',
  'paid'
]);

function sanitizeCategory(rawCategory) {
  const normalized = (rawCategory || '').toString().toLowerCase().trim();
  return ALLOWED_COST_CATEGORIES.has(normalized) ? normalized : 'other';
}

function sanitizeBookingStatus(rawStatus) {
  const normalized = (rawStatus || '').toString().toLowerCase().trim();
  return ALLOWED_BOOKING_STATUSES.has(normalized) ? normalized : 'estimated';
}

function sanitizeCurrency(rawCurrency) {
  const normalized = (rawCurrency || 'USD').toString().toUpperCase().trim();
  return normalized || 'USD';
}

function roundToCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

/**
 * Create and show data integrity panel
 * @param {Object} data - Current itinerary data
 * @param {Function} onUpdate - Callback when data is updated
 */
export function showDataIntegrityPanel(data, onUpdate) {
  const validation = validateDataIntegrity(data);
  const orphanedCosts = findOrphanedCosts(data.costs || [], data.locations || []);
  const destinationsMissingCosts = findDestinationsWithoutCosts(data);

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
            <div class="stat-box ${destinationsMissingCosts.length > 0 ? 'stat-warning' : ''}">
              <div class="stat-label">No Cost Data</div>
              <div class="stat-value">${destinationsMissingCosts.length}</div>
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

        <!-- Destinations Missing Costs -->
        ${destinationsMissingCosts.length > 0 ? `
          <div class="missing-costs-section" style="margin-bottom: 20px;">
            <h3>Destinations Missing Cost Coverage</h3>
            <p>${destinationsMissingCosts.length} destination${destinationsMissingCosts.length === 1 ? '' : 's'} currently have zero cost line items.</p>

            <div style="max-height: 220px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">
              ${destinationsMissingCosts.map(dest => `
                <div class="missing-cost-item" data-destination-id="${dest.normalizedId}" style="padding: 10px 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; gap: 12px;">
                  <div>
                    <div style="font-weight: 600;">${dest.name}${dest.city ? ` (${dest.city})` : ''}</div>
                    <div style="font-size: 12px; color: #555;">
                      ${[dest.country, dest.region].filter(Boolean).join(' • ')}
                    </div>
                    <div style="font-size: 12px; color: #777;">
                      ${dest.durationDays ? `${dest.durationDays} days` : ''} ${dest.arrivalDate ? `• Arr ${dest.arrivalDate}` : ''} ${dest.departureDate ? `• Dep ${dest.departureDate}` : ''}
                    </div>
                  </div>
                  <div style="text-align: right; font-size: 12px; color: #777;">
                    ${dest.leg ? `<div>${dest.leg}</div>` : ''}
                    ${dest.activityType ? `<div>${dest.activityType}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>

            <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px;">
              <button class="btn-primary" id="open-bulk-cost-helper">
                Bulk Cost Helper
              </button>
              <button class="btn-secondary" id="copy-missing-costs-summary">
                Copy Summary
              </button>
            </div>
          </div>
        ` : `
          <div style="padding: 20px; background: #f0f9f4; border-radius: 4px; text-align: center;">
            🎉 Every destination has at least one cost item.
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

  const openBulkHelperBtn = panel.querySelector('#open-bulk-cost-helper');
  if (openBulkHelperBtn) {
    openBulkHelperBtn.addEventListener('click', () => {
      showBulkCostHelperModal(data, onUpdate);
    });
  }

  const copySummaryBtn = panel.querySelector('#copy-missing-costs-summary');
  if (copySummaryBtn) {
    copySummaryBtn.addEventListener('click', async () => {
      const summary = buildMissingCostsSummary(destinationsMissingCosts);
      try {
        await navigator.clipboard.writeText(summary);
        alert('Copied summary of destinations without costs');
      } catch (error) {
        console.error('Failed to copy summary:', error);
        alert('Failed to copy summary. Check browser permissions.');
      }
    });
  }
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

/**
 * Build a quick text summary of destinations missing costs
 * @param {Array} destinations
 * @returns {string}
 */
function buildMissingCostsSummary(destinations = []) {
  if (!destinations.length) {
    return 'All destinations currently have cost line items.';
  }

  return destinations.map((dest, idx) => {
    const parts = [
      `${idx + 1}. ${dest.name}${dest.city ? ` (${dest.city})` : ''}${dest.country ? `, ${dest.country}` : ''}`
    ];

    const schedule = [];
    if (dest.durationDays) schedule.push(`${dest.durationDays} days`);
    if (dest.arrivalDate) schedule.push(`Arr ${dest.arrivalDate}`);
    if (dest.departureDate) schedule.push(`Dep ${dest.departureDate}`);
    if (schedule.length) {
      parts.push(`   Schedule: ${schedule.join(' • ')}`);
    }

    const context = [dest.region, dest.leg, dest.activityType].filter(Boolean);
    if (context.length) {
      parts.push(`   Context: ${context.join(' • ')}`);
    }

    parts.push(`   Destination ID: ${dest.normalizedId}`);

    return parts.join('\n');
  }).join('\n\n');
}

/**
 * Display modal for managing bulk cost updates via the agent
 * @param {Object} data
 * @param {Function} onUpdate
 */
function showBulkCostHelperModal(data, onUpdate) {
  const destinations = findDestinationsWithoutCosts(data);
  if (!destinations.length) {
    alert('Great news! Every destination already has cost coverage.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'bulk-cost-helper-modal';

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 960px;">
      <div class="modal-header">
        <h2>Bulk Cost Helper</h2>
        <button class="close-btn" data-action="close">×</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
        <p>Select destinations that need cost estimates, generate a ready-to-send agent prompt, then paste the agent's JSON response to apply the new costs.</p>

        <div class="bulk-helper-grid" style="display: grid; grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.2fr); gap: 16px;">
          <div class="bulk-helper-column">
            <h3 style="margin: 0 0 8px 0;">Destinations (${destinations.length})</h3>
            <div style="margin-bottom: 8px;">
              <label style="font-size: 13px; display: flex; align-items: center; gap: 6px;">
                <input type="checkbox" id="bulk-cost-select-all" checked>
                <span>Select all</span>
              </label>
            </div>
            <div id="bulk-cost-destination-list" style="max-height: 320px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">
              ${destinations.map(dest => `
                <label class="bulk-cost-destination" data-destination-id="${dest.normalizedId}" style="display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-bottom: 1px solid #eee; cursor: pointer;">
                  <input type="checkbox" class="bulk-cost-checkbox" data-destination-id="${dest.normalizedId}" checked style="margin-top: 4px;">
                  <div>
                    <div style="font-weight: 600;">${dest.name}${dest.city ? ` (${dest.city})` : ''}</div>
                    <div style="font-size: 12px; color: #555;">${[dest.country, dest.region].filter(Boolean).join(' • ')}</div>
                    <div style="font-size: 12px; color: #777;">
                      ${dest.durationDays ? `${dest.durationDays} days` : 'Duration unknown'}
                      ${dest.arrivalDate ? ` • Arr ${dest.arrivalDate}` : ''}
                      ${dest.departureDate ? ` • Dep ${dest.departureDate}` : ''}
                    </div>
                    ${dest.highlights?.length ? `<div style="font-size: 11px; color: #777; margin-top: 4px;">Highlights: ${dest.highlights.slice(0, 3).join(', ')}</div>` : ''}
                  </div>
                </label>
              `).join('')}
            </div>
            <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
              <button class="btn-primary" id="generate-bulk-cost-prompt">Generate Agent Prompt</button>
              <button class="btn-secondary" id="copy-bulk-cost-prompt">Copy Prompt</button>
            </div>
          </div>
          <div class="bulk-helper-column">
            <h3 style="margin: 0 0 8px 0;">Agent Prompt</h3>
            <textarea id="bulk-cost-prompt" placeholder="Click “Generate Agent Prompt” to build tailored instructions for the cost agent." style="width: 100%; min-height: 180px; resize: vertical; padding: 10px; font-family: monospace; font-size: 13px; border: 1px solid #ccc; border-radius: 4px;"></textarea>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
              <h3 style="margin: 0;">Agent Response JSON</h3>
              <button class="btn-secondary" id="bulk-cost-paste-example">Insert Example</button>
            </div>
            <textarea id="bulk-cost-response" placeholder="Paste the agent’s JSON array response here, then click “Apply Costs”." style="width: 100%; min-height: 180px; resize: vertical; padding: 10px; font-family: monospace; font-size: 13px; border: 1px solid #ccc; border-radius: 4px;"></textarea>
            <div style="display: flex; gap: 8px; align-items: center; margin-top: 8px;">
              <button class="btn-primary" id="apply-bulk-costs">Apply Costs</button>
              <div id="bulk-cost-status" style="font-size: 12px; color: #555;"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" data-action="close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.remove();
  };

  modal.addEventListener('click', (event) => {
    if (event.target.dataset.action === 'close' || event.target === modal) {
      closeModal();
    }
  });

  const selectAllCheckbox = modal.querySelector('#bulk-cost-select-all');
  const destinationCheckboxes = Array.from(modal.querySelectorAll('.bulk-cost-checkbox'));

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (event) => {
      const checked = event.target.checked;
      destinationCheckboxes.forEach((checkbox) => {
        checkbox.checked = checked;
      });
    });
  }

  const generatePromptBtn = modal.querySelector('#generate-bulk-cost-prompt');
  const copyPromptBtn = modal.querySelector('#copy-bulk-cost-prompt');
  const promptTextarea = modal.querySelector('#bulk-cost-prompt');
  const responseTextarea = modal.querySelector('#bulk-cost-response');
  const applyBtn = modal.querySelector('#apply-bulk-costs');
  const statusEl = modal.querySelector('#bulk-cost-status');
  const exampleBtn = modal.querySelector('#bulk-cost-paste-example');

  if (generatePromptBtn) {
    generatePromptBtn.addEventListener('click', () => {
      const selectedIds = destinationCheckboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.dataset.destinationId);

      const selectedDestinations = destinations.filter((dest) =>
        selectedIds.includes(dest.normalizedId)
      );

      if (!selectedDestinations.length) {
        alert('Select at least one destination to include in the prompt.');
        return;
      }

      const promptText = generateBulkCostPrompt(selectedDestinations, data);
      promptTextarea.value = promptText;
      statusEl.textContent = `Generated prompt for ${selectedDestinations.length} destination${selectedDestinations.length === 1 ? '' : 's'}.`;
    });
  }

  if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', async () => {
      const text = promptTextarea.value.trim();
      if (!text) {
        alert('Generate a prompt before copying.');
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        statusEl.textContent = 'Prompt copied to clipboard.';
      } catch (error) {
        console.error('Failed to copy prompt:', error);
        alert('Failed to copy prompt. Check browser permissions.');
      }
    });
  }

  if (exampleBtn) {
    exampleBtn.addEventListener('click', () => {
      responseTextarea.value = getBulkCostExampleJSON(destinations.slice(0, 1));
      statusEl.textContent = 'Inserted example JSON. Replace with actual agent output.';
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const raw = responseTextarea.value.trim();
      if (!raw) {
        alert('Paste the agent response JSON before applying.');
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        console.error('Invalid JSON:', error);
        alert('The agent response is not valid JSON. Please fix and try again.');
        return;
      }

      const result = applyAgentCosts(data, parsed);
      if (!result) {
        alert('No costs were applied. Ensure the JSON follows the expected format.');
        return;
      }

      if (result.added === 0) {
        statusEl.textContent = `No new costs added. ${result.skipped.length ? `Skipped: ${result.skipped.join(', ')}` : ''}`;
      } else {
        statusEl.textContent = `Added ${result.added} cost item${result.added === 1 ? '' : 's'}.`;
      }

      if (typeof onUpdate === 'function') {
        onUpdate(data, { skipRecalc: true });
      }

      window.dispatchEvent(new CustomEvent('costs-updated'));

      // Close after short delay to show status
      setTimeout(() => {
        closeModal();
      }, 800);
    });
  }
}

/**
 * Apply agent-generated costs to the itinerary data
 * @param {Object} data
 * @param {Array} agentPayload
 * @returns {{added: number, skipped: Array<string>}|null}
 */
function applyAgentCosts(data, agentPayload) {
  if (!Array.isArray(agentPayload)) {
    return null;
  }

  data.costs = data.costs || [];
  const existingCosts = data.costs;

  const existingKeySet = new Set(
    existingCosts.map((cost) => {
      const destId = normalizeId(cost.destination_id ?? cost.destinationId ?? '');
      const category = (cost.category || '').toLowerCase();
      const description = (cost.description || '').toLowerCase();
      return `${destId}::${category}::${description}`;
    })
  );

  let added = 0;
  const skipped = [];

  agentPayload.forEach((entry, index) => {
    const destIdRaw = entry.destination_id ?? entry.destinationId;
    if (!destIdRaw) {
      skipped.push(`Entry ${index + 1} missing destination_id`);
      return;
    }

    const destIdNormalized = normalizeId(destIdRaw);
    const location = (data.locations || []).find(
      (loc) => normalizeId(loc.id) === destIdNormalized
    );

    if (!location) {
      skipped.push(`Destination ${destIdNormalized} not found`);
      return;
    }

    const costItems = Array.isArray(entry.costs) ? entry.costs : [];
    if (!costItems.length) {
      skipped.push(`Destination ${location.name} has no cost items in response`);
      return;
    }

    costItems.forEach((cost, costIndex) => {
      const category = sanitizeCategory(cost.category);
      const description = (cost.description || `Cost item ${costIndex + 1}`).toString().trim();
      const key = `${destIdNormalized}::${category}::${description.toLowerCase()}`;

      if (existingKeySet.has(key)) {
        skipped.push(`Duplicate skipped: ${location.name} - ${description}`);
        return;
      }

      const amountRaw = cost.amount ?? cost.amount_usd ?? cost.amountUSD ?? cost.total ?? 0;
      const amount = roundToCents(amountRaw);
      if (!Number.isFinite(amount) || amount <= 0) {
        skipped.push(`Invalid amount for ${location.name} - ${description}`);
        return;
      }

      const currency = sanitizeCurrency(cost.currency);
      let amountUsd = cost.amount_usd ?? cost.amountUSD ?? null;
      amountUsd = roundToCents(
        amountUsd && Number.isFinite(Number(amountUsd))
          ? Number(amountUsd)
          : currency === 'USD'
            ? amount
            : amount
      );

      const date =
        cost.date ||
        entry.date ||
        location.arrival_date ||
        location.departure_date ||
        new Date().toISOString().split('T')[0];

      const bookingStatus = sanitizeBookingStatus(cost.booking_status);
      const source = (cost.source || entry.source || 'ai_estimate').toString().trim() || 'ai_estimate';
      const notes = (cost.notes || entry.notes || '').toString().trim() || 'Generated via bulk cost helper';

      const newCost = {
        id: cost.id ||
          (window.costTracker && typeof window.costTracker.generateId === 'function'
            ? window.costTracker.generateId()
            : `bulk_cost_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
        category,
        description,
        amount,
        currency,
        amount_usd: amountUsd,
        date,
        destination_id: location.id,
        destinationId: location.id,
        booking_status: bookingStatus,
        source,
        notes
      };

      existingKeySet.add(key);
      existingCosts.push(newCost);
      added += 1;
    });
  });

  return { added, skipped };
}

/**
 * Provide an example JSON payload for the agent response textarea
 * @param {Array} destinations
 * @returns {string}
 */
function getBulkCostExampleJSON(destinations = []) {
  if (!destinations.length) {
    return `[
  {
    "destination_id": "DESTINATION_ID_HERE",
    "notes": "Replace this example with the agent response.",
    "costs": [
      {
        "category": "accommodation",
        "description": "Lodge stay",
        "amount": 1800,
        "currency": "USD",
        "amount_usd": 1800,
        "date": "2026-08-10",
        "booking_status": "estimated",
        "source": "ai_estimate",
        "notes": "Includes lodge stay and meals"
      }
    ]
  }
]`;
  }

  const example = destinations[0];
  return JSON.stringify(
    [
      {
        destination_id: example.normalizedId,
        notes: `Example costs for ${example.name}. Replace with agent response.`,
        costs: [
          {
            category: 'accommodation',
            description: `${example.name} lodging`,
            amount: 1800,
            currency: 'USD',
            amount_usd: 1800,
            date: example.arrivalDate || '2026-08-10',
            booking_status: 'estimated',
            source: 'ai_estimate',
            notes: 'Example placeholder cost. Replace with actual data.'
          },
          {
            category: 'activity',
            description: `${example.name} signature experience`,
            amount: 950,
            currency: 'USD',
            amount_usd: 950,
            date: example.arrivalDate || '2026-08-11',
            booking_status: 'estimated',
            source: 'ai_estimate',
            notes: 'Example placeholder cost.'
          }
        ]
      }
    ],
    null,
    2
  );
}
