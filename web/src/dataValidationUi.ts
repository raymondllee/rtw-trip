/**
 * Data Validation UI for Geographic Data
 *
 * Provides UI for:
 * - Validating destinations have required country/region fields
 * - Enriching missing data from Places API
 * - Showing which destinations will be filtered out in different views
 */

import type { TripData } from './types/trip';
import {
  validateDestinations,
  enrichAllDestinations,
  formatValidationResult,
  formatEnrichmentReport
} from './utils/dataEnrichment';

/**
 * Show geographic data validation panel
 */
export async function showGeographicValidationPanel(
  data: TripData,
  onUpdate: (updatedData: TripData) => void,
  onSave?: () => Promise<void>
): Promise<void> {
  const validation = validateDestinations(data);

  const panel = document.createElement('div');
  panel.id = 'geo-validation-panel';
  panel.className = 'modal-overlay';

  const validationHtml = formatValidationResultAsHtml(validation);

  panel.innerHTML = `
    <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header">
        <h2>🌍 Geographic Data Validation</h2>
        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>

      <div class="modal-body">
        <!-- Summary Cards -->
        <div class="integrity-summary" style="margin-bottom: 20px;">
          <h3>Summary</h3>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            <div class="stat-box stat-success">
              <div class="stat-label">✅ Valid</div>
              <div class="stat-value">${validation.valid}</div>
            </div>
            <div class="stat-box ${validation.missingCountry > 0 ? 'stat-error' : ''}">
              <div class="stat-label">❌ Missing Country</div>
              <div class="stat-value">${validation.missingCountry}</div>
            </div>
            <div class="stat-box ${validation.missingRegion > 0 ? 'stat-warning' : ''}">
              <div class="stat-label">⚠️ Missing Region</div>
              <div class="stat-value">${validation.missingRegion}</div>
            </div>
            <div class="stat-box ${validation.unmappedCountry > 0 ? 'stat-info' : ''}">
              <div class="stat-label">🗺️ Unmapped Country</div>
              <div class="stat-value">${validation.unmappedCountry}</div>
            </div>
          </div>
        </div>

        <!-- Explanation -->
        <div class="info-box" style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
          <h4 style="margin-top: 0;">Why This Matters</h4>
          <p style="margin-bottom: 10px;">Destinations need both <strong>country</strong> and <strong>region</strong> fields to appear correctly in all views:</p>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Leg view</strong> (e.g., "China") filters by <code>region</code> field</li>
            <li><strong>Sub-leg view</strong> (e.g., "All Asia") filters by <code>country</code> field</li>
            <li><strong>All destinations</strong> shows everything (no filtering)</li>
          </ul>
          <p style="margin-bottom: 0; margin-top: 10px;">
            <strong>Missing either field will cause destinations to disappear when switching views!</strong>
          </p>
        </div>

        <!-- Action Buttons -->
        <div style="margin-bottom: 20px; display: flex; gap: 10px;">
          <button id="enrich-all-btn" class="btn-primary" ${validation.missingCountry + validation.missingRegion === 0 ? 'disabled' : ''}>
            🔧 Auto-Fix Missing Data
          </button>
          <button id="refresh-validation-btn" class="btn-secondary">
            🔄 Refresh Validation
          </button>
          <button id="view-report-btn" class="btn-secondary">
            📋 View Detailed Report
          </button>
        </div>

        <!-- Progress Bar (hidden initially) -->
        <div id="enrichment-progress" style="display: none; margin-bottom: 20px;">
          <div class="progress-bar-container" style="background: #e0e0e0; border-radius: 4px; height: 24px; position: relative; overflow: hidden;">
            <div id="progress-bar-fill" style="background: #4caf50; height: 100%; width: 0%; transition: width 0.3s;"></div>
            <div id="progress-bar-text" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12px; font-weight: bold; color: #333;">0%</div>
          </div>
          <div id="progress-message" style="margin-top: 8px; font-size: 13px; color: #666;"></div>
        </div>

        <!-- Validation Details -->
        <div class="validation-details">
          ${validationHtml}
        </div>

        <!-- Report Modal (hidden initially) -->
        <div id="report-modal" style="display: none;">
          <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 20px;">
            <h4>Detailed Report</h4>
            <pre id="report-content" style="background: white; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; max-height: 400px;"></pre>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Event listeners
  const enrichBtn = panel.querySelector('#enrich-all-btn') as HTMLButtonElement;
  const refreshBtn = panel.querySelector('#refresh-validation-btn') as HTMLButtonElement;
  const reportBtn = panel.querySelector('#view-report-btn') as HTMLButtonElement;
  const progressDiv = panel.querySelector('#enrichment-progress') as HTMLElement;
  const progressBar = panel.querySelector('#progress-bar-fill') as HTMLElement;
  const progressText = panel.querySelector('#progress-bar-text') as HTMLElement;
  const progressMessage = panel.querySelector('#progress-message') as HTMLElement;
  const reportModal = panel.querySelector('#report-modal') as HTMLElement;
  const reportContent = panel.querySelector('#report-content') as HTMLElement;

  // Enrich all destinations
  if (!enrichBtn) {
    console.error('❌ Enrich button not found!');
  } else {
    console.log('✅ Enrich button found, attaching click handler');
  }

  enrichBtn?.addEventListener('click', async () => {
    alert('Auto-Fix button clicked!'); // Very visible confirmation
    console.log('🚀 Auto-Fix started');
    enrichBtn.setAttribute('disabled', 'true');
    enrichBtn.textContent = '⏳ Enriching...';
    progressDiv!.style.display = 'block';

    try {
      console.log(`📊 Starting enrichment of ${data.locations.length} destinations`);
      const report = await enrichAllDestinations(data, {
        forceRefresh: false,
        onProgress: (progress, current) => {
          progressBar!.style.width = `${progress}%`;
          progressText!.textContent = `${progress}%`;
          progressMessage!.textContent = `Processing: ${current}`;
        }
      });

      console.log('📈 Enrichment report:', report);

      // Update progress to 100%
      progressBar!.style.width = '100%';
      progressText!.textContent = '100%';
      progressMessage!.textContent = `Complete! Enriched ${report.enriched} destinations`;

      // Call update callback to update in-memory data
      console.log('🔄 Calling onUpdate to update in-memory data');
      onUpdate(data);

      // Save to Firestore if callback provided
      if (onSave) {
        console.log('💾 Saving to Firestore...');
        progressMessage!.textContent = 'Saving to Firestore...';
        try {
          await onSave();
          console.log('✅ Saved to Firestore successfully!');
          progressMessage!.textContent = 'Saved to Firestore successfully!';
        } catch (saveError) {
          console.error('❌ Failed to save to Firestore:', saveError);
          alert(`Warning: Data was enriched but failed to save to Firestore: ${saveError instanceof Error ? saveError.message : 'Unknown error'}\n\nPlease save manually.`);
        }
      } else {
        console.warn('⚠️  No onSave callback provided - data will NOT be saved to Firestore!');
      }

      // Show success message
      console.log('🎉 Auto-Fix complete!');
      console.log(`   Enriched: ${report.enriched}`);
      console.log(`   Skipped: ${report.skipped}`);
      console.log(`   Failed: ${report.failed}`);
      alert(`Enrichment complete!\n\n✅ Enriched: ${report.enriched}\n⏭️ Skipped: ${report.skipped}\n❌ Failed: ${report.failed}\n\n💾 Data has been saved to Firestore.`);

      // Close and reopen panel to show updated validation
      console.log('🔄 Reopening validation panel to show updated data');
      panel.remove();
      await showGeographicValidationPanel(data, onUpdate, onSave);

    } catch (error) {
      console.error('Enrichment error:', error);
      alert(`Error during enrichment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      enrichBtn.removeAttribute('disabled');
      enrichBtn.textContent = '🔧 Auto-Fix Missing Data';
    }
  });

  // Refresh validation
  refreshBtn?.addEventListener('click', async () => {
    panel.remove();
    await showGeographicValidationPanel(data, onUpdate, onSave);
  });

  // View detailed report
  reportBtn?.addEventListener('click', () => {
    const reportText = formatValidationResult(validateDestinations(data));
    reportContent!.textContent = reportText;
    reportModal!.style.display = 'block';
  });
}

