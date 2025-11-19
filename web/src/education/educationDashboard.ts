/**
 * Education Dashboard
 * Main interface for managing students, curricula, and testing
 */

import { educationService } from './educationService';
import type { CurriculumPlan, StudentProfile } from '../types/education';

// State
let currentView: 'students' | 'curricula' | 'testing' = 'students';
let students: StudentProfile[] = [];
let curricula: CurriculumPlan[] = [];
let filteredCurricula: CurriculumPlan[] = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeModals();
    initializeStudentForm();
    initializeTestingLab();
    initializeCurriculaFilters();

    // Load initial data
    loadStudents();
    loadCurricula();
});

// Navigation
function initializeNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.getAttribute('data-view') as 'students' | 'curricula' | 'testing';
            switchView(view);
        });
    });
}

function switchView(view: 'students' | 'curricula' | 'testing') {
    currentView = view;

    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-view') === view);
    });

    // Update view sections
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.toggle('active', section.id === `${view}-view`);
    });

    // Reload data when switching to a view
    if (view === 'students') {
        loadStudents();
    } else if (view === 'curricula') {
        loadCurricula();
    }
}

// Modal Management
function initializeModals() {
    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = (e.target as HTMLElement).closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Click outside to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // New student button
    document.getElementById('new-student-btn')?.addEventListener('click', () => {
        openModal('new-student-modal');
    });
}

function openModal(modalId: string) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId: string) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Make closeModal global for HTML onclick handlers
(window as any).closeModal = closeModal;

// Students
async function loadStudents() {
    try {
        showLoading('Loading students...');

        // Load students from Firestore
        const response = await fetch('http://localhost:5001/api/education/students');
        if (!response.ok) {
            throw new Error('Failed to load students');
        }

        students = await response.json();

        // For each student, count their curricula
        const studentsWithStats = await Promise.all(
            students.map(async (student) => {
                const response = await educationService.getStudentCurricula(student.id);
                const studentCurricula = response.curricula;
                const completedCount = studentCurricula.filter(c => c.status === 'completed').length;
                const totalActivities = studentCurricula.reduce((sum, c) => {
                    const locations = c.location_lessons || {};
                    return sum + Object.values(locations).reduce((locationSum: number, location: any) => {
                        const experiential = location.on_location?.experiential_activities?.length || 0;
                        const structured = location.on_location?.structured_lessons?.length || 0;
                        return locationSum + experiential + structured;
                    }, 0);
                }, 0);

                return {
                    ...student,
                    curriculaCount: studentCurricula.length,
                    completedCount,
                    totalActivities,
                    completionPercentage: totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0,
                    totalHours: 0 // TODO: Calculate from progress tracking
                };
            })
        );

        renderStudents(studentsWithStats);
        updateStudentFilters(students);
    } catch (error) {
        console.error('Error loading students:', error);
        showError('Failed to load students');
    } finally {
        hideLoading();
    }
}

