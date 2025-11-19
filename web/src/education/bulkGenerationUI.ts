/**
 * Bulk Curriculum Generation UI
 *
 * Modal for generating curricula for multiple locations at once
 */

interface BulkGenerationOptions {
  locations: any[];
  scenarioId?: string;
  versionId?: string;
  defaultStudent?: any;
}

interface GenerationProgress {
  total: number;
  current: number;
  successful: number;
  failed: number;
  currentLocation?: string;
}

interface GenerationResult {
  location_id: string;
  location_name: string;
  status: 'success' | 'failed';
  curriculum_plan_id?: string;
  error?: string;
}

/**
 * Show the bulk generation modal
 */
export function showBulkGenerationModal(options: BulkGenerationOptions): void {
  const { locations, scenarioId, versionId, defaultStudent } = options;

  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'education-modal bulk-generation-modal';
  modal.style.display = 'flex';

  // Modal content
  modal.innerHTML = `
    <div class="education-modal-content" style="max-width: 800px; width: 100%;">
      <div class="education-modal-header">
        <h2>🌍 Bulk Generate Curricula</h2>
        <button class="education-modal-close">&times;</button>
      </div>

      <div class="education-modal-body">
        <!-- Step 1: Location Selection -->
        <div id="step-selection" class="bulk-step">
          <h3>Select Locations</h3>
          <p class="help-text">Choose which destinations to generate curricula for:</p>

          <div style="margin-bottom: 20px;">
            <button id="select-all-btn" class="btn-secondary" style="margin-right: 10px;">Select All</button>
            <button id="deselect-all-btn" class="btn-secondary">Deselect All</button>
          </div>

          <div id="locations-list" class="locations-checklist">
            <!-- Locations will be inserted here -->
          </div>

          <div style="margin-top: 20px;">
            <strong>Selected: <span id="selected-count">0</span> of ${locations.length}</strong>
          </div>

          <h3 style="margin-top: 30px;">Student Profile</h3>
          <p class="help-text">Enter the student information for curriculum generation:</p>

          <div class="form-grid">
            <div class="form-group">
              <label>Student Name *</label>
              <input type="text" id="student-name" value="${defaultStudent?.name || ''}" required>
            </div>
            <div class="form-group">
              <label>Age *</label>
              <input type="number" id="student-age" value="${defaultStudent?.age || 14}" min="5" max="18" required>
            </div>
            <div class="form-group">
              <label>Grade *</label>
              <input type="number" id="student-grade" value="${defaultStudent?.grade || 8}" min="1" max="12" required>
            </div>
            <div class="form-group">
              <label>State/Region *</label>
              <input type="text" id="student-state" value="${defaultStudent?.state || 'California'}" required>
            </div>
            <div class="form-group">
              <label>Learning Style *</label>
              <select id="student-learning-style">
                <option value="Visual" ${defaultStudent?.learning_style === 'Visual' ? 'selected' : ''}>Visual</option>
                <option value="Auditory" ${defaultStudent?.learning_style === 'Auditory' ? 'selected' : ''}>Auditory</option>
                <option value="Kinesthetic" ${defaultStudent?.learning_style === 'Kinesthetic' ? 'selected' : ''}>Kinesthetic</option>
                <option value="Reading/Writing" ${defaultStudent?.learning_style === 'Reading/Writing' ? 'selected' : ''}>Reading/Writing</option>
              </select>
            </div>
            <div class="form-group">
              <label>Time Budget (min/day)</label>
              <input type="number" id="student-time-budget" value="${defaultStudent?.time_budget_minutes_per_day || 60}" min="15" max="240">
            </div>
          </div>

          <div class="form-group">
            <label>Interests (comma-separated)</label>
            <input type="text" id="student-interests" value="${(defaultStudent?.interests || []).join(', ')}" placeholder="e.g., science, art, music, sports">
          </div>

          <div class="form-group">
            <label>Subjects to Cover</label>
            <div class="checkbox-group">
              <label><input type="checkbox" value="science" checked> Science</label>
              <label><input type="checkbox" value="social_studies" checked> Social Studies</label>
              <label><input type="checkbox" value="language_arts" checked> Language Arts</label>
              <label><input type="checkbox" value="math"> Mathematics</label>
              <label><input type="checkbox" value="art"> Arts</label>
            </div>
          </div>
        </div>

        <!-- Step 2: Progress -->
        <div id="step-progress" class="bulk-step" style="display: none;">
          <h3>Generating Curricula</h3>
          <p class="help-text">Please wait while we generate curricula for your selected locations...</p>

          <div class="progress-container">
            <div class="progress-bar">
              <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text">
              <span id="progress-current">0</span> / <span id="progress-total">0</span> completed
            </div>
          </div>

          <div id="current-location" class="current-location-status">
            Preparing...
          </div>

          <div class="progress-stats">
            <div class="stat-item success">
              <span class="stat-label">✓ Successful:</span>
              <span id="stat-successful" class="stat-value">0</span>
            </div>
            <div class="stat-item error">
              <span class="stat-label">✗ Failed:</span>
              <span id="stat-failed" class="stat-value">0</span>
            </div>
          </div>
        </div>

        <!-- Step 3: Results -->
        <div id="step-results" class="bulk-step" style="display: none;">
          <h3>Generation Complete</h3>

          <div class="results-summary">
            <div class="summary-card">
              <div class="summary-icon">🎉</div>
              <div class="summary-content">
                <div class="summary-title">
                  <span id="results-successful">0</span> of <span id="results-total">0</span> curricula generated successfully
                </div>
                <div class="summary-subtitle" id="results-subtitle"></div>
              </div>
            </div>
          </div>

          <div id="results-list" class="results-list">
            <!-- Results will be inserted here -->
          </div>

          <div id="failed-list" class="failed-list" style="display: none;">
            <h4>Failed Generations</h4>
            <div id="failed-items"></div>
            <button id="retry-failed-btn" class="btn-secondary" style="margin-top: 15px;">
              🔄 Retry Failed Generations
            </button>
          </div>
        </div>
      </div>

      <div class="education-modal-footer">
        <button id="cancel-btn" class="btn-secondary">Cancel</button>
        <button id="generate-btn" class="btn-primary">Generate Curricula</button>
        <button id="done-btn" class="btn-primary" style="display: none;">Done</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Populate locations list
  const locationsList = modal.querySelector('#locations-list') as HTMLElement;
  locations.forEach((location, index) => {
    const item = document.createElement('label');
    item.className = 'location-checkbox-item';
    item.innerHTML = `
      <input type="checkbox" value="${location.id}" data-index="${index}" checked>
      <span class="location-name">📍 ${location.name || location.id}</span>
      <span class="location-country">${location.country || ''}</span>
    `;
    locationsList.appendChild(item);
  });

  // Update selected count
  function updateSelectedCount() {
    const checkboxes = locationsList.querySelectorAll('input[type="checkbox"]');
    const selectedCount = Array.from(checkboxes).filter((cb: any) => cb.checked).length;
    (modal.querySelector('#selected-count') as HTMLElement).textContent = selectedCount.toString();
  }

  // Select/Deselect all buttons
  modal.querySelector('#select-all-btn')!.addEventListener('click', () => {
    locationsList.querySelectorAll('input[type="checkbox"]').forEach((cb: any) => cb.checked = true);
    updateSelectedCount();
  });

  modal.querySelector('#deselect-all-btn')!.addEventListener('click', () => {
    locationsList.querySelectorAll('input[type="checkbox"]').forEach((cb: any) => cb.checked = false);
    updateSelectedCount();
  });

  // Update count on checkbox change
  locationsList.addEventListener('change', updateSelectedCount);

  // Close modal
  function closeModal() {
    modal.remove();
  }

  modal.querySelector('.education-modal-close')!.addEventListener('click', closeModal);
  modal.querySelector('#cancel-btn')!.addEventListener('click', closeModal);
  modal.querySelector('#done-btn')!.addEventListener('click', closeModal);

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Generate button
  modal.querySelector('#generate-btn')!.addEventListener('click', async () => {
    // Validate form
    const nameInput = modal.querySelector('#student-name') as HTMLInputElement;
    const ageInput = modal.querySelector('#student-age') as HTMLInputElement;
    const gradeInput = modal.querySelector('#student-grade') as HTMLInputElement;
    const stateInput = modal.querySelector('#student-state') as HTMLInputElement;

    if (!nameInput.value || !ageInput.value || !gradeInput.value || !stateInput.value) {
      alert('Please fill in all required student information fields');
      return;
    }

    // Get selected locations
    const selectedCheckboxes = Array.from(
      locationsList.querySelectorAll('input[type="checkbox"]:checked')
    ) as HTMLInputElement[];

    if (selectedCheckboxes.length === 0) {
      alert('Please select at least one location');
      return;
    }

    const selectedLocations = selectedCheckboxes.map(cb => {
      const index = parseInt(cb.dataset.index!);
      return locations[index];
    });

    // Get student profile
    const interestsInput = (modal.querySelector('#student-interests') as HTMLInputElement).value;
    const interests = interestsInput.split(',').map(i => i.trim()).filter(i => i);

    const subjectCheckboxes = Array.from(
      modal.querySelectorAll('.checkbox-group input[type="checkbox"]:checked')
    ) as HTMLInputElement[];
    const subjects = subjectCheckboxes.map(cb => cb.value);

    const studentProfile = {
      name: nameInput.value,
      age: parseInt(ageInput.value),
      grade: parseInt(gradeInput.value),
      state: stateInput.value,
      learning_style: (modal.querySelector('#student-learning-style') as HTMLSelectElement).value,
      time_budget_minutes_per_day: parseInt((modal.querySelector('#student-time-budget') as HTMLInputElement).value),
      interests: interests,
      subjects_to_cover: subjects,
    };

    // Start generation
    await startBulkGeneration(
      modal,
      selectedLocations,
      studentProfile,
      subjects,
      scenarioId,
      versionId
    );
  });

  updateSelectedCount();
}

/**
 * Start bulk generation process
 */
async function startBulkGeneration(
  modal: HTMLElement,
  selectedLocations: any[],
  studentProfile: any,
  subjects: string[],
  scenarioId?: string,
  versionId?: string
): Promise<void> {
  // Switch to progress view
  modal.querySelector('#step-selection')!.setAttribute('style', 'display: none;');
  modal.querySelector('#step-progress')!.setAttribute('style', 'display: block;');
  modal.querySelector('#generate-btn')!.setAttribute('style', 'display: none;');
  modal.querySelector('#cancel-btn')!.setAttribute('disabled', 'true');

  // Initialize progress
  const progress: GenerationProgress = {
    total: selectedLocations.length,
    current: 0,
    successful: 0,
    failed: 0,
  };

  updateProgressUI(modal, progress);

  // Prepare request
  const requestBody = {
    student: studentProfile,
    locations: selectedLocations,
    subjects: subjects,
    scenario_id: scenarioId,
    version_id: versionId,
  };

  try {
    const response = await fetch('/api/education/bulk-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate curricula: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === 'success') {
      // Show results
      showResults(modal, data);
    } else {
      throw new Error(data.error || 'Unknown error occurred');
    }
  } catch (error: any) {
    console.error('Error in bulk generation:', error);
    alert(`Error: ${error.message}`);

    // Re-enable cancel button
    modal.querySelector('#cancel-btn')!.removeAttribute('disabled');
    modal.querySelector('#generate-btn')!.setAttribute('style', 'display: inline-block;');
    modal.querySelector('#step-progress')!.setAttribute('style', 'display: none;');
    modal.querySelector('#step-selection')!.setAttribute('style', 'display: block;');
  }
}

/**
 * Update progress UI (called periodically during generation)
 */
function updateProgressUI(modal: HTMLElement, progress: GenerationProgress): void {
  const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  (modal.querySelector('#progress-fill') as HTMLElement).style.width = `${percentage}%`;
  (modal.querySelector('#progress-current') as HTMLElement).textContent = progress.current.toString();
  (modal.querySelector('#progress-total') as HTMLElement).textContent = progress.total.toString();
  (modal.querySelector('#stat-successful') as HTMLElement).textContent = progress.successful.toString();
  (modal.querySelector('#stat-failed') as HTMLElement).textContent = progress.failed.toString();

  if (progress.currentLocation) {
    (modal.querySelector('#current-location') as HTMLElement).textContent =
      `Generating curriculum for ${progress.currentLocation}...`;
  }
}

/**
 * Show results after generation completes
 */
function showResults(modal: HTMLElement, data: any): void {
  // Switch to results view
  modal.querySelector('#step-progress')!.setAttribute('style', 'display: none;');
  modal.querySelector('#step-results')!.setAttribute('style', 'display: block;');
  modal.querySelector('#cancel-btn')!.setAttribute('style', 'display: none;');
  modal.querySelector('#done-btn')!.setAttribute('style', 'display: inline-block;');

  // Update summary
  (modal.querySelector('#results-successful') as HTMLElement).textContent = data.successful.toString();
  (modal.querySelector('#results-total') as HTMLElement).textContent = data.total.toString();

  const subtitleEl = modal.querySelector('#results-subtitle') as HTMLElement;
  if (data.failed > 0) {
    subtitleEl.textContent = `${data.failed} generation(s) failed`;
    subtitleEl.style.color = '#c53030';
  } else {
    subtitleEl.textContent = 'All curricula generated successfully!';
    subtitleEl.style.color = '#2f855a';
  }

  // Show results list
  const resultsList = modal.querySelector('#results-list') as HTMLElement;
  resultsList.innerHTML = '';

  const successfulResults = data.results.filter((r: GenerationResult) => r.status === 'success');
  const failedResults = data.results.filter((r: GenerationResult) => r.status === 'failed');

  // Show successful results
  if (successfulResults.length > 0) {
    const successSection = document.createElement('div');
    successSection.innerHTML = '<h4 style="color: #2f855a;">✓ Successfully Generated</h4>';

    successfulResults.forEach((result: GenerationResult) => {
      const item = document.createElement('div');
      item.className = 'result-item success';
      item.innerHTML = `
        <span class="result-icon">✓</span>
        <span class="result-name">${result.location_name || result.location_id}</span>
        <a href="/web/index.html?view_curriculum=${result.curriculum_plan_id}" target="_blank" class="result-link">View →</a>
      `;
      successSection.appendChild(item);
    });

    resultsList.appendChild(successSection);
  }

  // Show failed results
  if (failedResults.length > 0) {
    const failedList = modal.querySelector('#failed-list') as HTMLElement;
    const failedItems = modal.querySelector('#failed-items') as HTMLElement;
    failedList.style.display = 'block';
    failedItems.innerHTML = '';

    failedResults.forEach((result: GenerationResult) => {
      const item = document.createElement('div');
      item.className = 'result-item error';
      item.innerHTML = `
        <span class="result-icon">✗</span>
        <span class="result-name">${result.location_name || result.location_id}</span>
        <span class="result-error">${result.error || 'Unknown error'}</span>
      `;
      failedItems.appendChild(item);
    });

    // TODO: Implement retry functionality
    modal.querySelector('#retry-failed-btn')!.addEventListener('click', () => {
      alert('Retry functionality coming soon!');
    });
  }
}

/**
 * Get locations from the current scenario
 */
export async function getScenarioLocations(scenarioId: string, versionId: string): Promise<any[]> {
  try {
    // This would normally fetch from the scenario/version
    // For now, return empty array - will be filled by the caller
    return [];
  } catch (error) {
    console.error('Error fetching locations:', error);
    return [];
  }
}
