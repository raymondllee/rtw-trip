// @ts-nocheck
import { FirestoreScenarioManager } from './firestore/scenarioManager';
import { BudgetManager, budgetManagerStyles } from './components/BudgetManager';
import { db } from '../firebase-config';
import { updateDoc, doc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// Extend window interface for CostBulkEdit
declare global {
  interface Window {
    CostBulkEdit: any;
  }
}

// Get scenario ID from URL params
const urlParams = new URLSearchParams(window.location.search);
const scenarioId = urlParams.get('scenario');

if (!scenarioId) {
  alert('No scenario selected. Redirecting to main app...');
  window.location.href = '/';
}

const scenarioManager = new FirestoreScenarioManager();
let currentScenario = null;
let currentVersionData = null;
let bulkEditor = null;
let budgetManager = null;

// Tab switching
function initTabSwitching() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Update active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.add('active');

      // Initialize tab content on first view
      if (tabName === 'edit-costs' && !bulkEditor) {
        initEditCostsTab();
      } else if (tabName === 'generate-costs') {
        initGenerateCostsTab();
      } else if (tabName === 'budget' && !budgetManager) {
        initBudgetTab();
      }
    });
  });
}

// Initialize Edit Costs Tab (Tab 1)
async function initEditCostsTab() {
  const tabPanel = document.querySelector('#tab-edit-costs .tab-panel');

  try {
    // Use globally loaded CostBulkEdit class
    if (!window.CostBulkEdit) {
      throw new Error('CostBulkEdit class not loaded. Ensure cost-bulk-edit.js is loaded before cost-manager.ts');
    }

    // Create instance
    bulkEditor = new window.CostBulkEdit('http://localhost:5001');
    bulkEditor.setSessionId(scenarioId);
    bulkEditor.setDestinations(currentVersionData.itineraryData.locations || []);

    // Generate IDs for costs that don't have them
    let costs = currentVersionData.itineraryData.costs || [];
    let needsIdFix = false;
    costs = costs.map((cost, index) => {
      if (!cost.id) {
        needsIdFix = true;
        const destId = cost.destination_id || 'unknown';
        const category = cost.category || 'other';
        const id = `${destId}_${category}_${index}`;
        return { ...cost, id };
      }
      return cost;
    });

    if (needsIdFix) {
      console.warn('⚠️ Generated IDs for costs without IDs.');
    }

    bulkEditor.costs = costs;

    // Render the table
    tabPanel.innerHTML = `
      <div class="bulk-edit-toolbar" id="bulk-edit-toolbar"></div>
      <div class="bulk-edit-table-wrapper" id="table-container"></div>
      <div class="stats-bar" id="stats-bar">
        <div class="stat-item">
          <span>Total Costs:</span>
          <span class="stat-value" id="total-costs">0</span>
        </div>
        <div class="stat-item">
          <span>Total Amount:</span>
          <span class="stat-value" id="total-amount">$0</span>
        </div>
        <div class="stat-item">
          <span>Unsaved Changes:</span>
          <span class="stat-value" id="unsaved-changes">0</span>
        </div>
        <div class="stat-item" style="margin-left: auto;">
          <button class="btn btn-primary" id="save-all-btn">Save All Changes</button>
        </div>
      </div>
    `;

    const toolbar = document.getElementById('bulk-edit-toolbar');
    if (toolbar) {
      toolbar.innerHTML = bulkEditor.createBulkEditToolbar();
    }

    const container = document.getElementById('table-container');
    bulkEditor.columnWidths.clear();
    bulkEditor.resizeHandlersInitialized = false;

    container.innerHTML = bulkEditor.createBulkEditTable();
    bulkEditor.renderTableRows();
    bulkEditor.updateSelectionCount();

    updateEditCostsStats();

    // Setup save button
    const saveBtn = document.getElementById('save-all-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (bulkEditor.editedCosts.size === 0) {
          alert('No changes to save');
          return;
        }

        saveBtn.disabled = true;
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';

        try {
          const updates = Array.from(bulkEditor.editedCosts.values());
          await bulkEditor.bulkUpdateCosts(updates);
          alert(`Successfully saved ${updates.length} change(s)!`);
          bulkEditor.editedCosts.clear();
          updateEditCostsStats();
          saveBtn.textContent = originalText;
        } catch (error) {
          alert('Failed to save: ' + error.message);
          saveBtn.textContent = originalText;
        } finally {
          saveBtn.disabled = false;
        }
      });
    }

  } catch (error) {
    console.error('Failed to initialize edit costs tab:', error);
    tabPanel.innerHTML = `<div class="error-message">Failed to load cost editor: ${error.message}</div>`;
  }
}

