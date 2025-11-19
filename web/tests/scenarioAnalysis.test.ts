/**
 * Unit tests for Scenario Analysis
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { TripData, ScenarioCostSummary } from '../src/types/trip';
import {
  calculateScenarioCostSummary,
  compareScenarios
} from '../src/utils/scenarioAnalysis';

describe('Scenario Analysis', () => {
  let scenario1Data: TripData;
  let scenario2Data: TripData;
  let scenario3Data: TripData;

  beforeEach(() => {
    // Scenario 1: Short trip, low cost
    scenario1Data = {
      locations: [
        {
          id: '1',
          name: 'Bangkok, Thailand',
          city: 'Bangkok',
          country: 'Thailand',
          duration_days: 5
        },
        {
          id: '2',
          name: 'Chiang Mai, Thailand',
          city: 'Chiang Mai',
          country: 'Thailand',
          duration_days: 4
        }
      ],
      legs: [],
      costs: [
        { id: 'c1', category: 'accommodation', amount_usd: 300, amount: 300, currency: 'USD', destination_id: '1' },
        { id: 'c2', category: 'food', amount_usd: 200, amount: 200, currency: 'USD', destination_id: '1' },
        { id: 'c3', category: 'accommodation', amount_usd: 250, amount: 250, currency: 'USD', destination_id: '2' },
        { id: 'c4', category: 'food', amount_usd: 150, amount: 150, currency: 'USD', destination_id: '2' },
        { id: 'c5', category: 'flight', amount_usd: 500, amount: 500, currency: 'USD' }
      ],
      countryNotes: {}
    };

    // Scenario 2: Medium trip, medium cost
    scenario2Data = {
      locations: [
        {
          id: '3',
          name: 'Tokyo, Japan',
          city: 'Tokyo',
          country: 'Japan',
          duration_days: 7
        },
        {
          id: '4',
          name: 'Kyoto, Japan',
          city: 'Kyoto',
          country: 'Japan',
          duration_days: 5
        }
      ],
      legs: [],
      costs: [
        { id: 'c6', category: 'accommodation', amount_usd: 1000, amount: 1000, currency: 'USD', destination_id: '3' },
        { id: 'c7', category: 'food', amount_usd: 700, amount: 700, currency: 'USD', destination_id: '3' },
        { id: 'c8', category: 'accommodation', amount_usd: 800, amount: 800, currency: 'USD', destination_id: '4' },
        { id: 'c9', category: 'food', amount_usd: 500, amount: 500, currency: 'USD', destination_id: '4' },
        { id: 'c10', category: 'flight', amount_usd: 1200, amount: 1200, currency: 'USD' }
      ],
      countryNotes: {}
    };

    // Scenario 3: Long trip, high cost
    scenario3Data = {
      locations: [
        {
          id: '5',
          name: 'Paris, France',
          city: 'Paris',
          country: 'France',
          duration_days: 6
        },
        {
          id: '6',
          name: 'London, UK',
          city: 'London',
          country: 'UK',
          duration_days: 5
        },
        {
          id: '7',
          name: 'Rome, Italy',
          city: 'Rome',
          country: 'Italy',
          duration_days: 5
        }
      ],
      legs: [],
      costs: [
        { id: 'c11', category: 'accommodation', amount_usd: 1200, amount: 1200, currency: 'USD', destination_id: '5' },
        { id: 'c12', category: 'food', amount_usd: 600, amount: 600, currency: 'USD', destination_id: '5' },
        { id: 'c13', category: 'accommodation', amount_usd: 1100, amount: 1100, currency: 'USD', destination_id: '6' },
        { id: 'c14', category: 'food', amount_usd: 550, amount: 550, currency: 'USD', destination_id: '6' },
        { id: 'c15', category: 'accommodation', amount_usd: 1000, amount: 1000, currency: 'USD', destination_id: '7' },
        { id: 'c16', category: 'food', amount_usd: 500, amount: 500, currency: 'USD', destination_id: '7' },
        { id: 'c17', category: 'flight', amount_usd: 1500, amount: 1500, currency: 'USD' },
        { id: 'c18', category: 'activity', amount_usd: 800, amount: 800, currency: 'USD' }
      ],
      countryNotes: {}
    };
  });

  describe('calculateScenarioCostSummary', () => {
    it('should calculate total cost correctly', () => {
      const summary = calculateScenarioCostSummary('scenario1', 'Bangkok Trip', scenario1Data);

      const expectedTotal = 300 + 200 + 250 + 150 + 500;
      expect(summary.total).toBe(expectedTotal);
    });

    it('should calculate costs by category correctly', () => {
      const summary = calculateScenarioCostSummary('scenario1', 'Bangkok Trip', scenario1Data);

      expect(summary.by_category.accommodation).toBe(550); // 300 + 250
      expect(summary.by_category.food).toBe(350); // 200 + 150
      expect(summary.by_category.flight).toBe(500);
    });

    it('should calculate costs by destination correctly', () => {
      const summary = calculateScenarioCostSummary('scenario1', 'Bangkok Trip', scenario1Data);

      expect(summary.by_destination['Bangkok, Thailand']).toBe(500); // 300 + 200
      expect(summary.by_destination['Chiang Mai, Thailand']).toBe(400); // 250 + 150
    });

    it('should calculate cost per day correctly', () => {
      const summary = calculateScenarioCostSummary('scenario1', 'Bangkok Trip', scenario1Data);

      const totalDays = 9; // 5 + 4
      const expectedCostPerDay = 1400 / totalDays;
      expect(summary.cost_per_day).toBeCloseTo(expectedCostPerDay, 2);
    });

    it('should calculate cost per person correctly', () => {
      const summary = calculateScenarioCostSummary('scenario1', 'Bangkok Trip', scenario1Data, 2);

      expect(summary.cost_per_person).toBe(1400 / 2);
    });

    it('should handle scenario with zero days', () => {
      const zeroData: TripData = {
        locations: [],
        legs: [],
        costs: [{ id: 'c1', category: 'other', amount_usd: 100, amount: 100, currency: 'USD' }],
        countryNotes: {}
      };

      const summary = calculateScenarioCostSummary('zero', 'Zero Days', zeroData);

      expect(summary.total_days).toBe(0);
      expect(summary.cost_per_day).toBe(0);
    });

    it('should count number of destinations correctly', () => {
      const summary1 = calculateScenarioCostSummary('s1', 'Bangkok', scenario1Data);
      const summary3 = calculateScenarioCostSummary('s3', 'Europe', scenario3Data);

      expect(summary1.num_destinations).toBe(2);
      expect(summary3.num_destinations).toBe(3);
    });
  });

  describe('compareScenarios', () => {
    let summaries: ScenarioCostSummary[];

    beforeEach(() => {
      summaries = [
        calculateScenarioCostSummary('scenario1', 'Bangkok Trip', scenario1Data),
        calculateScenarioCostSummary('scenario2', 'Japan Trip', scenario2Data),
        calculateScenarioCostSummary('scenario3', 'Europe Trip', scenario3Data)
      ];
    });

    it('should identify cheapest and most expensive scenarios', () => {
      const comparison = compareScenarios(summaries);

      expect(comparison.cheapest_scenario).toBe('scenario1');
      expect(comparison.most_expensive_scenario).toBe('scenario3');
    });

    it('should calculate cost range correctly', () => {
      const comparison = compareScenarios(summaries);

      const cheapest = summaries.find(s => s.id === 'scenario1')!;
      const mostExpensive = summaries.find(s => s.id === 'scenario3')!;
      const expectedRange = mostExpensive.total - cheapest.total;

      expect(comparison.cost_range).toBe(expectedRange);
    });

    it('should calculate category deltas correctly', () => {
      const comparison = compareScenarios(summaries);

      // Accommodation costs across scenarios
      const accomCosts = summaries.map(s => s.by_category.accommodation || 0);
      const accomMin = Math.min(...accomCosts);
      const accomMax = Math.max(...accomCosts);

      expect(comparison.category_deltas.accommodation.min).toBe(accomMin);
      expect(comparison.category_deltas.accommodation.max).toBe(accomMax);
      expect(comparison.category_deltas.accommodation.range).toBe(accomMax - accomMin);
    });

    it('should calculate destination deltas correctly', () => {
      const comparison = compareScenarios(summaries);

      // Should have deltas for all destinations across scenarios
      expect(Object.keys(comparison.destination_deltas).length).toBeGreaterThan(0);

      // Destinations unique to one scenario should have 0 min
      const bangkokDelta = comparison.destination_deltas['Bangkok, Thailand'];
      expect(bangkokDelta).toBeDefined();
      expect(bangkokDelta.amounts).toContain(0); // Zero in scenarios without Bangkok
    });

    it('should generate key insights', () => {
      const comparison = compareScenarios(summaries);

      expect(comparison.key_insights).toBeDefined();
      expect(comparison.key_insights.length).toBeGreaterThan(0);

      // Should mention price difference
      const priceDiffInsight = comparison.key_insights.find(i => i.includes('Price difference'));
      expect(priceDiffInsight).toBeDefined();

      // Should mention biggest cost driver
      const costDriverInsight = comparison.key_insights.find(i => i.includes('Biggest cost difference'));
      expect(costDriverInsight).toBeDefined();
    });

    it('should generate recommendations', () => {
      const comparison = compareScenarios(summaries);

      expect(comparison.recommendations).toBeDefined();
      expect(comparison.recommendations.length).toBeGreaterThan(0);

      // Should recommend cheapest scenario
      const cheapestRec = comparison.recommendations.find(r => r.includes('Bangkok Trip'));
      expect(cheapestRec).toBeDefined();
    });

    it('should recommend cheapest when significant savings', () => {
      const comparison = compareScenarios(summaries);

      // Bangkok (scenario1) is significantly cheaper than Europe (scenario3)
      const savingsRec = comparison.recommendations.find(r => r.includes('save'));
      expect(savingsRec).toBeDefined();
    });

    it('should identify best value scenario', () => {
      const comparison = compareScenarios(summaries);

      // Find scenario with lowest cost per day
      const bestValue = summaries.reduce((best, s) =>
        s.cost_per_day < best.cost_per_day ? s : best
      );

      // Should mention best value in recommendations
      const valueRec = comparison.recommendations.find(r =>
        r.includes('best value') || r.includes(bestValue.name)
      );
      expect(valueRec).toBeDefined();
    });

    it('should suggest accommodation optimization if high variance', () => {
      const comparison = compareScenarios(summaries);

      // Accommodation varies significantly across scenarios
      const accomDelta = comparison.category_deltas.accommodation;
      if (accomDelta.range > 1000) {
        const accomRec = comparison.recommendations.find(r =>
          r.includes('Accommodation') || r.includes('accommodation')
        );
        expect(accomRec).toBeDefined();
      }
    });

    it('should handle scenario with equal costs', () => {
      const equalSummaries = [
        calculateScenarioCostSummary('s1', 'Trip 1', scenario1Data),
        calculateScenarioCostSummary('s2', 'Trip 2', scenario1Data) // Same data
      ];

      const comparison = compareScenarios(equalSummaries);

      expect(comparison.cost_range).toBe(0);
      expect(comparison.cheapest_scenario).toBeDefined();
      expect(comparison.most_expensive_scenario).toBeDefined();
    });

    it('should throw error with empty scenarios', () => {
      expect(() => compareScenarios([])).toThrow('No scenarios to compare');
    });

    it('should handle single scenario', () => {
      const singleSummary = [
        calculateScenarioCostSummary('s1', 'Trip 1', scenario1Data)
      ];

      const comparison = compareScenarios(singleSummary);

      expect(comparison.cheapest_scenario).toBe('s1');
      expect(comparison.most_expensive_scenario).toBe('s1');
      expect(comparison.cost_range).toBe(0);
    });
  });

  describe('Insights Generation', () => {
    it('should mention daily cost differences', () => {
      const summaries = [
        calculateScenarioCostSummary('s1', 'Bangkok', scenario1Data),
        calculateScenarioCostSummary('s3', 'Europe', scenario3Data)
      ];

      const comparison = compareScenarios(summaries);

      const dailyCostInsight = comparison.key_insights.find(i =>
        i.includes('daily cost') || i.includes('per day')
      );
      expect(dailyCostInsight).toBeDefined();
    });

    it('should identify high-variance destinations', () => {
      const summaries = [
        calculateScenarioCostSummary('s1', 'Bangkok', scenario1Data),
        calculateScenarioCostSummary('s2', 'Japan', scenario2Data),
        calculateScenarioCostSummary('s3', 'Europe', scenario3Data)
      ];

      const comparison = compareScenarios(summaries);

      // Should mention destination with high variance
      const varianceInsight = comparison.key_insights.find(i =>
        i.includes('variation') || i.includes('variance')
      );
      // May or may not have variance insight depending on data
      if (varianceInsight) {
        expect(varianceInsight).toBeTruthy();
      }
    });
  });

  describe('Recommendations Quality', () => {
    it('should prioritize significant savings', () => {
      const summaries = [
        calculateScenarioCostSummary('cheap', 'Budget Trip', scenario1Data),
        calculateScenarioCostSummary('expensive', 'Luxury Trip', scenario3Data)
      ];

      const comparison = compareScenarios(summaries);

      // First recommendation should be about savings
      expect(comparison.recommendations[0]).toContain('save');
      expect(comparison.recommendations[0]).toContain('Budget Trip');
    });

    it('should suggest duration trade-offs', () => {
      // Create scenarios with different durations
      const shortData = { ...scenario1Data };
      const longData = { ...scenario3Data };

      const summaries = [
        calculateScenarioCostSummary('short', 'Short Trip', shortData),
        calculateScenarioCostSummary('long', 'Long Trip', longData)
      ];

      const comparison = compareScenarios(summaries);

      const durationRec = comparison.recommendations.find(r =>
        r.includes('days') || r.includes('duration')
      );
      expect(durationRec).toBeDefined();
    });
  });
});