function renderStudents(studentsData: any[]) {
    const container = document.getElementById('students-container');
    if (!container) return;

    if (studentsData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👤</div>
                <h3>No students yet</h3>
                <p>Create a student profile to start generating curricula</p>
                <button class="btn btn-primary" onclick="document.getElementById('new-student-btn').click()">+ Create First Student</button>
            </div>
        `;
        return;
    }

    container.innerHTML = studentsData.map(student => `
        <div class="student-card">
            <div class="student-card-header">
                <div class="student-avatar">
                    ${student.name.charAt(0).toUpperCase()}
                </div>
                <div class="student-info">
                    <h3>${student.name}</h3>
                    <div class="student-meta">
                        ${student.age} years old • Grade ${student.grade} • ${student.state}
                    </div>
                    ${student.interests && student.interests.length > 0 ? `
                        <div class="student-meta" style="margin-top: 4px;">
                            Interests: ${student.interests.slice(0, 3).join(', ')}${student.interests.length > 3 ? '...' : ''}
                        </div>
                    ` : ''}
                    <div class="student-meta" style="margin-top: 4px;">
                        Learning Style: ${student.learning_style} • ${student.time_budget_minutes_per_day || 60} min/day
                    </div>
                </div>
                <button class="btn-icon" onclick="editStudent('${student.id}')" title="Edit student">✏️</button>
            </div>

            <div class="student-progress">
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${student.completionPercentage || 0}%"></div>
                </div>
                <div class="progress-text">${student.completionPercentage || 0}% Complete</div>
            </div>

            <div class="student-stats">
                <div class="stat">
                    <div class="stat-value">${student.curriculaCount || 0}</div>
                    <div class="stat-label">Curricula</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${student.totalHours || 0}h</div>
                    <div class="stat-label">Logged</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${student.totalActivities || 0}</div>
                    <div class="stat-label">Activities</div>
                </div>
            </div>

            <div class="student-actions">
                <button class="btn btn-primary btn-sm" onclick="viewStudentCurricula('${student.id}')">View Curricula</button>
                <button class="btn btn-secondary btn-sm" onclick="generateForStudent('${student.id}')">+ Generate</button>
                <button class="btn btn-danger btn-sm" onclick="deleteStudent('${student.id}', '${student.name.replace(/'/g, "\\'")}')">Delete</button>
            </div>
        </div>
    `).join('');
}

// Make functions global for HTML onclick handlers
(window as any).viewStudentCurricula = async (studentId: string) => {
    switchView('curricula');
    const filterSelect = document.getElementById('filter-student') as HTMLSelectElement;
    if (filterSelect) {
        filterSelect.value = studentId;
        applyFilters();
    }
};

(window as any).generateForStudent = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
        // Switch to testing lab and pre-fill student info
        switchView('testing');
        prefillTestingLab(student);
    }
};

function prefillTestingLab(student: StudentProfile) {
    (document.getElementById('test-student-name') as HTMLInputElement).value = student.name;
    (document.getElementById('test-student-age') as HTMLInputElement).value = student.age.toString();
    (document.getElementById('test-student-grade') as HTMLInputElement).value = student.grade.toString();
    (document.getElementById('test-student-state') as HTMLSelectElement).value = student.state;

    const learningStyleRadios = document.getElementsByName('learning-style') as NodeListOf<HTMLInputElement>;
    learningStyleRadios.forEach(radio => {
        radio.checked = radio.value === student.learning_style;
    });

    if (student.interests && student.interests.length > 0) {
        (document.getElementById('test-student-interests') as HTMLInputElement).value = student.interests.join(', ');
    }
}

// Student Form
function initializeStudentForm() {
    document.getElementById('save-student-btn')?.addEventListener('click', async () => {
        const form = document.getElementById('new-student-form') as HTMLFormElement;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const name = (document.getElementById('student-name') as HTMLInputElement).value;
        const age = parseInt((document.getElementById('student-age') as HTMLInputElement).value);
        const grade = parseInt((document.getElementById('student-grade') as HTMLInputElement).value);
        const state = (document.getElementById('student-state') as HTMLSelectElement).value;
        const learningStyleRadio = document.querySelector('input[name="student-learning-style"]:checked') as HTMLInputElement;
        const learningStyle = learningStyleRadio?.value || 'experiential';
        const interestsValue = (document.getElementById('student-interests') as HTMLInputElement).value;
        const interests = interestsValue ? interestsValue.split(',').map(i => i.trim()) : [];
        const timeBudget = parseInt((document.getElementById('student-time-budget') as HTMLInputElement).value) || 60;
        const readingLevel = parseInt((document.getElementById('student-reading-level') as HTMLInputElement).value) || grade;

        try {
            showLoading('Creating student profile...');

            const response = await fetch('http://localhost:5001/api/education/students', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    age,
                    grade,
                    state,
                    learning_style: learningStyle,
                    interests,
                    time_budget_minutes_per_day: timeBudget,
                    reading_level: readingLevel,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create student');
            }

            closeModal('new-student-modal');
            form.reset();
            await loadStudents();
            showSuccess('Student profile created successfully!');
        } catch (error) {
            console.error('Error creating student:', error);
            showError('Failed to create student profile');
        } finally {
            hideLoading();
        }
    });

    // Edit student form
    document.getElementById('update-student-btn')?.addEventListener('click', async () => {
        const form = document.getElementById('edit-student-form') as HTMLFormElement;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const studentId = (document.getElementById('edit-student-id') as HTMLInputElement).value;
        const name = (document.getElementById('edit-student-name') as HTMLInputElement).value;
        const age = parseInt((document.getElementById('edit-student-age') as HTMLInputElement).value);
        const grade = parseInt((document.getElementById('edit-student-grade') as HTMLInputElement).value);
        const state = (document.getElementById('edit-student-state') as HTMLSelectElement).value;
        const learningStyleRadio = document.querySelector('input[name="edit-student-learning-style"]:checked') as HTMLInputElement;
        const learningStyle = learningStyleRadio?.value || 'experiential';
        const interestsValue = (document.getElementById('edit-student-interests') as HTMLInputElement).value;
        const interests = interestsValue ? interestsValue.split(',').map(i => i.trim()) : [];
        const timeBudget = parseInt((document.getElementById('edit-student-time-budget') as HTMLInputElement).value) || 60;
        const readingLevel = parseInt((document.getElementById('edit-student-reading-level') as HTMLInputElement).value) || grade;

        try {
            showLoading('Updating student profile...');

            const response = await fetch(`http://localhost:5001/api/education/students/${studentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    age,
                    grade,
                    state,
                    learning_style: learningStyle,
                    interests,
                    time_budget_minutes_per_day: timeBudget,
                    reading_level: readingLevel,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update student');
            }

            closeModal('edit-student-modal');
            await loadStudents();
            showSuccess('Student profile updated successfully!');
        } catch (error) {
            console.error('Error updating student:', error);
            showError('Failed to update student profile');
        } finally {
            hideLoading();
        }
    });
}

