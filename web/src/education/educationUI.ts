/**
 * Education UI Components - Renders education section in destination cards
 */

import { educationService, type CurriculumPlan, type GenerateCurriculumRequest } from './educationService';

/**
 * Generate the education section HTML for a destination
 */
export function generateEducationSectionHTML(location: any, curricula: CurriculumPlan[] = []): string {
  const hasCurricula = curricula.length > 0;

  if (!hasCurricula) {
    return `
      <div class="education-section" data-location-id="${location.id}">
        <div class="education-header">
          <span class="education-icon">📚</span>
          <span>Education</span>
        </div>
        <div class="education-content">
          <button class="btn-generate-curriculum" data-location-id="${location.id}">
            <span>✨ Generate Curriculum</span>
          </button>
          <p class="education-hint">Create learning activities for this destination</p>
        </div>
      </div>
    `;
  }

  // Show existing curricula
  const mostRecent = curricula[0]; // Assuming sorted by created_at DESC
  const totalActivities = Object.values(mostRecent.location_lessons || {})
    .reduce((sum: number, lesson: any) => {
      const expCount = lesson?.on_location?.experiential_activities?.length || 0;
      const structCount = lesson?.on_location?.structured_lessons?.length || 0;
      return sum + expCount + structCount;
    }, 0);

  return `
    <div class="education-section expanded" data-location-id="${location.id}">
      <div class="education-header" data-toggle="education-${location.id}">
        <span class="education-icon">📚</span>
        <span>Education</span>
        <span class="education-badge">${curricula.length}</span>
        <span class="education-toggle">▼</span>
      </div>
      <div class="education-content" id="education-${location.id}">
        <div class="curriculum-summary">
          <div class="curriculum-title">${mostRecent.semester.title}</div>
          <div class="curriculum-meta">
            <span>📅 ${mostRecent.semester.total_weeks} weeks</span>
            <span>📝 ${totalActivities} activities</span>
            <span class="curriculum-status status-${mostRecent.status}">${mostRecent.status}</span>
          </div>
        </div>
        ${curricula.length > 1 ? `
          <div class="curriculum-count">
            +${curricula.length - 1} more curriculum${curricula.length > 2 ? 's' : ''}
          </div>
        ` : ''}
        <div class="education-actions">
          <button class="btn-view-curriculum" data-curriculum-id="${mostRecent.id}">
            <span>👁️ View</span>
          </button>
          <button class="btn-generate-curriculum" data-location-id="${location.id}">
            <span>✨ Generate New</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Load and display education section for a location
 */
export async function loadEducationSection(location: any): Promise<string> {
  try {
    const response = await educationService.getCurriculaByLocation(location.id);
    return generateEducationSectionHTML(location, response.curricula);
  } catch (error) {
    console.error(`Failed to load curricula for ${location.name}:`, error);
    return generateEducationSectionHTML(location, []);
  }
}

/**
 * Show curriculum generation modal
 */
export function showCurriculumGenerationModal(location: any, scenarioId?: string, versionId?: string) {
  // Check if modal exists, if not create it
  let modal = document.getElementById('curriculum-generation-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'curriculum-generation-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    document.body.appendChild(modal);
  }

  const highlightsArray = Array.isArray(location.highlights)
    ? location.highlights
    : (location.highlights || '').split(',').map((h: string) => h.trim()).filter(Boolean);

  modal.innerHTML = `
    <div class="modal">
      <h3>Generate Curriculum for ${location.name}</h3>
      <form class="modal-form" id="curriculum-generation-form">
        <div class="form-section">
          <h4>Student Profile</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="student-name">Student Name</label>
              <input type="text" id="student-name" class="form-input" value="Maya" required>
            </div>
            <div class="form-group">
              <label for="student-age">Age</label>
              <input type="number" id="student-age" class="form-input" value="14" min="5" max="18" required>
            </div>
            <div class="form-group">
              <label for="student-grade">Grade</label>
              <input type="number" id="student-grade" class="form-input" value="8" min="1" max="12" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="student-state">State</label>
              <select id="student-state" class="form-input" required>
                <option value="California" selected>California</option>
                <option value="New York">New York</option>
                <option value="Texas">Texas</option>
                <option value="Florida">Florida</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label for="learning-style">Learning Style</label>
              <select id="learning-style" class="form-input" required>
                <option value="experiential" selected>Experiential (hands-on)</option>
                <option value="structured">Structured (traditional)</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="student-interests">Interests (comma-separated)</label>
            <input type="text" id="student-interests" class="form-input"
                   value="marine biology, photography, architecture, food culture"
                   placeholder="e.g., science, art, history">
          </div>
          <div class="form-group">
            <label for="subjects">Subjects to Cover (comma-separated)</label>
            <input type="text" id="subjects" class="form-input"
                   value="science, social studies, language arts" required>
          </div>
        </div>

        <div class="form-section">
          <h4>Destination Details</h4>
          <div class="form-info">
            <div><strong>Location:</strong> ${location.name}, ${location.country}</div>
            <div><strong>Duration:</strong> ${location.duration_days || 1} days</div>
            ${location.arrival_date ? `<div><strong>Dates:</strong> ${location.arrival_date} to ${location.departure_date || 'TBD'}</div>` : ''}
            ${highlightsArray.length > 0 ? `<div><strong>Highlights:</strong> ${highlightsArray.join(', ')}</div>` : ''}
          </div>
        </div>

        <div class="form-section generation-status" id="generation-status" style="display: none;">
          <div class="loading-spinner"></div>
          <p id="generation-message">Generating curriculum...</p>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="cancel-curriculum-btn">Cancel</button>
          <button type="submit" class="btn-primary" id="generate-curriculum-btn">
            ✨ Generate Curriculum
          </button>
        </div>
      </form>
    </div>
  `;

  // Show modal
  modal.style.display = 'flex';

  // Handle cancel
  const cancelBtn = modal.querySelector('#cancel-curriculum-btn');
  cancelBtn?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Handle form submission
  const form = modal.querySelector('#curriculum-generation-form') as HTMLFormElement;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const statusSection = modal.querySelector('#generation-status') as HTMLElement;
    const messageEl = modal.querySelector('#generation-message') as HTMLElement;
    const submitBtn = modal.querySelector('#generate-curriculum-btn') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#cancel-curriculum-btn') as HTMLButtonElement;

    // Disable buttons and show loading
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    statusSection.style.display = 'block';
    messageEl.textContent = 'Generating curriculum with AI...';

    try {
      const interests = (document.getElementById('student-interests') as HTMLInputElement).value
        .split(',').map(s => s.trim()).filter(Boolean);
      const subjects = (document.getElementById('subjects') as HTMLInputElement).value
        .split(',').map(s => s.trim()).filter(Boolean);

      const request: GenerateCurriculumRequest = {
        student: {
          name: (document.getElementById('student-name') as HTMLInputElement).value,
          age: parseInt((document.getElementById('student-age') as HTMLInputElement).value),
          grade: parseInt((document.getElementById('student-grade') as HTMLInputElement).value),
          state: (document.getElementById('student-state') as HTMLSelectElement).value,
          learning_style: (document.getElementById('learning-style') as HTMLSelectElement).value,
          time_budget_minutes_per_day: 60,
          reading_level: parseInt((document.getElementById('student-grade') as HTMLInputElement).value) + 2,
          interests
        },
        location: {
          id: location.id,
          name: location.name,
          country: location.country,
          region: location.region,
          duration_days: location.duration_days || 1,
          arrival_date: location.arrival_date,
          departure_date: location.departure_date,
          activity_type: location.activity_type,
          highlights: highlightsArray,
          trip_scenario_id: scenarioId,
          trip_version_id: versionId
        },
        subjects
      };

      messageEl.textContent = 'Generating curriculum (this may take 30-60 seconds)...';

      const response = await educationService.generateCurriculum(request);

      if (response.status === 'success') {
        messageEl.textContent = '✅ Curriculum generated successfully!';
        messageEl.style.color = '#48bb78';

        // Wait a moment then close modal and refresh education section
        setTimeout(() => {
          modal.style.display = 'none';

          // Trigger a refresh of the destination's education section
          const event = new CustomEvent('curriculum-generated', {
            detail: { locationId: location.id, curriculumId: response.saved_ids?.curriculum_plan_id }
          });
          window.dispatchEvent(event);
        }, 1500);
      } else {
        throw new Error(response.error || 'Failed to generate curriculum');
      }
    } catch (error) {
      console.error('Error generating curriculum:', error);
      messageEl.textContent = `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      messageEl.style.color = '#f56565';
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });
}

