// @ts-nocheck
import { FirestoreScenarioManager } from './firestore/scenarioManager';
import { BudgetManager, budgetManagerStyles } from './components/BudgetManager';
import { TransportEditor } from './components/TransportEditor';
import { db } from '../firebase-config';
import { updateDoc, doc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// Extend window interface for CostBulkEdit
declare global {
  interface Window {
    CostBulkEdit: any;
    transportSegmentManager: any;
  }
}

// Get scenario ID from URL params
const urlParams = new URLSearchParams(window.location.search);
const scenarioId = urlParams.get('scenario');

if (!scenarioId) {
  alert('No scenario selected. Redirecting to main app...');
  window.location.href = '/';
}

// Set global scenario ID for components that rely on it (like TransportEditor)
(window as any).currentScenarioId = scenarioId;

const scenarioManager = new FirestoreScenarioManager();
let currentScenario = null;
let currentVersionData = null;
let bulkEditor = null;
let budgetManager = null;
let transportEditor = null;

// Tab switching
// Tab switching
function initTabSwitching() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  const activateTab = (tabName) => {
    // Update active states
    tabButtons.forEach(btn => {
      if (btn.dataset.tab === tabName) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    tabContents.forEach(content => {
      if (content.id === `tab-${tabName}`) content.classList.add('active');
      else content.classList.remove('active');
    });

    // Initialize tab content on first view
    if (tabName === 'budget' && !budgetManager) {
      initBudgetTab();
    } else if (tabName === 'edit-costs' && !bulkEditor) {
      initEditCostsTab();
    } else if (tabName === 'generate-costs') {
      initGenerateCostsTab();
    }

    // Persist to localStorage
    localStorage.setItem('costManagerActiveTab', tabName);
  };

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      activateTab(tabName);
    });
  });

  // Restore active tab from localStorage
  const savedTab = localStorage.getItem('costManagerActiveTab');
  if (savedTab) {
    const tabExists = document.getElementById(`tab-${savedTab}`);
    if (tabExists) {
      // Small delay to ensure DOM is fully ready if needed, though here it should be fine
      activateTab(savedTab);
    }
  }
}