// Edit student function
(window as any).editStudent = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
        showError('Student not found');
        return;
    }

    // Populate edit form
    (document.getElementById('edit-student-id') as HTMLInputElement).value = student.id;
    (document.getElementById('edit-student-name') as HTMLInputElement).value = student.name;
    (document.getElementById('edit-student-age') as HTMLInputElement).value = student.age.toString();
    (document.getElementById('edit-student-grade') as HTMLInputElement).value = student.grade.toString();
    (document.getElementById('edit-student-state') as HTMLSelectElement).value = student.state;

    const learningStyleRadios = document.getElementsByName('edit-student-learning-style') as NodeListOf<HTMLInputElement>;
    learningStyleRadios.forEach(radio => {
        radio.checked = radio.value === student.learning_style;
    });

    (document.getElementById('edit-student-interests') as HTMLInputElement).value = student.interests?.join(', ') || '';
    (document.getElementById('edit-student-time-budget') as HTMLInputElement).value = (student.time_budget_minutes_per_day || 60).toString();
    (document.getElementById('edit-student-reading-level') as HTMLInputElement).value = (student.reading_level || student.grade).toString();

    openModal('edit-student-modal');
};

// Delete student function
(window as any).deleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to delete ${studentName}? This will also delete all their curricula and cannot be undone.`)) {
        return;
    }

    try {
        showLoading('Deleting student...');

        const response = await fetch(`http://localhost:5001/api/education/students/${studentId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Failed to delete student');
        }

        await loadStudents();
        showSuccess('Student deleted successfully');
    } catch (error) {
        console.error('Error deleting student:', error);
        showError('Failed to delete student');
    } finally {
        hideLoading();
    }
};

// Curricula
async function loadCurricula() {
    try {
        showLoading('Loading curricula...');

        const response = await educationService.listCurricula();
        curricula = response.curricula;
        filteredCurricula = curricula;

        renderCurricula(filteredCurricula);
    } catch (error) {
        console.error('Error loading curricula:', error);
        showError('Failed to load curricula');
    } finally {
        hideLoading();
    }
}

