/**
 * Budget Manager UI Component (Recommendation J)
 * Provides integrated budget tracking, editing, and management interface
 */

import type { TripBudget, TripData } from '../types/trip';
import { calculateBudgetStatus, createDefaultBudget } from '../utils/budgetTracker';
import { getCurrencyForDestination } from '../utils/currencyMapping';
import { getRuntimeConfig } from '../config';
import { wellnessFirebaseService, WellnessUserData } from '../wellness/services/wellnessFirebaseService';
import { TransportEditor } from './TransportEditor';

export class BudgetManager {
  private container: HTMLElement;
  private tripData: TripData;
  private budget: TripBudget | null;
  private onBudgetUpdate?: (budget: TripBudget) => void;
  private editedCosts: Map<string, any> = new Map();
  private onCostsUpdate?: (costs: any[]) => Promise<void>;
  private onTripDataUpdate?: (tripData: TripData) => Promise<void>;
  private exchangeRates: { [key: string]: number } = {};
  private ratesFetchDate: string = '';
  private autoSaveTimer: number | null = null;
  private budgetAutoSaveTimer: number | null = null;
  private tripDataAutoSaveTimer: number | null = null;
  private savingCosts: Set<string> = new Set();
  private transportSegments: any[] = [];
  private collapsedSections: Set<string>; // Track collapsed sections
  private availableUsers: WellnessUserData[] = []; // Available wellness users
  private countryMode: 'dollars' | 'percent' | 'perday' = (localStorage.getItem('budget_country_mode') as 'dollars' | 'percent' | 'perday') || 'dollars';
  private transportEditor: TransportEditor;
  private lastSaved: Date | null = null;
  private isSaving: boolean = false;

  constructor(
    container: HTMLElement,
    tripData: TripData,
    budget?: TripBudget,
    onBudgetUpdate?: (budget: TripBudget) => void,
    onCostsUpdate?: (costs: any[]) => Promise<void>,
    onTripDataUpdate?: (tripData: TripData) => Promise<void>
  ) {
    this.container = container;
    this.tripData = tripData;
    this.budget = budget || null;
    this.onBudgetUpdate = onBudgetUpdate;
    this.onCostsUpdate = onCostsUpdate;
    this.onTripDataUpdate = onTripDataUpdate;

    // Fetch exchange rates on initialization
    this.fetchExchangeRates();
    this.fetchAvailableUsers();

    // Load collapsed state from localStorage
    const savedState = localStorage.getItem('budget_collapsed_sections');
    if (savedState) {
      try {
        this.collapsedSections = new Set(JSON.parse(savedState));
      } catch (e) {
        console.warn('Failed to parse saved collapsed sections state', e);
        this.collapsedSections = new Set();
      }
    } else {
      this.collapsedSections = new Set();
    }

    this.render();

    // Initialize transport editor
    this.transportEditor = new TransportEditor(window.transportSegmentManager || {
      // Fallback if manager not available (e.g. standalone mode)
      getAllSegments: () => this.transportSegments,
      updateSegment: async (id: string, updates: any, scenarioId?: string) => {
        const index = this.transportSegments.findIndex(s => s.id === id);
        if (index !== -1) {
          this.transportSegments[index] = { ...this.transportSegments[index], ...updates };

          // Update tripData and save to backend
          this.tripData.transport_segments = this.transportSegments;
          if (this.onTripDataUpdate) {
            await this.onTripDataUpdate(this.tripData);
            console.log(`✅ Transport segment ${id} saved to backend via onTripDataUpdate`);
          } else {
            console.warn('⚠️ onTripDataUpdate not available, segment updated in memory only');
          }
        }
      },
      getTransportIcon: (mode: string) => this.getTransportIcon(mode)
    });
  }

  private saveCollapsedState() {
    localStorage.setItem('budget_collapsed_sections', JSON.stringify(Array.from(this.collapsedSections)));
  }

  private scheduleAutoSave() {
    // Clear existing timer
    if (this.autoSaveTimer !== null) {
      window.clearTimeout(this.autoSaveTimer);
    }

    // Schedule save for 2 seconds after last edit
    this.autoSaveTimer = window.setTimeout(async () => {
      await this.saveAllCosts();
    }, 2000);
  }

  private scheduleBudgetAutoSave() {
    // Clear existing timer
    if (this.budgetAutoSaveTimer !== null) {
      window.clearTimeout(this.budgetAutoSaveTimer);
    }

    // Schedule save for 1 second after last edit
    this.budgetAutoSaveTimer = window.setTimeout(async () => {
      await this.saveBudget();
    }, 1000);
  }

  private scheduleTripDataAutoSave() {
    // Clear existing timer
    if (this.tripDataAutoSaveTimer !== null) {
      window.clearTimeout(this.tripDataAutoSaveTimer);
    }

    // Schedule save for 1 second after last edit
    this.tripDataAutoSaveTimer = window.setTimeout(async () => {
      await this.saveTripData();
    }, 1000);
  }

  private async saveAllCosts() {
    if (this.editedCosts.size === 0 || !this.onCostsUpdate) return;

    try {
      const costsToSave = Array.from(this.editedCosts.values());

      // Show saving indicator
      this.showSavingIndicator(true);

      await this.onCostsUpdate(costsToSave);

      // Clear edited costs after successful save
      this.editedCosts.clear();

      // Update totals without full re-render
      this.updateCostTotals();

      // Show success indicator briefly
      this.showSavingIndicator(false, true);
    } catch (error) {
      console.error('Failed to auto-save costs:', error);
      this.showSavingIndicator(false, false, 'Failed to save');
    }
  }

