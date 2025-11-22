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
        <div class="education-summary">
          <button class="btn-generate-curriculum" data-location-id="${location.id}">
            <span>✨ Generate Curriculum</span>
          </button>
        </div>
      </div>
    `;
  }

  // Show existing curricula
  const mostRecent = curricula[0]; // Assuming sorted by created_at DESC
  const destinationName = location?.name || location?.city || (mostRecent.semester?.title?.replace('Learning Journey: ', '') || 'Destination');

  // Calculate overview stats from location lessons
  let totalActivities = 0;
  let totalLessons = 0;
  let totalReadings = 0;

  const locationLesson = mostRecent.location_lessons?.[location.id];
  if (locationLesson) {
    totalActivities = (locationLesson.on_location?.experiential_activities?.length || 0);
    totalLessons = (locationLesson.on_location?.structured_lessons?.length || 0) +
                   (locationLesson.pre_trip?.lessons?.length || 0);
    totalReadings = (locationLesson.pre_trip?.readings?.length || 0);
  }

  // Count items per section for badges
  const preTripCount = (locationLesson?.pre_trip?.lessons?.length || 0) +
                       (locationLesson?.pre_trip?.readings?.length || 0) +
                       (locationLesson?.pre_trip?.videos?.length || 0) +
                       (locationLesson?.pre_trip?.preparation_tasks?.length || 0);

  const onLocationCount = totalActivities + totalLessons;

  const postTripCount = (locationLesson?.post_trip?.reflection_prompts?.length || 0) +
                        (locationLesson?.post_trip?.synthesis_activities?.length || 0) +
                        (locationLesson?.post_trip?.assessment_tasks?.length || 0);

  // Build compact summary for collapsed state
  const summaryParts = [];
  if (totalActivities > 0) summaryParts.push(`${totalActivities} ${totalActivities === 1 ? 'activity' : 'activities'}`);
  if (totalReadings > 0) summaryParts.push(`${totalReadings} ${totalReadings === 1 ? 'reading' : 'readings'}`);
  const summaryText = summaryParts.join(' • ');

  return `
    <div class="education-section" data-location-id="${location.id}">
      <div class="education-summary-compact" data-toggle="education-details-${location.id}">
        <div class="education-summary-left">
          <span class="education-icon">📚</span>
          <span class="education-title">${destinationName}</span>
          ${summaryText ? `<span class="education-meta-compact"> • ${summaryText}</span>` : ''}
        </div>
        <div class="education-summary-right">
          <span class="education-toggle-text">▾ Details</span>
        </div>
      </div>
      <div class="education-details" id="education-details-${location.id}">
        <div class="curriculum-status-row">
          <span class="curriculum-status-compact status-${mostRecent.status}">${mostRecent.status.toUpperCase()}</span>
          ${mostRecent.semester?.title ? `<span class="curriculum-semester-label">${mostRecent.semester.title}</span>` : ''}
        </div>
        ${locationLesson ? generateLocationDetailsHTML(locationLesson, location.id, preTripCount, onLocationCount, postTripCount) : '<p class="education-hint">No curriculum content for this location yet.</p>'}
        <div class="education-actions">
          <button class="btn-view-curriculum" data-curriculum-id="${mostRecent.id}">
            <span>👁️ View Full Details</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate nested expandable sections for Pre-Trip, On-Location, Post-Trip
 */
function generateLocationDetailsHTML(
  locationLesson: any,
  locationId: string,
  preCount: number,
  onCount: number,
  postCount: number
): string {
  return `
    ${preCount > 0 ? `
      <div class="education-subsection">
        <div class="education-subsection-header" data-toggle="pre-trip-${locationId}">
          <span class="subsection-icon">📖</span>
          <span>Pre-Trip</span>
          <span class="subsection-count">${preCount}</span>
          <span class="subsection-toggle">▶</span>
        </div>
        <div class="education-subsection-content" id="pre-trip-${locationId}">
          ${generatePreTripContentHTML(locationLesson.pre_trip)}
        </div>
      </div>
    ` : ''}

    ${onCount > 0 ? `
      <div class="education-subsection">
        <div class="education-subsection-header" data-toggle="on-location-${locationId}">
          <span class="subsection-icon">📍</span>
          <span>On-Location</span>
          <span class="subsection-count">${onCount}</span>
          <span class="subsection-toggle">▶</span>
        </div>
        <div class="education-subsection-content" id="on-location-${locationId}">
          ${generateOnLocationContentHTML(locationLesson.on_location)}
        </div>
      </div>
    ` : ''}

    ${postCount > 0 ? `
      <div class="education-subsection">
        <div class="education-subsection-header" data-toggle="post-trip-${locationId}">
          <span class="subsection-icon">✈️</span>
          <span>Post-Trip</span>
          <span class="subsection-count">${postCount}</span>
          <span class="subsection-toggle">▶</span>
        </div>
        <div class="education-subsection-content" id="post-trip-${locationId}">
          ${generatePostTripContentHTML(locationLesson.post_trip)}
        </div>
      </div>
    ` : ''}
  `;
}