/**
 * Format validation result as HTML
 */
function formatValidationResultAsHtml(validation: any): string {
  let html = '';

  // Missing Country
  if (validation.locations.missingCountry.length > 0) {
    html += `
      <div class="validation-section">
        <h4 style="color: #d32f2f; margin-bottom: 10px;">❌ Destinations Missing Country (${validation.locations.missingCountry.length})</h4>
        <p style="margin-bottom: 10px; color: #666;">These destinations will NOT appear in sub-leg or leg views:</p>
        <ul style="margin: 0; padding-left: 20px; max-height: 200px; overflow-y: auto;">
          ${validation.locations.missingCountry.map((loc: any) => `
            <li>
              <strong>${loc.name}</strong>
              ${loc.city ? `(${loc.city})` : ''}
              - ID: ${loc.id}
              ${loc.place_id ? `<br><small style="color: #666;">Place ID: ${loc.place_id}</small>` : '<br><small style="color: #d32f2f;">No Place ID - cannot auto-fix</small>'}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // Missing Region
  if (validation.locations.missingRegion.length > 0) {
    html += `
      <div class="validation-section" style="margin-top: 20px;">
        <h4 style="color: #f57c00; margin-bottom: 10px;">⚠️ Destinations Missing Region (${validation.locations.missingRegion.length})</h4>
        <p style="margin-bottom: 10px; color: #666;">These destinations will NOT appear in leg views:</p>
        <ul style="margin: 0; padding-left: 20px; max-height: 200px; overflow-y: auto;">
          ${validation.locations.missingRegion.map((loc: any) => `
            <li>
              <strong>${loc.name}</strong>
              ${loc.country ? `- Country: <code>${loc.country}</code>` : ''}
              ${loc.city ? `(${loc.city})` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // Unmapped Country
  if (validation.locations.unmappedCountry.length > 0) {
    const uniqueCountries = new Set(validation.locations.unmappedCountry.map((l: any) => l.country).filter(Boolean));

    html += `
      <div class="validation-section" style="margin-top: 20px;">
        <h4 style="color: #1976d2; margin-bottom: 10px;">🗺️ Destinations with Unmapped Countries (${validation.locations.unmappedCountry.length})</h4>
        <p style="margin-bottom: 10px; color: #666;">These countries need to be added to <code>regionMappings.ts</code>:</p>
        <ul style="margin: 0; padding-left: 20px;">
          ${Array.from(uniqueCountries).map(country => {
            const locs = validation.locations.unmappedCountry.filter((l: any) => l.country === country);
            return `
              <li>
                <strong>${country}</strong> (${locs.length} destination${locs.length > 1 ? 's' : ''})
                <ul style="margin-top: 5px; font-size: 13px;">
                  ${locs.map((loc: any) => `<li>${loc.name}</li>`).join('')}
                </ul>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;
  }

  // All valid
  if (validation.valid === validation.locations.valid.length + validation.locations.missingCountry.length + validation.locations.missingRegion.length + validation.locations.unmappedCountry.length) {
    html += `
      <div class="validation-section" style="margin-top: 20px;">
        <h4 style="color: #388e3c; margin-bottom: 10px;">✅ Valid Destinations (${validation.valid})</h4>
        <p style="color: #666;">All these destinations have complete geographic data and will appear correctly in all views.</p>
      </div>
    `;
  }

  if (!html) {
    html = '<p style="color: #388e3c; font-weight: bold;">✅ All destinations are valid!</p>';
  }

  return html;
}

/**
 * Quick validation check - returns true if there are issues
 */
export function hasGeographicDataIssues(data: TripData): boolean {
  const validation = validateDestinations(data);
  return validation.missingCountry > 0 || validation.missingRegion > 0;
}

/**
 * Show validation warning banner if there are issues
 */
export function showValidationWarningBanner(
  data: TripData,
  onFixClick: () => void
): void {
  const validation = validateDestinations(data);

  if (validation.missingCountry === 0 && validation.missingRegion === 0) {
    return; // No issues
  }

  // Remove existing banner if present
  const existing = document.getElementById('geo-validation-banner');
  if (existing) {
    existing.remove();
  }

  const banner = document.createElement('div');
  banner.id = 'geo-validation-banner';
  banner.style.cssText = `
    position: fixed;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    background: #fff3cd;
    border: 2px solid #ffc107;
    border-radius: 8px;
    padding: 15px 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 600px;
    animation: slideDown 0.3s ease-out;
  `;

  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px;">
      <div style="font-size: 32px;">⚠️</div>
      <div style="flex: 1;">
        <strong style="display: block; margin-bottom: 5px;">Geographic Data Issues Detected</strong>
        <span style="font-size: 14px; color: #666;">
          ${validation.missingCountry} destination(s) missing country,
          ${validation.missingRegion} missing region.
          These may disappear when switching views.
        </span>
      </div>
      <button id="fix-geo-data-btn" style="
        background: #ff9800;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        white-space: nowrap;
      ">Fix Now</button>
      <button id="dismiss-banner-btn" style="
        background: transparent;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        line-height: 1;
      ">×</button>
    </div>
  `;

  document.body.appendChild(banner);

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);

  // Event listeners
  banner.querySelector('#fix-geo-data-btn')?.addEventListener('click', () => {
    banner.remove();
    onFixClick();
  });

  banner.querySelector('#dismiss-banner-btn')?.addEventListener('click', () => {
    banner.remove();
  });
}