function initializeCurriculaFilters() {
    // Generate curriculum button
    document.getElementById('generate-curriculum-btn')?.addEventListener('click', () => {
        switchView('testing');
    });

    // Filter listeners
    const filters = ['filter-student', 'filter-location', 'filter-status', 'sort-curricula'];
    filters.forEach(filterId => {
        document.getElementById(filterId)?.addEventListener('change', applyFilters);
    });

    document.getElementById('curricula-search')?.addEventListener('input', applyFilters);
}

function applyFilters() {
    const studentFilter = (document.getElementById('filter-student') as HTMLSelectElement)?.value;
    const locationFilter = (document.getElementById('filter-location') as HTMLSelectElement)?.value;
    const statusFilter = (document.getElementById('filter-status') as HTMLSelectElement)?.value;
    const sortBy = (document.getElementById('sort-curricula') as HTMLSelectElement)?.value;
    const searchText = (document.getElementById('curricula-search') as HTMLInputElement)?.value.toLowerCase();

    filteredCurricula = curricula.filter(curriculum => {
        if (studentFilter && curriculum.student_profile_id !== studentFilter) return false;
        if (statusFilter && curriculum.status !== statusFilter) return false;

        // Location filter - check if any location matches
        if (locationFilter) {
            const locations = curriculum.location_lessons || {};
            const hasLocation = Object.values(locations).some((loc: any) => loc.location_id === locationFilter);
            if (!hasLocation) return false;
        }

        // Search filter
        if (searchText) {
            const searchableText = `${curriculum.semester_overview?.title || ''} ${curriculum.location_lessons ? Object.values(curriculum.location_lessons).map((l: any) => l.location_name).join(' ') : ''}`.toLowerCase();
            if (!searchableText.includes(searchText)) return false;
        }

        return true;
    });

    // Sort
    if (sortBy === 'recent') {
        filteredCurricula.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'oldest') {
        filteredCurricula.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === 'location') {
        filteredCurricula.sort((a, b) => {
            const aLoc = a.location_lessons ? Object.values(a.location_lessons)[0]?.location_name : '';
            const bLoc = b.location_lessons ? Object.values(b.location_lessons)[0]?.location_name : '';
            return (aLoc || '').localeCompare(bLoc || '');
        });
    }

    renderCurricula(filteredCurricula);
}

function updateStudentFilters(studentsData: StudentProfile[]) {
    const filterSelect = document.getElementById('filter-student') as HTMLSelectElement;
    if (!filterSelect) return;

    const currentValue = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All Students</option>' +
        studentsData.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    filterSelect.value = currentValue;
}