function updateEditCostsStats() {
  if (!bulkEditor) return;

  const totalCostsEl = document.getElementById('total-costs');
  const totalAmountEl = document.getElementById('total-amount');
  const unsavedChangesEl = document.getElementById('unsaved-changes');

  if (totalCostsEl) {
    totalCostsEl.textContent = bulkEditor.costs.length;
  }

  if (totalAmountEl) {
    const totalAmount = bulkEditor.costs.reduce((sum, cost) =>
      sum + (cost.amount_usd || cost.amount || 0), 0
    );
    totalAmountEl.textContent =
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalAmount);
  }

  if (unsavedChangesEl) {
    unsavedChangesEl.textContent = bulkEditor.editedCosts.size;
  }
}

// Initialize Generate Costs Tab (Tab 2)
function initGenerateCostsTab() {
  const container = document.getElementById('generate-costs-container');

  if (!currentVersionData) {
    container.innerHTML = '<div class="error-message">No scenario data loaded</div>';
    return;
  }

  const locations = currentVersionData.itineraryData.locations || [];
  const costs = currentVersionData.itineraryData.costs || [];

  // Create destination selection interface
  container.innerHTML = `
    <div style="padding: 24px; max-width: 900px; margin: 0 auto;">
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">Generate AI-Powered Cost Estimates</h2>
        <p style="margin: 0; color: #666; font-size: 14px;">
          Select destinations below and our AI will research and estimate costs for accommodation, activities, food, and transport.
        </p>
      </div>

      <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: center;">
        <button type="button" class="btn-sm btn-outline" id="select-all-generate-btn">Select All</button>
        <button type="button" class="btn-sm btn-outline" id="deselect-all-generate-btn">Deselect All</button>
        <span style="margin-left: auto; font-size: 14px; color: #666;" id="generate-selection-count">0 of ${locations.length} selected</span>
      </div>

      <div style="border: 1px solid #e0e0e0; border-radius: 8px; background: white; max-height: 500px; overflow-y: auto;">
        ${locations.map((dest, idx) => {
          const destCosts = costs.filter(c =>
            c.destination_id === dest.id ||
            c.destination_id === dest.destination_id
          );
          const hasCosts = destCosts.length > 0;
          const statusClass = hasCosts ? 'has-costs' : 'no-costs';
          const statusText = hasCosts ? `✓ Has ${destCosts.length} cost${destCosts.length !== 1 ? 's' : ''}` : '✗ No costs';
          const duration = dest.duration_days || 1;

          return `
            <div class="bulk-destination-item" data-destination-index="${idx}" style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background 0.2s;">
              <input type="checkbox" class="bulk-destination-checkbox" data-destination-index="${idx}" style="margin-right: 12px;">
              <div class="bulk-destination-info" style="flex: 1;">
                <div style="font-weight: 500; font-size: 14px; color: #333;">${dest.name || dest.city || 'Unknown'}</div>
                <div style="display: flex; gap: 16px; margin-top: 4px; font-size: 13px; color: #666;">
                  <span>${duration} day${duration !== 1 ? 's' : ''}</span>
                  <span class="bulk-destination-status ${statusClass}">${statusText}</span>
                </div>
                <div class="bulk-destination-progress-status" data-progress-status style="margin-top: 8px; font-size: 13px; color: #1a73e8;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
        <button type="button" class="btn btn-primary" id="start-ai-generation-btn" disabled>
          Generate Costs for Selected Destinations
        </button>
      </div>

      <div id="generate-progress" style="display: none; margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 6px;">
        <div style="margin-bottom: 8px; font-weight: 500;">Generating costs...</div>
        <div style="height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
          <div id="generate-progress-fill" style="height: 100%; background: #1a73e8; width: 0%; transition: width 0.3s;"></div>
        </div>
        <div id="generate-progress-text" style="margin-top: 8px; font-size: 13px; color: #666;"></div>
      </div>
    </div>
  `;

  // Setup event listeners for destination selection
  const selectedDestinations = new Set();
  const items = container.querySelectorAll('.bulk-destination-item');
  const selectionCount = document.getElementById('generate-selection-count');
  const startBtn = document.getElementById('start-ai-generation-btn');

  function updateSelectionCount() {
    selectionCount.textContent = `${selectedDestinations.size} of ${locations.length} selected`;
    startBtn.disabled = selectedDestinations.size === 0;
  }

  items.forEach((item, idx) => {
    const checkbox = item.querySelector('.bulk-destination-checkbox');

    item.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });

    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        selectedDestinations.add(idx);
        item.style.background = '#f0f7ff';
      } else {
        selectedDestinations.delete(idx);
        item.style.background = '';
      }
      updateSelectionCount();
    });
  });

  document.getElementById('select-all-generate-btn').addEventListener('click', () => {
    items.forEach((item, idx) => {
      const checkbox = item.querySelector('.bulk-destination-checkbox');
      checkbox.checked = true;
      selectedDestinations.add(idx);
      item.style.background = '#f0f7ff';
    });
    updateSelectionCount();
  });

  document.getElementById('deselect-all-generate-btn').addEventListener('click', () => {
    items.forEach((item) => {
      const checkbox = item.querySelector('.bulk-destination-checkbox');
      checkbox.checked = false;
      item.style.background = '';
    });
    selectedDestinations.clear();
    updateSelectionCount();
  });

  // Note: Actual AI generation would integrate with the existing chat/agent system
  // For now, we'll show a placeholder message
  startBtn.addEventListener('click', () => {
    alert('AI cost generation will be integrated with the existing agent system. This feature triggers the same AI research as "Update Multiple Costs" but within this unified interface.');
  });
}

// Initialize Budget Tab (Tab 3)
function initBudgetTab() {
  const container = document.getElementById('budget-container');

  if (!currentVersionData) {
    container.innerHTML = '<div class="error-message">No scenario data loaded</div>';
    return;
  }

  // Inject budget manager styles
  if (!document.getElementById('budget-manager-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'budget-manager-styles';
    styleElement.innerHTML = budgetManagerStyles;
    document.head.appendChild(styleElement);
  }

  const tripData = {
    locations: currentVersionData.itineraryData.locations || [],
    legs: currentVersionData.itineraryData.legs || [],
    costs: currentVersionData.itineraryData.costs || [],
    budget: currentVersionData.itineraryData.budget || null
  };

  budgetManager = new BudgetManager(
    container,
    tripData,
    tripData.budget,
    async (updatedBudget) => {
      // Save budget to Firestore when updated
      try {
        const scenarioRef = doc(db, 'scenarios', scenarioId);
        await updateDoc(scenarioRef, {
          'itineraryData.budget': updatedBudget,
          updatedAt: Timestamp.now()
        });
        console.log('✅ Budget saved to Firestore');
      } catch (error) {
        console.error('❌ Failed to save budget:', error);
        alert('Failed to save budget: ' + error.message);
      }
    }
  );

  budgetManager.render();
}

// Initialize the page
async function initialize() {
  try {
    console.log('🔄 Loading scenario:', scenarioId);

    // Load scenario and version data
    currentScenario = await scenarioManager.getScenario(scenarioId);
    if (!currentScenario) {
      throw new Error('Scenario not found');
    }

    // Update scenario name display
    document.getElementById('scenario-name-display').textContent = currentScenario.name || 'Unnamed Scenario';

    const currentVersion = currentScenario.currentVersion || 0;
    currentVersionData = await scenarioManager.getVersion(scenarioId, currentVersion);

    if (!currentVersionData || !currentVersionData.itineraryData) {
      throw new Error('Failed to load scenario data');
    }

    console.log('✅ Scenario loaded:', currentScenario.name);

    // Initialize tab switching
    initTabSwitching();

    // Initialize the first tab (Edit Costs)
    initEditCostsTab();

  } catch (error) {
    console.error('Failed to load scenario:', error);
    alert('Failed to load scenario: ' + error.message);
  }
}

// Start initialization
initialize();

// Listen for cost updates from other parts of the app
window.addEventListener('costs-updated', () => {
  if (bulkEditor) {
    updateEditCostsStats();
  }
});
