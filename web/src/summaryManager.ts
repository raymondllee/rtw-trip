// @ts-nocheck
// Itinerary Summary Manager
// Handles generating, saving, and viewing itinerary summaries

import { getRuntimeConfig } from './config';
import { prepareSummaryData, DEFAULT_SUMMARY_OPTIONS, SummaryOptions } from './utils/summaryGenerator';
import { generateSummaryHTML } from './utils/summaryTemplates';

const { apiBaseUrl } = getRuntimeConfig();
const API_URL = apiBaseUrl;

export class SummaryManager {
  constructor() {
    this.currentItinerary = null;
    this.currentScenarioId = null;
  }

  /**
   * Set the current itinerary data
   */
  setItinerary(itineraryData, scenarioId = null) {
    this.currentItinerary = itineraryData;
    this.currentScenarioId = scenarioId;
  }

  /**
   * Generate summary and open in new page
   */
  async generateAndView(itineraryData = null, scenarioId = null, options = DEFAULT_SUMMARY_OPTIONS, scenarioMetadata = null) {
    const data = itineraryData || this.currentItinerary;
    const scenario = scenarioId || this.currentScenarioId;

    if (!data || !data.locations || data.locations.length === 0) {
      throw new Error('No itinerary data available to generate summary');
    }

    // Store data in sessionStorage for the summary page to access
    sessionStorage.setItem('summaryItineraryData', JSON.stringify(data));
    sessionStorage.setItem('summaryOptions', JSON.stringify(options));
    if (scenario) {
      sessionStorage.setItem('summaryScenarioId', scenario);
    }
    if (scenarioMetadata) {
      sessionStorage.setItem('summaryScenarioMetadata', JSON.stringify(scenarioMetadata));
    }

    // Open summary viewer in new tab/window
    const params = new URLSearchParams();
    if (scenario) {
      params.append('scenario', scenario);
    }

    const url = `/summary-viewer.html${params.toString() ? '?' + params.toString() : ''}`;
    window.open(url, '_blank');
  }

  /**
   * Generate summary HTML (non-AI generator)
   */
  generateSummaryHTML(itineraryData, options = DEFAULT_SUMMARY_OPTIONS, scenarioMetadata = null) {
    if (!itineraryData || !itineraryData.locations || itineraryData.locations.length === 0) {
      throw new Error('No itinerary data available to generate summary');
    }

    // Prepare summary data
    const summaryData = prepareSummaryData(itineraryData, scenarioMetadata);

    // Generate HTML
    const html = generateSummaryHTML(summaryData, options);

    return html;
  }

  /**
   * Generate summary via API (for use in other contexts)
   */
  async generateSummaryData(itineraryData) {
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
        return {
          success: true,
          summary: result.summary,
          metadata: result.itinerary_data,
          message: result.message
        };
      } else {
        throw new Error(result.error || 'Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build itinerary data from current application state
   */
  static buildItineraryFromState(data) {
    // Extract relevant data from the application state
    const itinerary = {
      trip: data.trip || {},
      locations: data.locations || [],
      legs: data.legs || [],
      costs: data.costs || []
    };

    return itinerary;
  }

  /**
   * View an existing saved summary
   */
  static viewSavedSummary(summaryId, scenarioId = null) {
    const params = new URLSearchParams({
      id: summaryId
    });

    if (scenarioId) {
      params.append('scenario', scenarioId);
    }

    window.open(`summary-viewer.html?${params.toString()}`, '_blank');
  }
}

// Export singleton instance
export const summaryManager = new SummaryManager();