/**
 * Generate Pre-Trip content list with full details
 */
function generatePreTripContentHTML(preTrip: any): string {
  if (!preTrip) return '<p class="education-empty">No pre-trip content</p>';

  let html = '';

  // Readings
  if (preTrip.readings?.length > 0) {
    html += '<div style="margin-bottom: 16px;"><strong style="font-size: 13px; color: #333;">📚 Readings</strong>';
    preTrip.readings.forEach((reading: any) => {
      html += `
        <div style="margin: 8px 0; padding: 12px; background: white; border-left: 3px solid #1e88e5; border-radius: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${reading.title}</div>
          <div style="font-size: 12px; color: #999; margin-bottom: 6px;">${reading.source || ''} ${reading.reading_time_minutes ? `• ${reading.reading_time_minutes} min` : ''}</div>
          ${reading.description ? `<div style="font-size: 13px; color: #666; line-height: 1.5;">${reading.description}</div>` : ''}
          ${reading.url ? `<a href="${reading.url}" target="_blank" style="font-size: 12px; color: #1e88e5; text-decoration: none; margin-top: 6px; display: inline-block;">Read →</a>` : ''}
        </div>`;
    });
    html += '</div>';
  }

  // Videos
  if (preTrip.videos?.length > 0) {
    html += '<div style="margin-bottom: 16px;"><strong style="font-size: 13px; color: #333;">🎥 Videos</strong>';
    preTrip.videos.forEach((video: any) => {
      html += `
        <div style="margin: 8px 0; padding: 12px; background: white; border-left: 3px solid #1e88e5; border-radius: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${video.title}</div>
          <div style="font-size: 12px; color: #999; margin-bottom: 6px;">${video.source || ''} ${video.duration_minutes ? `• ${video.duration_minutes} min` : ''}</div>
          ${video.description ? `<div style="font-size: 13px; color: #666; line-height: 1.5;">${video.description}</div>` : ''}
          ${video.url ? `<a href="${video.url}" target="_blank" style="font-size: 12px; color: #1e88e5; text-decoration: none; margin-top: 6px; display: inline-block;">Watch →</a>` : ''}
        </div>`;
    });
    html += '</div>';
  }

  // Lessons
  if (preTrip.lessons?.length > 0) {
    html += '<div style="margin-bottom: 16px;"><strong style="font-size: 13px; color: #333;">📖 Lessons</strong>';
    preTrip.lessons.forEach((lesson: any) => {
      html += `
        <div style="margin: 8px 0; padding: 12px; background: white; border-left: 3px solid #1e88e5; border-radius: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${lesson.title}</div>
          ${lesson.description ? `<div style="font-size: 13px; color: #666; line-height: 1.5;">${lesson.description}</div>` : ''}
        </div>`;
    });
    html += '</div>';
  }

  // Preparation Tasks
  if (preTrip.preparation_tasks?.length > 0) {
    html += '<div style="margin-bottom: 16px;"><strong style="font-size: 13px; color: #333;">✅ Preparation Tasks</strong>';
    preTrip.preparation_tasks.forEach((task: any) => {
      html += `
        <div style="margin: 8px 0; padding: 12px; background: white; border-left: 3px solid #1e88e5; border-radius: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${task.title}</div>
          ${task.description ? `<div style="font-size: 13px; color: #666; line-height: 1.5;">${task.description}</div>` : ''}
          ${task.estimated_duration_minutes ? `<div style="font-size: 12px; color: #999; margin-top: 4px;">${task.estimated_duration_minutes} minutes</div>` : ''}
        </div>`;
    });
    html += '</div>';
  }

  return html || '<p class="education-empty">No pre-trip content</p>';
}

