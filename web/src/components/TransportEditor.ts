// @ts-nocheck
import { getRuntimeConfig } from '../config';

export class TransportEditor {
  private transportSegmentManager: any;
  private modalId = 'edit-transport-modal';
  private formId = 'edit-transport-form';
  private currentSegmentId: string | null = null;
  private onSaveCallback: (() => void) | null = null;

  constructor(transportSegmentManager: any) {
    this.transportSegmentManager = transportSegmentManager;
    this.ensureModalExists();
    this.attachListeners();
  }

  private ensureModalExists() {
    if (document.getElementById(this.modalId)) return;

    const modalHtml = `
      <div id="${this.modalId}" class="modal-overlay" style="display: none;">
        <div class="modal transport-modal" style="max-width: 900px; width: 90%;">
          <h3>Edit Transport Segment</h3>
          <form class="modal-form transport-form" id="${this.formId}">
            <!-- Route Info -->
            <div class="form-section">
              <div class="form-group">
                <label>Route</label>
                <input type="text" id="transport-route" class="form-input" disabled style="font-weight: bold; background: #f8f9fa;">
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="transport-mode">Transport Mode</label>
                  <select id="transport-mode" class="form-input" required>
                    <option value="plane">✈️ Flight</option>
                    <option value="train">🚂 Train</option>
                    <option value="bus">🚌 Bus</option>
                    <option value="car">🚗 Car / Rental</option>
                    <option value="ferry">🚢 Ferry</option>
                    <option value="walking">🚶 Walking</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="transport-duration">Duration (hours)</label>
                  <input type="number" id="transport-duration" class="form-input" min="0" step="0.01" placeholder="e.g., 2.5">
                </div>
              </div>
            </div>

            <!-- Cost Information with Visual Hierarchy -->
            <div class="form-section">
              <h4 class="section-title">💵 Cost Information</h4>
              <p style="font-size: 13px; color: #666; margin: 0 0 16px 0;">Costs follow a priority hierarchy: <strong>Actual</strong> (green) overrides <strong>Manual</strong> (orange), which overrides <strong>Researched</strong> (blue), which overrides <strong>Estimated</strong> (gray).</p>

              <!-- Level 1: Estimated (Gray) - Lowest Priority -->
              <div class="cost-level" style="background: #f5f5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #999; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="background: #999; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">ESTIMATED</span>
                  <span style="font-size: 13px; color: #666;">Level 1 - System Generated</span>
                </div>
                <div class="form-group" style="margin: 0;">
                  <label for="transport-cost" style="font-size: 13px;">Estimated Cost (USD)</label>
                  <input type="number" id="transport-cost" class="form-input" min="0" step="1" placeholder="0">
                  <small class="form-hint">Auto-calculated based on distance and mode</small>
                </div>
              </div>

              <!-- Level 2: Researched (Blue) -->
              <div class="cost-level" style="background: #e3f2fd; padding: 12px; border-radius: 6px; border-left: 4px solid #2196f3; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="background: #2196f3; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">RESEARCHED</span>
                  <span style="font-size: 13px; color: #1565c0;">Level 2 - AI Research</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                  <div class="form-group" style="margin: 0;">
                    <label for="transport-researched-low" style="font-size: 13px;">Low (USD)</label>
                    <input type="number" id="transport-researched-low" class="form-input" min="0" step="1" placeholder="Low">
                  </div>
                  <div class="form-group" style="margin: 0;">
                    <label for="transport-researched-mid" style="font-size: 13px; font-weight: 600;">Mid (USD)</label>
                    <input type="number" id="transport-researched-mid" class="form-input" min="0" step="1" placeholder="Typical" style="font-weight: 600;">
                  </div>
                  <div class="form-group" style="margin: 0;">
                    <label for="transport-researched-high" style="font-size: 13px;">High (USD)</label>
                    <input type="number" id="transport-researched-high" class="form-input" min="0" step="1" placeholder="High">
                  </div>
                </div>
                <small class="form-hint" style="margin-top: 8px; display: block;">From AI research of flights, routes, and booking sites</small>
              </div>

              <!-- Level 3: Manual Override (Orange) -->
              <div class="cost-level" style="background: #fff3e0; padding: 12px; border-radius: 6px; border-left: 4px solid #f57c00; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="background: #f57c00; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">MANUAL</span>
                  <span style="font-size: 13px; color: #e65100;">Level 3 - Budget Override</span>
                </div>
                <div class="form-group" style="margin: 0;">
                  <label for="transport-manual-cost" style="font-size: 13px; font-weight: 600;">Manual Budget (USD)</label>
                  <input type="number" id="transport-manual-cost" class="form-input" min="0" step="1" placeholder="Override amount" style="font-weight: 600;">
                  <small class="form-hint">Set a custom budget target that overrides estimates and research</small>
                </div>
              </div>

              <!-- Level 4: Actual Cost (Green) - Highest Priority -->
              <div class="cost-level" style="background: #e8f5e9; padding: 12px; border-radius: 6px; border-left: 4px solid #4caf50; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">ACTUAL</span>
                  <span style="font-size: 13px; color: #2e7d32;">Level 4 - Booked Price (Highest Priority)</span>
                </div>
                <div class="form-group" style="margin: 0 0 12px 0;">
                  <label for="transport-actual-cost" style="font-size: 13px; font-weight: 600;">Actual Cost (USD)</label>
                  <input type="number" id="transport-actual-cost" class="form-input" min="0" step="1" placeholder="Booked price" style="font-weight: 600;">
                  <small class="form-hint">The real price you paid - overrides all other costs</small>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; padding: 10px; background: #f3e5f5; border-radius: 4px; border-left: 3px solid #8e24aa;">
                  <input type="checkbox" id="transport-included-package" class="form-checkbox" style="margin: 0; width: 18px; height: 18px;">
                  <label for="transport-included-package" style="margin: 0; font-size: 13px; font-weight: 500; color: #6a1b9a; cursor: pointer;">
                    ✓ Included in Package (sets cost to $0)
                  </label>
                </div>
                <small class="form-hint" style="display: block; margin-top: 8px; color: #6a1b9a;">
                  Check this if transport is included in a tour package or cruise
                </small>
              </div>

              <!-- Local Currency (Optional) -->
              <details style="margin-top: 16px;">
                <summary style="cursor: pointer; font-size: 13px; font-weight: 500; color: #666; padding: 8px 0;">💱 Local Currency Details (Optional)</summary>
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-top: 12px; padding: 12px; background: #fafafa; border-radius: 4px;">
                  <div class="form-group" style="margin: 0;">
                    <label for="transport-currency-local" style="font-size: 13px;">Currency</label>
                    <input type="text" id="transport-currency-local" class="form-input" maxlength="3" placeholder="e.g., EUR" style="text-transform: uppercase;">
                  </div>
                  <div class="form-group" style="margin: 0;">
                    <label for="transport-amount-local" style="font-size: 13px;">Amount (Local)</label>
                    <input type="number" id="transport-amount-local" class="form-input" min="0" step="0.01" placeholder="Amount in local currency">
                  </div>
                </div>
              </details>
            </div>

            <!-- Research Data (AI Agent Results) -->
            <div class="form-section">
              <h4 class="section-title">Research Data 🤖</h4>

              <div class="form-row">
                <div class="form-group">
                  <label for="transport-researched-duration">Duration (hours)</label>
                  <input type="number" id="transport-researched-duration" class="form-input" min="0" step="0.01" placeholder="Flight duration">
                  <small class="form-hint">From AI research</small>
                </div>
                <div class="form-group">
                  <label for="transport-researched-stops">Stops</label>
                  <input type="number" id="transport-researched-stops" class="form-input" min="0" step="1" placeholder="Number of stops">
                  <small class="form-hint">Typical stops</small>
                </div>
              </div>

              <div class="form-group">
                <label for="transport-airlines">Airlines</label>
                <textarea id="transport-airlines" class="form-input" rows="2" placeholder="e.g., Hawaiian Airlines, Qantas, United Airlines"></textarea>
                <small class="form-hint">Comma-separated list of airlines found during research</small>
              </div>

              <div class="form-group">
                <label for="transport-research-notes">Booking Tips & Research Notes</label>
                <textarea id="transport-research-notes" class="form-input" rows="3" placeholder="Tips from AI research, booking windows, seasonal considerations..."></textarea>
                <small class="form-hint">Insights from AI agent research</small>
              </div>

              <div class="form-group">
                <label for="transport-research-sources">Research Sources</label>
                <textarea id="transport-research-sources" class="form-input" rows="2" placeholder="URLs or sources used for research"></textarea>
                <small class="form-hint">Comma-separated list of sources</small>
              </div>

              <!-- Alternative Routes (Full details) -->
              <div class="form-group" id="transport-alternatives-section" style="display: none;">
                <label>Alternative Routes Found 🔀</label>
                <div id="transport-alternatives-display" style="background: #f5f5f5; padding: 10px; border-radius: 4px; max-height: 400px; overflow-y: auto;">
                  <!-- Alternatives will be populated here -->
                </div>
                <small class="form-hint">Alternative routes discovered during AI research - compare costs and routing options</small>
              </div>
            </div>

            <!-- Booking Details -->
            <div class="form-section">
              <h4 class="section-title">Booking Details</h4>

              <div class="form-row">
                <div class="form-group">
                  <label for="transport-booking-status">Status</label>
                  <select id="transport-booking-status" class="form-input">
                    <option value="estimated">Estimated</option>
                    <option value="researched">Researched</option>
                    <option value="booked">Booked</option>
                    <option value="paid">Paid</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="transport-confidence">Confidence Level</label>
                  <select id="transport-confidence" class="form-input">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="transport-booking-reference">Booking Reference</label>
                <input type="text" id="transport-booking-reference" class="form-input" placeholder="e.g., ABC123, XY789">
              </div>

              <div class="form-group">
                <label for="transport-booking-link">Booking Link</label>
                <input type="url" id="transport-booking-link" class="form-input" placeholder="https://...">
                <small class="form-hint">Link to booking confirmation or ticket</small>
              </div>
            </div>

            <!-- Notes -->
            <div class="form-section">
              <div class="form-group">
                <label for="transport-notes">Notes</label>
                <textarea id="transport-notes" class="form-input" rows="3" placeholder="Travel tips, booking details, alternative options, etc."></textarea>
              </div>
            </div>

            <input type="hidden" id="edit-transport-segment-id">

            <div class="modal-actions">
              <button type="button" class="btn-secondary" id="cancel-edit-transport-btn">Cancel</button>
              <button type="submit" class="btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  private attachListeners() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    // Close on cancel
    const cancelBtn = document.getElementById('cancel-edit-transport-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }

    // Close on click outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Handle form submission
    const form = document.getElementById(this.formId);
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.save();
      });
    }

    // "Included in Package" checkbox
    const includedCheckbox = document.getElementById('transport-included-package') as HTMLInputElement;
    const actualCostInput = document.getElementById('transport-actual-cost') as HTMLInputElement;
    if (includedCheckbox && actualCostInput) {
      includedCheckbox.addEventListener('change', () => {
        if (includedCheckbox.checked) {
          actualCostInput.value = '0';
          actualCostInput.readOnly = true;
          actualCostInput.style.background = '#f3e5f5';
        } else {
          actualCostInput.readOnly = false;
          actualCostInput.style.background = '';
        }
      });

      // Also update checkbox if cost is manually set to 0
      actualCostInput.addEventListener('input', () => {
        if (actualCostInput.value === '0') {
          includedCheckbox.checked = true;
          actualCostInput.readOnly = true;
          actualCostInput.style.background = '#f3e5f5';
        }
      });
    }
  }

  public open(segmentId: string, onSave?: () => void) {
    this.ensureModalExists();
    this.currentSegmentId = segmentId;
    this.onSaveCallback = onSave || null;

    const segment = this.transportSegmentManager.getAllSegments().find((s: any) => s.id === segmentId);
    if (!segment) {
      console.error('Transport segment not found:', segmentId);
      return;
    }

    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    // Populate form fields
    (document.getElementById('transport-route') as HTMLInputElement).value = `${segment.from_destination_name} → ${segment.to_destination_name}`;
    (document.getElementById('transport-mode') as HTMLInputElement).value = segment.transport_mode || 'plane';
    (document.getElementById('transport-cost') as HTMLInputElement).value = segment.estimated_cost_usd || '';
    (document.getElementById('transport-manual-cost') as HTMLInputElement).value = segment.manual_cost_usd || '';
    (document.getElementById('transport-duration') as HTMLInputElement).value = segment.duration_hours || '';

    // Researched costs
    (document.getElementById('transport-researched-low') as HTMLInputElement).value = segment.researched_cost_low || '';
    (document.getElementById('transport-researched-mid') as HTMLInputElement).value = segment.researched_cost_mid || '';
    (document.getElementById('transport-researched-high') as HTMLInputElement).value = segment.researched_cost_high || '';

    // Actual cost
    (document.getElementById('transport-actual-cost') as HTMLInputElement).value =
      segment.actual_cost_usd !== null && segment.actual_cost_usd !== undefined ? segment.actual_cost_usd.toString() : '';

    // Set "Included in Package" checkbox if actual cost is $0
    const includedCheckbox = document.getElementById('transport-included-package') as HTMLInputElement;
    const actualCostInput = document.getElementById('transport-actual-cost') as HTMLInputElement;
    if (segment.actual_cost_usd === 0) {
      if (includedCheckbox) includedCheckbox.checked = true;
      if (actualCostInput) {
        actualCostInput.readOnly = true;
        actualCostInput.style.background = '#f3e5f5';
      }
    } else {
      if (includedCheckbox) includedCheckbox.checked = false;
      if (actualCostInput) {
        actualCostInput.readOnly = false;
        actualCostInput.style.background = '';
      }
    }

    // Local currency
    (document.getElementById('transport-currency-local') as HTMLInputElement).value = segment.currency_local || '';
    (document.getElementById('transport-amount-local') as HTMLInputElement).value = segment.amount_local || '';

    // Research data (AI agent results)
    (document.getElementById('transport-researched-duration') as HTMLInputElement).value = segment.researched_duration_hours || '';
    (document.getElementById('transport-researched-stops') as HTMLInputElement).value = segment.researched_stops || '';
    (document.getElementById('transport-airlines') as HTMLInputElement).value = segment.researched_airlines ? segment.researched_airlines.join(', ') : '';
    (document.getElementById('transport-research-notes') as HTMLInputElement).value = segment.research_notes || '';
    (document.getElementById('transport-research-sources') as HTMLInputElement).value = segment.research_sources ? segment.research_sources.join(', ') : '';

    // Alternative routes (full details integrated)
    const alternativesSection = document.getElementById('transport-alternatives-section');
    const alternativesDisplay = document.getElementById('transport-alternatives-display');
    if (alternativesSection && alternativesDisplay) {
      if (segment.researched_alternatives && segment.researched_alternatives.length > 0) {
        alternativesSection.style.display = 'block';

        // Show primary route for comparison
        const primaryInfo = `
          <div style="margin-bottom: 12px; padding: 10px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
            <strong>Primary Route:</strong> ${segment.from_destination_name} → ${segment.to_destination_name}<br>
            <strong>Estimated Cost:</strong> $${segment.researched_cost_mid?.toFixed(0) || segment.estimated_cost_usd?.toFixed(0) || 'N/A'}
          </div>
        `;

        const alternativesHtml = segment.researched_alternatives.map((alt: any, idx: number) => {
          const savingsClass = alt.savings_vs_primary > 0 ? 'color: #2e7d32;' : 'color: #d32f2f;';
          const savingsText = alt.savings_vs_primary > 0
            ? `💰 Save $${alt.savings_vs_primary.toFixed(0)}`
            : `💸 Extra $${Math.abs(alt.savings_vs_primary).toFixed(0)}`;

          return `
            <div style="margin-bottom: 12px; padding: 10px; background: white; border: 1px solid #e0e0e0; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="font-size: 15px;">#${idx + 1}: ${alt.from_location} → ${alt.to_location}</strong>
                <span style="${savingsClass} font-weight: bold;">${savingsText}</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 8px;">
                <div><strong>Cost Range:</strong> $${alt.cost_low?.toFixed(0) || 'N/A'} - $${alt.cost_high?.toFixed(0) || 'N/A'}</div>
                <div><strong>Mid Cost:</strong> $${alt.cost_mid?.toFixed(0) || 'N/A'}</div>
                ${alt.airlines && alt.airlines.length > 0 ? `
                  <div style="grid-column: 1 / -1;"><strong>Airlines:</strong> ${alt.airlines.join(', ')}</div>
                ` : ''}
                ${alt.typical_duration_hours ? `
                  <div><strong>Duration:</strong> ${alt.typical_duration_hours.toFixed(1)} hrs</div>
                ` : ''}
                ${alt.typical_stops !== undefined ? `
                  <div><strong>Stops:</strong> ${alt.typical_stops === 0 ? 'Direct' : alt.typical_stops}</div>
                ` : ''}
                ${alt.distance_from_original_km > 0 ? `
                  <div style="grid-column: 1 / -1;"><strong>Distance from original:</strong> ${Math.round(alt.distance_from_original_km * 0.621371)} mi</div>
                ` : ''}
              </div>

              ${alt.notes ? `
                <div style="font-size: 13px; color: #666; font-style: italic; padding-top: 8px; border-top: 1px solid #f0f0f0;">
                  ${alt.notes}
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

        alternativesDisplay.innerHTML = primaryInfo + alternativesHtml;
      } else {
        alternativesSection.style.display = 'none';
      }
    }

    // Booking details
    (document.getElementById('transport-booking-status') as HTMLSelectElement).value = segment.booking_status || 'estimated';
    (document.getElementById('transport-confidence') as HTMLSelectElement).value = segment.confidence_level || 'low';
    (document.getElementById('transport-booking-reference') as HTMLInputElement).value = segment.booking_reference || '';
    (document.getElementById('transport-booking-link') as HTMLInputElement).value = segment.booking_link || '';

    // Notes
    (document.getElementById('transport-notes') as HTMLInputElement).value = segment.notes || '';
    (document.getElementById('edit-transport-segment-id') as HTMLInputElement).value = segmentId;

    modal.style.display = 'flex';
  }

  public close() {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  private async save() {
    if (!this.currentSegmentId) return;

    const mode = (document.getElementById('transport-mode') as HTMLInputElement).value;
    const estimatedCost = parseFloat((document.getElementById('transport-cost') as HTMLInputElement).value) || 0;

    // Manual cost - allow 0 for budgeting
    const manualCostValue = (document.getElementById('transport-manual-cost') as HTMLInputElement).value;
    const manualCost = manualCostValue === '' ? null : parseFloat(manualCostValue);

    const duration = parseFloat((document.getElementById('transport-duration') as HTMLInputElement).value) || null;

    // Researched costs
    const researchedLow = parseFloat((document.getElementById('transport-researched-low') as HTMLInputElement).value) || null;
    const researchedMid = parseFloat((document.getElementById('transport-researched-mid') as HTMLInputElement).value) || null;
    const researchedHigh = parseFloat((document.getElementById('transport-researched-high') as HTMLInputElement).value) || null;

    // Actual cost - allow 0 for included-in-package segments
    const actualCostValue = (document.getElementById('transport-actual-cost') as HTMLInputElement).value;
    const actualCost = actualCostValue === '' ? null : parseFloat(actualCostValue);

    // Local currency
    const currencyLocal = (document.getElementById('transport-currency-local') as HTMLInputElement).value.toUpperCase() || null;
    const amountLocal = parseFloat((document.getElementById('transport-amount-local') as HTMLInputElement).value) || null;

    // Research data (AI agent results)
    const researchedDuration = parseFloat((document.getElementById('transport-researched-duration') as HTMLInputElement).value) || null;
    const researchedStops = parseInt((document.getElementById('transport-researched-stops') as HTMLInputElement).value) || null;
    const airlinesText = (document.getElementById('transport-airlines') as HTMLInputElement).value;
    const airlines = airlinesText ? airlinesText.split(',').map(a => a.trim()).filter(a => a) : [];
    const researchNotes = (document.getElementById('transport-research-notes') as HTMLInputElement).value;
    const sourcesText = (document.getElementById('transport-research-sources') as HTMLInputElement).value;
    const sources = sourcesText ? sourcesText.split(',').map(s => s.trim()).filter(s => s) : [];

    // Booking details
    const bookingStatus = (document.getElementById('transport-booking-status') as HTMLSelectElement).value;
    const confidenceLevel = (document.getElementById('transport-confidence') as HTMLSelectElement).value;
    const bookingReference = (document.getElementById('transport-booking-reference') as HTMLInputElement).value;
    const bookingLink = (document.getElementById('transport-booking-link') as HTMLInputElement).value;

    // Notes
    const notes = (document.getElementById('transport-notes') as HTMLInputElement).value;

    const updates = {
      transport_mode: mode,
      transport_mode_icon: this.transportSegmentManager.getTransportIcon(mode),
      estimated_cost_usd: estimatedCost,
      manual_cost_usd: manualCost,
      researched_cost_low: researchedLow,
      researched_cost_mid: researchedMid,
      researched_cost_high: researchedHigh,
      actual_cost_usd: actualCost,
      currency_local: currencyLocal,
      amount_local: amountLocal,
      duration_hours: duration,
      researched_duration_hours: researchedDuration,
      researched_stops: researchedStops,
      researched_airlines: airlines,
      research_notes: researchNotes,
      research_sources: sources,
      booking_status: bookingStatus,
      confidence_level: confidenceLevel,
      booking_reference: bookingReference,
      booking_link: bookingLink,
      notes: notes
    };

    try {
      // Get current scenario ID from window
      const currentScenarioId = (window as any).currentScenarioId;
      console.log(`💾 Saving transport segment ${this.currentSegmentId} with updates:`, updates);
      await this.transportSegmentManager.updateSegment(this.currentSegmentId, updates, currentScenarioId);
      console.log('✅ Transport segment persisted to backend successfully');
      this.close();

      if (this.onSaveCallback) {
        this.onSaveCallback();
      }
    } catch (error) {
      console.error('Error updating transport segment:', error);
      alert('Failed to update transport segment. Please try again.');
    }
  }
}