  private async saveBudget() {
    if (!this.budget || !this.onBudgetUpdate) return;

    try {
      // Show saving indicator
      const indicator = this.container.querySelector('#budget-save-indicator');
      if (indicator) {
        indicator.textContent = '💾 Saving...';
        indicator.className = 'auto-save-indicator-inline saving';
      }

      await this.onBudgetUpdate(this.budget);

      // Show success indicator briefly
      if (indicator) {
        indicator.textContent = '✓ Saved';
        indicator.className = 'auto-save-indicator-inline saved';
        setTimeout(() => {
          indicator.textContent = '';
          indicator.className = 'auto-save-indicator-inline';
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to auto-save budget:', error);
      const indicator = this.container.querySelector('#budget-save-indicator');
      if (indicator) {
        indicator.textContent = '✗ Failed';
        indicator.className = 'auto-save-indicator-inline error';
      }
    }
  }

  private async saveTripData() {
    if (!this.onTripDataUpdate) return;

    try {
      // Show saving indicator
      const indicator = this.container.querySelector('#traveler-save-indicator');
      if (indicator) {
        indicator.textContent = '💾 Saving...';
        indicator.className = 'auto-save-indicator-inline saving';
      }

      await this.onTripDataUpdate(this.tripData);

      // Show success indicator briefly
      if (indicator) {
        indicator.textContent = '✓ Saved';
        indicator.className = 'auto-save-indicator-inline saved';
        setTimeout(() => {
          indicator.textContent = '';
          indicator.className = 'auto-save-indicator-inline';
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to auto-save trip data:', error);
      const indicator = this.container.querySelector('#traveler-save-indicator');
      if (indicator) {
        indicator.textContent = '✗ Failed';
        indicator.className = 'auto-save-indicator-inline error';
      }
    }
  }

  private showSavingIndicator(saving: boolean, success?: boolean, message?: string) {
    const indicators = this.container.querySelectorAll('.auto-save-indicator');
    indicators.forEach(indicator => {
      if (saving) {
        indicator.textContent = '💾 Saving...';
        indicator.className = 'auto-save-indicator saving';
      } else if (success) {
        indicator.textContent = '✓ Saved';
        indicator.className = 'auto-save-indicator saved';
        setTimeout(() => {
          indicator.textContent = '';
          indicator.className = 'auto-save-indicator';
        }, 2000);
      } else {
        indicator.textContent = message || '✗ Save failed';
        indicator.className = 'auto-save-indicator error';
      }
    });
  }

  private updateCostTotals() {
    // Update totals for each country without full re-render
    const countries = new Set<string>();
    (this.tripData.locations || []).forEach(loc => {
      if (loc.country) countries.add(loc.country);
    });

    countries.forEach(country => {
      const countryCosts = (this.tripData.costs || [])
        .filter(c => {
          const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
          return location?.country === country;
        });

      const total = countryCosts.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);

      const totalElement = this.container.querySelector(`.country-total-row[data-country="${country}"] .country-total-amount`);
      if (totalElement) {
        totalElement.textContent = this.formatCurrency(total);
      }
    });
  }

  private async fetchExchangeRates() {
    try {
      // Using exchangerate-api.io free tier (1500 requests/month)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();

      if (data && data.rates) {
        this.exchangeRates = data.rates;
        this.ratesFetchDate = new Date(data.time_last_updated * 1000).toLocaleDateString();
        console.log('✅ Exchange rates fetched:', this.ratesFetchDate);
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
      // Set default rates if API fails
      this.exchangeRates = {
        USD: 1,
        // Europe
        EUR: 0.92,
        GBP: 0.79,
        CHF: 0.88,
        NOK: 10.50,
        SEK: 10.30,
        DKK: 6.85,
        // Asia
        JPY: 149.50,
        CNY: 7.24,
        INR: 83.12,
        THB: 34.50,
        VND: 24450,
        SGD: 1.34,
        MYR: 4.65,
        IDR: 15600,
        PHP: 56.50,
        KRW: 1320,
        TWD: 31.50,
        BTN: 83.12,
        NPR: 133,
        // Oceania
        AUD: 1.52,
        NZD: 1.68,
        FJD: 2.24,
        // Americas
        CAD: 1.36,
        BRL: 5.75,
        ARS: 350,
        CLP: 920,
        PEN: 3.70,
        COP: 3900,
        // Africa
        ZAR: 18.50,
        EGP: 30.90,
        MAD: 10.10,
        KES: 129,
        TZS: 2500,
        NAD: 18.50,
        MGA: 4500,
        // Middle East
        AED: 3.67,
        SAR: 3.75,
        ILS: 3.65,
        TRY: 32
      };
      this.ratesFetchDate = 'Using default rates';
    }
  }

  private async refreshExchangeRates(currencies?: string[]): Promise<void> {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();

      if (data && data.rates) {
        // Update specific currencies if provided, otherwise update all
        if (currencies && currencies.length > 0) {
          currencies.forEach(currency => {
            if (data.rates[currency]) {
              this.exchangeRates[currency] = data.rates[currency];
            }
          });
        } else {
          this.exchangeRates = data.rates;
        }
        this.ratesFetchDate = new Date(data.time_last_updated * 1000).toLocaleDateString();
        console.log('✅ Exchange rates refreshed:', currencies ? currencies.join(', ') : 'all');
      }
    } catch (error) {
      console.error('Failed to refresh exchange rates:', error);
      throw error;
    }
  }

  /**
   * Trigger AI research for a transport segment
   */
  private async researchTransportSegment(segmentId: string, isBulkOperation: boolean = false): Promise<void> {
    try {
      const segment = this.transportSegments.find(s => s.id === segmentId);
      if (!segment) {
        throw new Error('Transport segment not found');
      }

      // Show loading indicator
      const btn = this.container.querySelector(`[data-segment-id="${segmentId}"]`) as HTMLButtonElement;
      if (btn) {
        btn.disabled = true;
        btn.textContent = '🔄 Researching...';
      }

      // Get API configuration
      const config = getRuntimeConfig();
      const apiBaseUrl = config.apiBaseUrl || '';

      // Get scenario ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const scenarioId = urlParams.get('scenario');
      if (!scenarioId) {
        throw new Error('No scenario ID found in URL');
      }

      // Get destination info for the segment
      const fromLocation = this.tripData.locations.find(
        loc => loc.id === segment.from_destination_id
      );
      const toLocation = this.tripData.locations.find(
        loc => loc.id === segment.to_destination_id
      );

      // Call the transport research API
      const response = await fetch(`${apiBaseUrl}/api/transport/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: scenarioId,
          segment_id: segmentId,
          from_destination_name: segment.from_destination_name,
          to_destination_name: segment.to_destination_name,
          from_country: fromLocation?.country || '',
          to_country: toLocation?.country || '',
          departure_date: fromLocation?.departure_date || ''
        })
      });

      if (!response.ok) {
        throw new Error(`Research failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Extract research data from response (API returns it nested in research_result)
      const researchData = result.research_result || result;
      console.log('Research API response:', result);
      console.log('Research data:', researchData);

      // Update segment with research results
      // API returns cost_mid/cost_low/cost_high, we store as researched_cost_*
      const costMid = researchData.researched_cost_mid || researchData.cost_mid;
      const costLow = researchData.researched_cost_low || researchData.cost_low;
      const costHigh = researchData.researched_cost_high || researchData.cost_high;

      if (costMid) {
        // Persist research results to Firestore via update-research API
        try {
          const updateResponse = await fetch(`${apiBaseUrl}/api/transport/update-research`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: scenarioId,
              scenario_id: scenarioId,
              segment_id: segmentId,
              research_data: researchData
            })
          });
          const updateResult = await updateResponse.json();
          console.log('💾 Segment updated in Firestore:', updateResult);
        } catch (updateError) {
          console.error('Failed to save research to Firestore:', updateError);
        }

        // Update local segment data
        Object.assign(segment, {
          researched_cost_low: costLow,
          researched_cost_mid: costMid,
          researched_cost_high: costHigh,
          researched_airlines: researchData.researched_airlines || researchData.airlines,
          researched_duration_hours: researchData.researched_duration_hours || researchData.duration_hours,
          researched_stops: researchData.researched_stops ?? researchData.typical_stops,
          researched_alternatives: researchData.alternatives,
          booking_status: 'researched',
          researched_at: new Date().toISOString()
        });

        // Also update transportSegmentManager if available
        if ((window as any).transportSegmentManager) {
          (window as any).transportSegmentManager.updateSegment(segmentId, segment, scenarioId);
        }

        // Re-render to show updated costs
        await this.render();

        // Show detailed success message like main app (only for individual research, not bulk)
        if (!isBulkOperation) {
          const airlines = (researchData.airlines || []).slice(0, 3).join(', ') || 'various carriers';
          const alternatives = researchData.alternatives?.length || 0;
          alert(`✅ Research complete! ${this.formatCurrency(costMid)} estimated (${airlines}). Found ${alternatives} alternative routes.`);
        }
      } else {
        // Research completed but no structured pricing data
        console.warn('Research completed but no pricing data returned:', result);
        if (!isBulkOperation) {
          alert(`⚠️ Research completed but no pricing data was found. Check console for details.`);
        }
      }

    } catch (error) {
      console.error('Error researching transport segment:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (!isBulkOperation) {
        alert(`❌ Research failed: ${errorMessage}`);
      }

      // Re-enable button
      const btn = this.container.querySelector(`[data-segment-id="${segmentId}"]`) as HTMLButtonElement;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🤖 Research';
      }

      // Re-throw error for bulk operation to handle
      if (isBulkOperation) {
        throw error;
      }
    }
  }

  /**
   * Identify transport segments that need research
   * @param maxAgeDays - Maximum age in days before research is considered stale (default: 30)
   * @returns Array of segments needing research
   */
  private getSegmentsNeedingResearch(maxAgeDays: number = 30): any[] {
    return this.transportSegments.filter(segment => {
      // Check if segment has no researched data
      const hasNoResearch = !segment.researched_cost_mid &&
        segment.booking_status !== 'researched' &&
        segment.booking_status !== 'booked' &&
        segment.booking_status !== 'paid';

      // Check if research is old
      let isOldResearch = false;
      if (segment.researched_at) {
        const ageInDays = Math.floor(
          (Date.now() - new Date(segment.researched_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        isOldResearch = ageInDays > maxAgeDays;
      }

      return hasNoResearch || isOldResearch;
    });
  }

  /**
   * Show bulk research modal to select segments for research
   */
  private showBulkResearchModal(): void {
    const needsResearch = this.getSegmentsNeedingResearch(30);

    if (needsResearch.length === 0) {
      alert('✅ All transport segments have recent research data!');
      return;
    }

    // Create modal HTML
    const modalHtml = `
      <div class="bulk-research-modal-overlay" id="bulk-research-modal">
        <div class="bulk-research-modal">
          <div class="modal-header">
            <h3>🔍 Bulk Transport Research</h3>
            <button class="close-modal-btn" id="close-bulk-research-modal">×</button>
          </div>
          <div class="modal-body">
            <p class="modal-description">
              The following transport segments need research (no data or data older than 30 days).
              Select segments to research:
            </p>
            <div class="bulk-research-options">
              <button class="btn-xs btn-secondary" id="select-all-segments">Select All</button>
              <button class="btn-xs btn-secondary" id="deselect-all-segments">Deselect All</button>
            </div>
            <div class="segments-checklist">
              ${needsResearch.map((segment, index) => {
      const icon = segment.transport_mode_icon || this.getTransportIcon(segment.transport_mode);
      const fromName = segment.from_destination_name || 'Unknown';
      const toName = segment.to_destination_name || 'Unknown';
      const mode = segment.transport_mode || 'plane';

      // Calculate research age
      let ageInfo = '<span class="no-research-badge">No research</span>';
      if (segment.researched_at) {
        const ageInDays = Math.floor(
          (Date.now() - new Date(segment.researched_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        ageInfo = `<span class="old-research-badge">${ageInDays} days old</span>`;
      }

      return `
                  <div class="segment-checkbox-item">
                    <label>
                      <input type="checkbox"
                             class="segment-checkbox"
                             data-segment-id="${segment.id}"
                             data-segment-index="${index}"
                             checked>
                      <span class="segment-checkbox-label">
                        <span class="segment-icon">${icon}</span>
                        <span class="segment-route">${fromName} → ${toName}</span>
                        <span class="segment-mode-badge">${mode}</span>
                        ${ageInfo}
                      </span>
                    </label>
                  </div>
                `;
    }).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" id="cancel-bulk-research">Cancel</button>
            <button class="btn-primary" id="start-bulk-research">
              Research Selected (${needsResearch.length})
            </button>
          </div>
        </div>
      </div>
    `;

    // Insert modal into DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstElementChild!);

    // Attach event listeners
    this.attachBulkResearchModalListeners(needsResearch);
  }

  /**
   * Attach event listeners for bulk research modal
   */
  private attachBulkResearchModalListeners(segments: any[]): void {
    const modal = document.getElementById('bulk-research-modal');
    if (!modal) return;

    // Close modal handlers
    const closeBtn = modal.querySelector('#close-bulk-research-modal');
    const cancelBtn = modal.querySelector('#cancel-bulk-research');
    const closeModal = () => modal.remove();

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Select/Deselect all handlers
    const selectAllBtn = modal.querySelector('#select-all-segments');
    const deselectAllBtn = modal.querySelector('#deselect-all-segments');

    selectAllBtn?.addEventListener('click', () => {
      modal.querySelectorAll('.segment-checkbox').forEach((checkbox: any) => {
        checkbox.checked = true;
      });
      this.updateBulkResearchCount();
    });

    deselectAllBtn?.addEventListener('click', () => {
      modal.querySelectorAll('.segment-checkbox').forEach((checkbox: any) => {
        checkbox.checked = false;
      });
      this.updateBulkResearchCount();
    });

    // Update count when checkboxes change
    modal.querySelectorAll('.segment-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => this.updateBulkResearchCount());
    });

    // Start research button
    const startBtn = modal.querySelector('#start-bulk-research');
    startBtn?.addEventListener('click', async () => {
      const selectedCheckboxes = Array.from(
        modal.querySelectorAll('.segment-checkbox:checked')
      ) as HTMLInputElement[];

      const selectedSegmentIds = selectedCheckboxes.map(cb => cb.dataset.segmentId!);

      if (selectedSegmentIds.length === 0) {
        alert('Please select at least one segment to research.');
        return;
      }

      modal.remove();
      await this.bulkResearchSegments(selectedSegmentIds);
    });
  }

  /**
   * Update the count of selected segments in bulk research modal
   */
  private updateBulkResearchCount(): void {
    const modal = document.getElementById('bulk-research-modal');
    if (!modal) return;

    const selectedCount = modal.querySelectorAll('.segment-checkbox:checked').length;
    const startBtn = modal.querySelector('#start-bulk-research');
    if (startBtn) {
      startBtn.textContent = `Research Selected (${selectedCount})`;
    }
  }

  /**
   * Research multiple transport segments sequentially
   */
  private async bulkResearchSegments(segmentIds: string[]): Promise<void> {
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // Show progress indicator
    const progressHtml = `
      <div class="bulk-research-progress-overlay" id="bulk-research-progress">
        <div class="bulk-research-progress-modal">
          <h3>🔄 Researching Transport Segments</h3>
          <div class="progress-info">
            <p>Processing <span id="current-segment">0</span> of ${segmentIds.length} segments...</p>
            <div class="progress-bar-container">
              <div class="progress-bar" id="research-progress-bar" style="width: 0%"></div>
            </div>
          </div>
          <div class="progress-details" id="progress-details"></div>
        </div>
      </div>
    `;

    const progressContainer = document.createElement('div');
    progressContainer.innerHTML = progressHtml;
    document.body.appendChild(progressContainer.firstElementChild!);

    // Research each segment sequentially
    for (let i = 0; i < segmentIds.length; i++) {
      const segmentId = segmentIds[i];
      const segment = this.transportSegments.find(s => s.id === segmentId);

      // Update progress
      const currentEl = document.getElementById('current-segment');
      const progressBar = document.getElementById('research-progress-bar');
      const detailsEl = document.getElementById('progress-details');

      if (currentEl) currentEl.textContent = String(i + 1);
      if (progressBar) {
        const percent = ((i + 1) / segmentIds.length) * 100;
        progressBar.style.width = `${percent}%`;
      }

      if (detailsEl && segment) {
        const fromName = segment.from_destination_name || 'Unknown';
        const toName = segment.to_destination_name || 'Unknown';
        detailsEl.innerHTML = `
          <p class="current-research">
            Researching: ${fromName} → ${toName}
          </p>
        `;
      }

      try {
        await this.researchTransportSegment(segmentId, true);
        successCount++;

        // Add small delay between requests to avoid overwhelming the API
        if (i < segmentIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorMsg = segment
          ? `${segment.from_destination_name} → ${segment.to_destination_name}: ${errorMessage}`
          : `Segment ${segmentId}: ${errorMessage}`;
        errors.push(errorMsg);
        console.error('Bulk research error:', error);
      }
    }

    // Remove progress modal
    document.getElementById('bulk-research-progress')?.remove();

    // Show results
    let resultMessage = `Bulk Research Complete!\n\n`;
    resultMessage += `✅ Successful: ${successCount}\n`;
    if (failureCount > 0) {
      resultMessage += `❌ Failed: ${failureCount}\n\n`;
      if (errors.length > 0) {
        resultMessage += `Errors:\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          resultMessage += `\n... and ${errors.length - 5} more errors`;
        }
      }
    }

    alert(resultMessage);
  }

  /**
   * Show transport segment details modal
   */
  private showTransportDetailsModal(segmentId: string): void {
    const segment = this.transportSegments.find(s => s.id === segmentId);
    if (!segment) {
      console.error('Transport segment not found:', segmentId);
      return;
    }

    const icon = segment.transport_mode_icon || this.getTransportIcon(segment.transport_mode);
    const fromName = segment.from_destination_name || 'Unknown';
    const toName = segment.to_destination_name || 'Unknown';
    const mode = segment.transport_mode || 'plane';
    const alternatives = segment.alternatives || segment.researched_alternatives || [];

    // Create modal HTML
    const modalHtml = `
      <div class="transport-details-modal-overlay" id="transport-details-modal">
        <div class="transport-details-modal">
          <div class="modal-header">
            <h3>${icon} ${fromName} → ${toName}</h3>
            <button class="modal-close-btn" title="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="details-section">
              <h4>Route Information</h4>
              <div class="details-grid">
                <div class="detail-item">
                  <label>Transport Mode</label>
                  <span>${mode}</span>
                </div>
                ${segment.distance_km ? `
                  <div class="detail-item">
                    <label>Distance</label>
                    <span>${Math.round(segment.distance_km)} km</span>
                  </div>
                ` : ''}
                ${segment.researched_duration_hours || segment.duration_hours ? `
                  <div class="detail-item">
                    <label>Duration</label>
                    <span>${segment.researched_duration_hours || segment.duration_hours} hours</span>
                  </div>
                ` : ''}
                ${segment.researched_stops !== undefined ? `
                  <div class="detail-item">
                    <label>Stops</label>
                    <span>${segment.researched_stops === 0 ? 'Direct' : segment.researched_stops + ' stop(s)'}</span>
                  </div>
                ` : ''}
              </div>
            </div>

            <div class="details-section">
              <h4>Cost Information</h4>
              <div class="details-grid">
                ${segment.estimated_cost_usd ? `
                  <div class="detail-item">
                    <label>Estimated Cost</label>
                    <span>${this.formatCurrency(segment.estimated_cost_usd)}</span>
                  </div>
                ` : ''}
                ${segment.researched_cost_mid ? `
                  <div class="detail-item highlight">
                    <label>Researched Cost (Mid)</label>
                    <span>${this.formatCurrency(segment.researched_cost_mid)}</span>
                  </div>
                ` : ''}
                ${segment.researched_cost_low && segment.researched_cost_high ? `
                  <div class="detail-item">
                    <label>Cost Range</label>
                    <span>${this.formatCurrency(segment.researched_cost_low)} - ${this.formatCurrency(segment.researched_cost_high)}</span>
                  </div>
                ` : ''}
                ${segment.actual_cost_usd ? `
                  <div class="detail-item highlight">
                    <label>Actual Cost</label>
                    <span>${this.formatCurrency(segment.actual_cost_usd)}</span>
                  </div>
                ` : ''}
              </div>
            </div>

            ${segment.researched_airlines && segment.researched_airlines.length > 0 ? `
              <div class="details-section">
                <h4>Airlines</h4>
                <p>${segment.researched_airlines.join(', ')}</p>
              </div>
            ` : ''}

            ${segment.research_notes || segment.booking_tips ? `
              <div class="details-section">
                <h4>Booking Tips</h4>
                <p class="booking-tips">${segment.research_notes || segment.booking_tips}</p>
              </div>
            ` : ''}

            ${alternatives.length > 0 ? `
              <div class="details-section">
                <h4>Alternative Routes (${alternatives.length})</h4>
                <div class="alternatives-list">
                  ${alternatives.map((alt: any, index: number) => `
                    <div class="alternative-item">
                      <div class="alt-header">
                        <strong>#${index + 1}: ${alt.from_airport || alt.from_destination} → ${alt.to_airport || alt.to_destination}</strong>
                        ${alt.savings ? `<span class="savings-badge">💰 Save ${this.formatCurrency(alt.savings)}</span>` : ''}
                      </div>
                      <div class="alt-details">
                        ${alt.cost_mid ? `<span>Cost: ${this.formatCurrency(alt.cost_mid)}</span>` : ''}
                        ${alt.cost_low && alt.cost_high ? `<span>Range: ${this.formatCurrency(alt.cost_low)} - ${this.formatCurrency(alt.cost_high)}</span>` : ''}
                        ${alt.airlines ? `<span>Airlines: ${Array.isArray(alt.airlines) ? alt.airlines.join(', ') : alt.airlines}</span>` : ''}
                        ${alt.duration_hours ? `<span>Duration: ${alt.duration_hours}h</span>` : ''}
                        ${alt.stops !== undefined ? `<span>Stops: ${alt.stops === 0 ? 'Direct' : alt.stops}</span>` : ''}
                      </div>
                      ${alt.notes ? `<p class="alt-notes">${alt.notes}</p>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${segment.research_sources && segment.research_sources.length > 0 ? `
              <div class="details-section collapsible">
                <h4>Research Sources</h4>
                <ul class="sources-list">
                  ${segment.research_sources.slice(0, 5).map((source: string) => `
                    <li><a href="${source}" target="_blank" rel="noopener">${new URL(source).hostname}</a></li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}

            ${segment.researched_at ? `
              <div class="details-footer">
                <small>Last researched: ${new Date(segment.researched_at).toLocaleString()}</small>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary modal-close-btn">Close</button>
            <button class="btn btn-secondary modal-edit-btn" data-segment-id="${segmentId}" title="Edit transport details">
              ✏️ Edit Details
            </button>
            <button class="btn btn-primary modal-research-btn" data-segment-id="${segmentId}">
              🤖 Re-research
            </button>
          </div>
        </div>
      </div>
    `;

    // Add modal to DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstElementChild!);

    // Add event listeners
    const modal = document.getElementById('transport-details-modal');
    if (modal) {
      // Close button handlers
      modal.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
      });

      // Click outside to close
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });

      // Escape key to close
      const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          modal.remove();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);

      // Re-research button
      const researchBtn = modal.querySelector('.modal-research-btn');
      researchBtn?.addEventListener('click', async () => {
        modal.remove();
        await this.researchTransportSegment(segmentId);
      });

      // Edit button
      const editBtn = modal.querySelector('.modal-edit-btn');
      editBtn?.addEventListener('click', () => {
        modal.remove();
        this.transportEditor.open(segmentId, async () => {
          // Refresh UI after save
          await this.render();
        });
      });
    }
  }

  /**
   * Load and auto-sync transport segments from tripData or API
   */
  private async loadTransportSegments(): Promise<void> {
    console.log('🔍 loadTransportSegments called', {
      hasTransportSegments: !!this.tripData.transport_segments,
      transportSegmentsLength: this.tripData.transport_segments?.length || 0,
      locationsLength: this.tripData.locations?.length || 0,
      hasWindow: !!window.transportSegmentManager
    });

    // First check if transport_segments are already in tripData
    if (this.tripData.transport_segments && this.tripData.transport_segments.length > 0) {
      this.transportSegments = this.tripData.transport_segments;
      this.lastSaved = new Date();
      console.log(`✅ Loaded ${this.transportSegments.length} transport segments from tripData. Last synced: ${this.lastSaved.toLocaleTimeString()}`);

      // Check if any segments need cost estimates
      const needsEstimates = this.transportSegments.some(
        seg => !seg.researched_cost_mid && (!seg.estimated_cost_usd || seg.estimated_cost_usd === 0)
      );

      if (needsEstimates) {
        console.log('🔄 Some segments need cost estimates, triggering sync with force_recalculate...');
        const urlParams = new URLSearchParams(window.location.search);
        const scenarioId = urlParams.get('scenario');
        if (scenarioId) {
          const config = getRuntimeConfig();
          const apiBaseUrl = config.apiBaseUrl || '';
          try {
            const response = await fetch(`${apiBaseUrl}/api/transport-segments/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scenario_id: scenarioId, force_recalculate: true })
            });
            if (response.ok) {
              const data = await response.json();
              this.transportSegments = data.transport_segments || this.transportSegments;
              console.log(`✅ Re-synced segments with estimates`);
            }
          } catch (err) {
            console.warn('Failed to recalculate estimates:', err);
          }
        }
      }
      return;
    }

    // Otherwise, try to sync from API or use the global transport segment manager
    try {
      // Get scenario ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const scenarioId = urlParams.get('scenario');
      console.log('🔍 Auto-sync check:', { scenarioId, locationsCount: this.tripData.locations?.length || 0 });

      if (scenarioId && this.tripData.locations && this.tripData.locations.length > 1) {
        console.log(`🔄 Auto-syncing transport segments for scenario ${scenarioId}...`);

        // Use the global transport segment manager if available
        if (window.transportSegmentManager && window.transportSegmentManager.syncSegments) {
          const result = await window.transportSegmentManager.syncSegments(scenarioId, this.tripData.locations);
          this.transportSegments = window.transportSegmentManager.segments || [];
          console.log(`✅ Auto-synced ${this.transportSegments.length} transport segments (${result.created} created, ${result.kept} kept, ${result.removed} removed)`);
        } else {
          // Fallback to direct API call
          const config = getRuntimeConfig();
          const apiBaseUrl = config.apiBaseUrl || '';

          const response = await fetch(`${apiBaseUrl}/api/transport-segments/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenario_id: scenarioId })
          });

          if (response.ok) {
            const data = await response.json();
            this.transportSegments = data.transport_segments || [];
            console.log(`✅ Auto-synced ${this.transportSegments.length} transport segments via API (${data.created} created, ${data.kept} kept, ${data.removed} removed)`);
          } else {
            console.warn('Failed to sync transport segments via API');
            this.transportSegments = [];
          }
        }
      } else {
        // No scenario or not enough locations
        if (window.transportSegmentManager && window.transportSegmentManager.segments) {
          this.transportSegments = window.transportSegmentManager.segments;
          console.log(`✅ Loaded ${this.transportSegments.length} transport segments from manager`);
        } else {
          this.transportSegments = [];
          console.log('ℹ️ No transport segments found (need 2+ destinations to create segments)');
        }
      }
    } catch (error) {
      console.error('Error loading/syncing transport segments:', error);
      this.transportSegments = [];
    }
  }

  /**
   * Get the active cost for a transport segment (actual > researched_mid > estimated)
   */
  private getSegmentActiveCost(segment: any): number {
    if (segment.actual_cost_usd && segment.actual_cost_usd > 0) {
      return segment.actual_cost_usd;
    }
    if (segment.manual_cost_usd && segment.manual_cost_usd > 0) {
      return segment.manual_cost_usd;
    }
    if (segment.researched_cost_mid && segment.researched_cost_mid > 0) {
      return segment.researched_cost_mid;
    }
    return segment.estimated_cost_usd || 0;
  }

  /**
   * Calculate total transport costs
   */
  private calculateTransportTotal(): number {
    return this.transportSegments.reduce((total, segment) => {
      return total + this.getSegmentActiveCost(segment);
    }, 0);
  }

  /**
   * Calculate transport cost breakdown by type
   */
  private calculateTransportBreakdown(): { actual: number; manual: number; researched: number; estimated: number; actualCount: number; manualCount: number; researchedCount: number; estimatedCount: number } {
    const breakdown = {
      actual: 0,
      manual: 0,
      researched: 0,
      estimated: 0,
      actualCount: 0,
      manualCount: 0,
      researchedCount: 0,
      estimatedCount: 0
    };

    this.transportSegments.forEach(segment => {
      const cost = this.getSegmentActiveCost(segment);

      // Determine which category this cost falls into (same logic as getSegmentActiveCost)
      if (segment.actual_cost_usd && segment.actual_cost_usd > 0) {
        breakdown.actual += cost;
        breakdown.actualCount++;
      } else if (segment.manual_cost_usd && segment.manual_cost_usd > 0) {
        breakdown.manual += cost;
        breakdown.manualCount++;
      } else if (segment.researched_cost_mid && segment.researched_cost_mid > 0) {
        breakdown.researched += cost;
        breakdown.researchedCount++;
      } else {
        breakdown.estimated += cost;
        breakdown.estimatedCount++;
      }
    });

    return breakdown;
  }

  /**
   * Get status badge for a transport segment
   */
  private getSegmentStatusBadge(segment: any): string {
    const badges: Record<string, any> = {
      'estimated': { color: '#999', text: 'Est', title: 'Estimated cost' },
      'manual': { color: '#f39c12', text: 'Manual', title: 'Manual override' },
      'researched': { color: '#3498db', text: 'Researched', title: 'AI researched cost' },
      'actual': { color: '#27ae60', text: 'Actual', title: 'Actual cost paid' },
      'booked': { color: '#27ae60', text: 'Booked', title: 'Booked and confirmed' },
      'paid': { color: '#27ae60', text: 'Paid', title: 'Paid in full' },
      'completed': { color: '#27ae60', text: 'Completed', title: 'Travel completed' }
    };

    // Determine effective status based on cost hierarchy (actual > manual > researched > estimated)
    let effectiveStatus = 'estimated';

    if (segment.actual_cost_usd && segment.actual_cost_usd > 0) {
      effectiveStatus = 'actual';
    } else if (segment.manual_cost_usd && segment.manual_cost_usd > 0) {
      effectiveStatus = 'manual';
    } else if (segment.researched_cost_mid && segment.researched_cost_mid > 0) {
      effectiveStatus = 'researched';
    }

    const badge = badges[effectiveStatus] || badges['estimated'];
    return `<span class="confidence-badge" style="background: ${badge.color}" title="${badge.title}">${badge.text}</span>`;
  }

  /**
   * Get transport mode icon - matches transport-segment-manager.js
   */
  private getTransportIcon(mode: string | undefined): string {
    const icons: Record<string, string> = {
      'plane': '✈️',
      'train': '🚂',
      'car': '🚗',
      'bus': '🚌',
      'ferry': '🚢',
      'walking': '🚶',
      'other': '🚗'
    };
    return icons[mode || ''] || '✈️';
  }

  private async generateCostsForCountry(country: string, destinationIds: string[]): Promise<any[]> {
    // Get destinations for this country
    const destinations = destinationIds
      .map(id => (this.tripData.locations || []).find(loc => String(loc.id) === id))
      .filter(d => d);

    if (destinations.length === 0) {
      throw new Error('No valid destinations found');
    }

    // Get API configuration
    const config = getRuntimeConfig();
    const apiBaseUrl = config.apiBaseUrl || '';

    // Get scenario ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const scenarioId = urlParams.get('scenario');
    if (!scenarioId) {
      throw new Error('No scenario ID found in URL. Please make sure you have a scenario loaded.');
    }

    // Get travel style and num travelers
    const numTravelers = this.tripData.num_travelers || 1;
    const accommodationPref = this.tripData.accommodation_preference || 'mid-range';

    // Generate costs for each destination by calling backend cost research API
    const allCosts: any[] = [];

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      if (!dest) continue;
      const localCurrency = getCurrencyForDestination(dest.id, this.tripData.locations || []);

      // Build destination name
      const destinationName = `${dest.name || dest.city}, ${dest.country}`;

      // Get previous and next destinations for context
      const previousDest = i > 0 ? destinations[i - 1] : null;
      const nextDest = i < destinations.length - 1 ? destinations[i + 1] : null;

      // Generate default dates if not set (use current date + offset)
      const today = new Date();
      const defaultArrival = dest.arrival_date || today.toISOString().split('T')[0];
      const arrivalDate = new Date(defaultArrival);
      const durationDays = Math.max(1, Math.round(dest.duration_days || 7));
      const departureDate = new Date(arrivalDate);
      departureDate.setDate(departureDate.getDate() + durationDays);
      const defaultDeparture = dest.departure_date || departureDate.toISOString().split('T')[0];

      const payload = {
        session_id: `budget_manager_${Date.now()}`,
        scenario_id: scenarioId,
        destination_name: destinationName,
        destination_id: String(dest.id),
        duration_days: durationDays,
        arrival_date: defaultArrival,
        departure_date: defaultDeparture,
        num_travelers: numTravelers,
        travel_style: accommodationPref,
        previous_destination: previousDest ? `${previousDest.name || previousDest.city}, ${previousDest.country}` : undefined,
        next_destination: nextDest ? `${nextDest.name || nextDest.city}, ${nextDest.country}` : undefined
      };

      // Call backend cost research API
      const response = await fetch(`${apiBaseUrl}/api/costs/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || `Request failed with status ${response.status}`;
        throw new Error(`Failed to research costs for ${destinationName}: ${errorMessage}`);
      }

      const data = await response.json();

      // Check if research returned partial results
      if (data.status === 'partial') {
        console.warn(`Partial result for ${destinationName}:`, data);
        continue; // Skip this destination
      }

      // The backend saves costs directly to Firestore, but also returns them
      // Extract costs from the response if available
      if (data.research && Array.isArray(data.research)) {
        allCosts.push(...data.research);
      } else if (data.costs_saved) {
        // Costs were saved but not returned - we'll need to fetch them
        // For now, just log success
        console.log(`✓ Generated ${data.costs_saved} costs for ${destinationName}`);
      }
    }

    return allCosts;
  }

  private generateCostPrompt(destinations: any[], country: string): string {
    const numTravelers = this.tripData.num_travelers || 1;
    const travelerComposition = this.tripData.traveler_composition;
    const accommodationPref = this.tripData.accommodation_preference || 'mid-range';

    // Build traveler info string
    let travelerInfo = `Number of travelers: ${numTravelers}`;
    if (travelerComposition) {
      travelerInfo += ` (${travelerComposition.adults} adult${travelerComposition.adults !== 1 ? 's' : ''}`;
      if (travelerComposition.children > 0) {
        travelerInfo += `, ${travelerComposition.children} child${travelerComposition.children !== 1 ? 'ren' : ''}`;
      }
      travelerInfo += ')';
    }
    travelerInfo += `\nAccommodation preference: ${accommodationPref}`;

    const destinationBlocks = destinations.map((dest, index) => {
      const lines = [];
      lines.push(`${index + 1}. ${dest.name}${dest.city ? ` (${dest.city})` : ''}, ${country}`);

      if (dest.region) {
        lines.push(`   Region: ${dest.region}`);
      }

      if (dest.arrivalDate || dest.departureDate || dest.durationDays) {
        const dateBits = [];
        if (dest.arrivalDate) dateBits.push(`Arrive ${dest.arrivalDate}`);
        if (dest.departureDate) dateBits.push(`Depart ${dest.departureDate}`);
        dateBits.push(`${dest.durationDays} days`);
        lines.push(`   Schedule: ${dateBits.join(' • ')}`);
      }

      if (dest.activityType) {
        lines.push(`   Primary focus: ${dest.activityType}`);
      }

      const highlights = (dest.highlights || []).slice(0, 5);
      if (highlights.length) {
        lines.push(`   Highlights: ${highlights.join(', ')}`);
      }

      if (dest.notes) {
        lines.push(`   Notes: ${dest.notes}`);
      }

      lines.push(`   Local Currency: ${dest.localCurrency}`);
      lines.push(`   Destination ID: ${dest.normalizedId}`);
      return lines.join('\n');
    }).join('\n\n');

    return `You are the RTW trip cost-planning assistant. Help estimate costs for the destinations below in ${country}.

TRAVELER INFORMATION:
${travelerInfo}

IMPORTANT PRICING GUIDELINES:
- For PER-PERSON costs (meals, museum entries, individual transport tickets, per-person activity fees):
  Set "scales_with_travelers": true
  Amount should be the per-person rate

- For SHARED/FIXED costs (hotel rooms, rental cars, private tours, taxis):
  Set "scales_with_travelers": false
  Amount should be the total for the entire group

- For ACCOMMODATION: Use ${accommodationPref} level pricing
  * budget: hostels, basic guesthouses, shared accommodations
  * mid-range: 3-star hotels, comfortable B&Bs, decent Airbnbs
  * higher-end: 4-star hotels, upscale boutique properties
  * luxurious: 5-star hotels, luxury resorts, premium accommodations

For each destination, produce 3-6 cost line items that cover major spend categories (accommodation, key activities, food, local transport, other notable expenses). Use realistic amounts appropriate for ${numTravelers} traveler${numTravelers !== 1 ? 's' : ''} and ${accommodationPref} accommodation standards. Amounts should be in the local currency specified for each destination.

Return a single JSON array. Each element must follow exactly:
{
  "destination_id": "<match the Destination ID>",
  "notes": "<optional high-level notes>",
  "costs": [
    {
      "category": "accommodation|activity|food|transport|other",
      "description": "<short human-friendly label>",
      "amount": 0.0,
      "currency": "<local currency code>",
      "date": "YYYY-MM-DD",
      "status": "estimated",
      "source": "ai_estimate",
      "notes": "<optional detail>",
      "pricing_model": {
        "type": "fixed|per_day|per_night|per_person_day|per_person_night",
        "scales_with_travelers": true|false
      }
    }
  ]
}

EXAMPLES:
- Hotel room: amount=150, scales_with_travelers=false, type="per_night" (room rate for entire group)
- Museum entry: amount=20, scales_with_travelers=true, type="fixed" (per-person admission)
- Restaurant meal: amount=25, scales_with_travelers=true, type="per_day" (per-person cost)
- Taxi ride: amount=30, scales_with_travelers=false, type="fixed" (shared ride for group)

Destinations to cover:

${destinationBlocks}

IMPORTANT: Return ONLY the JSON array, no markdown formatting, no explanation text, no code fences. Just the raw JSON array starting with [ and ending with ].`;
  }

  private parseAICostResponse(responseText: string, destinations: any[]): any[] {
    // Try to extract JSON from the response
    let jsonText = responseText.trim();

    // Remove markdown code fences if present
    jsonText = jsonText.replace(/^```json?\s*/i, '').replace(/```\s*$/, '');

    // Try to find JSON array in the text
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Original response text:', responseText);
      console.error('Extracted JSON text:', jsonText);

      // Show a preview in the error message
      const preview = responseText.length > 200
        ? responseText.substring(0, 200) + '...'
        : responseText;
      throw new Error(`Failed to parse AI response as JSON. Response preview: "${preview}"`);
    }

    if (!Array.isArray(parsed)) {
      console.error('Parsed response is not an array:', parsed);
      throw new Error('AI response is not an array');
    }

    // Transform the parsed data into costs format
    const allCosts: any[] = [];

    parsed.forEach((destData: any) => {
      const costs = destData.costs || [];
      costs.forEach((cost: any) => {
        const destId = String(destData.destination_id);
        const destination = destinations.find(d => String(d.id) === destId);

        if (!destination) {
          console.warn(`Destination ${destId} not found in provided destinations`);
          return;
        }

        // Ensure currency is set properly
        const currency = cost.currency || destination.localCurrency || 'USD';

        // Generate cost ID
        const costId = `${destId}_${cost.category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Calculate amount_usd if currency is not USD
        let amountUsd = cost.amount;
        if (currency !== 'USD' && this.exchangeRates[currency]) {
          amountUsd = cost.amount / this.exchangeRates[currency];
        }

        allCosts.push({
          id: costId,
          destination_id: destData.destination_id,
          category: cost.category || 'other',
          description: cost.description || 'AI Generated Cost',
          amount: Math.round(cost.amount || 0),
          currency: currency,
          amount_usd: Math.round(amountUsd),
          date: cost.date || new Date().toISOString().split('T')[0],
          status: cost.status || 'estimated',
          notes: cost.notes || destData.notes || '',
          source: 'ai_estimate',
          pricing_model: cost.pricing_model || {
            type: 'fixed',
            scales_with_travelers: false  // Default to fixed/shared if not specified
          }
        });
      });
    });

    return allCosts;
  }

  private async showPromptEditModal(prompt: string, title: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Create modal overlay
      const modal = document.createElement('div');
      modal.className = 'prompt-edit-modal-overlay';
      modal.innerHTML = `
        <div class="prompt-edit-modal">
          <div class="prompt-edit-header">
            <h3>${title}</h3>
            <button class="close-modal-btn">×</button>
          </div>
          <div class="prompt-edit-body">
            <p style="margin-bottom: 10px; color: #666; font-size: 13px;">Review and edit the prompt before sending to AI:</p>
            <textarea class="prompt-edit-textarea">${prompt}</textarea>
          </div>
          <div class="prompt-edit-footer">
            <button class="btn-secondary cancel-prompt-btn">Cancel</button>
            <button class="btn-primary generate-with-prompt-btn">Generate Costs</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const textarea = modal.querySelector('.prompt-edit-textarea') as HTMLTextAreaElement;
      const closeBtn = modal.querySelector('.close-modal-btn');
      const cancelBtn = modal.querySelector('.cancel-prompt-btn');
      const generateBtn = modal.querySelector('.generate-with-prompt-btn');

      const cleanup = () => {
        modal.remove();
      };

      closeBtn?.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      cancelBtn?.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      generateBtn?.addEventListener('click', () => {
        const editedPrompt = textarea.value;
        cleanup();
        resolve(editedPrompt);
      });

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });
    });
  }

  private getCurrenciesForCountry(country: string): string[] {
    const currencies = new Set<string>();
    (this.tripData.costs || [])
      .filter(c => {
        const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
        return location?.country === country;
      })
      .forEach(cost => {
        if (cost.currency && cost.currency !== 'USD') {
          currencies.add(cost.currency);
        }
      });

    return Array.from(currencies);
  }

  private getAllCurrencies(): string[] {
    const currencies = new Set<string>();
    (this.tripData.costs || []).forEach(cost => {
      if (cost.currency && cost.currency !== 'USD') {
        currencies.add(cost.currency);
      }
    });
    return Array.from(currencies);
  }

  private updateExchangeRateDisplays(country?: string) {
    // Update exchange rate displays without full re-render
    const costs = country
      ? (this.tripData.costs || []).filter(c => {
        const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
        return location?.country === country;
      })
      : (this.tripData.costs || []);

    costs.forEach(cost => {
      const currency = cost.currency || 'USD';
      if (currency === 'USD') return;

      const costId = cost.id || `${cost.destination_id}_${cost.category}_${Date.now()}`;
      const row = this.container.querySelector(`.editable-cost-row[data-cost-id="${costId}"]`);

      if (row) {
        const rateInfo = row.querySelector('.exchange-rate-info');
        const rate = this.exchangeRates[currency] || 1;

        if (rateInfo) {
          rateInfo.innerHTML = `1 ${currency} = $${(1 / rate).toFixed(4)} USD<br><span class="rate-date">${this.ratesFetchDate}</span>`;
        }
      }
    });
  }

  private convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return amount;

    // Convert to USD first, then to target currency
    const amountInUSD = fromCurrency === 'USD'
      ? amount
      : amount / (this.exchangeRates[fromCurrency] || 1);

    const result = toCurrency === 'USD'
      ? amountInUSD
      : amountInUSD * (this.exchangeRates[toCurrency] || 1);

    return result;
  }

  private getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      AUD: 'A$',
      CAD: 'C$',
      CNY: '¥',
      INR: '₹',
      THB: '฿',
      VND: '₫',
      FJD: 'FJ$',
      SGD: 'S$',
      NZD: 'NZ$'
    };
    return symbols[currency] || currency;
  }

  async updateData(tripData: TripData, budget?: TripBudget) {
    // Save the current open/closed state of country sections before re-rendering
    const openCountries = new Set<string>();
    this.container.querySelectorAll('.item-costs-section').forEach(section => {
      const country = (section as HTMLElement).dataset.country;
      const display = (section as HTMLElement).style.display;
      if (country && display !== 'none') {
        openCountries.add(country);
      }
    });

    this.tripData = tripData;
    if (budget !== undefined) {
      this.budget = budget;
    }
    await this.render();

    // Restore the open/closed state after rendering
    openCountries.forEach(country => {
      const section = this.container.querySelector(`.item-costs-section[data-country="${country}"]`) as HTMLElement;
      if (section) {
        section.style.display = 'block';

        // Auto-resize all textareas in restored sections
        section.querySelectorAll('textarea.auto-resize').forEach(textarea => {
          const el = textarea as HTMLTextAreaElement;
          requestAnimationFrame(() => {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
          });
        });
      }
    });
  }

  private formatCurrency(amount: number): string {
    return `$${Math.round(amount).toLocaleString()}`;
  }

  private getAlertIcon(type: string): string {
    switch (type) {
      case 'exceeded': return '🔴';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📊';
    }
  }

  private getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'flight': '#3498db',
      'accommodation': '#e74c3c',
      'activity': '#9b59b6',
      'food': '#f39c12',
      'transport': '#1abc9c',
      'education': '#2ecc71',
      'educational_materials': '#27ae60',
      'educational_activities': '#16a085',
      'other': '#95a5a6'
    };
    return colors[category] || '#95a5a6';
  }

  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'flight': '✈️',
      'accommodation': '🏨',
      'activity': '🎯',
      'food': '🍽️',
      'transport': '🚗',
      'education': '📚',
      'educational_materials': '📖',
      'educational_activities': '🎓',
      'other': '📦'
    };
    return icons[category] || '📦';
  }

  private renderCostsTableForCountry(country: string): string {
    const countryCosts = (this.tripData.costs || [])
      .filter(c => {
        const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
        return location?.country === country;
      });

    // Get destinations for this country to allow adding new costs
    const countryDestinations = (this.tripData.locations || [])
      .filter(loc => loc.country === country);

    const hasChanges = Array.from(this.editedCosts.values()).some(cost => {
      const location = (this.tripData.locations || []).find(loc => loc.id === cost.destination_id);
      return location?.country === country;
    });

    if (countryCosts.length === 0) {
      const destinationCount = countryDestinations.length;
      const destinationLabel = destinationCount === 1 ? `${destinationCount} destination` : `${destinationCount} destinations`;

      return `
        <div class="no-costs-container">
          <div class="no-costs-message">
            <p style="margin: 0; color: #666;">No costs recorded for this country yet. Add costs manually below.</p>
          </div>
          ${this.renderAddCostSection(country, countryDestinations)}
        </div>
      `;
    }

    // Group costs by destination
    const costsByDestination: Record<string, any[]> = {};
    countryCosts.forEach(cost => {
      const location = (this.tripData.locations || []).find(loc => loc.id === cost.destination_id);
      const destName = location?.name || location?.city || 'Unknown';
      if (!costsByDestination[destName]) {
        costsByDestination[destName] = [];
      }
      costsByDestination[destName].push(cost);
    });

    const countryCurrencies = this.getCurrenciesForCountry(country);
    const hasCurrencies = countryCurrencies.length > 0;

    // Build exchange rate display for all currencies used in this country
    const ratesDisplay = countryCurrencies.length > 0
      ? countryCurrencies.map(curr => {
        const rate = this.exchangeRates[curr] || 1;
        return `<span class="currency-rate-item">1 ${curr} = $${(1 / rate).toFixed(4)} USD</span>`;
      }).join(' • ')
      : '';

    return `
      <div class="country-costs-table" data-country="${country}">
        <div class="costs-table-actions">
          <button class="btn-sm btn-success add-cost-btn" data-country="${country}">+ Add Cost</button>
          ${hasCurrencies ? `
            <button class="btn-sm btn-secondary refresh-country-rates-btn" data-country="${country}" title="Refresh exchange rates for ${countryCurrencies.join(', ')}">
              🔄 Refresh Rates (${countryCurrencies.join(', ')})
            </button>
          ` : ''}
          <button class="btn-sm btn-secondary regenerate-country-costs-btn" data-country="${country}" data-destinations="${countryDestinations.map(d => d.id).join(',')}" title="Regenerate all costs for this country">
            🔄 Regenerate Costs
          </button>
          <span class="auto-save-indicator"></span>
        </div>
        ${ratesDisplay ? `
          <div class="exchange-rates-header">
            <strong>Exchange Rates:</strong> ${ratesDisplay} <span class="rates-date-small">(${this.ratesFetchDate})</span>
          </div>
        ` : ''}
        ${Object.entries(costsByDestination).map(([destName, costs]) => {
      const firstCost = costs[0];
      const destinationId = firstCost?.destination_id;
      const destLocation = (this.tripData.locations || []).find(loc => loc.id === destinationId);
      const destDays = destLocation?.duration_days || 0;
      const destDateRange = destLocation?.arrival_date && destLocation?.departure_date
        ? `${new Date(destLocation.arrival_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(destLocation.departure_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : '';
      return `
          <div class="destination-costs-section" data-destination-id="${destinationId}">
            <div class="destination-header">
              <span>
                ${destName}
                ${destDays || destDateRange ? `<span class="dest-meta">(${destDays ? `${destDays} day${destDays !== 1 ? 's' : ''}` : ''}${destDays && destDateRange ? ' • ' : ''}${destDateRange})</span>` : ''}
              </span>
              <button class="btn-xs btn-secondary regenerate-destination-costs-btn"
                      data-destination-id="${destinationId}"
                      data-destination-name="${destName}"
                      title="Regenerate costs for ${destName}">
                🔄 Regenerate
              </button>
            </div>
            <table class="costs-table editable-costs-table">
              <thead>
                <tr>
                  <th style="width: 140px;">Category</th>
                  <th style="width: 260px;">Description</th>
                  <th style="width: 80px;">Currency</th>
                  <th style="width: 100px;" class="text-right">Amount</th>
                  <th style="width: 100px;" class="text-right">USD</th>
                  <th style="width: 120px;">Status</th>
                  <th style="width: 110px;">Date</th>
                  <th style="width: 200px;">Notes</th>
                  <th style="width: 60px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${costs.map(cost => this.renderEditableCostRow(cost)).join('')}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="4"><strong>Subtotal for ${destName}</strong></td>
                  <td class="text-right"><strong>${this.formatCurrency(
        costs.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0)
      )}</strong></td>
                  <td colspan="4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
    }).join('')}
        <div class="country-total-row" data-country="${country}">
          <strong>Total for ${country}:</strong>
          <strong class="country-total-amount">${this.formatCurrency(
      countryCosts.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0)
    )}</strong>
        </div>
        ${this.renderAddCostSection(country, countryDestinations)}
      </div>
    `;
  }

  private renderEditableCostRow(cost: any): string {
    const costId = cost.id || `${cost.destination_id}_${cost.category}_${Date.now()}`;
    const amount = cost.amount || 0;
    const amountUsd = cost.amount_usd || amount;
    // Default to local currency if not set
    const currency = cost.currency || getCurrencyForDestination(cost.destination_id, this.tripData.locations || []);

    // Get research metadata if available
    const confidence = cost.confidence || '';
    const sources = cost.sources || [];
    const amountLow = cost.amount_low;
    const amountMid = cost.amount_mid || amountUsd;
    const amountHigh = cost.amount_high;
    const hasResearchData = confidence || sources.length > 0 || (amountLow && amountHigh);

    // Build confidence indicator
    let confidenceIndicator = '';
    if (confidence) {
      const confidenceColors: Record<string, string> = {
        'high': '#28a745',
        'medium': '#ffc107',
        'low': '#dc3545'
      };
      const confidenceColor = confidenceColors[confidence.toLowerCase()] || '#6c757d';
      confidenceIndicator = `<span class="confidence-badge" style="background-color: ${confidenceColor}" title="Confidence: ${confidence}">${confidence.charAt(0).toUpperCase()}</span>`;
    }

    // Build estimate range display
    let estimateRange = '';
    if (amountLow && amountHigh) {
      estimateRange = `<div class="estimate-range" title="Low: $${Math.round(amountLow)} | Mid: $${Math.round(amountMid)} | High: $${Math.round(amountHigh)}">
        $${Math.round(amountLow)}-$${Math.round(amountHigh)}
      </div>`;
    }

    // Build sources list
    let sourcesHtml = '';
    if (sources.length > 0) {
      const renderedSources = sources.slice(0, 2).map((url: string) => {
        const domain = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        return `<a href="${url}" target="_blank" class="source-link" title="${url}">${domain}</a>`;
      }).join('');
      const remainingSources = sources.length > 2
        ? `<span class="more-sources" title="${sources.slice(2).join('\n')}">+${sources.length - 2} more</span>`
        : '';
      sourcesHtml = `<div class="cost-sources">${renderedSources}${remainingSources}</div>`;
    }

    return `
      <tr class="editable-cost-row" data-cost-id="${costId}">
        <td>
          <div class="category-cell">
            <span class="category-badge" style="background-color: ${this.getCategoryColor(cost.category || 'other')}">
              ${this.getCategoryIcon(cost.category || 'other')} ${(cost.category || 'other').replace(/_/g, ' ')}
            </span>
            ${confidenceIndicator}
          </div>
        </td>
        <td class="description-cell">
          <div class="description-cell-content">
            <input type="text"
                   class="cost-field-input description-input"
                   data-cost-id="${costId}"
                   data-field="description"
                   value="${cost.description || ''}"
                   placeholder="Description">
            ${sourcesHtml}
          </div>
        </td>
        <td>
          <div class="currency-display-wrapper">
            <div class="currency-code-display">${currency}</div>
          </div>
          <input type="hidden"
                 class="currency-field"
                 data-cost-id="${costId}"
                 data-field="currency"
                 value="${currency}">
        </td>
        <td class="text-right">
          <div class="currency-input-wrapper">
            <span class="currency-symbol">${this.getCurrencySymbol(currency)}</span>
            <input type="number"
                   class="cost-field-input amount-input"
                   data-cost-id="${costId}"
                   data-field="amount"
                   value="${Math.round(amount)}"
                   step="1"
                   min="0">
          </div>
          ${estimateRange}
        </td>
        <td class="text-right">
          <div class="currency-input-wrapper">
            <span class="currency-symbol">$</span>
            <input type="number"
                   class="cost-field-input usd-input"
                   data-cost-id="${costId}"
                   data-field="amount_usd"
                   value="${Math.round(amountUsd)}"
                   step="1"
                   min="0"
                   ${currency === 'USD' ? 'disabled' : ''}>
          </div>
        </td>
        <td>
          <select class="cost-field-select status-select"
                  data-cost-id="${costId}"
                  data-field="status">
            <option value="estimated" ${(cost.status || 'estimated') === 'estimated' ? 'selected' : ''}>Estimated</option>
            <option value="researched" ${cost.status === 'researched' ? 'selected' : ''}>Researched</option>
            <option value="booked" ${cost.status === 'booked' ? 'selected' : ''}>Booked</option>
            <option value="paid" ${cost.status === 'paid' ? 'selected' : ''}>Paid</option>
          </select>
        </td>
        <td>
          <input type="date"
                 class="cost-field-input date-input"
                 data-cost-id="${costId}"
                 data-field="date"
                 value="${cost.date || ''}">
        </td>
        <td>
          <textarea class="cost-field-input notes-input auto-resize"
                    data-cost-id="${costId}"
                    data-field="notes"
                    placeholder="Notes"
                    rows="1">${cost.notes || ''}</textarea>
        </td>
        <td>
          <button class="btn-icon delete-cost-btn" data-cost-id="${costId}" title="Delete cost">🗑️</button>
        </td>
      </tr>
    `;
  }

  private renderAddCostSection(country: string, destinations: any[]): string {
    return `
      <div class="add-cost-section" data-country="${country}" style="display: none;">
        <div class="add-cost-form">
          <h5>Add New Cost for ${country}</h5>
          <div class="form-row">
            <div class="form-group">
              <label>Destination</label>
              <select class="new-cost-field" data-field="destination_id">
                <option value="">Select destination...</option>
                ${destinations.map(dest =>
      `<option value="${dest.id}">${dest.name || dest.city}</option>`
    ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Category</label>
              <select class="new-cost-field" data-field="category">
                <option value="accommodation">🏨 Accommodation</option>
                <option value="food">🍽️ Food</option>
                <option value="transport">🚗 Transport</option>
                <option value="activity">🎯 Activity</option>
                <option value="flight">✈️ Flight</option>
                <option value="other">📦 Other</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Description</label>
              <input type="text" class="new-cost-field" data-field="description" placeholder="Description">
            </div>
            <div class="form-group">
              <label>Currency</label>
              <select class="new-cost-field new-cost-currency" data-field="currency">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="AUD">AUD</option>
                <option value="CAD">CAD</option>
                <option value="CNY">CNY</option>
                <option value="INR">INR</option>
                <option value="THB">THB</option>
                <option value="VND">VND</option>
                <option value="FJD">FJD</option>
                <option value="SGD">SGD</option>
                <option value="NZD">NZD</option>
              </select>
            </div>
            <div class="form-group">
              <label>Amount</label>
              <input type="number" class="new-cost-field new-cost-amount" data-field="amount" step="0.01" min="0" value="0">
            </div>
            <div class="form-group">
              <label>Amount (USD)</label>
              <input type="number" class="new-cost-field new-cost-usd" data-field="amount_usd" step="0.01" min="0" value="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Status</label>
              <select class="new-cost-field" data-field="status">
                <option value="estimated">Estimated</option>
                <option value="researched">Researched</option>
                <option value="booked">Booked</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div class="form-group">
              <label>Date</label>
              <input type="date" class="new-cost-field" data-field="date">
            </div>
            <div class="form-group">
              <label>Notes</label>
              <input type="text" class="new-cost-field" data-field="notes" placeholder="Notes">
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-sm btn-primary save-new-cost-btn" data-country="${country}">Save New Cost</button>
            <button class="btn-sm btn-secondary cancel-new-cost-btn" data-country="${country}">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get the total budget amount
   */
  private getTotalBudget(): number {
    const totalBudgetInput = this.container.querySelector('#total-budget') as HTMLInputElement;
    return totalBudgetInput ? (parseFloat(totalBudgetInput.value) || 0) : (this.budget?.total_budget_usd || 0);
  }

  /**
   * Get current budget data for countries
   * Scrapes from DOM if available for real-time updates, otherwise calculates from data
   */
  private getCountryBudgetData(): Array<{
    country: string,
    amount: number,
    percent: number,
    perDay: number,
    budgetAmount: number,
    budgetPerDay: number,
    actualSpent: number,
    days: number
  }> {
    const data: Array<{
      country: string,
      amount: number,
      percent: number,
      perDay: number,
      budgetAmount: number,
      budgetPerDay: number,
      actualSpent: number,
      days: number
    }> = [];
    const totalBudgetInput = this.container.querySelector('#total-budget') as HTMLInputElement;
    const totalBudget = totalBudgetInput ? (parseFloat(totalBudgetInput.value) || 0) : (this.budget?.total_budget_usd || 0);

    // Try to get data from inputs first (for real-time updates while editing)
    const inputs = this.container.querySelectorAll('.country-input');
    if (inputs.length > 0) {
      inputs.forEach(input => {
        const el = input as HTMLInputElement;
        const country = el.dataset.country!;
        const days = parseFloat(el.dataset.days!) || 1;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;

        // Get actual spending for this country
        const countryCosts = (this.tripData.costs || [])
          .filter(c => {
            const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
            return location?.country === country;
          })
          .reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);

        data.push({
          country,
          amount: dollarValue,
          percent: totalBudget > 0 ? (dollarValue / totalBudget * 100) : 0,
          perDay: days > 0 ? Math.round(dollarValue / days) : 0,
          budgetAmount: dollarValue,
          budgetPerDay: days > 0 ? Math.round(dollarValue / days) : 0,
          actualSpent: countryCosts,
          days: days
        });
      });
    } else {
      // Fallback to stored data
      const countries = new Set<string>();
      (this.tripData.locations || []).forEach(loc => {
        if (loc.country) countries.add(loc.country);
      });

      countries.forEach(country => {
        const countryCosts = (this.tripData.costs || [])
          .filter(c => {
            const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
            return location?.country === country;
          })
          .reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);

        const countryDays = (this.tripData.locations || [])
          .filter(loc => loc.country === country)
          .reduce((sum, loc) => sum + (loc.duration_days || 0), 0);

        const amount = this.budget?.budgets_by_country?.[country] || countryCosts * 1.1;

        data.push({
          country,
          amount,
          percent: totalBudget > 0 ? (amount / totalBudget * 100) : 0,
          perDay: countryDays > 0 ? Math.round(amount / countryDays) : 0,
          budgetAmount: amount,
          budgetPerDay: countryDays > 0 ? Math.round(amount / countryDays) : 0,
          actualSpent: countryCosts,
          days: countryDays
        });
      });
    }

    // Sort based on mode
    if (this.countryMode === 'dollars') {
      return data.sort((a, b) => b.amount - a.amount); // Highest first for dollars
    } else if (this.countryMode === 'perday') {
      return data.sort((a, b) => b.perDay - a.perDay); // Highest first for per day
    } else {
      return data.sort((a, b) => b.percent - a.percent); // Highest first for percent
    }
  }

  /**
   * Render visuals for country budget
   */
  private renderCountryVisuals(): string {
    const data = this.getCountryBudgetData();
    if (data.length === 0) return '';

    if (this.countryMode === 'percent') {
      // Bar Chart for Percentages
      const maxPercent = Math.max(...data.map(d => {
        const budgetPercent = d.percent;
        const estimatedPercent = d.actualSpent > 0 ? (d.actualSpent / this.getTotalBudget()) * 100 : 0;
        return Math.max(budgetPercent, estimatedPercent);
      }));

      // Column headers (shown once at the top)
      const headers = `
        <div class="chart-bar-headers">
          <div class="bar-label"></div>
          <div class="bar-container"></div>
          <div class="bar-value">
            <div class="bar-value-columns">
              <div class="bar-value-column">
                <div class="bar-value-header">Budget</div>
              </div>
              <div class="bar-value-column">
                <div class="bar-value-header">Estimate</div>
              </div>
              <div class="bar-value-column">
                <div class="bar-value-header">Over/Under</div>
              </div>
            </div>
          </div>
        </div>
      `;

      const bars = data.map(d => {
        const budgetPercent = d.percent;
        const estimatedPercent = d.actualSpent > 0 ? (d.actualSpent / this.getTotalBudget()) * 100 : 0;
        const variance = estimatedPercent - budgetPercent;

        const budgetWidthPct = maxPercent > 0 ? (budgetPercent / maxPercent * 100) : 0;
        const actualWidthPct = maxPercent > 0 ? (estimatedPercent / maxPercent * 100) : 0;

        // Determine color based on over/under
        const isOverBudget = estimatedPercent > budgetPercent;
        const barColor = isOverBudget ? '#dc3545' : '#007bff';
        const varianceColor = isOverBudget ? '#dc3545' : '#28a745';
        const varianceSign = variance > 0 ? '+' : '';

        return `
          <div class="chart-bar-row visual-chart-item" data-country="${d.country}" style="cursor: pointer;">
            <div class="bar-label">${d.country}</div>
            <div class="bar-container">
              <div class="bar-fill-budget" style="width: ${budgetWidthPct}%"></div>
              <div class="bar-fill-actual" style="width: ${actualWidthPct}%; background-color: ${barColor}"></div>
            </div>
            <div class="bar-value">
              <div class="bar-value-columns">
                <div class="bar-value-column">
                  <div class="bar-value-amount">${budgetPercent.toFixed(1)}%</div>
                </div>
                <div class="bar-value-column">
                  <div class="bar-value-amount">${estimatedPercent.toFixed(1)}%</div>
                </div>
                <div class="bar-value-column">
                  <div class="bar-value-amount" style="color: ${varianceColor}">${varianceSign}${Math.abs(variance).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Legend for bar chart
      const legend = `
        <div class="chart-legend bar-chart-legend">
          <div class="chart-legend-item">
            <span class="legend-color" style="background-color: rgba(0, 123, 255, 0.2); border: 1px solid rgba(0, 123, 255, 0.4);"></span>
            <span class="legend-label">Budget Allocated</span>
          </div>
          <div class="chart-legend-item">
            <span class="legend-color" style="background-color: #007bff;"></span>
            <span class="legend-label">Estimated Costs (Under Budget)</span>
          </div>
          <div class="chart-legend-item">
            <span class="legend-color" style="background-color: #dc3545;"></span>
            <span class="legend-label">Estimated Costs (Over Budget)</span>
          </div>
        </div>
      `;

      return `
        <div class="country-visual-chart bar-chart-container">
          ${legend}
          ${headers}
          ${bars}
        </div>
      `;
    } else {
      // Bar Chart (Compact) for Dollars or Per Day
      // For $ mode, compare budget vs spent
      // For $/day mode, compare budget per day vs actual spent per day
      const maxVal = Math.max(...data.map(d => {
        const budgetVal = this.countryMode === 'perday' ? d.budgetPerDay : d.budgetAmount;
        const actualVal = this.countryMode === 'perday' ? (d.days > 0 ? d.actualSpent / d.days : 0) : d.actualSpent;
        return Math.max(budgetVal, actualVal);
      }));

      // Column headers (shown once at the top)
      const headers = `
        <div class="chart-bar-headers">
          <div class="bar-label"></div>
          <div class="bar-container"></div>
          <div class="bar-value">
            <div class="bar-value-columns">
              <div class="bar-value-column">
                <div class="bar-value-header">Budget</div>
              </div>
              <div class="bar-value-column">
                <div class="bar-value-header">Estimate</div>
              </div>
              <div class="bar-value-column">
                <div class="bar-value-header">Over/Under</div>
              </div>
            </div>
          </div>
        </div>
      `;

      const bars = data.map(d => {
        const budgetVal = this.countryMode === 'perday' ? d.budgetPerDay : d.budgetAmount;
        const actualVal = this.countryMode === 'perday' ? (d.days > 0 ? Math.round(d.actualSpent / d.days) : 0) : d.actualSpent;
        const variance = actualVal - budgetVal;

        const budgetWidthPct = maxVal > 0 ? (budgetVal / maxVal * 100) : 0;
        const actualWidthPct = maxVal > 0 ? (actualVal / maxVal * 100) : 0;

        const budgetLabel = this.countryMode === 'perday' ? `$${budgetVal}` : this.formatCurrency(budgetVal);
        const actualLabel = this.countryMode === 'perday' ? `$${actualVal}` : this.formatCurrency(actualVal);
        const varianceLabel = this.countryMode === 'perday' ? `$${Math.abs(variance)}` : this.formatCurrency(Math.abs(variance));

        // Determine if over budget
        const isOverBudget = actualVal > budgetVal;
        const barColor = isOverBudget ? '#dc3545' : '#007bff';
        const varianceColor = isOverBudget ? '#dc3545' : '#28a745';
        const varianceSign = variance > 0 ? '+' : '';

        return `
          <div class="chart-bar-row visual-chart-item" data-country="${d.country}" style="cursor: pointer;">
            <div class="bar-label">${d.country}</div>
            <div class="bar-container">
              <div class="bar-fill-budget" style="width: ${budgetWidthPct}%"></div>
              <div class="bar-fill-actual" style="width: ${actualWidthPct}%; background-color: ${barColor}"></div>
            </div>
            <div class="bar-value">
              <div class="bar-value-columns">
                <div class="bar-value-column">
                  <div class="bar-value-amount">${budgetLabel}</div>
                </div>
                <div class="bar-value-column">
                  <div class="bar-value-amount">${actualLabel}</div>
                </div>
                <div class="bar-value-column">
                  <div class="bar-value-amount" style="color: ${varianceColor}">${varianceSign}${varianceLabel}</div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Legend for bar chart
      const legend = `
        <div class="chart-legend bar-chart-legend">
          <div class="chart-legend-item">
            <span class="legend-color" style="background-color: rgba(0, 123, 255, 0.2); border: 1px solid rgba(0, 123, 255, 0.4);"></span>
            <span class="legend-label">Budget Allocated</span>
          </div>
          <div class="chart-legend-item">
            <span class="legend-color" style="background-color: #007bff;"></span>
            <span class="legend-label">Estimated Costs (Under Budget)</span>
          </div>
          <div class="chart-legend-item">
            <span class="legend-color" style="background-color: #dc3545;"></span>
            <span class="legend-label">Estimated Costs (Over Budget)</span>
          </div>
        </div>
      `;

      return `
        <div class="country-visual-chart bar-chart-container">
          ${legend}
          ${headers}
          ${bars}
        </div>
      `;
    }
  }

  /**
   * Update the country visuals in the DOM
   */
  private updateCountryVisualsDOM() {
    const container = this.container.querySelector('#country-visuals-container');
    if (container) {
      container.innerHTML = this.renderCountryVisuals();

      // Attach click listeners to new visual elements
      container.querySelectorAll('.visual-chart-item').forEach(item => {
        item.addEventListener('click', () => {
          const country = (item as HTMLElement).dataset.country;
          if (country) {
            // Find the country section
            const section = this.container.querySelector(`.item-costs-section[data-country="${country}"]`) as HTMLElement;
            if (section) {
              // Ensure it's visible
              section.style.display = 'block';

              // Update toggle button text
              const toggleBtn = this.container.querySelector(`.costs-toggle-btn[data-country="${country}"]`) as HTMLElement;
              if (toggleBtn) {
                const countryCurrentCosts = (this.tripData.costs || []).filter(c => {
                  const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
                  return location?.country === country;
                });
                toggleBtn.innerHTML = `💰 ▼ Hide Costs (${countryCurrentCosts.length})`;
              }

              // Scroll to it
              section.scrollIntoView({ behavior: 'smooth', block: 'start' });

              // Highlight it briefly
              section.style.transition = 'background-color 0.5s';
              section.style.backgroundColor = '#fff3cd';
              setTimeout(() => {
                section.style.backgroundColor = '#f8f9fa';
              }, 1000);
            }
          }
        });
      });
    }
  }

  private renderCategoryBreakdown(costs: Array<{ category?: string, amount?: number, amount_usd?: number }>): string {
    const categoryTotals: Record<string, number> = {};
    let total = 0;

    costs.forEach(cost => {
      const cat = cost.category || 'other';
      const amount = cost.amount_usd || cost.amount || 0;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
      total += amount;
    });

    if (total === 0) return '';

    return Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => {
        const pct = (amount / total) * 100;
        const color = this.getCategoryColor(cat);
        return `<div class="cat-breakdown-item" style="background-color: ${color}" title="${cat.replace(/_/g, ' ')}: ${this.formatCurrency(amount)} (${pct.toFixed(0)}%)"></div>`;
      })
      .join('');
  }

  private async fetchAvailableUsers() {
    try {
      this.availableUsers = await wellnessFirebaseService.getAllUsers();
      // Re-render if we have users and the UI is already mounted
      if (this.availableUsers.length > 0 && this.container.innerHTML) {
        this.render();
      }
    } catch (error) {
      console.error('Failed to fetch wellness users:', error);
    }
  }

  private renderTravelerSection(): string {
    const numTravelers = this.tripData.num_travelers || 1;
    const composition = this.tripData.traveler_composition;
    const adults = composition?.adults || numTravelers;
    const children = composition?.children || 0;
    const accommodationPref = this.tripData.accommodation_preference || 'mid-range';
    const selectedUserIds = this.tripData.traveler_ids || [];

    const userCheckboxes = this.availableUsers.map(user => {
      const isSelected = selectedUserIds.includes(user.userId);
      return `
        <div class="traveler-checkbox-item" style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <input type="checkbox" 
                 id="user-${user.userId}" 
                 class="traveler-user-checkbox" 
                 data-user-id="${user.userId}"
                 ${isSelected ? 'checked' : ''}>
          <label for="user-${user.userId}" style="cursor: pointer;">${user.userName}</label>
        </div>
      `;
    }).join('');

    return `
      <div class="traveler-section">
        <div class="traveler-header">
          <h4>👥 Travelers & Preferences</h4>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="traveler-count-badge">${numTravelers} total</span>
            <span id="traveler-save-indicator" class="auto-save-indicator-inline"></span>
          </div>
        </div>
        
        ${this.availableUsers.length > 0 ? `
          <div class="traveler-inputs" style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Select Travelers:</label>
            <div class="traveler-user-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
              ${userCheckboxes}
            </div>
          </div>
        ` : ''}

        <div class="traveler-inputs">
          <div class="traveler-input-group">
            <label for="adults-count">Adults:</label>
            <input type="number" id="adults-count" value="${adults}" min="1" max="20" step="1">
          </div>
          <div class="traveler-input-group">
            <label for="children-count">Children:</label>
            <input type="number" id="children-count" value="${children}" min="0" max="20" step="1">
          </div>
        </div>
        <div class="traveler-inputs" style="margin-top: 10px;">
          <div class="traveler-input-group" style="flex: 1;">
            <label for="accommodation-pref">Accommodation:</label>
            <select id="accommodation-pref" class="accommodation-select">
              <option value="budget" ${accommodationPref === 'budget' ? 'selected' : ''}>Budget</option>
              <option value="mid-range" ${accommodationPref === 'mid-range' ? 'selected' : ''}>Mid-range</option>
              <option value="higher-end" ${accommodationPref === 'higher-end' ? 'selected' : ''}>Higher-end</option>
              <option value="luxurious" ${accommodationPref === 'luxurious' ? 'selected' : ''}>Luxurious</option>
            </select>
          </div>
        </div>
        <div class="traveler-note">
          <small>ℹ️ Changes save automatically. Regenerate existing costs to apply updated preferences.</small>
        </div>
      </div>
    `;
  }

  private renderNoBudget(): string {
    const totalCosts = (this.tripData.costs || [])
      .reduce((sum, cost) => sum + (cost.amount_usd || cost.amount || 0), 0);

    return `
      <div class="budget-manager no-budget">
        <div class="budget-header">
          <h3>💰 Budget Management</h3>
          <p class="budget-subtitle">No budget set for this trip</p>
        </div>

        <div class="current-spending">
          <div class="spending-summary">
            <div class="spending-label">Current Total Spending</div>
            <div class="spending-amount">${this.formatCurrency(totalCosts)}</div>
          </div>
        </div>

        <div class="budget-actions">
          <button class="btn-primary" id="create-budget-btn">
            Create Budget (+10% Contingency)
          </button>
          <button class="btn-secondary" id="custom-budget-btn">
            Set Custom Budget
          </button>
        </div>

        <div class="budget-help">
          <p>💡 <strong>Tip:</strong> Setting a budget helps you track spending and receive alerts when approaching limits.</p>
        </div>
      </div>
    `;
  }

  /**
   * Render the transport costs section
   */
  private renderTransportSection(): string {
    if (this.transportSegments.length === 0) {
      return '';
    }

    const transportTotal = this.calculateTransportTotal();
    const breakdown = this.calculateTransportBreakdown();
    const currentBudget = this.budget?.total_budget_usd || 0;
    const transportPct = currentBudget > 0 ? (transportTotal / currentBudget * 100) : 0;

    // Count segments that need research
    const needsResearchCount = this.getSegmentsNeedingResearch(30).length;

    // Create breakdown display
    const breakdownParts = [];
    if (breakdown.actualCount > 0) {
      breakdownParts.push(`🟢 ${breakdown.actualCount} Actual`);
    }
    if (breakdown.manualCount > 0) {
      breakdownParts.push(`🟠 ${breakdown.manualCount} Manual`);
    }
    if (breakdown.researchedCount > 0) {
      breakdownParts.push(`🔵 ${breakdown.researchedCount} AI`);
    }
    if (breakdown.estimatedCount > 0) {
      breakdownParts.push(`⚪ ${breakdown.estimatedCount} Est`);
    }
    const breakdownDisplay = breakdownParts.length > 0 ? ` | ${breakdownParts.join(' · ')}` : '';

    const isCollapsed = this.collapsedSections.has('transport');
    const collapseIcon = isCollapsed ? '▶' : '▼';

    return `
      <div class="budget-edit-section transport-section" data-section="transport">
        <div class="section-header section-header-collapsible" data-section="transport">
          <div class="section-header-left">
            <h4>✈️ Inter-Country Transport</h4>
            <div class="section-summary-inline">
              <span class="transport-total">Total: ${this.formatCurrency(transportTotal)}</span>
              ${currentBudget > 0 ? `<span class="transport-pct">(${transportPct.toFixed(1)}% of budget)</span>` : ''}
              <span class="transport-breakdown" style="font-size: 11px; color: #666; margin-left: 8px;">${breakdownDisplay}</span>
            </div>
          </div>
          <div class="section-header-right">
            ${needsResearchCount > 0 ? `
              <button class="btn-sm btn-primary" id="bulk-research-btn" title="Research multiple segments at once">
                🔍 Bulk Research (${needsResearchCount})
              </button>
            ` : ''}
            <span class="section-collapse-icon">${collapseIcon}</span>
          </div>
        </div>

        <div class="section-content" data-section="transport" style="display: ${isCollapsed ? 'none' : 'block'}">
          <div class="transport-segments-list">
            ${this.transportSegments.map(segment => {
      const activeCost = this.getSegmentActiveCost(segment);
      // Use transport_mode_icon if set, otherwise derive from transport_mode
      const icon = segment.transport_mode_icon || this.getTransportIcon(segment.transport_mode);
      const fromName = segment.from_destination_name || 'Unknown';
      const toName = segment.to_destination_name || 'Unknown';
      const mode = segment.transport_mode || 'plane';
      const distance = segment.distance_km ? `${Math.round(segment.distance_km)}km` : '';
      const duration = segment.duration_hours || segment.researched_duration_hours;
      const durationStr = duration ? `${duration}h` : '';
      const airlines = segment.researched_airlines && segment.researched_airlines.length > 0
        ? segment.researched_airlines.join(', ')
        : '';
      const statusBadge = this.getSegmentStatusBadge(segment);
      const researchedDate = segment.researched_at
        ? new Date(segment.researched_at).toLocaleDateString()
        : '';
      const alternatives = segment.alternatives || segment.researched_alternatives;
      const hasAlternatives = alternatives && alternatives.length > 0;
      const hasResearchData = segment.booking_status === 'researched' || segment.researched_cost_mid;

      // Check if research is old (>30 days)
      let researchAge = '';
      if (segment.researched_at) {
        const ageInDays = Math.floor((Date.now() - new Date(segment.researched_at).getTime()) / (1000 * 60 * 60 * 24));
        if (ageInDays > 30) {
          researchAge = `<span class="research-old" title="Research is ${ageInDays} days old">⚠️ Old</span>`;
        } else if (ageInDays > 7) {
          researchAge = `<span class="research-aging" title="Research is ${ageInDays} days old">⏰</span>`;
        }
      }

      return `
              <div class="transport-segment-item" data-segment-id="${segment.id}">
                <div class="segment-header">
                  <div class="segment-route">
                    <span class="segment-icon">${icon}</span>
                    <span class="segment-from">${fromName}</span>
                    <span class="segment-arrow">→</span>
                    <span class="segment-to">${toName}</span>
                    <span class="segment-mode">${mode}</span>
                    ${distance ? `<span class="segment-distance">• ${distance}</span>` : ''}
                    ${durationStr ? `<span class="segment-duration">• ${durationStr}</span>` : ''}
                  </div>
                  <div class="segment-actions">
                    ${hasResearchData ? `
                      <button class="btn-xs btn-secondary transport-details-btn"
                              data-segment-id="${segment.id}"
                              title="Edit details & view alternatives">
                        ✏️ Edit
                      </button>
                    ` : `
                      <button class="btn-xs btn-secondary transport-details-btn"
                              data-segment-id="${segment.id}"
                              title="Edit details">
                        ✏️ Edit
                      </button>
                    `}
                    <button class="btn-xs btn-primary transport-research-btn"
                            data-segment-id="${segment.id}"
                            title="Research cost with AI">
                      🤖 Research
                    </button>
                  </div>
                </div>
                <div class="segment-details">
                  <div class="segment-cost">
                    <span class="cost-value">${this.formatCurrency(activeCost)}</span>
                    ${statusBadge}
                    ${researchAge}
                  </div>
                  ${airlines ? `<div class="segment-airlines">✈️ ${airlines}</div>` : ''}
                  ${segment.researched_cost_low && segment.researched_cost_high ? `
                    <div class="segment-range">
                      Range: ${this.formatCurrency(segment.researched_cost_low)} - ${this.formatCurrency(segment.researched_cost_high)}
                    </div>
                  ` : ''}
                  ${hasAlternatives ? `
                    <div class="segment-alternatives">
                      <span class="alternatives-badge" style="cursor: pointer;" onclick="document.querySelector('.transport-details-btn[data-segment-id=\\'${segment.id}\\']').click()">
                        🔀 ${alternatives.length} alternative${alternatives.length > 1 ? 's' : ''} available
                      </span>
                    </div>
                  ` : ''}
                  ${segment.notes ? `<div class="segment-notes">📝 ${segment.notes}</div>` : ''}
                  ${researchedDate ? `<div class="segment-researched">Last researched: ${researchedDate}</div>` : ''}
                </div>
              </div>
            `;
    }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private renderBudgetStatus(): string {
    if (!this.budget) return this.renderNoBudget();

    const status = calculateBudgetStatus(this.budget, this.tripData);

    // Add transport costs to the total spent
    const transportTotal = this.calculateTransportTotal();
    const totalSpentWithTransport = status.total_spent + transportTotal;
    const totalRemainingWithTransport = status.total_budget - totalSpentWithTransport;
    const percentageUsedWithTransport = (totalSpentWithTransport / status.total_budget) * 100;

    const progressBarClass = percentageUsedWithTransport > 100 ? 'over-budget' :
      percentageUsedWithTransport > 90 ? 'warning' :
        percentageUsedWithTransport > 80 ? 'caution' : '';
    const progressWidth = Math.min(percentageUsedWithTransport, 100);

    // Get all categories and countries from trip data
    const categories = new Set<string>();
    const countries = new Set<string>();

    (this.tripData.costs || []).forEach(cost => {
      if (cost.category) categories.add(cost.category);
    });

    (this.tripData.locations || []).forEach(loc => {
      if (loc.country) countries.add(loc.country);
    });

    const currentBudget = this.budget.total_budget_usd || 0;
    const allCurrencies = this.getAllCurrencies();
    const hasAnyCurrencies = allCurrencies.length > 0;

    return `
      <div class="budget-manager integrated">
        <div class="budget-header-compact">
          <div class="header-row">
            <h3>💰 Budget Management</h3>
            <div class="header-actions">
              <div class="global-controls">
                <button class="global-control-btn" id="expand-all-sections-btn" title="Expand all sections">
                  <span>📂</span> Expand All
                </button>
                <button class="global-control-btn" id="collapse-all-sections-btn" title="Collapse all sections" style="display: none;">
                  <span>📁</span> Collapse All
                </button>
              </div>
              ${hasAnyCurrencies ? `
                <button class="btn-secondary-sm" id="refresh-all-rates-btn" title="Refresh all exchange rates (${allCurrencies.join(', ')})">
                  🔄 Refresh All Rates
                </button>
              ` : ''}
              ${this.lastSaved ? `
                <span class="last-saved-indicator" style="font-size: 12px; color: #666; margin-right: 10px;">
                  ${this.isSaving ? 'Saving...' : `Last synced: ${this.lastSaved.toLocaleTimeString()}`}
                </span>
              ` : ''}
              <button class="btn-secondary-sm" id="refresh-budget-btn" title="Reload data">🔄 Refresh</button>
              <span id="budget-save-indicator" class="auto-save-indicator-inline"></span>
            </div>
          </div>
          <div class="budget-overview-compact">
            <div class="budget-field">
              <label>Total:</label>
              <input type="number" id="total-budget" value="${currentBudget}" min="0" step="100">
              <span>USD</span>
            </div>
            <div class="budget-field">
              <label>Contingency:</label>
              <input type="number" id="contingency-pct" value="${this.budget.contingency_pct || 0}" min="0" max="100" step="1">
              <span>%</span>
            </div>
            <div class="budget-stat">
              <span class="stat-label">Estimated:</span>
              <span class="stat-value ${progressBarClass}">${this.formatCurrency(totalSpentWithTransport)} <span class="stat-pct">(${percentageUsedWithTransport.toFixed(1)}%)</span></span>
              ${transportTotal > 0 ? `<div class="stat-breakdown">In-country: ${this.formatCurrency(status.total_spent)} | Transport: ${this.formatCurrency(transportTotal)}</div>` : ''}
            </div>
            <div class="budget-stat">
              <span class="stat-label">Remaining:</span>
              <span class="stat-value ${totalRemainingWithTransport < 0 ? 'negative' : 'positive'}">
                ${this.formatCurrency(totalRemainingWithTransport)}
              </span>
            </div>
          </div>
          <div class="budget-progress-compact">
            <div class="progress-bar ${progressBarClass}">
              <div class="progress-fill" style="width: ${progressWidth}%"></div>
            </div>
          </div>
        </div>

        <!-- Traveler Information -->
        ${this.renderTravelerSection()}

        <!-- Alerts -->
        ${status.alerts.length > 0 ? `
          <div class="budget-edit-section" data-section="alerts">
            <div class="section-header section-header-collapsible" data-section="alerts">
              <div class="section-header-left">
                <h4>🔔 Alerts</h4>
                <div class="section-summary-inline">
                  <span class="alert-count-badge" style="background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                    ${status.alerts.length} alert${status.alerts.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div class="section-header-right">
                <span class="section-collapse-icon">${this.collapsedSections.has('alerts') ? '▶' : '▼'}</span>
              </div>
            </div>
            <div class="section-content" data-section="alerts" style="display: ${this.collapsedSections.has('alerts') ? 'none' : 'block'}">
              <div class="budget-alerts">
                ${status.alerts.map(alert => `
                  <div class="budget-alert alert-${alert.type}">
                    <span class="alert-icon">${this.getAlertIcon(alert.type)}</span>
                    <span class="alert-message">${alert.message}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Inter-Country Transport -->
        ${this.renderTransportSection()}

        <!-- Budget by Country -->
        ${countries.size > 0 ? `
          <div class="budget-edit-section" data-section="countries">
            <div class="section-header section-header-collapsible" data-section="countries">
              <div class="section-header-left">
                <h4>🌍 Budget by Country</h4>
                <div class="section-summary-inline">
                  <span class="transport-total">Allocated: ${this.formatCurrency(
      Array.from(countries).reduce((sum, country) => sum + (this.budget?.budgets_by_country?.[country] || 0), 0)
    )}</span>
                  <span class="transport-pct">Est: ${this.formatCurrency(
      Array.from(countries).reduce((sum, country) => {
        const countryCosts = (this.tripData.costs || [])
          .filter(c => {
            const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
            return location?.country === country;
          });
        return sum + countryCosts.reduce((s, c) => s + (c.amount_usd || c.amount || 0), 0);
      }, 0)
    )} (${(() => {
      const allocated = Array.from(countries).reduce((sum, country) => sum + (this.budget?.budgets_by_country?.[country] || 0), 0);
      const estimated = Array.from(countries).reduce((sum, country) => {
        const countryCosts = (this.tripData.costs || [])
          .filter(c => {
            const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
            return location?.country === country;
          });
        return sum + countryCosts.reduce((s, c) => s + (c.amount_usd || c.amount || 0), 0);
      }, 0);
      return allocated > 0 ? ((estimated / allocated) * 100).toFixed(1) : '0.0';
    })()}%)</span>
                </div>
              </div>
              <div class="section-header-right">
                <div class="mode-controls">
                  <button class="btn-xs btn-secondary" id="show-all-costs-btn" title="Expand all cost sections">📂 Show All Costs</button>
                  <button class="btn-xs btn-secondary" id="hide-all-costs-btn" title="Collapse all cost sections" style="display: none;">📁 Hide All Costs</button>
                  <span class="mode-indicator" id="country-mode-indicator">Mode: Dollar Amounts</span>
                  <div class="country-mode-selector">
                    <button class="mode-btn active" data-mode="dollars" id="country-mode-dollars">$</button>
                    <button class="mode-btn" data-mode="perday" id="country-mode-perday">$/day</button>
                    <button class="mode-btn" data-mode="percent" id="country-mode-percent">%</button>
                  </div>
                </div>
                <span class="section-collapse-icon">${this.collapsedSections.has('countries') ? '▶' : '▼'}</span>
              </div>
            </div>
            <div class="section-content" data-section="countries" style="display: ${this.collapsedSections.has('countries') ? 'none' : 'block'}">

            <!-- Country Visuals -->
            <div id="country-visuals-container" class="country-visuals-section">
              ${this.renderCountryVisuals()}
            </div>

            <!-- Group note for countries -->
            <div class="group-note-section">
              <label class="note-label">📝 Country Budget Notes:</label>
              <textarea class="group-note-input"
                        id="country-group-note"
                        placeholder="Add notes about country budgeting strategy..."
                        rows="2">${this.budget?.country_group_note || ''}</textarea>
            </div>

            <div id="country-allocation-status" style="display: none;" class="allocation-status">
              <div class="allocation-info">
                <strong>Total Allocated:</strong> <span id="country-total-allocated-pct">0</span>%
              </div>
              <div id="country-allocation-remainder" class="allocation-remainder"></div>
            </div>

            <div class="budget-items-edit">
              ${Array.from(countries).map(country => {
      const countryDays = (this.tripData.locations || [])
        .filter(loc => loc.country === country)
        .reduce((sum, loc) => sum + (loc.duration_days || 0), 0);

      const countryCostsArray = (this.tripData.costs || [])
        .filter(c => {
          const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
          return location?.country === country;
        });

      // Get destinations for this country for the Generate Costs button
      const countryDestinations = (this.tripData.locations || [])
        .filter(loc => loc.country === country);

      // Calculate date range for country
      const countryDates = countryDestinations
        .filter(loc => loc.arrival_date || loc.departure_date)
        .map(loc => ({
          arrival: loc.arrival_date ? new Date(loc.arrival_date) : null,
          departure: loc.departure_date ? new Date(loc.departure_date) : null
        }))
        .filter(d => d.arrival || d.departure);

      let countryDateRange = '';
      if (countryDates.length > 0) {
        const validArrivals = countryDates.filter(d => d.arrival).map(d => d.arrival!);
        const validDepartures = countryDates.filter(d => d.departure).map(d => d.departure!);

        if (validArrivals.length > 0 && validDepartures.length > 0) {
          const earliestArrival = new Date(Math.min(...validArrivals.map(d => d.getTime())));
          const latestDeparture = new Date(Math.max(...validDepartures.map(d => d.getTime())));
          countryDateRange = `${earliestArrival.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${latestDeparture.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
      }

      const countryCosts = countryCostsArray.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);
      const categoryBreakdown = this.renderCategoryBreakdown(countryCostsArray);

      const countryBudget = this.budget?.budgets_by_country?.[country] || countryCosts * 1.1;
      const budgetPerDay = countryDays > 0 ? countryBudget / countryDays : 0;
      const countryPct = currentBudget > 0 ? (countryBudget / currentBudget * 100) : 0;
      const pct = status.by_country[country]?.percentage || 0;
      const barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';
      const countryNote = this.budget?.country_notes?.[country] || '';

      // Determine which button to show: Generate Costs or View Costs
      const hasCosts = countryCostsArray.length > 0;
      const destinationLabel = countryDestinations.length === 1
        ? '1 destination'
        : `${countryDestinations.length} destinations`;

      const costsButton = hasCosts
        ? `<button class="costs-toggle-btn" data-country="${country}" title="View Costs">
                       💰 View Costs (${countryCostsArray.length})
                     </button>`
        : `<button class="generate-costs-btn inline-generate-btn"
                             data-country="${country}"
                             data-destinations="${countryDestinations.map(d => d.id).join(',')}"
                             title="Generate AI cost estimates">
                       🤖 Generate Costs (${destinationLabel})
                     </button>`;

      return `
                  <div class="budget-item-edit">
                    <div class="item-header-row">
                      <div class="item-label-with-note">
                        <span class="item-label-text">
                          ${country}
                          <span class="days-label">(${countryDays} day${countryDays !== 1 ? 's' : ''}${countryDateRange ? ` • ${countryDateRange}` : ''})</span>
                        </span>
                        <button class="note-toggle-btn" data-country="${country}" title="${countryNote ? 'Edit Note' : 'Add Note'}">
                          ${countryNote ? '📝' : '📄'}
                        </button>
                        ${countryNote ? `<span class="inline-note">${countryNote}</span>` : ''}
                        ${costsButton}
                      </div>
                    </div>
                    <div class="item-input-row">
                      <div class="input-with-unit">
                        <input type="number"
                               class="country-input"
                               data-country="${country}"
                               data-days="${countryDays}"
                               data-dollar-value="${Math.round(countryBudget)}"
                               value="${Math.round(countryBudget)}"
                               min="0"
                               step="10">
                        <span class="input-unit" data-country="${country}">USD</span>
                      </div>
                      <span class="calc-arrow">→</span>
                      <div class="calculated-display">
                        <span class="calc-value" data-country="${country}">${countryPct.toFixed(1)}%</span>
                      </div>
                      <div class="item-status">
                        <span class="country-per-day-display" data-country="${country}">$${Math.round(budgetPerDay)}/day</span>
                        <div class="est-cost-with-breakdown">
                          <span class="current-spend">Est: ${this.formatCurrency(countryCosts)}</span>
                          ${categoryBreakdown ? `<div class="cat-breakdown-bar">${categoryBreakdown}</div>` : ''}
                        </div>
                        <div class="mini-progress-bar ${barClass}">
                          <div class="mini-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                        </div>
                      </div>
                    </div>
                    <div class="item-note-section" data-country="${country}" style="display: none">
                      <textarea class="item-note-input"
                                data-country="${country}"
                                placeholder="Add notes about this country budget..."
                                rows="2">${countryNote}</textarea>
                    </div>
                    <div class="item-costs-section" data-country="${country}" style="display: none">
                      ${this.renderCostsTableForCountry(country)}
                    </div>
                  </div>
                `;
    }).join('')}
            </div>
            </div>
          </div>
        ` : ''}

        <!-- Budget by Category -->
        <div class="budget-edit-section" data-section="categories">
          <div class="section-header section-header-collapsible" data-section="categories">
            <div class="section-header-left">
              <h4>📊 Budget by Category</h4>
            </div>
            <div class="section-header-right">
              <div class="mode-controls">
                <span class="mode-indicator" id="category-mode-indicator">Mode: Dollar Amounts</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="category-mode-toggle">
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">Use %</span>
                </label>
              </div>
              <span class="section-collapse-icon">${this.collapsedSections.has('categories') ? '▶' : '▼'}</span>
            </div>
          </div>
          <div class="section-content" data-section="categories" style="display: ${this.collapsedSections.has('categories') ? 'none' : 'block'}">

          <!-- Group note for categories -->
          <div class="group-note-section">
            <label class="note-label">📝 Category Budget Notes:</label>
            <textarea class="group-note-input"
                      id="category-group-note"
                      placeholder="Add notes about category budgeting strategy..."
                      rows="2">${this.budget?.category_group_note || ''}</textarea>
          </div>

          <!-- Always-visible budget summary -->
          <div class="budget-summary-box">
            <div class="summary-row">
              <span class="summary-label">Total Budget:</span>
              <span class="summary-value" id="category-total-budget">${this.formatCurrency(currentBudget)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Allocated to Categories:</span>
              <span class="summary-value" id="category-total-allocated">${this.formatCurrency(
      Array.from(categories).reduce((sum, cat) => {
        return sum + (this.budget?.budgets_by_category?.[cat] || 0);
      }, 0)
    )}</span>
              <span class="summary-percentage" id="category-total-pct">${currentBudget > 0 ?
        ((Array.from(categories).reduce((sum, cat) => sum + (this.budget?.budgets_by_category?.[cat] || 0), 0) / currentBudget) * 100).toFixed(1) : 0}%</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Unallocated:</span>
              <span class="summary-value" id="category-unallocated">${this.formatCurrency(
          currentBudget - Array.from(categories).reduce((sum, cat) => sum + (this.budget?.budgets_by_category?.[cat] || 0), 0)
        )}</span>
            </div>
          </div>

          <div id="allocation-status" style="display: none;" class="allocation-status">
            <div class="allocation-info">
              <strong>Total Allocated:</strong> <span id="total-allocated-pct">0</span>%
            </div>
            <div id="allocation-remainder" class="allocation-remainder"></div>
          </div>

          <div class="budget-items-edit">
            ${Array.from(categories).map(cat => {
          const catCosts = (this.tripData.costs || [])
            .filter(c => c.category === cat)
            .reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);
          const catBudget = this.budget?.budgets_by_category?.[cat] || catCosts * 1.1;
          const catPct = currentBudget > 0 ? (catBudget / currentBudget * 100) : 0;
          const pct = status.by_category[cat]?.percentage || 0;
          const barClass = pct > 100 ? 'over-budget' : pct > 90 ? 'warning' : '';

          const catNote = this.budget?.category_notes?.[cat] || '';
          return `
                <div class="budget-item-edit">
                  <div class="item-header-row">
                    <div class="item-label-with-note">
                      <span class="item-label-text">${cat.replace(/_/g, ' ')}</span>
                      <button class="note-toggle-btn" data-category="${cat}" title="${catNote ? 'Edit Note' : 'Add Note'}">
                        ${catNote ? '📝' : '📄'}
                      </button>
                      ${catNote ? `<span class="inline-note">${catNote}</span>` : ''}
                    </div>
                  </div>
                  <div class="item-input-row">
                    <div class="input-with-unit">
                      <input type="number"
                             class="cat-input"
                             data-category="${cat}"
                             data-dollar-value="${Math.round(catBudget)}"
                             value="${Math.round(catBudget)}"
                             min="0"
                             step="10">
                      <span class="input-unit" data-category="${cat}">USD</span>
                    </div>
                    <span class="calc-arrow">→</span>
                    <div class="calculated-display">
                      <span class="calc-value" data-category="${cat}">${catPct.toFixed(1)}%</span>
                    </div>
                    <div class="item-status">
                      <span class="current-spend">Est: ${this.formatCurrency(catCosts)}</span>
                      <div class="mini-progress-bar ${barClass}">
                        <div class="mini-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                      </div>
                    </div>
                  </div>
                  <div class="item-note-section" data-category="${cat}" style="display: none">
                    <textarea class="item-note-input"
                              data-category="${cat}"
                              placeholder="Add notes about this category budget..."
                              rows="2">${catNote}</textarea>
                  </div>
                </div>
              `;
        }).join('')}
          </div>
          </div>
        </div>
      </div>
    `;
  }

  private attachEventListeners() {
    console.log('BudgetManager: Attaching event listeners (start)');

    // Section collapse/expand functionality (Added at start to ensure it loads)
    const collapsibleHeaders = this.container.querySelectorAll('.section-header-collapsible');
    console.log(`BudgetManager: Found ${collapsibleHeaders.length} collapsible headers`);

    collapsibleHeaders.forEach(header => {
      header.addEventListener('click', (e) => {
        console.log('BudgetManager: Header clicked', header);
        const target = e.target as HTMLElement;
        // Don't collapse if clicking on a button inside the header
        if (target.closest('button')) {
          console.log('BudgetManager: Clicked on button, ignoring collapse');
          return;
        }

        const section = (header as HTMLElement).dataset.section;
        console.log(`BudgetManager: Toggling section ${section}`);
        if (!section) return;

        // Toggle collapsed state
        if (this.collapsedSections.has(section)) {
          this.collapsedSections.delete(section);
        } else {
          this.collapsedSections.add(section);
        }
        this.saveCollapsedState();

        // Find and toggle the content
        const content = this.container.querySelector(`.section-content[data-section="${section}"]`) as HTMLElement;
        const icon = header.querySelector('.section-collapse-icon');

        if (content) {
          const isCollapsed = this.collapsedSections.has(section);
          content.style.display = isCollapsed ? 'none' : 'block';
          if (icon) {
            icon.textContent = isCollapsed ? '▶' : '▼';
          }
        } else {
          console.warn(`BudgetManager: Content not found for section ${section}`);
        }
      });
    });

    // Global expand all sections button
    const expandAllSectionsBtn = this.container.querySelector('#expand-all-sections-btn');
    const collapseAllSectionsBtn = this.container.querySelector('#collapse-all-sections-btn');

    console.log('BudgetManager: Global buttons found:', !!expandAllSectionsBtn, !!collapseAllSectionsBtn);

    expandAllSectionsBtn?.addEventListener('click', () => {
      console.log('BudgetManager: Expand all clicked');
      // Clear all collapsed sections
      this.collapsedSections.clear();
      this.saveCollapsedState();

      // Show all section contents
      this.container.querySelectorAll('.section-content').forEach(content => {
        (content as HTMLElement).style.display = 'block';
      });

      // Update all collapse icons
      this.container.querySelectorAll('.section-collapse-icon').forEach(icon => {
        icon.textContent = '▼';
      });

      // Toggle button visibility
      if (expandAllSectionsBtn) (expandAllSectionsBtn as HTMLElement).style.display = 'none';
      if (collapseAllSectionsBtn) (collapseAllSectionsBtn as HTMLElement).style.display = 'inline-block';
    });

    collapseAllSectionsBtn?.addEventListener('click', () => {
      console.log('BudgetManager: Collapse all clicked');
      // Add all sections to collapsed set
      const sections = ['alerts', 'transport', 'countries', 'categories'];
      sections.forEach(section => this.collapsedSections.add(section));
      this.saveCollapsedState();

      // Hide all section contents
      this.container.querySelectorAll('.section-content').forEach(content => {
        (content as HTMLElement).style.display = 'none';
      });

      // Update all collapse icons
      this.container.querySelectorAll('.section-collapse-icon').forEach(icon => {
        icon.textContent = '▶';
      });

      // Toggle button visibility
      if (collapseAllSectionsBtn) (collapseAllSectionsBtn as HTMLElement).style.display = 'none';
      if (expandAllSectionsBtn) (expandAllSectionsBtn as HTMLElement).style.display = 'inline-block';
    });
    // Create budget button
    const createBtn = this.container.querySelector('#create-budget-btn');
    createBtn?.addEventListener('click', async () => {
      const newBudget = createDefaultBudget(this.tripData, 10);
      this.budget = newBudget;
      this.onBudgetUpdate?.(newBudget);
      await this.render();
    });

    // Custom budget button
    const customBtn = this.container.querySelector('#custom-budget-btn');
    customBtn?.addEventListener('click', async () => {
      const newBudget = createDefaultBudget(this.tripData, 10);
      this.budget = newBudget;
      this.onBudgetUpdate?.(newBudget);
      await this.render();
    });

    // Auto-save travelers on input change
    const adultsInput = this.container.querySelector('#adults-count') as HTMLInputElement;
    const childrenInput = this.container.querySelector('#children-count') as HTMLInputElement;

    // Handle user selection
    const userCheckboxes = this.container.querySelectorAll('.traveler-user-checkbox');
    userCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const selectedCheckboxes = Array.from(this.container.querySelectorAll('.traveler-user-checkbox:checked')) as HTMLInputElement[];
        const selectedIds = selectedCheckboxes.map(cb => cb.dataset.userId!);

        // Update tripData
        this.tripData.traveler_ids = selectedIds;

        // Sync num_travelers with selected users count if users are selected
        if (selectedIds.length > 0) {
          this.tripData.num_travelers = selectedIds.length;

          // Also update adults count to match (assuming all selected users are adults for now)
          // We keep children separate or as is
          if (adultsInput) {
            adultsInput.value = String(selectedIds.length);
            // Update composition
            if (this.tripData.traveler_composition) {
              this.tripData.traveler_composition.adults = selectedIds.length;
            }
          }
        }

        // Update badge
        const badge = this.container.querySelector('.traveler-count-badge');
        if (badge) {
          badge.textContent = `${this.tripData.num_travelers} total`;
        }

        this.scheduleTripDataAutoSave();
      });
    });

    const updateTravelerCount = () => {
      if (!adultsInput || !childrenInput) return;

      const adults = parseInt(adultsInput.value) || 1;
      const children = parseInt(childrenInput.value) || 0;
      const total = adults + children;

      // Update tripData
      this.tripData.num_travelers = total;
      this.tripData.traveler_composition = {
        adults: adults,
        children: children
      };

      // Update badge
      const badge = this.container.querySelector('.traveler-count-badge');
      if (badge) {
        badge.textContent = `${total} total`;
      }

      // Schedule auto-save
      this.scheduleTripDataAutoSave();
    };

    adultsInput?.addEventListener('input', updateTravelerCount);
    childrenInput?.addEventListener('input', updateTravelerCount);

    // Auto-save accommodation preference
    const accommodationSelect = this.container.querySelector('#accommodation-pref') as HTMLSelectElement;
    accommodationSelect?.addEventListener('change', () => {
      this.tripData.accommodation_preference = accommodationSelect.value as any;
      this.scheduleTripDataAutoSave();
    });

    // Transport research buttons
    this.container.querySelectorAll('.transport-research-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.target as HTMLButtonElement;
        const segmentId = target.dataset.segmentId;
        if (segmentId) {
          await this.researchTransportSegment(segmentId);
        }
      });
    });

    // Transport details buttons
    this.container.querySelectorAll('.transport-details-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const segmentId = target.dataset.segmentId;
        if (segmentId && this.transportEditor) {
          this.transportEditor.open(segmentId, async () => {
            await this.render();
          });
        }
      });
    });

    // Bulk research button
    const bulkResearchBtn = this.container.querySelector('#bulk-research-btn');
    bulkResearchBtn?.addEventListener('click', () => {
      this.showBulkResearchModal();
    });

    // If budget exists, attach integrated edit listeners
    if (this.budget) {
      this.attachBudgetEditListeners();
    }
  }

  private attachBudgetEditListeners() {
    const totalBudgetInput = this.container.querySelector('#total-budget') as HTMLInputElement;
    const contingencyInput = this.container.querySelector('#contingency-pct') as HTMLInputElement;

    if (!totalBudgetInput) return;

    // Category mode toggle logic
    const categoryModeToggle = this.container.querySelector('#category-mode-toggle') as HTMLInputElement;
    const categoryModeIndicator = this.container.querySelector('#category-mode-indicator') as HTMLElement;
    const allocationStatus = this.container.querySelector('#allocation-status') as HTMLElement;
    const totalAllocatedSpan = this.container.querySelector('#total-allocated-pct') as HTMLElement;
    const allocationRemainder = this.container.querySelector('#allocation-remainder') as HTMLElement;

    let isPercentageMode = false;

    // Update budget summary for categories
    const updateCategorySummary = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;
      let totalAllocated = 0;

      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        totalAllocated += dollarValue;
      });

      const categoryTotalBudgetEl = this.container.querySelector('#category-total-budget') as HTMLElement;
      const categoryTotalEl = this.container.querySelector('#category-total-allocated') as HTMLElement;
      const categoryPctEl = this.container.querySelector('#category-total-pct') as HTMLElement;
      const categoryUnallocatedEl = this.container.querySelector('#category-unallocated') as HTMLElement;

      // Update total budget display
      if (categoryTotalBudgetEl) {
        categoryTotalBudgetEl.textContent = `$${Math.round(totalBudget).toLocaleString()}`;
      }

      if (categoryTotalEl) {
        categoryTotalEl.textContent = `$${totalAllocated.toLocaleString()}`;
      }
      if (categoryPctEl) {
        const pct = totalBudget > 0 ? (totalAllocated / totalBudget * 100) : 0;
        categoryPctEl.textContent = `${pct.toFixed(1)}%`;

        // Color code based on allocation status
        if (Math.abs(pct - 100) < 0.1) {
          categoryPctEl.style.color = '#28a745'; // Green for fully allocated
        } else if (pct > 100) {
          categoryPctEl.style.color = '#dc3545'; // Red for over-allocated
        } else {
          categoryPctEl.style.color = '#ffc107'; // Orange for under-allocated
        }
      }
      if (categoryUnallocatedEl) {
        const unallocated = totalBudget - totalAllocated;
        categoryUnallocatedEl.textContent = `$${unallocated.toLocaleString()}`;

        // Color code the unallocated amount
        if (Math.abs(unallocated) < 1) {
          categoryUnallocatedEl.style.color = '#28a745';
        } else if (unallocated < 0) {
          categoryUnallocatedEl.style.color = '#dc3545';
        } else {
          categoryUnallocatedEl.style.color = '#ffc107';
        }
      }
    };

    // Update calculated displays for categories
    const updateCalculatedDisplays = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const category = el.dataset.category!;
        const calcValueSpan = this.container.querySelector(`.calc-value[data-category="${category}"]`) as HTMLElement;

        if (isPercentageMode) {
          const pct = parseFloat(el.value) || 0;
          const dollars = Math.round(totalBudget * pct / 100);
          calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
          el.dataset.dollarValue = dollars.toString();
        } else {
          const dollars = parseFloat(el.value) || 0;
          const pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
          calcValueSpan.textContent = `${pct.toFixed(1)}%`;
          el.dataset.dollarValue = dollars.toString();
        }
      });

      if (isPercentageMode) {
        updateAllocationStatus();
      }

      updateCategorySummary();
    };

    // Update allocation status for categories
    const updateAllocationStatus = () => {
      let totalPct = 0;
      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        totalPct += parseFloat(el.value) || 0;
      });

      totalAllocatedSpan.textContent = totalPct.toFixed(1);

      const remainder = 100 - totalPct;
      const absRemainder = Math.abs(remainder);

      if (Math.abs(remainder) < 0.1) {
        allocationRemainder.textContent = '✓ Fully Allocated';
        allocationRemainder.style.color = '#28a745';
      } else if (remainder > 0) {
        allocationRemainder.textContent = `${absRemainder.toFixed(1)}% Unallocated`;
        allocationRemainder.style.color = '#ffc107';
      } else {
        allocationRemainder.textContent = `${absRemainder.toFixed(1)}% Over-allocated`;
        allocationRemainder.style.color = '#dc3545';
      }
    };

    // Category toggle between % and $
    categoryModeToggle?.addEventListener('change', () => {
      isPercentageMode = categoryModeToggle.checked;
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      categoryModeIndicator.textContent = isPercentageMode ? 'Mode: Percentages' : 'Mode: Dollar Amounts';
      allocationStatus.style.display = isPercentageMode ? 'block' : 'none';

      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const category = el.dataset.category!;
        const unitSpan = this.container.querySelector(`.input-unit[data-category="${category}"]`) as HTMLElement;
        const currentDollarValue = parseFloat(el.dataset.dollarValue!) || parseFloat(el.value) || 0;

        if (isPercentageMode) {
          const pct = totalBudget > 0 ? (currentDollarValue / totalBudget * 100) : 0;
          el.value = pct.toFixed(1);
          el.step = '0.1';
          el.max = '100';
          unitSpan.textContent = '%';
        } else {
          el.value = Math.round(currentDollarValue).toString();
          el.step = '10';
          el.removeAttribute('max');
          unitSpan.textContent = 'USD';
        }
      });

      updateCalculatedDisplays();
    });

    // Update category displays when inputs change
    this.container.querySelectorAll('.cat-input').forEach(input => {
      input.addEventListener('input', () => {
        updateCalculatedDisplays();
      });
    });

    // Update when total budget changes
    totalBudgetInput.addEventListener('input', () => {
      updateCalculatedDisplays();
      updateCountryCalculatedDisplays();
    });

    // Country mode selector logic
    const countryModeIndicator = this.container.querySelector('#country-mode-indicator') as HTMLElement;
    const countryAllocationStatus = this.container.querySelector('#country-allocation-status') as HTMLElement;
    const countryTotalAllocatedSpan = this.container.querySelector('#country-total-allocated-pct') as HTMLElement;
    const countryAllocationRemainder = this.container.querySelector('#country-allocation-remainder') as HTMLElement;

    let countryMode: 'dollars' | 'percent' | 'perday' = 'dollars';

    // Update budget summary for countries
    const updateCountrySummary = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;
      let totalAllocated = 0;

      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        totalAllocated += dollarValue;
      });

      const countryTotalBudgetEl = this.container.querySelector('#country-total-budget') as HTMLElement;
      const countryTotalEl = this.container.querySelector('#country-total-allocated') as HTMLElement;
      const countryPctEl = this.container.querySelector('#country-total-pct') as HTMLElement;
      const countryUnallocatedEl = this.container.querySelector('#country-unallocated') as HTMLElement;

      // Update total budget display
      if (countryTotalBudgetEl) {
        countryTotalBudgetEl.textContent = `$${Math.round(totalBudget).toLocaleString()}`;
      }

      if (countryTotalEl) {
        countryTotalEl.textContent = `$${totalAllocated.toLocaleString()}`;
      }
      if (countryPctEl) {
        const pct = totalBudget > 0 ? (totalAllocated / totalBudget * 100) : 0;
        countryPctEl.textContent = `${pct.toFixed(1)}%`;

        // Color code based on allocation status
        if (Math.abs(pct - 100) < 0.1) {
          countryPctEl.style.color = '#28a745'; // Green for fully allocated
        } else if (pct > 100) {
          countryPctEl.style.color = '#dc3545'; // Red for over-allocated
        } else {
          countryPctEl.style.color = '#ffc107'; // Orange for under-allocated
        }
      }
      if (countryUnallocatedEl) {
        const unallocated = totalBudget - totalAllocated;
        countryUnallocatedEl.textContent = `$${unallocated.toLocaleString()}`;

        // Color code the unallocated amount
        if (Math.abs(unallocated) < 1) {
          countryUnallocatedEl.style.color = '#28a745';
        } else if (unallocated < 0) {
          countryUnallocatedEl.style.color = '#dc3545';
        } else {
          countryUnallocatedEl.style.color = '#ffc107';
        }
      }
    };

    // Update calculated displays for countries
    const updateCountryCalculatedDisplays = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;

      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        const country = el.dataset.country!;
        const days = parseFloat(el.dataset.days!) || 1;
        const calcValueSpan = this.container.querySelector(`.calc-value[data-country="${country}"]`) as HTMLElement;
        const perDayDisplay = this.container.querySelector(`.country-per-day-display[data-country="${country}"]`) as HTMLElement;

        if (countryMode === 'percent') {
          const pct = parseFloat(el.value) || 0;
          const dollars = Math.round(totalBudget * pct / 100);
          const perDay = days > 0 ? Math.round(dollars / days) : 0;
          calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
          perDayDisplay.textContent = `$${perDay}/day`;
          el.dataset.dollarValue = dollars.toString();
        } else if (countryMode === 'perday') {
          const perDay = parseFloat(el.value) || 0;
          const dollars = Math.round(perDay * days);
          const pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
          calcValueSpan.textContent = `$${dollars.toLocaleString()}`;
          perDayDisplay.textContent = `${pct.toFixed(1)}%`;
          el.dataset.dollarValue = dollars.toString();
        } else {
          const dollars = parseFloat(el.value) || 0;
          const pct = totalBudget > 0 ? (dollars / totalBudget * 100) : 0;
          const perDay = days > 0 ? Math.round(dollars / days) : 0;
          calcValueSpan.textContent = `${pct.toFixed(1)}%`;
          perDayDisplay.textContent = `$${perDay}/day`;
          el.dataset.dollarValue = dollars.toString();
        }
      });

      if (countryMode === 'percent') {
        updateCountryAllocationStatus();
      }

      updateCountrySummary();
    };

    // Update allocation status for countries
    const updateCountryAllocationStatus = () => {
      let totalPct = 0;
      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        totalPct += parseFloat(el.value) || 0;
      });

      countryTotalAllocatedSpan.textContent = totalPct.toFixed(1);

      const remainder = 100 - totalPct;
      const absRemainder = Math.abs(remainder);

      if (Math.abs(remainder) < 0.1) {
        countryAllocationRemainder.textContent = '✓ Fully Allocated';
        countryAllocationRemainder.style.color = '#28a745';
      } else if (remainder > 0) {
        countryAllocationRemainder.textContent = `${absRemainder.toFixed(1)}% Unallocated`;
        countryAllocationRemainder.style.color = '#ffc107';
      } else {
        countryAllocationRemainder.textContent = `${absRemainder.toFixed(1)}% Over-allocated`;
        countryAllocationRemainder.style.color = '#dc3545';
      }
    };

    // Country mode selector buttons
    const countryModeBtns = this.container.querySelectorAll('.country-mode-selector .mode-btn');
    countryModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newMode = (btn as HTMLElement).dataset.mode as 'dollars' | 'percent' | 'perday';
        countryMode = newMode;
        this.countryMode = newMode; // Update class property for visuals
        localStorage.setItem('budget_country_mode', newMode);
        const totalBudget = parseFloat(totalBudgetInput.value) || 0;

        // Update button states
        countryModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update indicator
        const modeText = newMode === 'dollars' ? 'Dollar Amounts' : newMode === 'percent' ? 'Percentages' : 'Per Day';
        countryModeIndicator.textContent = `Mode: ${modeText}`;
        countryAllocationStatus.style.display = newMode === 'percent' ? 'block' : 'none';

        // Convert all inputs to new mode
        this.container.querySelectorAll('.country-input').forEach(input => {
          const el = input as HTMLInputElement;
          const country = el.dataset.country!;
          const days = parseFloat(el.dataset.days!) || 1;
          const unitSpan = this.container.querySelector(`.input-unit[data-country="${country}"]`) as HTMLElement;
          const currentDollarValue = parseFloat(el.dataset.dollarValue!) || parseFloat(el.value) || 0;

          if (newMode === 'percent') {
            const pct = totalBudget > 0 ? (currentDollarValue / totalBudget * 100) : 0;
            el.value = pct.toFixed(1);
            el.step = '0.1';
            el.max = '100';
            unitSpan.textContent = '%';
          } else if (newMode === 'perday') {
            const perDay = days > 0 ? Math.round(currentDollarValue / days) : 0;
            el.value = perDay.toString();
            el.step = '1';
            el.removeAttribute('max');
            unitSpan.textContent = '$/day';
          } else {
            el.value = Math.round(currentDollarValue).toString();
            el.step = '10';
            el.removeAttribute('max');
            unitSpan.textContent = 'USD';
          }
        });

        updateCountryCalculatedDisplays();
        this.updateCountryVisualsDOM(); // Update visuals when mode changes
      });
    });

    // Update country displays when inputs change
    this.container.querySelectorAll('.country-input').forEach(input => {
      input.addEventListener('input', () => {
        updateCountryCalculatedDisplays();
      });
    });

    // Note toggle functionality for categories
    this.container.querySelectorAll('.note-toggle-btn[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        const category = (btn as HTMLElement).dataset.category!;
        const noteSection = this.container.querySelector(`.item-note-section[data-category="${category}"]`) as HTMLElement;
        if (noteSection) {
          const isVisible = noteSection.style.display !== 'none';
          noteSection.style.display = isVisible ? 'none' : 'block';
        }
      });
    });

    // Note toggle functionality for countries
    this.container.querySelectorAll('.note-toggle-btn[data-country]').forEach(btn => {
      btn.addEventListener('click', () => {
        const country = (btn as HTMLElement).dataset.country!;
        const noteSection = this.container.querySelector(`.item-note-section[data-country="${country}"]`) as HTMLElement;
        if (noteSection) {
          const isVisible = noteSection.style.display !== 'none';
          noteSection.style.display = isVisible ? 'none' : 'block';
        }
      });
    });

    // Costs toggle functionality for countries
    this.container.querySelectorAll('.costs-toggle-btn[data-country]').forEach(btn => {
      btn.addEventListener('click', () => {
        const country = (btn as HTMLElement).dataset.country!;
        const costsSection = this.container.querySelector(`.item-costs-section[data-country="${country}"]`) as HTMLElement;
        if (costsSection) {
          const isVisible = costsSection.style.display !== 'none';
          costsSection.style.display = isVisible ? 'none' : 'block';

          // Update button text to indicate state
          const btnElement = btn as HTMLElement;
          if (isVisible) {
            btnElement.innerHTML = btnElement.innerHTML.replace('▼', '▶').replace('Hide', 'View');
          } else {
            btnElement.innerHTML = btnElement.innerHTML.replace('▶', '▼').replace('View', 'Hide');

            // Auto-resize all textareas in this section when opening
            costsSection.querySelectorAll('textarea.auto-resize').forEach(textarea => {
              const el = textarea as HTMLTextAreaElement;
              requestAnimationFrame(() => {
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              });
            });
          }
        }
      });
    });

    // Save budget functionality
    const saveBudget = () => {
      const totalBudget = parseFloat(totalBudgetInput.value) || 0;
      const contingency = parseFloat(contingencyInput.value) || 0;

      // Collect category budgets - use stored dollar values
      const budgets_by_category: Record<string, number> = {};
      this.container.querySelectorAll('.cat-input').forEach(input => {
        const el = input as HTMLInputElement;
        const category = el.dataset.category!;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        budgets_by_category[category] = dollarValue;
      });

      // Collect country budgets - use stored dollar values
      const budgets_by_country: Record<string, number> = {};
      this.container.querySelectorAll('.country-input').forEach(input => {
        const el = input as HTMLInputElement;
        const country = el.dataset.country!;
        const dollarValue = parseFloat(el.dataset.dollarValue!) || 0;
        budgets_by_country[country] = dollarValue;
      });

      // Collect category notes
      const category_notes: Record<string, string> = {};
      this.container.querySelectorAll('.item-note-input[data-category]').forEach(textarea => {
        const el = textarea as HTMLTextAreaElement;
        const category = el.dataset.category!;
        const note = el.value.trim();
        if (note) {
          category_notes[category] = note;
        }
      });

      // Collect country notes
      const country_notes: Record<string, string> = {};
      this.container.querySelectorAll('.item-note-input[data-country]').forEach(textarea => {
        const el = textarea as HTMLTextAreaElement;
        const country = el.dataset.country!;
        const note = el.value.trim();
        if (note) {
          country_notes[country] = note;
        }
      });

      // Get group notes
      const categoryGroupNote = (this.container.querySelector('#category-group-note') as HTMLTextAreaElement)?.value.trim();
      const countryGroupNote = (this.container.querySelector('#country-group-note') as HTMLTextAreaElement)?.value.trim();

      // Build budget object, only including note fields if they have values
      const newBudget: TripBudget = {
        total_budget_usd: totalBudget,
        budgets_by_category,
        budgets_by_country,
        contingency_pct: contingency,
        alerts: []
      };

      // Only add note fields if they have values (Firestore doesn't accept undefined)
      if (Object.keys(category_notes).length > 0) {
        newBudget.category_notes = category_notes;
      }
      if (Object.keys(country_notes).length > 0) {
        newBudget.country_notes = country_notes;
      }
      if (categoryGroupNote) {
        newBudget.category_group_note = categoryGroupNote;
      }
      if (countryGroupNote) {
        newBudget.country_group_note = countryGroupNote;
      }

      this.budget = newBudget;
      this.scheduleBudgetAutoSave();
    };

    // Auto-save on total budget input change
    totalBudgetInput?.addEventListener('input', () => {
      if (!this.budget) return;
      this.budget.total_budget_usd = parseFloat(totalBudgetInput.value) || 0;
      updateCalculatedDisplays();
      this.scheduleBudgetAutoSave();
    });

    // Auto-save on contingency input change
    contingencyInput?.addEventListener('input', () => {
      if (!this.budget) return;
      this.budget.contingency_pct = parseFloat(contingencyInput.value) || 0;
      this.scheduleBudgetAutoSave();
    });

    // Auto-save on category/country budget changes
    this.container.querySelectorAll('.cat-input, .country-input, .cat-note-input, .country-note-input, .group-note-input').forEach(input => {
      input.addEventListener('input', () => {
        if (!this.budget) return;
        saveBudget();
      });
    });

    // Attach cost editing listeners
    this.attachCostEditingListeners();
  }

  private attachCostEditingListeners() {
    // Inline editing of cost fields - use 'input' for real-time updates
    this.container.querySelectorAll('.cost-field-input, .cost-field-select').forEach(field => {
      const inputEl = field as HTMLInputElement | HTMLSelectElement;

      const handleChange = () => {
        const costId = inputEl.dataset.costId!;
        const fieldName = inputEl.dataset.field!;

        // Find the original cost
        const originalCost = (this.tripData.costs || []).find(c =>
          (c.id || `${c.destination_id}_${c.category}_${Date.now()}`) === costId
        );

        if (!originalCost) return;

        // Get or create edited cost entry
        let editedCost = this.editedCosts.get(costId);
        if (!editedCost) {
          editedCost = { ...originalCost, id: costId };
          this.editedCosts.set(costId, editedCost);
        }

        // Update the field
        if (inputEl.type === 'number') {
          editedCost[fieldName] = parseFloat(inputEl.value) || 0;
        } else {
          editedCost[fieldName] = inputEl.value;
        }

        // Special handling for currency changes
        if (fieldName === 'currency') {
          const currency = inputEl.value;
          const row = inputEl.closest('tr');
          const amountInput = row?.querySelector('.amount-input') as HTMLInputElement;
          const usdInput = row?.querySelector('.usd-input') as HTMLInputElement;
          const currencySymbol = row?.querySelector('.currency-symbol') as HTMLElement;

          if (currencySymbol) {
            currencySymbol.textContent = this.getCurrencySymbol(currency);
          }

          if (currency === 'USD') {
            // Disable USD input and sync with amount
            if (usdInput && amountInput) {
              usdInput.disabled = true;
              usdInput.value = amountInput.value;
              editedCost.amount_usd = parseFloat(amountInput.value) || 0;
            }
          } else {
            // Enable USD input and auto-convert
            if (usdInput && amountInput) {
              usdInput.disabled = false;
              const amount = parseFloat(amountInput.value) || 0;
              const convertedUsd = this.convertCurrency(amount, currency, 'USD');
              usdInput.value = Math.round(convertedUsd).toString();
              editedCost.amount_usd = Math.round(convertedUsd);
            }
          }

          // Update exchange rate display without full re-render
          const rateInfo = row?.querySelector('.exchange-rate-info');
          if (rateInfo && currency !== 'USD') {
            const rate = this.exchangeRates[currency] || 1;
            rateInfo.textContent = `1 USD = ${this.getCurrencySymbol(currency)}${rate.toFixed(2)}`;
            rateInfo.setAttribute('title', `Rate as of ${this.ratesFetchDate}`);
          } else if (rateInfo) {
            rateInfo.textContent = '';
          }
        }

        // If amount changes, auto-convert to USD
        if (fieldName === 'amount') {
          const row = inputEl.closest('tr');
          const currencyField = row?.querySelector('.currency-field') as HTMLInputElement;
          const usdInput = row?.querySelector('.usd-input') as HTMLInputElement;
          const currency = currencyField?.value || editedCost.currency || 'USD';
          const amount = parseFloat(inputEl.value) || 0;

          if (usdInput) {
            if (currency === 'USD') {
              usdInput.value = inputEl.value;
              editedCost.amount_usd = amount;
            } else {
              const convertedUsd = this.convertCurrency(amount, currency, 'USD');
              usdInput.value = Math.round(convertedUsd).toString();
              editedCost.amount_usd = Math.round(convertedUsd);
            }
          }
        }

        // If USD amount changes, reverse calculate original currency amount
        if (fieldName === 'amount_usd') {
          const row = inputEl.closest('tr');
          const currencyField = row?.querySelector('.currency-field') as HTMLInputElement;
          const amountInput = row?.querySelector('.amount-input') as HTMLInputElement;
          const currency = currencyField?.value || editedCost.currency || 'USD';
          const usdAmount = parseFloat(inputEl.value) || 0;

          if (amountInput && currency !== 'USD') {
            const convertedAmount = this.convertCurrency(usdAmount, 'USD', currency);
            amountInput.value = Math.round(convertedAmount).toString();
            editedCost.amount = Math.round(convertedAmount);
          }
        }

        // Schedule auto-save instead of immediate render
        this.scheduleAutoSave();
      };

      // Use 'input' for text/number fields for real-time updates
      if (inputEl.type === 'number' || inputEl.type === 'text' || inputEl.type === 'date') {
        inputEl.addEventListener('input', handleChange);
      } else {
        // Use 'change' for selects
        inputEl.addEventListener('change', handleChange);
      }
    });

    // Auto-resize textareas
    this.setupAutoResizeTextareas();

    // Add cost button
    this.container.querySelectorAll('.add-cost-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const country = (btn as HTMLElement).dataset.country!;
        const addSection = this.container.querySelector(`.add-cost-section[data-country="${country}"]`) as HTMLElement;
        if (addSection) {
          const isOpening = addSection.style.display === 'none';
          addSection.style.display = isOpening ? 'block' : 'none';

          // Set default currency to local currency when opening the form
          if (isOpening) {
            const currencySelect = addSection.querySelector('.new-cost-currency') as HTMLSelectElement;
            if (currencySelect) {
              // Find the first destination in this country to get its currency
              const destinations = (this.tripData.locations || []).filter(loc => loc.country === country);
              if (destinations.length > 0) {
                const localCurrency = getCurrencyForDestination(destinations[0].id, this.tripData.locations || []);
                currencySelect.value = localCurrency;

                // Trigger change event to update USD field disabled state
                currencySelect.dispatchEvent(new Event('change'));
              }
            }
          }
        }
      });
    });

    // Cancel new cost button
    this.container.querySelectorAll('.cancel-new-cost-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const country = (btn as HTMLElement).dataset.country!;
        const addSection = this.container.querySelector(`.add-cost-section[data-country="${country}"]`) as HTMLElement;
        if (addSection) {
          addSection.style.display = 'none';
          // Reset form
          addSection.querySelectorAll('.new-cost-field').forEach(field => {
            const input = field as HTMLInputElement | HTMLSelectElement;
            if (input.type === 'number') {
              input.value = '0';
            } else {
              input.value = '';
            }
          });
        }
      });
    });

    // Currency sync for new cost form
    this.container.querySelectorAll('.new-cost-currency').forEach(currencySelect => {
      currencySelect.addEventListener('change', () => {
        const form = currencySelect.closest('.add-cost-form');
        const amountInput = form?.querySelector('.new-cost-amount') as HTMLInputElement;
        const usdInput = form?.querySelector('.new-cost-usd') as HTMLInputElement;

        if ((currencySelect as HTMLSelectElement).value === 'USD') {
          if (usdInput) {
            usdInput.disabled = true;
            usdInput.value = amountInput?.value || '0';
          }
        } else {
          if (usdInput) {
            usdInput.disabled = false;
          }
        }
      });
    });

    // Amount sync when currency is USD for new cost form
    this.container.querySelectorAll('.new-cost-amount').forEach(amountInput => {
      amountInput.addEventListener('input', () => {
        const form = amountInput.closest('.add-cost-form');
        const currencySelect = form?.querySelector('.new-cost-currency') as HTMLSelectElement;
        const usdInput = form?.querySelector('.new-cost-usd') as HTMLInputElement;

        if (currencySelect?.value === 'USD' && usdInput) {
          usdInput.value = (amountInput as HTMLInputElement).value;
        }
      });
    });

    // Save new cost button
    this.container.querySelectorAll('.save-new-cost-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const country = (btn as HTMLElement).dataset.country!;
        const addSection = this.container.querySelector(`.add-cost-section[data-country="${country}"]`) as HTMLElement;

        if (!addSection) return;

        // Collect form data
        const newCost: any = { status: 'estimated' };
        addSection.querySelectorAll('.new-cost-field').forEach(field => {
          const input = field as HTMLInputElement | HTMLSelectElement;
          const fieldName = input.dataset.field!;

          if (input.type === 'number') {
            newCost[fieldName] = parseFloat(input.value) || 0;
          } else {
            newCost[fieldName] = input.value;
          }
        });

        // Validate required fields
        if (!newCost.destination_id || !newCost.category) {
          alert('Please select a destination and category');
          return;
        }

        // Generate ID for new cost
        newCost.id = `${newCost.destination_id}_${newCost.category}_${Date.now()}`;

        // If currency is USD, ensure amount_usd equals amount
        if (newCost.currency === 'USD') {
          newCost.amount_usd = newCost.amount;
        }

        // Add to edited costs
        this.editedCosts.set(newCost.id, newCost);

        // Add to tripData temporarily for display
        if (!this.tripData.costs) {
          this.tripData.costs = [];
        }
        this.tripData.costs.push(newCost);

        // Hide form and re-render
        addSection.style.display = 'none';
        await this.render();
      });
    });

    // Delete cost button
    this.container.querySelectorAll('.delete-cost-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Are you sure you want to delete this cost?')) return;

        const costId = (btn as HTMLElement).dataset.costId!;

        // Mark for deletion by setting a special flag
        const costIndex = (this.tripData.costs || []).findIndex(c =>
          (c.id || `${c.destination_id}_${c.category}_${Date.now()}`) === costId
        );

        if (costIndex !== -1) {
          const deletedCost = { ...this.tripData.costs![costIndex], _deleted: true };
          this.editedCosts.set(costId, deletedCost);
          this.tripData.costs!.splice(costIndex, 1);

          // Remove the row inline without full refresh
          const row = btn.closest('tr');
          if (row) {
            row.style.opacity = '0.5';
            row.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
              row.remove();
            }, 300);
          }
        }
      });
    });

    // Refresh country rates button
    this.container.querySelectorAll('.refresh-country-rates-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const country = (btn as HTMLElement).dataset.country!;
        const currencies = this.getCurrenciesForCountry(country);

        if (currencies.length === 0) return;

        // Show loading state
        const originalText = btn.textContent;
        btn.textContent = '⏳ Refreshing...';
        (btn as HTMLButtonElement).disabled = true;

        try {
          await this.refreshExchangeRates(currencies);

          // Update the rate display text
          const ratesDateEl = btn.closest('.costs-table-actions')?.querySelector('.rates-fetch-date');
          if (ratesDateEl) {
            ratesDateEl.textContent = `Rates: ${this.ratesFetchDate}`;
          }

          // Highlight all exchange rate displays for this country
          const countrySection = this.container.querySelector(`.item-costs-section[data-country="${country}"]`);
          if (countrySection) {
            countrySection.querySelectorAll('.exchange-rate-info').forEach(rateInfo => {
              const el = rateInfo as HTMLElement;
              el.style.transition = 'background-color 0.3s ease';
              el.style.backgroundColor = '#d4edda';
              el.style.padding = '4px 6px';
              el.style.borderRadius = '3px';

              // Remove highlight after 2 seconds
              setTimeout(() => {
                el.style.backgroundColor = '';
                el.style.padding = '';
                el.style.borderRadius = '';
              }, 2000);
            });
          }

          // Update exchange rate displays without full re-render
          this.updateExchangeRateDisplays(country);

          // Show success message in button briefly
          btn.textContent = '✓ Refreshed';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 1500);
        } catch (error) {
          btn.textContent = '✗ Failed';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
          console.error('Failed to refresh rates:', error);
        } finally {
          (btn as HTMLButtonElement).disabled = false;
        }
      });
    });


    // Refresh budget button
    const refreshBtn = this.container.querySelector('#refresh-budget-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const btn = refreshBtn as HTMLButtonElement;
        const originalText = btn.textContent;
        btn.textContent = '🔄 Loading...';
        btn.disabled = true;

        try {
          console.log('🔄 Manually refreshing budget data...');
          await this.loadTransportSegments();
          await this.render();
          console.log('✅ Manual refresh complete');
          btn.textContent = originalText;
        } catch (error) {
          console.error('Failed to refresh budget:', error);
          btn.textContent = '❌ Error';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        } finally {
          btn.disabled = false;
        }
      });
    }

    // Refresh all rates button
    const refreshAllBtn = this.container.querySelector('#refresh-all-rates-btn');
    if (refreshAllBtn) {
      refreshAllBtn.addEventListener('click', async () => {
        const allCurrencies = this.getAllCurrencies();

        if (allCurrencies.length === 0) return;

        // Show loading state
        const originalText = refreshAllBtn.textContent;
        refreshAllBtn.textContent = '⏳ Refreshing...';
        (refreshAllBtn as HTMLButtonElement).disabled = true;

        try {
          await this.refreshExchangeRates();

          // Highlight all exchange rate displays
          this.container.querySelectorAll('.exchange-rate-info').forEach(rateInfo => {
            const el = rateInfo as HTMLElement;
            el.style.transition = 'background-color 0.3s ease';
            el.style.backgroundColor = '#d4edda';
            el.style.padding = '4px 6px';
            el.style.borderRadius = '3px';

            // Remove highlight after 2 seconds
            setTimeout(() => {
              el.style.backgroundColor = '';
              el.style.padding = '';
              el.style.borderRadius = '';
            }, 2000);
          });

          // Update all exchange rate displays without full re-render
          this.updateExchangeRateDisplays();

          // Show success message in button briefly
          refreshAllBtn.textContent = '✓ Refreshed';
          setTimeout(() => {
            refreshAllBtn.textContent = originalText;
          }, 1500);
        } catch (error) {
          refreshAllBtn.textContent = '✗ Failed';
          setTimeout(() => {
            refreshAllBtn.textContent = originalText;
          }, 2000);
          console.error('Failed to refresh rates:', error);
        } finally {
          (refreshAllBtn as HTMLButtonElement).disabled = false;
        }
      });
    }

    // Generate costs button for countries without costs
    this.container.querySelectorAll('.generate-costs-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const country = (btn as HTMLElement).dataset.country!;
        const destinationIds = (btn as HTMLElement).dataset.destinations?.split(',') || [];

        const destinations = destinationIds
          .map(id => (this.tripData.locations || []).find(loc => String(loc.id) === id))
          .filter(d => !!d);

        const destNames = destinations.map(d => d!.name || d!.city).join(', ');

        // Show progress UI
        const originalBtn = btn as HTMLButtonElement;
        const originalText = originalBtn.innerHTML;
        originalBtn.disabled = true;
        originalBtn.innerHTML = '⏳ Researching costs...';

        // Find and open the costs section to show progress
        const costsSection = this.container.querySelector(
          `.item-costs-section[data-country="${country}"]`
        ) as HTMLElement;

        // Open the costs section immediately to show progress
        if (costsSection) {
          costsSection.style.display = 'block';

          // Show progress message
          const progressDiv = document.createElement('div');
          progressDiv.className = 'cost-generation-progress';
          progressDiv.innerHTML = `
            <div style="padding: 20px; text-align: center; background: #f0f8ff; border-radius: 6px; margin: 15px 0;">
              <div style="font-size: 16px; font-weight: 600; color: #1a73e8; margin-bottom: 8px;">
                🔍 Researching current prices from the web...
              </div>
              <div style="font-size: 14px; color: #666; margin-bottom: 12px;">
                Analyzing costs for ${destNames}
              </div>
              <div style="width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden;">
                <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2, #667eea); background-size: 200% 100%; animation: shimmer 1.5s infinite;"></div>
              </div>
            </div>
            <style>
              @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
            </style>
          `;
          costsSection.insertBefore(progressDiv, costsSection.firstChild);
        }

        try {
          // Call backend cost research API for each destination
          await this.generateCostsForCountry(country, destinationIds);

          // Show success message
          originalBtn.innerHTML = `✓ Costs researched`;
          originalBtn.style.background = '#28a745';

          // Remove progress UI and refresh display
          if (costsSection) {
            const progressDiv = costsSection.querySelector('.cost-generation-progress');
            if (progressDiv) {
              progressDiv.remove();
            }
          }

          // Refresh the entire budget manager to show new costs
          await this.render();

          // Automatically open the costs section for this country
          setTimeout(() => {
            const updatedCostsSection = this.container.querySelector(
              `.item-costs-section[data-country="${country}"]`
            ) as HTMLElement;
            if (updatedCostsSection) {
              updatedCostsSection.style.display = 'block';
            }

            // Update the toggle button text
            const toggleBtn = this.container.querySelector(
              `.costs-toggle-btn[data-country="${country}"]`
            ) as HTMLElement;
            if (toggleBtn) {
              const countryCurrentCosts = (this.tripData.costs || []).filter(c => {
                const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
                return location?.country === country;
              });
              toggleBtn.innerHTML = `💰 ▼ Hide Costs (${countryCurrentCosts.length})`;
            }

            // Auto-resize textareas in the opened section
            this.setupAutoResizeTextareas();
          }, 100);

          // Reset button after 3 seconds
          setTimeout(() => {
            originalBtn.innerHTML = originalText;
            originalBtn.style.background = '';
            originalBtn.disabled = false;
          }, 3000);

        } catch (error) {
          console.error('Failed to generate costs:', error);

          // Remove progress UI
          if (costsSection) {
            const progressDiv = costsSection.querySelector('.cost-generation-progress');
            if (progressDiv) {
              progressDiv.remove();
            }
          }

          // Show error
          originalBtn.innerHTML = '✗ Research failed';
          originalBtn.style.background = '#dc3545';

          alert(`Failed to research costs: ${error instanceof Error ? error.message : 'Unknown error'}`);

          // Reset button after 3 seconds
          setTimeout(() => {
            originalBtn.innerHTML = originalText;
            originalBtn.style.background = '';
            originalBtn.disabled = false;
          }, 3000);
        }
      });
    });

    // Setup regenerate country costs buttons
    this.container.querySelectorAll('.regenerate-country-costs-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const country = btn.getAttribute('data-country');
        const destinationIds = btn.getAttribute('data-destinations')?.split(',') || [];

        if (!country || destinationIds.length === 0) {
          alert('Missing country or destination information');
          return;
        }

        const originalBtn = btn as HTMLButtonElement;
        const originalText = originalBtn.innerHTML;

        try {
          // Disable button and show progress
          originalBtn.disabled = true;
          originalBtn.innerHTML = '🔄 Researching...';

          // Delete existing costs for this country
          const existingCosts = (this.tripData.costs || []).filter(c => {
            const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
            return location?.country === country;
          });

          if (existingCosts.length > 0) {
            // Mark costs for deletion and remove from local data
            existingCosts.forEach(cost => {
              const costId = cost.id || `${cost.destination_id}_${cost.category}_${Date.now()}`;
              const deletedCost = { ...cost, _deleted: true };
              this.editedCosts.set(costId, deletedCost);
            });

            // Remove from local data
            this.tripData.costs = (this.tripData.costs || []).filter(c => {
              const location = (this.tripData.locations || []).find(loc => loc.id === c.destination_id);
              return location?.country !== country;
            });
          }

          // Call backend cost research API
          const newCosts = await this.generateCostsForCountry(country, destinationIds);

          // Add new costs to tripData
          if (!this.tripData.costs) {
            this.tripData.costs = [];
          }
          this.tripData.costs.push(...newCosts);

          // If costs were saved but not returned, we need to reload from Firestore
          // For now, show a message and suggest refreshing
          if (newCosts.length === 0) {
            console.warn('Backend saved costs but did not return them. Costs will appear after page refresh.');
          }

          // Show success message
          originalBtn.innerHTML = `✓ Costs researched`;
          originalBtn.style.background = '#28a745';

          // Refresh the entire budget manager to show new costs
          await this.render();

          // Reset button after 3 seconds
          setTimeout(() => {
            originalBtn.innerHTML = originalText;
            originalBtn.style.background = '';
            originalBtn.disabled = false;
          }, 3000);

        } catch (error) {
          console.error('Failed to regenerate costs:', error);

          // Show error
          originalBtn.innerHTML = '✗ Research failed';
          originalBtn.style.background = '#dc3545';

          alert(`Failed to regenerate costs: ${error instanceof Error ? error.message : 'Unknown error'}`);

          // Reset button after 3 seconds
          setTimeout(() => {
            originalBtn.innerHTML = originalText;
            originalBtn.style.background = '';
            originalBtn.disabled = false;
          }, 3000);
        }
      });
    });

    // Setup regenerate destination costs buttons
    this.container.querySelectorAll('.regenerate-destination-costs-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const destinationId = btn.getAttribute('data-destination-id');
        const destinationName = btn.getAttribute('data-destination-name');

        if (!destinationId) {
          alert('Missing destination information');
          return;
        }

        const originalBtn = btn as HTMLButtonElement;
        const originalText = originalBtn.innerHTML;

        try {
          // Get destination info
          const location = (this.tripData.locations || []).find(loc => String(loc.id) === destinationId);
          if (!location) {
            throw new Error('Destination not found');
          }

          // Disable button and show progress
          originalBtn.disabled = true;
          originalBtn.innerHTML = '🔄 Researching...';

          // Delete existing costs for this destination
          const existingCosts = (this.tripData.costs || []).filter(c =>
            String(c.destination_id) === destinationId
          );

          if (existingCosts.length > 0) {
            // Mark costs for deletion and remove from local data
            existingCosts.forEach(cost => {
              const costId = cost.id || `${cost.destination_id}_${cost.category}_${Date.now()}`;
              const deletedCost = { ...cost, _deleted: true };
              this.editedCosts.set(costId, deletedCost);
            });

            // Remove from local data
            this.tripData.costs = (this.tripData.costs || []).filter(c =>
              String(c.destination_id) !== destinationId
            );
          }

          // Call backend cost research API for this single destination
          const newCosts = await this.generateCostsForCountry(location.country || '', [destinationId]);

          // Add new costs to tripData
          if (!this.tripData.costs) {
            this.tripData.costs = [];
          }
          this.tripData.costs.push(...newCosts);

          // If costs were saved but not returned, we need to reload from Firestore
          if (newCosts.length === 0) {
            console.warn('Backend saved costs but did not return them. Costs will appear after page refresh.');
          }

          // Show success message
          originalBtn.innerHTML = `✓ Costs researched`;
          originalBtn.style.background = '#28a745';

          // Refresh the entire budget manager to show new costs
          await this.render();

          // Reset button after 3 seconds
          setTimeout(() => {
            originalBtn.innerHTML = originalText;
            originalBtn.style.background = '';
            originalBtn.disabled = false;
          }, 3000);

        } catch (error) {
          console.error('Failed to regenerate costs:', error);

          // Show error
          originalBtn.innerHTML = '✗ Research failed';
          originalBtn.style.background = '#dc3545';

          alert(`Failed to regenerate costs: ${error instanceof Error ? error.message : 'Unknown error'}`);

          // Reset button after 3 seconds
          setTimeout(() => {
            originalBtn.innerHTML = originalText;
            originalBtn.style.background = '';
            originalBtn.disabled = false;
          }, 3000);
        }
      });
    });




    // Setup show all costs button
    const showAllBtn = this.container.querySelector('#show-all-costs-btn');
    const hideAllBtn = this.container.querySelector('#hide-all-costs-btn');

    showAllBtn?.addEventListener('click', () => {
      this.container.querySelectorAll('.item-costs-section[data-country]').forEach(section => {
        (section as HTMLElement).style.display = 'block';
      });
      if (showAllBtn) (showAllBtn as HTMLElement).style.display = 'none';
      if (hideAllBtn) (hideAllBtn as HTMLElement).style.display = 'inline-block';
    });

    hideAllBtn?.addEventListener('click', () => {
      this.container.querySelectorAll('.item-costs-section[data-country]').forEach(section => {
        (section as HTMLElement).style.display = 'none';
      });
      if (hideAllBtn) (hideAllBtn as HTMLElement).style.display = 'none';
      if (showAllBtn) (showAllBtn as HTMLElement).style.display = 'inline-block';
    });
  }

  private setupAutoResizeTextareas() {
    // Function to auto-resize a textarea based on its content
    const autoResize = (textarea: HTMLTextAreaElement) => {
      // Reset height to get accurate scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight to fit content
      textarea.style.height = textarea.scrollHeight + 'px';
    };

    // Setup auto-resize for all textareas with the auto-resize class
    this.container.querySelectorAll('textarea.auto-resize').forEach(textarea => {
      const el = textarea as HTMLTextAreaElement;

      // Initial resize - use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        autoResize(el);
      });

      // Resize on input
      el.addEventListener('input', () => autoResize(el));

      // Resize on focus (in case content was changed programmatically)
      el.addEventListener('focus', () => autoResize(el));
    });
  }

  async render() {
    // Load and auto-sync transport segments before rendering
    await this.loadTransportSegments();

    const html = this.renderBudgetStatus();
    this.container.innerHTML = html;
    this.container.style.display = 'block';
    this.attachEventListeners();

    // Update visuals after render to ensure they are populated
    this.updateCountryVisualsDOM();
  }
}

// CSS styles for the budget manager
export const budgetManagerStyles = `
<style>
.budget-manager {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin: 20px 0;
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.budget-header h3 {
  margin: 0;
  font-size: 20px;
}

.budget-subtitle {
  color: #666;
  margin: 5px 0 0 0;
}

/* Compact header styles */
.budget-header-compact {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-row h3 {
  margin: 0;
  font-size: 18px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-primary-sm {
  padding: 6px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary-sm:hover {
  background: #0056b3;
}

.btn-secondary-sm {
  padding: 6px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary-sm:hover {
  background: #5a6268;
}

.btn-secondary-sm:disabled,
.btn-primary-sm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.rates-fetch-date {
  font-size: 11px;
  color: #666;
  font-style: italic;
  margin-left: auto;
  white-space: nowrap;
}

.auto-save-indicator {
  font-size: 12px;
  font-weight: 600;
  margin-left: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.auto-save-indicator.saving {
  color: #0056b3;
  background: #cfe2ff;
}

.auto-save-indicator.saved {
  color: #155724;
  background: #d4edda;
}

.auto-save-indicator.error {
  color: #721c24;
  background: #f8d7da;
}

.budget-overview-compact {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.budget-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.budget-field label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.budget-field input {
  width: 90px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.budget-field span {
  font-size: 12px;
  color: #666;
}

.budget-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.stat-value {
  font-size: 15px;
  font-weight: 700;
  color: #333;
}

.stat-value.positive {
  color: #28a745;
}

.stat-value.negative {
  color: #dc3545;
}

.stat-pct {
  font-size: 13px;
  font-weight: 500;
  color: #666;
  margin-left: 4px;
}

.budget-progress-compact {
  margin-top: 8px;
}

.budget-progress-compact .progress-bar {
  height: 6px;
  border-radius: 3px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 5px 10px;
}

.btn-icon:hover {
  background: #f0f0f0;
  border-radius: 4px;
}

.budget-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.budget-total, .budget-spent, .budget-remaining {
  padding: 15px;
  border-radius: 6px;
  background: #f8f9fa;
}

.budget-spent.over-budget {
  background: #fee;
}

.budget-spent.warning {
  background: #fff3cd;
}

.budget-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  margin-bottom: 5px;
}

.budget-amount {
  font-size: 24px;
  font-weight: bold;
}

.budget-amount.negative {
  color: #dc3545;
}

.budget-progress {
  margin: 20px 0;
}

.progress-bar {
  height: 30px;
  background: #e9ecef;
  border-radius: 15px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: #28a745;
  transition: width 0.3s ease;
}

.progress-bar.caution .progress-fill {
  background: #ffc107;
}

.progress-bar.warning .progress-fill {
  background: #fd7e14;
}

.progress-bar.over-budget .progress-fill {
  background: #dc3545;
}

.progress-label {
  text-align: center;
  margin-top: 5px;
  font-weight: bold;
}

.budget-alerts {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
}

.budget-alerts h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.budget-alert {
  padding: 10px;
  margin: 5px 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-info {
  background: #d1ecf1;
  border-left: 4px solid #0c5460;
}

.alert-warning {
  background: #fff3cd;
  border-left: 4px solid #856404;
}

.alert-exceeded {
  background: #f8d7da;
  border-left: 4px solid #721c24;
}

.budget-breakdown {
  margin: 20px 0;
}

.budget-breakdown h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
}

.budget-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.budget-item {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.item-name {
  font-weight: 500;
  text-transform: capitalize;
}

.item-amounts {
  font-size: 14px;
  color: #666;
}

.item-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mini-progress-bar {
  flex: 1;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.mini-progress-fill {
  height: 100%;
  background: #28a745;
  transition: width 0.3s ease;
}

.mini-progress-bar.warning .mini-progress-fill {
  background: #fd7e14;
}

.mini-progress-bar.over-budget .mini-progress-fill {
  background: #dc3545;
}

.item-percentage {
  font-size: 12px;
  color: #666;
  min-width: 40px;
  text-align: right;
}

.budget-actions {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.budget-help {
  margin-top: 20px;
  padding: 15px;
  background: #e7f3ff;
  border-left: 4px solid #007bff;
  border-radius: 4px;
}

.budget-help p {
  margin: 0;
  font-size: 14px;
}

.current-spending {
  margin: 20px 0;
}

.spending-summary {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 6px;
  text-align: center;
}

.spending-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.spending-amount {
  font-size: 32px;
  font-weight: bold;
  color: #007bff;
}

/* Integrated budget interface styles */
.budget-manager.integrated {
  max-width: 100%;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.budget-edit-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  border: 1px solid #e0e0e0;
}

.budget-edit-section h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-header-collapsible {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
  padding: 12px;
  margin-left: -12px;
  margin-right: -12px;
  border-radius: 6px;
}

.section-header-collapsible:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.section-header-left {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
}

.section-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-collapse-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 10px;
  color: #666;
  background: rgba(0,0,0,0.05);
  transition: all 0.2s;
  margin-left: 8px;
}

.section-header-collapsible:hover .section-collapse-icon {
  background: rgba(0,0,0,0.1);
  color: #333;
}

.section-content {
  transition: all 0.3s ease-in-out;
  overflow: hidden;
}

.section-header h4 {
  margin: 0;
  white-space: nowrap;
}

.section-summary-inline {
  color: #666;
  font-size: 14px;
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: 8px;
}

.global-controls {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.global-control-btn {
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.global-control-btn:hover {
  background: #f5f5f5;
  color: #333;
  border-color: #ccc;
}

.mode-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-indicator {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.budget-overview-edit {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.form-group-inline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 200px;
}

.form-group-inline label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.budget-status-display {
  display: flex;
  gap: 20px;
  padding: 15px;
  background: white;
  border-radius: 6px;
  margin: 15px 0;
  flex-wrap: wrap;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.status-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
}

.status-value {
  font-size: 18px;
  font-weight: bold;
}

.status-value.positive {
  color: #28a745;
}

.status-value.negative {
  color: #dc3545;
}

.status-value.over-budget,
.status-value.warning {
  color: #dc3545;
}

.allocation-status {
  padding: 12px;
  background: white;
  border-radius: 6px;
  margin: 15px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.allocation-info {
  font-size: 14px;
}

.allocation-remainder {
  font-weight: 600;
  font-size: 14px;
}

.budget-summary-box {
  padding: 15px;
  background: white;
  border-radius: 6px;
  margin: 15px 0;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.summary-row {
  display: grid;
  grid-template-columns: 1fr 160px 70px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  gap: 10px;
}

.summary-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.summary-label {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}



.summary-value {
  font-weight: 700;
  color: #333;
  font-size: 16px;
  transition: color 0.2s;
  text-align: right;
}

.summary-percentage {
  font-weight: 600;
  font-size: 14px;
  transition: color 0.2s;
  text-align: right;
}

.budget-items-edit {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.budget-item-edit {
  background: white;
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.item-label {
  font-weight: 600;
  margin-bottom: 10px;
  color: #333;
}

.item-header-row {
  margin-bottom: 10px;
}

.item-label-with-note {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.item-label-text {
  font-weight: 600;
  color: #333;
}

.inline-note {
  flex: 1;
  color: #666;
  font-size: 13px;
  font-style: italic;
  padding: 4px 8px;
  background: #fffbf0;
  border-radius: 4px;
  border: 1px solid #ffe4a3;
  min-width: 200px;
}

.days-label {
  font-weight: normal;
  color: #666;
  font-size: 13px;
}

.item-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.item-status {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 300px;
}

.item-status .mini-progress-bar {
  flex: 1;
  min-width: 100px;
}

.budget-footer {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
}

.input-with-unit {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 180px;
  gap: 8px;
}

.input-with-unit input {
  width: 120px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input-with-unit input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.input-unit {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  min-width: 35px;
  text-align: left;
}

.calc-arrow {
  font-size: 16px;
  color: #999;
  flex-shrink: 0;
}

.calculated-display {
  min-width: 80px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  color: #007bff;
}

.calc-value {
  white-space: nowrap;
}

.current-spend {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

/* Toggle Switch */
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.toggle-switch input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  background-color: #ccc;
  border-radius: 24px;
  transition: background-color 0.3s;
}

.toggle-slider::before {
  content: "";
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #007bff;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

/* Allocation status colors */
#allocation-status,
#country-allocation-status {
  border-left: 4px solid #007bff;
}

/* Country mode selector buttons */
.country-mode-selector {
  display: flex;
  gap: 4px;
  background: #f0f0f0;
  padding: 4px;
  border-radius: 6px;
}

.mode-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: #666;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: #e0e0e0;
}

.mode-btn.active {
  background: #007bff;
  color: white;
}

/* Notes sections */
.group-note-section {
  margin: 15px 0;
  padding: 12px;
  background: #fffbf0;
  border-radius: 6px;
  border: 1px solid #ffe4a3;
}

.note-label {
  display: block;
  font-weight: 600;
  font-size: 13px;
  color: #333;
  margin-bottom: 6px;
}

.group-note-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}

.group-note-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.note-toggle-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
  margin-left: 8px;
}

.note-toggle-btn:hover {
  opacity: 1;
}

.item-note-section {
  margin-top: 10px;
  padding: 10px;
  background: #fffbf0;
  border-radius: 4px;
  border: 1px solid #ffe4a3;
}

.item-note-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  resize: vertical;
}

.item-note-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

/* Category breakdown visualization */
.est-cost-with-breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cat-breakdown-bar {
  display: flex;
  height: 8px;
  gap: 1px;
  border-radius: 4px;
  overflow: hidden;
}

.cat-breakdown-item {
  flex: 1;
  min-width: 3px;
  transition: transform 0.2s;
}

.cat-breakdown-item:hover {
  transform: scaleY(1.5);
  cursor: help;
}

/* Costs toggle button */
.costs-toggle-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
  margin-left: 8px;
  font-weight: 500;
}

.costs-toggle-btn:hover {
  background: #0056b3;
}

/* Costs section */
.item-costs-section {
  margin-top: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.country-costs-table {
  background: white;
  border-radius: 6px;
  padding: 12px;
}

.destination-costs-section {
  margin-bottom: 20px;
}

.destination-costs-section:last-child {
  margin-bottom: 0;
}

.destination-header {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 10px;
  padding: 8px 12px;
  background: #f0f7ff;
  border-left: 4px solid #007bff;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.exchange-rates-header {
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #333;
  border: 1px solid #e0e0e0;
}

.currency-rate-item {
  font-family: monospace;
  color: #555;
}

.rates-date-small {
  color: #999;
  font-size: 11px;
  font-style: italic;
}

.btn-xs {
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
}

.regenerate-destination-costs-btn,
.regenerate-country-costs-btn {
  white-space: nowrap;
}

.costs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-bottom: 12px;
}

.costs-table thead {
  background: #f8f9fa;
  border-bottom: 2px solid #dee2e6;
}

.costs-table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.costs-table th.text-right {
  text-align: right;
}

.costs-table tbody tr {
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.costs-table tbody tr:hover {
  background: #f8f9fa;
}

.costs-table td {
  padding: 10px 12px;
  color: #333;
}

.costs-table td.text-right {
  text-align: right;
}

.costs-table td.amount-cell {
  font-weight: 600;
  color: #007bff;
  white-space: nowrap;
}

.costs-table td.notes-cell {
  color: #666;
  font-size: 12px;
  word-wrap: break-word;
  max-width: 400px;
}

.editable-cost-row td {
  vertical-align: top;
}

.description-cell {
  vertical-align: top;
  padding-top: 8px;
  padding-bottom: 8px;
}

.description-cell-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.description-input {
  font-size: 13px;
  padding: 8px 10px;
}

.category-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.category-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.confidence-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  color: white;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cost-sources {
  margin-top: 0;
  font-size: 11px;
  color: #6c757d;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.source-link {
  color: #007bff;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  padding: 2px 0;
}

.source-link:hover {
  text-decoration: underline;
}

.more-sources {
  color: #6c757d;
  font-style: italic;
  cursor: help;
  display: inline-flex;
  align-items: center;
  padding: 2px 0;
}

.estimate-range {
  margin-top: 2px;
  font-size: 10px;
  color: #6c757d;
  font-style: italic;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.status-estimated {
  background: #fff3cd;
  color: #856404;
}

.status-researched {
  background: #d1ecf1;
  color: #0c5460;
}

.status-booked {
  background: #d4edda;
  color: #155724;
}

.status-paid {
  background: #c3e6cb;
  color: #155724;
}

.costs-table tfoot .total-row {
  background: #f8f9fa;
  border-top: 2px solid #dee2e6;
  font-weight: 600;
}

.costs-table tfoot .total-row td {
  padding: 12px;
}

.country-total-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  background: #e7f3ff;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #007bff;
  margin-top: 12px;
  border: 1px solid #b8daff;
}

.no-costs-container {
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.no-costs-message {
  padding: 24px;
  text-align: center;
  color: #666;
  border-bottom: 1px solid #f0f0f0;
}

.generate-costs-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.generate-costs-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.generate-costs-btn:active {
  transform: translateY(0);
}

.inline-generate-btn {
  padding: 6px 12px;
  font-size: 13px;
  margin-left: 8px;
}

/* Editable costs table styles */
.costs-table-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  padding: 10px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #218838;
}

.unsaved-indicator {
  color: #dc3545;
  font-size: 13px;
  font-weight: 600;
  margin-left: auto;
}

.editable-costs-table {
  table-layout: fixed;
}

.cost-field-input,
.cost-field-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 12px;
  font-family: inherit;
}

.cost-field-input:focus,
.cost-field-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.cost-field-input:disabled {
  background: #f8f9fa;
  color: #999;
}

textarea.cost-field-input {
  resize: none;
  overflow: hidden;
  min-height: 34px;
  line-height: 1.4;
}

textarea.auto-resize {
  resize: none;
  overflow: hidden;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-icon:hover {
  opacity: 1;
}

/* Add cost form */
.add-cost-section {
  margin-top: 15px;
}

.add-cost-form {
  background: white;
  padding: 20px;
  border-radius: 6px;
  border: 2px solid #28a745;
}

.add-cost-form h5 {
  margin: 0 0 15px 0;
  color: #28a745;
  font-size: 16px;
}

.form-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: flex-start;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #333;
}

.new-cost-field {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}

.new-cost-field:focus {
  outline: none;
  border-color: #28a745;
  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
}

.new-cost-field:disabled {
  background: #f8f9fa;
  color: #999;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e0e0e0;
}

/* Currency input with symbol */
.currency-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-symbol {
  position: absolute;
  left: 8px;
  font-weight: 600;
  color: #666;
  pointer-events: none;
  z-index: 1;
  font-size: 14px;
}

.currency-input-wrapper .cost-field-input {
  padding-left: 36px;
  text-align: right;
}

.currency-display-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.currency-code-display {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  padding: 4px 0;
}

.exchange-rate-info {
  font-size: 10px;
  color: #666;
  font-style: italic;
  white-space: nowrap;
  line-height: 1.3;
}

.rate-date {
  font-size: 9px;
  color: #999;
}

/* Prompt Edit Modal */
.prompt-edit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.prompt-edit-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.prompt-edit-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.prompt-edit-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-modal-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-modal-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.prompt-edit-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.prompt-edit-textarea {
  width: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
}

.prompt-edit-footer {
  padding: 20px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* Traveler Section */
.traveler-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
}

.traveler-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.traveler-header h4 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.traveler-count-badge {
  background: #667eea;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.traveler-inputs {
  display: flex;
  gap: 15px;
  align-items: center;
  margin-bottom: 10px;
}

.traveler-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.traveler-input-group label {
  font-size: 14px;
  font-weight: 500;
  color: #555;
  min-width: 65px;
}

.traveler-input-group input {
  width: 80px;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.traveler-note {
  color: #666;
  font-size: 12px;
  line-height: 1.4;
  margin-top: 8px;
}

.traveler-note small {
  display: block;
}

/* Auto-save indicators */
.auto-save-indicator-inline {
  font-size: 13px;
  font-weight: 500;
  transition: opacity 0.2s;
  min-width: 80px;
  text-align: left;
}

.auto-save-indicator-inline.saving {
  color: #667eea;
}

.auto-save-indicator-inline.saved {
  color: #28a745;
}

.auto-save-indicator-inline.error {
  color: #dc3545;
}

/* Accommodation select */
.accommodation-select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  min-width: 150px;
}

/* Destination meta info */
.dest-meta {
  font-weight: 400;
  font-size: 12px;
  color: #666;
  margin-left: 6px;
}
/* Transport section styles */
.transport-section {
  margin-top: 20px;
  margin-bottom: 20px;
  border-top: 2px solid #e9ecef;
  padding-top: 20px;
}

.transport-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

/* Country Visuals */
.country-visuals-section {
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.country-visual-chart {
  width: 100%;
}

.bar-chart-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.bar-label {
  width: 120px;
  text-align: right;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-container {
  flex: 1;
  height: 20px;
  background: #f8f9fa;
  border-radius: 4px;
  overflow: visible;
  position: relative;
}

.bar-fill-budget {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(0, 123, 255, 0.2);
  border: 1px solid rgba(0, 123, 255, 0.4);
  border-radius: 4px;
  min-width: 2px;
  transition: width 0.5s ease-out;
  z-index: 1;
}

.bar-fill-actual {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #007bff;
  border-radius: 4px;
  min-width: 2px;
  transition: width 0.5s ease-out;
  z-index: 2;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  min-width: 2px;
  transition: width 0.5s ease-out;
}

.bar-value {
  min-width: 120px;
  font-weight: 600;
  color: #555;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}

.bar-value-line {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.bar-value-label {
  font-weight: 500;
  color: #888;
  font-size: 11px;
}

.pie-chart-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  padding: 10px;
}

.pie-chart-svg {
  width: 180px;
  height: 180px;
  transform: rotate(-90deg); /* Start from top */
}

.pie-chart-svg path {
  transition: opacity 0.2s;
  cursor: pointer;
}

.pie-chart-svg path:hover {
  opacity: 0.8;
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.bar-chart-legend {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  max-height: none;
}

.chart-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-label {
  font-weight: 500;
  color: #333;
}

.legend-value {
  color: #666;
  font-weight: 400;
}
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.transport-section .section-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.transport-summary {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 14px;
}

.transport-total {
  font-weight: 700;
  color: #007bff;
}

.transport-pct {
  color: #666;
  font-size: 13px;
}

.transport-segments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transport-segment-item {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 12px;
  border: 1px solid #dee2e6;
}

.segment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.segment-route {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  flex-wrap: wrap;
}

.segment-icon {
  font-size: 18px;
}

.segment-from,
.segment-to {
  font-weight: 600;
  color: #333;
}

.segment-arrow {
  color: #999;
  font-weight: 400;
}

.segment-distance,
.segment-duration {
  color: #666;
  font-size: 12px;
  padding: 2px 6px;
  background: white;
  border-radius: 3px;
  border: 1px solid #dee2e6;
}

.segment-actions {
  display: flex;
  gap: 6px;
}

.segment-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.segment-cost {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.segment-cost .cost-value {
  font-size: 16px;
  font-weight: 700;
  color: #007bff;
}

.segment-airlines {
  color: #666;
  font-size: 12px;
}

.segment-range {
  color: #666;
  font-size: 12px;
  font-style: italic;
}

.segment-alternatives {
  margin-top: 4px;
}

.alternatives-badge {
  background: #ffc107;
  color: #000;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}

.segment-notes {
  color: #666;
  font-size: 12px;
  font-style: italic;
}

.segment-researched {
  color: #999;
  font-size: 11px;
}

.research-old {
  background: #ffc107;
  color: #000;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}

.research-aging {
  font-size: 14px;
}

.confidence-badge {
  color: white;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  display: inline-block;
}

.stat-breakdown {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

</style>
`;