function renderCurricula(curriculaData: CurriculumPlan[]) {
    const container = document.getElementById('curricula-container');
    if (!container) return;

    if (curriculaData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h3>No curricula found</h3>
                <p>Try adjusting your filters or generate a new curriculum</p>
            </div>
        `;
        return;
    }

    container.innerHTML = curriculaData.map(curriculum => {
        const locations = curriculum.location_lessons || {};
        const locationNames = Object.values(locations).map((l: any) => l.location_name).join(', ');
        const totalActivities = Object.values(locations).reduce((sum: number, location: any) => {
            const experiential = location.on_location?.experiential_activities?.length || 0;
            const structured = location.on_location?.structured_lessons?.length || 0;
            return sum + experiential + structured;
        }, 0);

        const subjects = curriculum.semester_overview?.subjects_covered || [];
        const startDate = curriculum.semester_overview?.start_date ? new Date(curriculum.semester_overview.start_date).toLocaleDateString() : '';
        const endDate = curriculum.semester_overview?.end_date ? new Date(curriculum.semester_overview.end_date).toLocaleDateString() : '';
        const duration = curriculum.semester_overview?.duration_weeks || 0;

        return `
            <div class="curriculum-card">
                <div class="curriculum-header">
                    <div>
                        <div class="curriculum-title">${curriculum.semester_overview?.title || 'Untitled Curriculum'}</div>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">
                            ${locationNames}
                        </div>
                    </div>
                    <span class="curriculum-status ${curriculum.status}">${curriculum.status}</span>
                </div>

                <div class="curriculum-meta">
                    <div class="meta-item">
                        <span class="meta-icon">📅</span>
                        ${startDate} - ${endDate}
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">📊</span>
                        ${totalActivities} activities
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon">⏱️</span>
                        ${duration} weeks
                    </div>
                </div>

                ${subjects.length > 0 ? `
                    <div class="curriculum-subjects">
                        ${subjects.map(subject => `<span class="subject-badge">${subject}</span>`).join('')}
                    </div>
                ` : ''}

                <div class="curriculum-actions">
                    <button class="btn btn-primary btn-sm" onclick="viewCurriculum('${curriculum.id}')">View Details</button>
                    <button class="btn btn-secondary btn-sm" onclick="exportCurriculum('${curriculum.id}')">Export</button>
                </div>
            </div>
        `;
    }).join('');
}

// Make functions global
(window as any).viewCurriculum = async (curriculumId: string) => {
    try {
        showLoading('Loading curriculum details...');
        const response = await educationService.getCurriculum(curriculumId);
        displayCurriculumDetails(response.curriculum);
    } catch (error) {
        console.error('Error loading curriculum:', error);
        showError('Failed to load curriculum details');
    } finally {
        hideLoading();
    }
};

(window as any).exportCurriculum = async (curriculumId: string) => {
    try {
        const response = await educationService.getCurriculum(curriculumId);
        const dataStr = JSON.stringify(response.curriculum, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `curriculum_${curriculumId}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        showSuccess('Curriculum exported successfully!');
    } catch (error) {
        console.error('Error exporting curriculum:', error);
        showError('Failed to export curriculum');
    }
};

