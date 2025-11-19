
/**
 * Bulk Generation UI Logic
 * Handles the modal for generating curricula for multiple locations at once.
 */

export async function showBulkGenerationModal(studentId: string) {
    // 1. Create or get modal
    let modal = document.getElementById('bulk-generation-modal');
    if (!modal) {
        modal = createBulkGenerationModal();
        document.body.appendChild(modal);
    }

    // 2. Fetch destinations
    const destinations = await fetchDestinations();

    // 3. Render content
    renderModalContent(modal, destinations, studentId);

    // 4. Show modal
    modal.style.display = 'flex';
}

function createBulkGenerationModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.id = 'bulk-generation-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    modal.style.zIndex = '1000';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';

    return modal;
}

async function fetchDestinations() {
    try {
        const response = await fetch('/api/education/destinations');
        if (!response.ok) throw new Error('Failed to fetch destinations');
        const data = await response.json();
        console.log('✅ Fetched destinations:', data.destinations?.length || 0, 'destinations');
        return data.destinations || [];
    } catch (error) {
        console.error('❌ Error fetching destinations:', error);
        return [];
    }
}

function renderModalContent(modal: HTMLElement, destinations: any[], studentId: string) {
    console.log('📋 Rendering modal with', destinations.length, 'destinations');
    modal.innerHTML = `
        <div class="modal" style="background: #1e293b; padding: 2rem; border-radius: 1rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; color: #f8fafc;">
            <h2 style="margin-bottom: 1.5rem; font-size: 1.5rem;">Generate All Curricula</h2>

            <div id="bulk-step-1">
                <p style="margin-bottom: 1rem; color: #94a3b8;">Select locations to generate curriculum for:</p>
                
                <div class="actions" style="margin-bottom: 1rem; display: flex; gap: 1rem;">
                    <button id="select-all-btn" class="btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">Select All</button>
                    <button id="deselect-all-btn" class="btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">Deselect All</button>
                </div>

                <div class="locations-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem; margin-bottom: 2rem; max-height: 300px; overflow-y: auto; padding: 0.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem;">
                    ${destinations.length > 0 ? destinations.map(dest => `
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.25rem;">
                            <input type="checkbox" class="location-checkbox" value="${dest.id}" data-name="${dest.name}" data-country="${dest.country || ''}" data-days="${dest.days || 7}" data-arrival="${dest.arrival_date || ''}" data-departure="${dest.departure_date || ''}" checked>
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${dest.name}</span>
                        </label>
                    `).join('') : '<div style="padding: 2rem; text-align: center; color: #ef4444; grid-column: 1 / -1;">⚠️ No destinations found. Please create a trip scenario first.</div>'}
                </div>

                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">Focus Subjects</label>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <label><input type="checkbox" name="subject" value="science" checked> Science</label>
                        <label><input type="checkbox" name="subject" value="social_studies" checked> Social Studies</label>
                        <label><input type="checkbox" name="subject" value="language_arts" checked> Language Arts</label>
                        <label><input type="checkbox" name="subject" value="math"> Math</label>
                        <label><input type="checkbox" name="subject" value="art"> Art</label>
                    </div>
                </div>

                <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 1rem;">
                    <button id="cancel-bulk-btn" class="btn-outline" style="padding: 0.75rem 1.5rem; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: white; border-radius: 0.5rem; cursor: pointer;">Cancel</button>
                    <button id="start-generate-btn" class="btn-primary" style="padding: 0.75rem 1.5rem; background: #6366f1; color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 600;">Start Generation</button>
                </div>
            </div>

            <div id="bulk-step-2" style="display: none;">
                <div style="text-align: center; padding: 2rem;">
                    <div class="spinner" style="font-size: 2rem; margin-bottom: 1rem;">🔄</div>
                    <h3 id="progress-status">Generating curricula...</h3>
                    <div class="progress-bar" style="width: 100%; height: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; margin: 1.5rem 0; overflow: hidden;">
                        <div id="progress-fill" style="width: 0%; height: 100%; background: #10b981; transition: width 0.3s;"></div>
                    </div>
                    <p id="progress-details" style="color: #94a3b8;">0 of 0 completed</p>
                </div>
            </div>

            <div id="bulk-step-3" style="display: none;">
                <div style="text-align: center; padding: 2rem;">
                    <h3 style="font-size: 1.5rem; margin-bottom: 1rem;">Generation Complete!</h3>
                    <div id="results-summary" style="margin-bottom: 2rem;"></div>
                    <button id="close-bulk-btn" class="btn-primary" style="padding: 0.75rem 1.5rem; background: #6366f1; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">Close & Refresh</button>
                </div>
            </div>
        </div>
    `;

    // Bind events
    document.getElementById('cancel-bulk-btn')?.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    document.getElementById('select-all-btn')?.addEventListener('click', () => {
        modal.querySelectorAll<HTMLInputElement>('.location-checkbox').forEach(cb => cb.checked = true);
    });

    document.getElementById('deselect-all-btn')?.addEventListener('click', () => {
        modal.querySelectorAll<HTMLInputElement>('.location-checkbox').forEach(cb => cb.checked = false);
    });

    document.getElementById('start-generate-btn')?.addEventListener('click', () => {
        const selectedCheckboxes = Array.from(modal.querySelectorAll<HTMLInputElement>('.location-checkbox:checked'));
        const selectedLocations = selectedCheckboxes.map(cb => ({
            id: cb.value,
            name: cb.getAttribute('data-name') || '',
            country: cb.getAttribute('data-country') || '',
            duration_days: parseInt(cb.getAttribute('data-days') || '7'),
            arrival_date: cb.getAttribute('data-arrival') || '',
            departure_date: cb.getAttribute('data-departure') || ''
        }));

        const selectedSubjects = Array.from(modal.querySelectorAll<HTMLInputElement>('input[name="subject"]:checked')).map(cb => cb.value);

        if (selectedLocations.length === 0) {
            alert('Please select at least one location.');
            return;
        }

        startBulkGeneration(modal, selectedLocations, selectedSubjects, studentId);
    });

    document.getElementById('close-bulk-btn')?.addEventListener('click', () => {
        modal.style.display = 'none';
        window.location.reload(); // Refresh dashboard
    });
}

