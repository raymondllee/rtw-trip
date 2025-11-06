// @ts-nocheck
// Summary Viewer - loads and displays itinerary summaries

import { db } from '../firebase-config.js';
import { doc, updateDoc, getDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { prepareSummaryData, DEFAULT_SUMMARY_OPTIONS } from './utils/summaryGenerator';
import { generateSummaryHTML } from './utils/summaryTemplates';

const API_URL = 'http://localhost:5001';

// Get summary data from URL params or sessionStorage
const urlParams = new URLSearchParams(window.location.search);
const summaryId = urlParams.get('id');
const scenarioId = urlParams.get('scenario');

let currentSummary = null;
let currentScenarioId = scenarioId;

async function loadExistingSummary(id) {
  // Load a previously saved summary from sessionStorage or Firebase
  if (id === 'saved' && currentScenarioId) {
    // Load saved summary from Firestore
    try {
      const scenarioDoc = await getDoc(doc(db, 'scenarios', currentScenarioId));
      if (scenarioDoc.exists() && scenarioDoc.data().summary) {
        return {
          summary: scenarioDoc.data().summary.markdown,
          itinerary_data: scenarioDoc.data().summary.metadata,
          generatedAt: scenarioDoc.data().summaryGeneratedAt?.toDate()
        };
      }
    } catch (error) {
      console.error('Error loading saved summary from Firestore:', error);
    }
    return null;
  }

  const saved = sessionStorage.getItem(`summary_${id}`);
  if (saved) {
    return JSON.parse(saved);
  }
  return null;
}

async function generateSummary(itineraryData) {
  try {
    const response = await fetch(`${API_URL}/api/itinerary/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itinerary: itineraryData
      })
    });

    const result = await response.json();

    if (result.status === 'success') {
      return result;
    } else {
      // Create a custom error object with additional info
      const error = new Error(result.error || 'Failed to generate summary');
      error.errorCode = result.error_code;
      error.retryAfter = result.retry_after;
      error.statusCode = response.status;
      throw error;
    }
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

async function displaySummary(summaryHtml, itineraryData, options) {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const containerEl = document.querySelector('.container');

  loadingEl.style.display = 'none';

  if (!summaryHtml) {
    errorEl.textContent = 'Failed to generate summary';
    errorEl.style.display = 'block';
    return;
  }

  // Replace container content with the generated HTML body
  const parser = new DOMParser();
  const doc = parser.parseFromString(summaryHtml, 'text/html');
  const bodyContent = doc.body.innerHTML;

  containerEl.innerHTML = bodyContent;

  // Apply cost visibility
  if (!options.showCosts) {
    document.body.classList.add('hide-costs');
  }

  currentSummary = {
    html: summaryHtml,
    itineraryData: itineraryData,
    options: options,
    generatedAt: new Date().toISOString()
  };
}

async function saveSummaryToScenario() {
  if (!currentSummary || !currentScenarioId) {
    alert('No summary or scenario to save to');
    return;
  }

  try {
    const scenarioRef = doc(db, 'scenarios', currentScenarioId);
    const scenarioDoc = await getDoc(scenarioRef);

    if (!scenarioDoc.exists()) {
      alert('Scenario not found');
      return;
    }

    await updateDoc(scenarioRef, {
      summary: currentSummary,
      summaryGeneratedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    alert('Summary saved to scenario!');
  } catch (error) {
    console.error('Error saving summary:', error);
    alert('Failed to save summary: ' + error.message);
  }
}

// Toggle costs visibility
function toggleCosts() {
  document.body.classList.toggle('hide-costs');
  const btn = document.getElementById('toggle-costs-btn');
  const isHidden = document.body.classList.contains('hide-costs');
  btn.textContent = isHidden ? '💰 Show Costs' : '💰 Hide Costs';
}

// Setup section toggle functionality
function setupSectionToggles() {
  const toggles = document.querySelectorAll('[data-section-toggle]');

  toggles.forEach(toggle => {
    const checkbox = toggle as HTMLInputElement;
    const sectionName = checkbox.getAttribute('data-section-toggle');

    checkbox.addEventListener('change', () => {
      const section = document.querySelector(`[data-section="${sectionName}"]`) as HTMLElement;
      if (section) {
        section.style.display = checkbox.checked ? 'block' : 'none';
      }
    });

    // Initialize visibility based on checkbox state
    const section = document.querySelector(`[data-section="${sectionName}"]`) as HTMLElement;
    if (section) {
      section.style.display = checkbox.checked ? 'block' : 'none';
    }
  });
}

// Initialize
async function init() {
  try {
    // Get itinerary data from sessionStorage
    const itineraryDataStr = sessionStorage.getItem('summaryItineraryData');
    if (!itineraryDataStr) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').textContent = 'No itinerary data found. Please generate from the main page.';
      document.getElementById('error').style.display = 'block';
      return;
    }

    const itineraryData = JSON.parse(itineraryDataStr);

    // Get options from sessionStorage
    const optionsStr = sessionStorage.getItem('summaryOptions');
    const options = optionsStr ? JSON.parse(optionsStr) : DEFAULT_SUMMARY_OPTIONS;

    // Store scenario ID if provided
    const storedScenarioId = sessionStorage.getItem('summaryScenarioId');
    if (storedScenarioId) {
      currentScenarioId = storedScenarioId;
    }

    // Get scenario metadata from sessionStorage
    const scenarioMetadataStr = sessionStorage.getItem('summaryScenarioMetadata');
    const scenarioMetadata = scenarioMetadataStr ? JSON.parse(scenarioMetadataStr) : null;

    // Generate the summary using non-AI generator
    const summaryData = prepareSummaryData(itineraryData, scenarioMetadata);
    const html = generateSummaryHTML(summaryData, options);

    // Display the summary
    await displaySummary(html, itineraryData, options);

    // Setup section toggles
    setupSectionToggles();

    // Update cost toggle button text
    const btn = document.getElementById('toggle-costs-btn');
    btn.textContent = options.showCosts ? '💰 Hide Costs' : '💰 Show Costs';
  } catch (error) {
    document.getElementById('loading').style.display = 'none';
    const errorEl = document.getElementById('error');
    errorEl.textContent = 'Error: ' + error.message;
    errorEl.style.display = 'block';
    console.error('Error generating summary:', error);
  }
}

// Event listeners
document.getElementById('save-btn').addEventListener('click', saveSummaryToScenario);
document.getElementById('toggle-costs-btn').addEventListener('click', toggleCosts);

// Start initialization
init();