/**
 * Show curriculum viewer modal
 */
export async function showCurriculumViewerModal(curriculumId: string) {
  try {
    const response = await educationService.getCurriculum(curriculumId);
    const curriculum = response.curriculum;

    // Get the first location's lessons
    const locationLessons = Object.values(curriculum.location_lessons)[0] as any;

    let modal = document.getElementById('curriculum-viewer-modal');

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'curriculum-viewer-modal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }

    // Count activities
    const expActivities = locationLessons?.on_location?.experiential_activities || [];
    const structuredLessons = locationLessons?.on_location?.structured_lessons || [];
    const readings = locationLessons?.pre_trip?.readings || [];
    const videos = locationLessons?.pre_trip?.videos || [];

    modal.innerHTML = `
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>${curriculum.semester.title}</h3>
          <button class="modal-close-btn" id="close-viewer-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="curriculum-meta-bar">
            <span>📅 ${curriculum.semester.start_date} to ${curriculum.semester.end_date}</span>
            <span>📍 ${curriculum.location_name}</span>
            <span class="status-badge status-${curriculum.status}">${curriculum.status}</span>
          </div>

          <div class="curriculum-tabs">
            <button class="tab-btn active" data-tab="overview">Overview</button>
            <button class="tab-btn" data-tab="pretrip">Pre-Trip (${readings.length + videos.length})</button>
            <button class="tab-btn" data-tab="onlocation">On-Location (${expActivities.length + structuredLessons.length})</button>
            <button class="tab-btn" data-tab="posttrip">Post-Trip</button>
          </div>

          <div class="tab-content active" id="tab-overview">
            <h4>Overview</h4>
            <div class="overview-stats">
              <div class="stat-card">
                <div class="stat-value">${curriculum.semester.total_weeks}</div>
                <div class="stat-label">Weeks</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${expActivities.length}</div>
                <div class="stat-label">Experiential Activities</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${structuredLessons.length}</div>
                <div class="stat-label">Structured Lessons</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${readings.length}</div>
                <div class="stat-label">Readings</div>
              </div>
            </div>
          </div>

          <div class="tab-content" id="tab-pretrip">
            <h4>Pre-Trip Preparation</h4>
            ${renderPreTrip(locationLessons?.pre_trip)}
          </div>

          <div class="tab-content" id="tab-onlocation">
            <h4>On-Location Activities</h4>
            ${renderOnLocation(locationLessons?.on_location)}
          </div>

          <div class="tab-content" id="tab-posttrip">
            <h4>Post-Trip Reflection</h4>
            ${renderPostTrip(locationLessons?.post_trip)}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="close-viewer-bottom-btn">Close</button>
          <button class="btn-primary" onclick="window.open('/curriculum-test.html', '_blank')">
            Open in Full Editor
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Handle close buttons
    modal.querySelector('#close-viewer-btn')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    modal.querySelector('#close-viewer-bottom-btn')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Handle tab switching
    modal.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = (btn as HTMLElement).dataset.tab;
        modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        modal.querySelector(`#tab-${tabName}`)?.classList.add('active');
      });
    });

  } catch (error) {
    console.error('Error loading curriculum:', error);
    alert(`Failed to load curriculum: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function renderPreTrip(preTrip: any): string {
  if (!preTrip) return '<p>No pre-trip content available.</p>';

  const readings = preTrip.readings || [];
  const videos = preTrip.videos || [];
  const tasks = preTrip.preparation_tasks || [];

  return `
    ${readings.length > 0 ? `
      <div class="content-section">
        <h5>📖 Readings</h5>
        ${readings.map((r: any) => `
          <div class="content-item">
            <div class="content-title">${r.title}</div>
            <div class="content-meta">${r.source} • ${r.reading_time_minutes} min</div>
            <div class="content-desc">${r.description}</div>
            ${r.url ? `<a href="${r.url}" target="_blank" class="content-link">Read →</a>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${videos.length > 0 ? `
      <div class="content-section">
        <h5>🎥 Videos</h5>
        ${videos.map((v: any) => `
          <div class="content-item">
            <div class="content-title">${v.title}</div>
            <div class="content-meta">${v.source} • ${v.duration_minutes} min</div>
            <div class="content-desc">${v.description}</div>
            ${v.url ? `<a href="${v.url}" target="_blank" class="content-link">Watch →</a>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${tasks.length > 0 ? `
      <div class="content-section">
        <h5>✅ Preparation Tasks</h5>
        ${tasks.map((t: any) => `
          <div class="content-item">
            <div class="content-title">${t.title}</div>
            <div class="content-desc">${t.description}</div>
            <div class="content-meta">${t.estimated_duration_minutes} minutes</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

function renderOnLocation(onLocation: any): string {
  if (!onLocation) return '<p>No on-location content available.</p>';

  const expActivities = onLocation.experiential_activities || [];
  const structuredLessons = onLocation.structured_lessons || [];

  return `
    ${expActivities.length > 0 ? `
      <div class="content-section">
        <h5>🌍 Experiential Activities</h5>
        ${expActivities.map((a: any) => `
          <div class="activity-item">
            <div class="activity-header">
              <div class="activity-title">${a.title}</div>
              <div class="activity-meta">
                <span class="subject-badge">${a.subject}</span>
                <span>${a.estimated_duration_minutes} min</span>
              </div>
            </div>
            <div class="activity-desc">${a.description}</div>
            ${a.site_details ? `
              <div class="site-details">
                <strong>📍 ${a.site_details.name}</strong>
                ${a.site_details.address ? `<div>${a.site_details.address}</div>` : ''}
                ${a.site_details.best_time ? `<div>⏰ ${a.site_details.best_time}</div>` : ''}
                ${a.site_details.cost_usd ? `<div>💵 $${a.site_details.cost_usd}</div>` : ''}
              </div>
            ` : ''}
            ${a.learning_objectives?.length > 0 ? `
              <div class="learning-objectives">
                <strong>Learning Objectives:</strong>
                <ul>
                  ${a.learning_objectives.map((obj: string) => `<li>${obj}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${structuredLessons.length > 0 ? `
      <div class="content-section">
        <h5>📝 Structured Lessons</h5>
        ${structuredLessons.map((l: any) => `
          <div class="activity-item">
            <div class="activity-header">
              <div class="activity-title">${l.title}</div>
              <div class="activity-meta">
                <span class="subject-badge">${l.subject}</span>
                <span>${l.estimated_duration_minutes} min</span>
              </div>
            </div>
            <div class="activity-desc">${l.description}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

function renderPostTrip(postTrip: any): string {
  if (!postTrip) return '<p>No post-trip content available.</p>';

  const reflectionPrompts = postTrip.reflection_prompts || [];
  const synthesisActivities = postTrip.synthesis_activities || [];

  return `
    ${reflectionPrompts.length > 0 ? `
      <div class="content-section">
        <h5>💭 Reflection Prompts</h5>
        ${reflectionPrompts.map((p: any) => `
          <div class="content-item">
            <div class="content-desc">${p.text || p.prompt || p.question}</div>
            <div class="content-meta">
              ${p.type || 'journal'} • ${p.word_count_target || p.word_count || 300} words
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${synthesisActivities.length > 0 ? `
      <div class="content-section">
        <h5>✍️ Synthesis Activities</h5>
        ${synthesisActivities.map((a: any) => `
          <div class="content-item">
            <div class="content-title">${a.title}</div>
            <div class="content-desc">${a.description}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

/**
 * Initialize education UI for all destinations
 */
export function initializeEducationUI(scenarioId?: string, versionId?: string) {
  // Listen for generate curriculum button clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains('btn-generate-curriculum') || target.closest('.btn-generate-curriculum')) {
      const btn = target.closest('.btn-generate-curriculum') as HTMLElement;
      const locationId = btn?.dataset.locationId;

      if (locationId) {
        // Find the location data
        const locationElement = document.querySelector(`[data-location-id="${locationId}"]`);
        if (locationElement) {
          // Get location data from the working data or element
          const location = (window as any).appWorkingData?.locations?.find((l: any) => String(l.id) === String(locationId));

          if (location) {
            showCurriculumGenerationModal(location, scenarioId, versionId);
          }
        }
      }
    }

    if (target.classList.contains('btn-view-curriculum') || target.closest('.btn-view-curriculum')) {
      const btn = target.closest('.btn-view-curriculum') as HTMLElement;
      const curriculumId = btn?.dataset.curriculumId;

      if (curriculumId) {
        showCurriculumViewerModal(curriculumId);
      }
    }

    // Toggle education section
    if (target.closest('.education-header')) {
      const header = target.closest('.education-header') as HTMLElement;
      const toggleId = header.dataset.toggle;

      if (toggleId) {
        const content = document.getElementById(toggleId);
        const section = header.closest('.education-section');
        const toggleIcon = header.querySelector('.education-toggle');

        if (content && section) {
          section.classList.toggle('expanded');
          if (toggleIcon) {
            toggleIcon.textContent = section.classList.contains('expanded') ? '▼' : '▶';
          }
        }
      }
    }
  });

  // Listen for curriculum generated events
  window.addEventListener('curriculum-generated', async (e: Event) => {
    const event = e as CustomEvent;
    const { locationId } = event.detail;

    // Reload the education section for this location
    const educationSection = document.querySelector(`.education-section[data-location-id="${locationId}"]`);
    if (educationSection) {
      const location = (window as any).appWorkingData?.locations?.find((l: any) => String(l.id) === String(locationId));
      if (location) {
        const newHTML = await loadEducationSection(location);
        educationSection.outerHTML = newHTML;
      }
    }
  });
}