/**
 * Generate On-Location content list with full activity details
 */
function generateOnLocationContentHTML(onLocation: any): string {
  if (!onLocation) return '<p class="education-empty">No on-location content</p>';

  let html = '';

  // Experiential Activities
  if (onLocation.experiential_activities?.length > 0) {
    html += '<div style="margin-bottom: 16px;"><strong style="font-size: 13px; color: #333;">🌍 Experiential Activities</strong>';
    onLocation.experiential_activities.forEach((activity: any) => {
      html += `
        <div style="margin: 8px 0; padding: 12px; background: white; border-left: 3px solid #1e88e5; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="font-weight: 600; font-size: 14px;">${activity.title}</div>
            <div style="display: flex; gap: 8px; align-items: center; font-size: 11px;">
              ${activity.subject ? `<span style="background: #e3f2fd; color: #1e88e5; padding: 3px 8px; border-radius: 10px; font-weight: 600;">${activity.subject}</span>` : ''}
              ${activity.estimated_duration_minutes ? `<span style="color: #999;">${activity.estimated_duration_minutes} min</span>` : ''}
            </div>
          </div>
          ${activity.description ? `<div style="font-size: 13px; color: #666; line-height: 1.6; margin-bottom: 8px;">${activity.description}</div>` : ''}
          ${activity.site_details ? `
            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; font-size: 12px; margin-top: 8px;">
              <strong style="color: #856404;">📍 ${activity.site_details.name}</strong>
              ${activity.site_details.address ? `<div style="color: #856404; margin-top: 4px;">${activity.site_details.address}</div>` : ''}
            </div>
          ` : ''}
          ${activity.external_links && activity.external_links.length > 0 ? `
            <div style="margin-top: 8px;">
              ${activity.external_links.map((link: string) => `<a href="${link}" target="_blank" style="font-size: 12px; color: #1e88e5; text-decoration: none; margin-right: 12px;">🔗 Link</a>`).join('')}
            </div>
          ` : ''}
        </div>`;
    });
    html += '</div>';
  }

  // Structured Lessons
  if (onLocation.structured_lessons?.length > 0) {
    html += '<div style="margin-bottom: 16px;"><strong style="font-size: 13px; color: #333;">📝 Structured Lessons</strong>';
    onLocation.structured_lessons.forEach((lesson: any) => {
      html += `
        <div style="margin: 8px 0; padding: 12px; background: white; border-left: 3px solid #1e88e5; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div style="font-weight: 600; font-size: 14px;">${lesson.title}</div>
            <div style="display: flex; gap: 8px; align-items: center; font-size: 11px;">
              ${lesson.subject ? `<span style="background: #e3f2fd; color: #1e88e5; padding: 3px 8px; border-radius: 10px; font-weight: 600;">${lesson.subject}</span>` : ''}
              ${lesson.estimated_duration_minutes ? `<span style="color: #999;">${lesson.estimated_duration_minutes} min</span>` : ''}
            </div>
          </div>
          ${lesson.description ? `<div style="font-size: 13px; color: #666; line-height: 1.6;">${lesson.description}</div>` : ''}
        </div>`;
    });
    html += '</div>';
  }

  // Field Trip Guides
  if (onLocation.field_trip_guides?.length > 0) {
    html += '<div style="margin-bottom: 16px;"><strong style="font-size: 13px; color: #333;">🗺️ Field Trip Guides</strong>';
    onLocation.field_trip_guides.forEach((guide: any) => {
      html += `
        <div style="margin: 8px 0; padding: 12px; background: white; border-left: 3px solid #1e88e5; border-radius: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${guide.site_name}</div>
          ${guide.description ? `<div style="font-size: 13px; color: #666; line-height: 1.5;">${guide.description}</div>` : ''}
        </div>`;
    });
    html += '</div>';
  }

  return html || '<p class="education-empty">No on-location content</p>';
}

/**
 * Generate Post-Trip content list with full details
 */