function displayCurriculumDetails(curriculum: CurriculumPlan) {
    const modal = document.getElementById('curriculum-detail-modal');
    const content = document.getElementById('curriculum-detail-content');
    if (!modal || !content) return;

    const locations = curriculum.location_lessons || {};

    content.innerHTML = `
        <div class="curriculum-details">
            <h3>${curriculum.semester_overview?.title || 'Untitled Curriculum'}</h3>
            <p><strong>Status:</strong> <span class="curriculum-status ${curriculum.status}">${curriculum.status}</span></p>
            <p><strong>Duration:</strong> ${curriculum.semester_overview?.duration_weeks || 0} weeks</p>
            <p><strong>Subjects:</strong> ${(curriculum.semester_overview?.subjects_covered || []).join(', ')}</p>

            ${Object.entries(locations).map(([locId, location]: [string, any]) => `
                <div style="margin-top: 24px; padding: 16px; background: var(--bg-secondary); border-radius: 8px;">
                    <h4>${location.location_name}</h4>

                    ${location.pre_trip ? `
                        <div style="margin-top: 16px;">
                            <strong>Pre-Trip Activities:</strong>
                            ${location.pre_trip.readings?.length > 0 ? `<p>Readings: ${location.pre_trip.readings.length}</p>` : ''}
                            ${location.pre_trip.videos?.length > 0 ? `<p>Videos: ${location.pre_trip.videos.length}</p>` : ''}
                            ${location.pre_trip.prep_tasks?.length > 0 ? `<p>Prep Tasks: ${location.pre_trip.prep_tasks.length}</p>` : ''}
                        </div>
                    ` : ''}

                    ${location.on_location ? `
                        <div style="margin-top: 16px;">
                            <strong>On-Location Activities:</strong>
                            ${location.on_location.experiential_activities?.length > 0 ? `<p>Experiential: ${location.on_location.experiential_activities.length}</p>` : ''}
                            ${location.on_location.structured_lessons?.length > 0 ? `<p>Structured Lessons: ${location.on_location.structured_lessons.length}</p>` : ''}
                        </div>
                    ` : ''}

                    ${location.post_trip ? `
                        <div style="margin-top: 16px;">
                            <strong>Post-Trip Activities:</strong>
                            ${location.post_trip.reflection_prompts?.length > 0 ? `<p>Reflections: ${location.post_trip.reflection_prompts.length}</p>` : ''}
                            ${location.post_trip.synthesis_activities?.length > 0 ? `<p>Synthesis: ${location.post_trip.synthesis_activities.length}</p>` : ''}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;

    openModal('curriculum-detail-modal');
}

// Testing Lab
function initializeTestingLab() {
    document.getElementById('test-generate-btn')?.addEventListener('click', generateTestCurriculum);
    document.getElementById('test-reset-btn')?.addEventListener('click', resetTestingForm);
}

async function generateTestCurriculum() {
    const name = (document.getElementById('test-student-name') as HTMLInputElement).value;
    const age = parseInt((document.getElementById('test-student-age') as HTMLInputElement).value);
    const grade = parseInt((document.getElementById('test-student-grade') as HTMLInputElement).value);
    const state = (document.getElementById('test-student-state') as HTMLSelectElement).value;

    const learningStyleRadio = document.querySelector('input[name="learning-style"]:checked') as HTMLInputElement;
    const learningStyle = learningStyleRadio?.value || 'experiential';

    const interestsValue = (document.getElementById('test-student-interests') as HTMLInputElement).value;
    const interests = interestsValue ? interestsValue.split(',').map(i => i.trim()) : [];

    const locationName = (document.getElementById('test-location-name') as HTMLInputElement).value;
    const locationCountry = (document.getElementById('test-location-country') as HTMLInputElement).value;
    const duration = parseInt((document.getElementById('test-location-duration') as HTMLInputElement).value);

    const highlightsValue = (document.getElementById('test-location-highlights') as HTMLTextAreaElement).value;
    const highlights = highlightsValue ? highlightsValue.split(',').map(h => h.trim()) : [];

    const subjectCheckboxes = document.querySelectorAll('input[name="subjects"]:checked') as NodeListOf<HTMLInputElement>;
    const subjects = Array.from(subjectCheckboxes).map(cb => cb.value);

    const timeBudget = parseInt((document.getElementById('test-time-budget') as HTMLInputElement).value);
    const readingLevel = parseInt((document.getElementById('test-reading-level') as HTMLInputElement).value);

    if (!name || !locationName || !locationCountry || subjects.length === 0) {
        showError('Please fill in all required fields');
        return;
    }

    try {
        showLoading('Generating curriculum... This may take 30-60 seconds');

        const result = await educationService.generateCurriculum({
            student: {
                name,
                age,
                grade,
                state,
                learning_style: learningStyle as any,
                interests,
                time_budget_minutes_per_day: timeBudget,
                reading_level: readingLevel,
            },
            location: {
                id: `${locationName.toLowerCase().replace(/\s+/g, '_')}_${locationCountry.toLowerCase().replace(/\s+/g, '_')}`,
                name: locationName,
                country: locationCountry,
                duration_days: duration,
                highlights,
            },
            subjects,
        });

        displayTestResults(result);
        showSuccess('Curriculum generated successfully!');
    } catch (error) {
        console.error('Error generating curriculum:', error);
        showError('Failed to generate curriculum. Please try again.');
    } finally {
        hideLoading();
    }
}

function displayTestResults(result: any) {
    const resultsContainer = document.getElementById('test-results');
    const resultsContent = document.getElementById('test-results-content');
    if (!resultsContainer || !resultsContent) return;

    const curriculum = result.curriculum;
    const locations = curriculum.location_lessons || {};

    let totalActivities = 0;
    let preTripCount = 0;
    let onLocationCount = 0;
    let postTripCount = 0;

    Object.values(locations).forEach((location: any) => {
        preTripCount += (location.pre_trip?.readings?.length || 0) +
                        (location.pre_trip?.videos?.length || 0) +
                        (location.pre_trip?.prep_tasks?.length || 0);
        onLocationCount += (location.on_location?.experiential_activities?.length || 0) +
                           (location.on_location?.structured_lessons?.length || 0);
        postTripCount += (location.post_trip?.reflection_prompts?.length || 0) +
                         (location.post_trip?.synthesis_activities?.length || 0);
    });

    totalActivities = preTripCount + onLocationCount + postTripCount;

    resultsContent.innerHTML = `
        <div class="result-summary">
            <h4>✅ Generation Complete</h4>
            <p>Model: ${result.metadata?.model_used || 'Gemini 2.0 Flash'}</p>
            <p>Generated: ${new Date(result.metadata?.generation_time).toLocaleString()}</p>

            <div class="result-stats">
                <div class="result-stat">
                    <div class="result-stat-value">${totalActivities}</div>
                    <div class="result-stat-label">Total Activities</div>
                </div>
                <div class="result-stat">
                    <div class="result-stat-value">${preTripCount}</div>
                    <div class="result-stat-label">Pre-Trip</div>
                </div>
                <div class="result-stat">
                    <div class="result-stat-value">${onLocationCount}</div>
                    <div class="result-stat-label">On-Location</div>
                </div>
                <div class="result-stat">
                    <div class="result-stat-value">${postTripCount}</div>
                    <div class="result-stat-label">Post-Trip</div>
                </div>
            </div>

            <div class="result-actions">
                <button class="btn btn-primary" onclick="saveTestCurriculum('${result.saved_ids?.curriculum_plan_id || ''}')">
                    💾 Save to Student
                </button>
                <button class="btn btn-secondary" onclick="downloadTestResults()">
                    📥 Download JSON
                </button>
                <button class="btn btn-secondary" onclick="viewFullCurriculum('${result.saved_ids?.curriculum_plan_id || ''}')">
                    👁️ View Full Details
                </button>
            </div>
        </div>

        <h4 style="margin-top: 24px;">Activity Preview</h4>
        ${Object.entries(locations).slice(0, 1).map(([locId, location]: [string, any]) => `
            ${location.on_location?.experiential_activities?.slice(0, 3).map((activity: any) => `
                <div class="activity-preview">
                    <h4>${activity.title}</h4>
                    <p>${activity.description || ''}</p>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                        ${activity.subject} • ${activity.estimated_duration_minutes || 0} min
                    </div>
                </div>
            `).join('') || ''}
        `).join('')}
    `;

    resultsContainer.style.display = 'block';

    // Store result for later use
    (window as any).lastTestResult = result;
}

function resetTestingForm() {
    (document.getElementById('test-student-name') as HTMLInputElement).value = 'Maya';
    (document.getElementById('test-student-age') as HTMLInputElement).value = '14';
    (document.getElementById('test-student-grade') as HTMLInputElement).value = '8';
    (document.getElementById('test-location-name') as HTMLInputElement).value = 'Tokyo';
    (document.getElementById('test-location-country') as HTMLInputElement).value = 'Japan';
    (document.getElementById('test-location-duration') as HTMLInputElement).value = '23';

    const resultsContainer = document.getElementById('test-results');
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
}

(window as any).saveTestCurriculum = async (curriculumId: string) => {
    if (!curriculumId) {
        showError('No curriculum to save');
        return;
    }

    showSuccess('Curriculum already saved to database!');
    await loadCurricula();
    switchView('curricula');
};

(window as any).downloadTestResults = () => {
    const result = (window as any).lastTestResult;
    if (!result) {
        showError('No results to download');
        return;
    }

    const dataStr = JSON.stringify(result, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = 'test_curriculum_result.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    showSuccess('Results downloaded successfully!');
};

(window as any).viewFullCurriculum = (curriculumId: string) => {
    if (curriculumId) {
        (window as any).viewCurriculum(curriculumId);
    }
};

// UI Helpers
function showLoading(message: string = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    if (overlay && messageEl) {
        messageEl.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showSuccess(message: string) {
    alert(message); // TODO: Replace with better toast notification
}

function showError(message: string) {
    alert('Error: ' + message); // TODO: Replace with better toast notification
}