// Initialize Edit Costs Tab (Tab 1)
async function initEditCostsTab() {
  const tabPanel = document.querySelector('#tab-edit-costs .tab-panel');

  try {
    // Use globally loaded CostBulkEdit class
    if (!window.CostBulkEdit) {
      throw new Error('CostBulkEdit class not loaded. Ensure cost-bulk-edit.js is loaded before cost-manager.ts');
    }

    // Initialize Bulk Editor
    bulkEditor = new window.CostBulkEdit();
    bulkEditor.setSessionId(scenarioId);
    bulkEditor.setDestinations(currentVersionData.itineraryData.locations);

    // Initialize Transport Editor if needed
    if (!transportEditor) {
      if (window.transportSegmentManager) {
        console.log('✅ Initializing TransportEditor...');
        transportEditor = new TransportEditor(window.transportSegmentManager);

        // Listen for edit requests from bulk editor
        window.addEventListener('edit-transport-segment', (e: any) => {
          console.log('📨 Received edit-transport-segment event:', e.detail);
          const { segmentId } = e.detail;
          if (transportEditor) {
            transportEditor.open(segmentId, async () => {
              // On save, refresh the table without resetting filters
              console.log('🔄 Transport segment updated, refreshing table...');
              await bulkEditor.fetchCosts();
              bulkEditor.renderTableRows(); // Re-render with current filters
            });
          } else {
            console.error('❌ TransportEditor is not initialized when event received');
          }
        });

        // Listen for research requests
        window.addEventListener('research-transport-segment', async (e: any) => {
          console.log('📨 Received research-transport-segment event:', e.detail);
          const { segmentId } = e.detail;

          if (window.transportSegmentManager) {
            const btn = document.querySelector(`.research-transport-btn[data-segment-id="${segmentId}"]`) as HTMLButtonElement;
            if (btn) {
              btn.disabled = true;
              btn.innerHTML = '⏳';
            }

            try {
              const scenarioId = new URLSearchParams(window.location.search).get('scenario');
              if (!scenarioId) throw new Error('No scenario ID found');

              await window.transportSegmentManager.researchSegment(segmentId, scenarioId);

              // Refresh table without resetting filters
              console.log('✅ Research complete, refreshing table...');
              await bulkEditor.fetchCosts();
              bulkEditor.renderTableRows();
            } catch (error) {
              console.error('❌ Research failed:', error);
              alert('Research failed. Check console for details.');
              if (btn) {
                btn.disabled = false;
                btn.innerHTML = '🤖';
              }
            }
          }
        });
      } else {
        console.warn('⚠️ window.transportSegmentManager not found, cannot initialize TransportEditor');
      }
    }

    // Override fetchCosts to use our local data + transport segments
    bulkEditor.fetchCosts = async () => {
      // Generate IDs for costs that don't have them
      let costs = currentVersionData.itineraryData.costs || [];
      let needsIdFix = false;
      costs = costs.map((cost, index) => {
        if (!cost.id) {
          needsIdFix = true;
          const destId = cost.destination_id || 'unknown';
          const category = cost.category || 'other';
          const id = `${destId}_${category}_${index}`;
          return { ...cost, id, modality: 'local' };
        }
        return { ...cost, modality: cost.modality || 'local' };
      });

      if (needsIdFix) {
        console.warn('⚠️ Generated IDs for costs without IDs.');
      }

      // --- INTEGRATE TRANSPORT SEGMENTS ---
      const transportSegments = currentVersionData.itineraryData.transport_segments || [];

      // Sync to manager so TransportEditor can find them
      if (window.transportSegmentManager) {
        window.transportSegmentManager.setSegments(transportSegments);
      }

      const locationMap = new Map((currentVersionData.itineraryData.locations || []).map(l => [l.id, l]));

      const transportCosts = transportSegments.map(segment => {
        const fromLoc = locationMap.get(segment.from_destination_id);
        const toLoc = locationMap.get(segment.to_destination_id);
        const fromName = fromLoc ? (fromLoc.name || fromLoc.city) : 'Unknown';
        const toName = toLoc ? (toLoc.name || toLoc.city) : 'Unknown';
        const mode = segment.transport_mode || 'transport';

        // Determine status
        let status = 'estimated';
        if (segment.actual_cost_usd > 0) status = 'paid';
        else if (segment.booking_status) status = segment.booking_status;

        return {
          id: segment.id,
          destination_id: segment.to_destination_id, // Associate with destination
          category: 'transport',
          modality: mode,
          description: `Transport: ${fromName} -> ${toName} (${mode})`,
          amount_usd: window.transportSegmentManager ? window.transportSegmentManager.getActiveCost(segment) : (segment.estimated_cost_usd || 0),
          currency: 'USD',
          date: segment.date || null,
          booking_status: status,
          notes: segment.notes || '',
          _isTransportSegment: true,
          _originalSegment: segment
        };
      });

      bulkEditor.costs = [...costs, ...transportCosts];

      // Render the table
      tabPanel.innerHTML = `
      <div class="bulk-edit-toolbar" id="bulk-edit-toolbar"></div>
      <div class="bulk-edit-table-wrapper" id="table-container"></div>
    `;

      const toolbar = document.getElementById('bulk-edit-toolbar');
      if (toolbar) {
        toolbar.innerHTML = bulkEditor.createBulkEditToolbar();
      }

      const container = document.getElementById('table-container');
      bulkEditor.columnWidths.clear();
      bulkEditor.resizeHandlersInitialized = false;

      container.innerHTML = bulkEditor.createBulkEditTable();
      // Apply filters (which will call renderTableRows)
      bulkEditor.applyFilters();
      bulkEditor.updateSelectionCount();

    }; // End of fetchCosts override

    // Trigger initial load
    await bulkEditor.fetchCosts();

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
    transport_segments: currentVersionData.itineraryData.transport_segments || [],
    budget: currentVersionData.itineraryData.budget || null,
    num_travelers: currentVersionData.itineraryData.num_travelers,
    traveler_composition: currentVersionData.itineraryData.traveler_composition,
    traveler_ids: currentVersionData.itineraryData.traveler_ids,
    accommodation_preference: currentVersionData.itineraryData.accommodation_preference
  };

  budgetManager = new BudgetManager(
    container,
    tripData,
    tripData.budget,
    async (updatedBudget) => {
      // Save budget to version document to ensure persistence
      try {
        // Also update currentVersionData so the budget persists in the version
        currentVersionData.itineraryData.budget = updatedBudget;

        // Update the version document with the budget using the actual document ID
        if (!currentVersionData.id) {
          throw new Error('Version document ID not found');
        }

        const versionRef = doc(db, 'scenarios', scenarioId, 'versions', currentVersionData.id);
        await updateDoc(versionRef, {
          'itineraryData.budget': updatedBudget,
          updatedAt: Timestamp.now()
        });

        console.log('✅ Budget saved to Firestore');
      } catch (error) {
        console.error('❌ Failed to save budget:', error);
        alert('Failed to save budget: ' + error.message);
      }
    },
    async (updatedCosts) => {
      // Save costs to version document
      try {
        if (!currentVersionData.id) {
          throw new Error('Version document ID not found');
        }

        // Update or add costs in the current version data
        updatedCosts.forEach(updatedCost => {
          if (updatedCost._deleted) {
            // Remove deleted costs
            currentVersionData.itineraryData.costs = (currentVersionData.itineraryData.costs || [])
              .filter(c => c.id !== updatedCost.id);
          } else {
            // Update or add cost
            const index = (currentVersionData.itineraryData.costs || []).findIndex(c => c.id === updatedCost.id);
            if (index >= 0) {
              currentVersionData.itineraryData.costs[index] = updatedCost;
            } else {
              if (!currentVersionData.itineraryData.costs) {
                currentVersionData.itineraryData.costs = [];
              }
              currentVersionData.itineraryData.costs.push(updatedCost);
            }
          }
        });

        // Save to Firestore
        const versionRef = doc(db, 'scenarios', scenarioId, 'versions', currentVersionData.id);
        await updateDoc(versionRef, {
          'itineraryData.costs': currentVersionData.itineraryData.costs,
          updatedAt: Timestamp.now()
        });

        console.log('✅ Costs saved to Firestore');

        // Update tripData and re-render budget manager
        tripData.costs = currentVersionData.itineraryData.costs;
        budgetManager.updateData(tripData, tripData.budget);
      } catch (error) {
        console.error('❌ Failed to save costs:', error);
        throw error;
      }
    },
    async (updatedTripData) => {
      // Save trip data (num_travelers, traveler_composition) to version document
      try {
        if (!currentVersionData.id) {
          throw new Error('Version document ID not found');
        }

        // Update currentVersionData
        currentVersionData.itineraryData.num_travelers = updatedTripData.num_travelers;
        currentVersionData.itineraryData.traveler_composition = updatedTripData.traveler_composition;
        currentVersionData.itineraryData.traveler_ids = updatedTripData.traveler_ids;
        currentVersionData.itineraryData.accommodation_preference = updatedTripData.accommodation_preference;

        // CRITICAL: Also save transport_segments if updated
        if (updatedTripData.transport_segments) {
          currentVersionData.itineraryData.transport_segments = updatedTripData.transport_segments;
        }

        // Save to Firestore
        const versionRef = doc(db, 'scenarios', scenarioId, 'versions', currentVersionData.id);
        const updateData: any = {
          'itineraryData.num_travelers': updatedTripData.num_travelers,
          'itineraryData.traveler_composition': updatedTripData.traveler_composition,
          'itineraryData.traveler_ids': updatedTripData.traveler_ids || [],
          'itineraryData.accommodation_preference': updatedTripData.accommodation_preference,
          updatedAt: Timestamp.now()
        };

        // Add transport_segments to update if present
        if (updatedTripData.transport_segments) {
          updateData['itineraryData.transport_segments'] = updatedTripData.transport_segments;
          console.log(`💾 Saving ${updatedTripData.transport_segments.length} transport segments to Firestore`);
        }

        await updateDoc(versionRef, updateData);

        console.log('✅ Traveler data saved to Firestore');
      } catch (error) {
        console.error('❌ Failed to save traveler data:', error);
        throw error;
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

    // Initialize the first tab (Budget Management)
    initBudgetTab();

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