function generatePostTripContentHTML(postTrip: any): string {
  if (!postTrip) return '<p class="education-empty">No post-trip content</p>';

  let html = '';

  // Reflection Prompts
  if (postTrip.reflection_prompts?.length > 0) {
    html += '<div style="margin-bottom: 16px;"><strong style="font-size: 13px; color: #333;">💭 Reflection Prompts</strong>';
    postTrip.reflection_prompts.forEach((prompt: any) => {
      html += `
        <div style="margin: 8px 0; padding: 12px; background: white; border-left: 3px solid #1e88e5; border-radius: 4px;">
          <div style="font-size: 13px; color: #666; line-height: 1.6;">${prompt.text || prompt.prompt || prompt.question}</div>
          <div style="font-size: 12px; color: #999; margin-top: 6px;">${prompt.type || 'journal'} • ${prompt.word_count_target || prompt.word_count || 300} words</div>
        </div>`;
    });
    html += '</div>';
  }

  // Synthesis Activities
  if (postTrip.synthesis_activities?.length > 0) {
    html += '<div style="margin-bottom: 16px;"><strong style="font-size: 13px; color: #333;">🎨 Synthesis Activities</strong>';
    postTrip.synthesis_activities.forEach((activity: any) => {
      html += `
        <div style="margin: 8px 0; padding: 12px; background: white; border-left: 3px solid #1e88e5; border-radius: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${activity.title}</div>
          ${activity.description ? `<div style="font-size: 13px; color: #666; line-height: 1.5;">${activity.description}</div>` : ''}
        </div>`;
    });
    html += '</div>';
  }

  // Assessment Tasks
  if (postTrip.assessment_tasks?.length > 0) {
    html += '<div style="margin-bottom: 16px;"><strong style="font-size: 13px; color: #333;">✅ Assessment Tasks</strong>';
    postTrip.assessment_tasks.forEach((task: any) => {
      html += `
        <div style="margin: 8px 0; padding: 12px; background: white; border-left: 3px solid #1e88e5; border-radius: 4px;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${task.title}</div>
          ${task.description ? `<div style="font-size: 13px; color: #666; line-height: 1.5;">${task.description}</div>` : ''}
        </div>`;
    });
    html += '</div>';
  }

  return html || '<p class="education-empty">No post-trip content</p>';
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
      } else if (response.status === 'partial_success') {
        messageEl.textContent = '⚠️ Curriculum generated with formatting issues. Please try again.';
        messageEl.style.color = '#f6ad55';
        console.warn('Partial success - JSON parsing failed:', response.error);
        console.log('Raw curriculum text:', response.raw_text);
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
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
export async function showCurriculumViewerModal(curriculumId: string, isEditMode = false) {
  try {
    const response = await educationService.getCurriculum(curriculumId);
    const curriculum = response.curriculum;

    // Get the first location's lessons
    const locationLessons = Object.values(curriculum.location_lessons)[0] as any;
    const locationId = Object.keys(curriculum.location_lessons)[0];

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
          <div style="display: flex; align-items: center; gap: 1rem;">
            <h3>${curriculum.semester.title}</h3>
            <label class="toggle-switch" style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer;">
              <input type="checkbox" id="edit-mode-toggle" ${isEditMode ? 'checked' : ''}>
              <span>Edit Mode</span>
            </label>
          </div>
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
            ${renderPreTrip(locationLessons?.pre_trip, isEditMode)}
          </div>

          <div class="tab-content" id="tab-onlocation">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h4>On-Location Activities</h4>
              ${isEditMode ? `
                <button class="btn-primary btn-sm" id="add-activity-btn">
                  + Add Activity
                </button>
              ` : ''}
            </div>
            ${renderOnLocation(locationLessons?.on_location, isEditMode)}
          </div>

          <div class="tab-content" id="tab-posttrip">
            <h4>Post-Trip Reflection</h4>
            ${renderPostTrip(locationLessons?.post_trip, isEditMode)}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="close-viewer-bottom-btn">Close</button>
          ${isEditMode ? `
            <button class="btn-primary" id="save-curriculum-btn">Save Changes</button>
          ` : `
            <button class="btn-primary" onclick="window.open('/curriculum-test.html', '_blank')">
              Open in Full Editor
            </button>
          `}
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Bind Events
    const close = () => { if (modal) modal.style.display = 'none'; };
    modal.querySelector('#close-viewer-btn')?.addEventListener('click', close);
    modal.querySelector('#close-viewer-bottom-btn')?.addEventListener('click', close);

    // Edit Mode Toggle
    modal.querySelector('#edit-mode-toggle')?.addEventListener('change', (e) => {
      showCurriculumViewerModal(curriculumId, (e.target as HTMLInputElement).checked);
    });

    // Add Activity Button
    modal.querySelector('#add-activity-btn')?.addEventListener('click', () => {
      showAddCustomActivityModal(curriculumId, locationId);
    });

    // Helper to scrape current state
    const getUpdatedLocationLessons = () => {
      const updatedLessons = JSON.parse(JSON.stringify(locationLessons));
      modal?.querySelectorAll('[contenteditable]').forEach((el) => {
        const sectionPath = (el as HTMLElement).dataset.section;
        const indexStr = (el as HTMLElement).dataset.index;
        const field = (el as HTMLElement).dataset.field;

        if (sectionPath && indexStr && field) {
          const index = parseInt(indexStr, 10);
          const parts = sectionPath.split('.');
          let current = updatedLessons;
          for (const part of parts) {
            if (!current[part]) current[part] = [];
            current = current[part];
          }
          if (Array.isArray(current) && current[index]) {
            current[index][field] = (el as HTMLElement).innerText.trim();
          }
        }
      });
      return updatedLessons;
    };

    // Save Changes Button
    modal.querySelector('#save-curriculum-btn')?.addEventListener('click', async () => {
      try {
        const btn = modal?.querySelector('#save-curriculum-btn') as HTMLButtonElement;
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Saving...';
        }

        const updatedLessons = getUpdatedLocationLessons();
        const updates = { location_lessons: { [locationId]: updatedLessons } };

        await educationService.updateCurriculum(curriculumId, updates);

        alert('Changes saved successfully!');
        showCurriculumViewerModal(curriculumId, false);

      } catch (error) {
        console.error('Error saving curriculum:', error);
        alert(`Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        const btn = modal?.querySelector('#save-curriculum-btn') as HTMLButtonElement;
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Save Changes';
        }
      }
    });

    // Add Item Buttons
    modal.querySelectorAll('.add-item-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const section = (e.currentTarget as HTMLElement).dataset.section;
        if (!section) return;

        try {
          const updatedLessons = getUpdatedLocationLessons();

          // Navigate to section
          const parts = section.split('.');
          let current = updatedLessons;
          for (const part of parts) {
            if (!current[part]) current[part] = {}; // Ensure object exists for path
            current = current[part];
          }

          // Add placeholder item based on section
          const newItem = getPlaceholderItem(parts[parts.length - 1]);
          if (Array.isArray(current)) {
            current.push(newItem);
          } else {
            // If it's not an array yet (e.g., first item being added), make it an array
            const parentPath = parts.slice(0, -1);
            let parent = updatedLessons;
            for (const part of parentPath) {
              parent = parent[part];
            }
            parent[parts[parts.length - 1]] = [newItem];
          }

          const updates = { location_lessons: { [locationId]: updatedLessons } };
          await educationService.updateCurriculum(curriculumId, updates);
          showCurriculumViewerModal(curriculumId, true); // Reload in edit mode

        } catch (error) {
          console.error('Error adding item:', error);
          alert('Failed to add item.');
        }
      });
    });

    // Tab Switching
    modal.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = (btn as HTMLElement).dataset.tab;
        modal?.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        modal?.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        modal?.querySelector(`#tab-${tabName}`)?.classList.add('active');
      });
    });

    // Listen for activity added event to refresh
    const refreshHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.planId === curriculumId) {
        showCurriculumViewerModal(curriculumId, true); // Keep edit mode on
      }
    };
    window.removeEventListener('activity-added', refreshHandler); // Avoid duplicates if possible (though anonymous function makes it hard)
    // Actually, we should use a named handler or just rely on the modal being rebuilt.
    // Since we rebuild the modal, the old listeners are gone (garbage collected with the DOM elements).
    // But window listeners persist.
    // We should add { once: true } or manage cleanup.
    window.addEventListener('activity-added', refreshHandler, { once: true });

  } catch (error) {
    console.error('Error loading curriculum:', error);
    alert(`Failed to load curriculum: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getPlaceholderItem(type: string): any {
  switch (type) {
    case 'readings': return { title: 'New Reading', description: 'Description here', source: 'Source', reading_time_minutes: 15 };
    case 'videos': return { title: 'New Video', description: 'Description here', source: 'Source', duration_minutes: 10 };
    case 'preparation_tasks': return { title: 'New Task', description: 'Description here', estimated_duration_minutes: 20 };
    case 'experiential_activities': return { title: 'New Activity', description: 'Description here', subject: 'General', estimated_duration_minutes: 60 };
    case 'structured_lessons': return { title: 'New Lesson', description: 'Description here', subject: 'General', estimated_duration_minutes: 45 };
    case 'reflection_prompts': return { text: 'New Reflection Prompt', type: 'journal', word_count_target: 300 };
    case 'synthesis_activities': return { title: 'New Synthesis Activity', description: 'Description here' };
    default: return { title: 'New Item', description: 'Description' };
  }
}

function renderPreTrip(preTrip: any, isEditMode: boolean): string {
  if (!preTrip && !isEditMode) return '<p>No pre-trip content available.</p>';

  const readings = preTrip?.readings || [];
  const videos = preTrip?.videos || [];
  const tasks = preTrip?.preparation_tasks || [];

  return `
    <div class="content-section">
      <h5>📖 Readings</h5>
      ${readings.map((r: any, i: number) => `
        <div class="content-item">
          <div class="content-title" ${isEditMode ? `contenteditable="true" data-section="pre_trip.readings" data-index="${i}" data-field="title"` : ''}>${r.title}</div>
          <div class="content-meta">${r.source} • ${r.reading_time_minutes} min</div>
          <div class="content-desc" ${isEditMode ? `contenteditable="true" data-section="pre_trip.readings" data-index="${i}" data-field="description"` : ''}>${r.description}</div>
          ${r.url ? `<a href="${r.url}" target="_blank" class="content-link">Read →</a>` : ''}
        </div>
      `).join('')}
      ${isEditMode ? `<button class="btn-sm btn-outline add-item-btn" data-section="pre_trip.readings">+ Add Reading</button>` : ''}
    </div>

    <div class="content-section">
      <h5>🎥 Videos</h5>
      ${videos.map((v: any, i: number) => `
        <div class="content-item">
          <div class="content-title" ${isEditMode ? `contenteditable="true" data-section="pre_trip.videos" data-index="${i}" data-field="title"` : ''}>${v.title}</div>
          <div class="content-meta">${v.source} • ${v.duration_minutes} min</div>
          <div class="content-desc" ${isEditMode ? `contenteditable="true" data-section="pre_trip.videos" data-index="${i}" data-field="description"` : ''}>${v.description}</div>
          ${v.url ? `<a href="${v.url}" target="_blank" class="content-link">Watch →</a>` : ''}
        </div>
      `).join('')}
      ${isEditMode ? `<button class="btn-sm btn-outline add-item-btn" data-section="pre_trip.videos">+ Add Video</button>` : ''}
    </div>

    <div class="content-section">
      <h5>✅ Preparation Tasks</h5>
      ${tasks.map((t: any, i: number) => `
        <div class="content-item">
          <div class="content-title" ${isEditMode ? `contenteditable="true" data-section="pre_trip.preparation_tasks" data-index="${i}" data-field="title"` : ''}>${t.title}</div>
          <div class="content-desc" ${isEditMode ? `contenteditable="true" data-section="pre_trip.preparation_tasks" data-index="${i}" data-field="description"` : ''}>${t.description}</div>
          <div class="content-meta">${t.estimated_duration_minutes} minutes</div>
        </div>
      `).join('')}
      ${isEditMode ? `<button class="btn-sm btn-outline add-item-btn" data-section="pre_trip.preparation_tasks">+ Add Task</button>` : ''}
    </div>
  `;
}

function renderOnLocation(onLocation: any, isEditMode: boolean): string {
  if (!onLocation && !isEditMode) return '<p>No on-location content available.</p>';
  const expActivities = onLocation?.experiential_activities || [];
  const structuredLessons = onLocation?.structured_lessons || [];

  return `
    <div class="content-section">
      <h5>🌍 Experiential Activities</h5>
      ${expActivities.map((a: any, i: number) => `
        <div class="activity-item">
          <div class="activity-header">
            <div class="activity-title" ${isEditMode ? `contenteditable="true" data-section="on_location.experiential_activities" data-index="${i}" data-field="title"` : ''}>${a.title}</div>
            <div class="activity-meta">
              <span class="subject-badge">${a.subject}</span>
              <span>${a.estimated_duration_minutes} min</span>
            </div>
          </div>
          <div class="activity-desc" ${isEditMode ? `contenteditable="true" data-section="on_location.experiential_activities" data-index="${i}" data-field="description"` : ''}>${a.description}</div>
          ${a.external_links && a.external_links.length > 0 ? `
            <div class="external-links" style="margin-top: 0.5rem;">
              ${a.external_links.map((link: string) => `
                <a href="${link}" target="_blank" class="content-link" style="display: inline-flex; align-items: center; gap: 0.25rem;">🔗 ${link}</a>
              `).join('')}
            </div>
          ` : ''}
          ${a.site_details ? `
            <div class="site-details">
              <strong>📍 ${a.site_details.name}</strong>
              ${a.site_details.address ? `<div>${a.site_details.address}</div>` : ''}
            </div>
          ` : ''}
        </div>
      `).join('')}
      ${isEditMode ? `<button class="btn-sm btn-outline add-item-btn" data-section="on_location.experiential_activities">+ Add Activity</button>` : ''}
    </div>

    <div class="content-section">
      <h5>📝 Structured Lessons</h5>
      ${structuredLessons.map((l: any, i: number) => `
        <div class="activity-item">
          <div class="activity-header">
            <div class="activity-title" ${isEditMode ? `contenteditable="true" data-section="on_location.structured_lessons" data-index="${i}" data-field="title"` : ''}>${l.title}</div>
            <div class="activity-meta">
              <span class="subject-badge">${l.subject}</span>
              <span>${l.estimated_duration_minutes} min</span>
            </div>
          </div>
          <div class="activity-desc" ${isEditMode ? `contenteditable="true" data-section="on_location.structured_lessons" data-index="${i}" data-field="description"` : ''}>${l.description}</div>
        </div>
      `).join('')}
      ${isEditMode ? `<button class="btn-sm btn-outline add-item-btn" data-section="on_location.structured_lessons">+ Add Lesson</button>` : ''}
    </div>
  `;
}

function renderPostTrip(postTrip: any, isEditMode: boolean): string {
  if (!postTrip && !isEditMode) return '<p>No post-trip content available.</p>';
  const reflectionPrompts = postTrip?.reflection_prompts || [];
  const synthesisActivities = postTrip?.synthesis_activities || [];

  return `
    <div class="content-section">
      <h5>💭 Reflection Prompts</h5>
      ${reflectionPrompts.map((p: any, i: number) => `
        <div class="content-item">
          <div class="content-desc" ${isEditMode ? `contenteditable="true" data-section="post_trip.reflection_prompts" data-index="${i}" data-field="text"` : ''}>${p.text || p.prompt || p.question}</div>
          <div class="content-meta">${p.type || 'journal'} • ${p.word_count_target || p.word_count || 300} words</div>
        </div>
      `).join('')}
      ${isEditMode ? `<button class="btn-sm btn-outline add-item-btn" data-section="post_trip.reflection_prompts">+ Add Prompt</button>` : ''}
    </div>

    <div class="content-section">
      <h5>✍️ Synthesis Activities</h5>
      ${synthesisActivities.map((a: any, i: number) => `
        <div class="content-item">
          <div class="content-title" ${isEditMode ? `contenteditable="true" data-section="post_trip.synthesis_activities" data-index="${i}" data-field="title"` : ''}>${a.title}</div>
          <div class="content-desc" ${isEditMode ? `contenteditable="true" data-section="post_trip.synthesis_activities" data-index="${i}" data-field="description"` : ''}>${a.description}</div>
        </div>
      `).join('')}
      ${isEditMode ? `<button class="btn-sm btn-outline add-item-btn" data-section="post_trip.synthesis_activities">+ Add Activity</button>` : ''}
    </div>
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
      e.stopPropagation(); // Prevent destination card click
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
      e.stopPropagation(); // Prevent destination card click
      const btn = target.closest('.btn-view-curriculum') as HTMLElement;
      const curriculumId = btn?.dataset.curriculumId;

      if (curriculumId) {
        showCurriculumViewerModal(curriculumId);
      }
    }

    // Toggle education details (main expand/collapse) - compact design
    if (target.closest('.education-summary-compact')) {
      e.stopPropagation(); // Prevent destination card click
      const summary = target.closest('.education-summary-compact') as HTMLElement;
      const toggleId = summary.dataset.toggle;

      if (toggleId) {
        const detailsSection = document.getElementById(toggleId);
        const toggleText = summary.querySelector('.education-toggle-text');

        if (detailsSection) {
          detailsSection.classList.toggle('visible');
          summary.classList.toggle('expanded');
          if (toggleText) {
            toggleText.textContent = detailsSection.classList.contains('visible') ? '▴ Details' : '▾ Details';
          }
        }
      }
    }

    // Toggle education subsections (Pre-Trip, On-Location, Post-Trip)
    if (target.closest('.education-subsection-header')) {
      e.stopPropagation(); // Prevent destination card click
      const header = target.closest('.education-subsection-header') as HTMLElement;
      const toggleId = header.dataset.toggle;

      if (toggleId) {
        const content = document.getElementById(toggleId);
        const toggleIcon = header.querySelector('.subsection-toggle');

        if (content) {
          content.classList.toggle('visible');
          header.classList.toggle('expanded');
          if (toggleIcon) {
            toggleIcon.textContent = content.classList.contains('visible') ? '▼' : '▶';
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

/**
 * Show modal to add a custom activity
 */
export function showAddCustomActivityModal(planId: string, locationId: string) {
  let modal = document.getElementById('add-activity-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'add-activity-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal">
      <h3>Add Custom Activity</h3>
      <form class="modal-form" id="add-activity-form">
        <div class="form-group">
          <label for="activity-title">Activity Title</label>
          <input type="text" id="activity-title" class="form-input" required placeholder="e.g., Visit the Local Market">
        </div>
        
        <div class="form-group">
          <label for="activity-type">Type</label>
          <select id="activity-type" class="form-input">
            <option value="experiential">Experiential Activity</option>
            <option value="structured">Structured Lesson</option>
            <option value="reading">Reading</option>
            <option value="video">Video</option>
          </select>
        </div>

        <div class="form-group">
          <label for="activity-subject">Subject</label>
          <input type="text" id="activity-subject" class="form-input" placeholder="e.g., Social Studies">
        </div>

        <div class="form-group">
          <label for="activity-description">Description</label>
          <textarea id="activity-description" class="form-input" rows="3" required placeholder="Describe the activity..."></textarea>
        </div>

        <div class="form-group">
          <label for="activity-url">External Link (optional)</label>
          <input type="url" id="activity-url" class="form-input" placeholder="https://...">
        </div>

        <div class="form-group">
          <label for="activity-duration">Duration (minutes)</label>
          <input type="number" id="activity-duration" class="form-input" value="60" min="15" step="15">
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="cancel-add-activity-btn">Cancel</button>
          <button type="submit" class="btn-primary">Add Activity</button>
        </div>
      </form>
    </div>
  `;

  modal.style.display = 'flex';

  // Bind events
  modal.querySelector('#cancel-add-activity-btn')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  modal.querySelector('#add-activity-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = (document.getElementById('activity-title') as HTMLInputElement).value;
    const type = (document.getElementById('activity-type') as HTMLSelectElement).value;
    const subject = (document.getElementById('activity-subject') as HTMLInputElement).value;
    const description = (document.getElementById('activity-description') as HTMLTextAreaElement).value;
    const url = (document.getElementById('activity-url') as HTMLInputElement).value;
    const duration = parseInt((document.getElementById('activity-duration') as HTMLInputElement).value);

    const activityData = {
      location_id: locationId,
      title,
      type,
      subject,
      description,
      external_links: url ? [url] : [],
      estimated_duration_minutes: duration,
      is_custom: true
    };

    try {
      await educationService.addCustomActivity(planId, activityData);
      if (modal) modal.style.display = 'none';

      // Refresh viewer if open, or just alert success
      // Ideally we should trigger a refresh of the viewer
      const event = new CustomEvent('activity-added', { detail: { planId } });
      window.dispatchEvent(event);

      alert('Activity added successfully!');
    } catch (error) {
      console.error('Failed to add activity:', error);
      alert('Failed to add activity');
    }
  });
}