async function startBulkGeneration(modal: HTMLElement, locations: any[], subjects: string[], studentId: string) {
    const step1 = document.getElementById('bulk-step-1');
    const step2 = document.getElementById('bulk-step-2');
    const step3 = document.getElementById('bulk-step-3');
    const progressStatus = document.getElementById('progress-status');
    const progressFill = document.getElementById('progress-fill');
    const progressDetails = document.getElementById('progress-details');
    const resultsSummary = document.getElementById('results-summary');

    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';

    // Fetch student profile first
    let student = {};
    try {
        const resp = await fetch(`/api/education/students/${studentId}/dashboard`);
        const data = await resp.json();
        student = data.dashboard.student_profile;
    } catch (e) {
        console.error("Failed to fetch student", e);
        alert("Failed to fetch student profile");
        return;
    }

    // Call API
    // Since the backend loops, we just make one call.
    // BUT if it takes too long, it might timeout.
    // Ideally we'd chunk it or use the backend loop.
    // The user asked for "Live updates as each curriculum completes".
    // If the backend does it all in one go, we can't get live updates unless we stream.
    // Or we can loop here on the frontend.
    // "Loops through each location... Returns summary" -> Backend description.
    // "Progress bar showing 'Generating 15/43...'" -> Frontend description.
    // If I use the backend endpoint I implemented, it blocks until ALL are done.
    // So I should probably loop on the frontend to get the progress bar effect, 
    // calling the SINGLE generation endpoint (or the bulk one with 1 location at a time).
    // But the user explicitly asked for a "Bulk Generate Curricula Endpoint".
    // Maybe the backend endpoint is meant to be used for smaller batches?
    // Or maybe I should use the backend endpoint and just show a spinner?
    // "Bulk Curriculum Generation - Backend endpoint and frontend modal to generate curricula for all 43 trip locations at once with progress tracking"
    // "Progress tracking" implies we know the progress.
    // If I call the bulk endpoint with ALL locations, I won't get progress until the end.
    // So I will implement the frontend to call the bulk endpoint with *batches* or *single* locations?
    // OR I will assume the backend endpoint I wrote is fine and I'll just wait.
    // But 43 locations will timeout.
    // I'll implement frontend looping to call the bulk endpoint with batches of 1 (effectively single generation but using the bulk endpoint structure) OR just use the bulk endpoint if the user insists on "at once".
    // Actually, calling the bulk endpoint with a list of 1 location is a safe bet to reuse the endpoint logic while getting progress.

    const total = locations.length;
    let completed = 0;
    let successful = 0;
    let failed = 0;

    // Chunk size of 1 to get progress updates
    for (const location of locations) {
        if (progressStatus) progressStatus.textContent = `Generating for ${location.name}...`;

        try {
            const response = await fetch('/api/education/bulk-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student: student,
                    locations: [location], // Send one at a time
                    subjects: subjects
                })
            });

            const result = await response.json();
            if (result.status === 'success' && result.successful > 0) {
                successful++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`Failed for ${location.name}`, error);
            failed++;
        }

        completed++;
        const percent = Math.round((completed / total) * 100);
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressDetails) progressDetails.textContent = `${completed} of ${total} completed (${successful} success, ${failed} failed)`;
    }

    if (step2) step2.style.display = 'none';
    if (step3) step3.style.display = 'block';

    if (resultsSummary) {
        resultsSummary.innerHTML = `
            <p style="color: #10b981; font-size: 1.2rem;">✅ ${successful} Successful</p>
            <p style="color: #ef4444; font-size: 1.2rem;">❌ ${failed} Failed</p>
        `;
    }
}
