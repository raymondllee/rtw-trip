/**
 * Unit tests for Budget Tracker
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { TripBudget, TripData, TripCost, TripLocation } from '../src/types/trip';
import { calculateBudgetStatus, createDefaultBudget } from '../src/utils/budgetTracker';

describe('Budget Tracker', () => {
  let mockTripData: TripData;
  let mockBudget: TripBudget;

  beforeEach(() => {
    // Setup mock trip data
    const locations: TripLocation[] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Tokyo, Japan',
        city: 'Tokyo',
        country: 'Japan',
        duration_days: 7
      },
      {
        id: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
        name: 'Paris, France',
        city: 'Paris',
        country: 'France',
        duration_days: 5
      }
    ];

    const costs: TripCost[] = [
      {
        id: 'cost1',
        category: 'accommodation',
        amount: 1000,
        amount_usd: 1000,
        currency: 'USD',
        destination_id: '550e8400-e29b-41d4-a716-446655440000'
      },
      {
        id: 'cost2',
        category: 'food',
        amount: 500,
        amount_usd: 500,
        currency: 'USD',
        destination_id: '550e8400-e29b-41d4-a716-446655440000'
      },
      {
        id: 'cost3',
        category: 'accommodation',
        amount: 800,
        amount_usd: 800,
        currency: 'USD',
        destination_id: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a'
      },
      {
        id: 'cost4',
        category: 'activity',
        amount: 300,
        amount_usd: 300,
        currency: 'USD',
        destination_id: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a'
      }
    ];

    mockTripData = {
      locations,
      legs: [],
      costs,
      countryNotes: {}
    };

    mockBudget = {
      total_budget_usd: 3000,
      budgets_by_category: {
        accommodation: 2000,
        food: 600,
        activity: 400,
        transport: 0,
        flight: 0,
        other: 0
      },
      budgets_by_destination: {
        'Tokyo, Japan': 1500,
        'Paris, France': 1500
      },
      contingency_pct: 10,
      alerts: []
    };
  });

  describe('calculateBudgetStatus', () => {
    it('should calculate total budget status correctly', () => {
      const status = calculateBudgetStatus(mockBudget, mockTripData);

      expect(status.total_budget).toBe(3000);
      expect(status.total_spent).toBe(2600); // 1000 + 500 + 800 + 300
      expect(status.total_remaining).toBe(400);
      expect(status.percentage_used).toBeCloseTo(86.67, 1);
    });

    it('should calculate category budgets correctly', () => {
      const status = calculateBudgetStatus(mockBudget, mockTripData);

      expect(status.by_category.accommodation.spent).toBe(1800); // 1000 + 800
      expect(status.by_category.accommodation.budget).toBe(2000);
      expect(status.by_category.accommodation.remaining).toBe(200);
      expect(status.by_category.accommodation.percentage).toBe(90);

      expect(status.by_category.food.spent).toBe(500);
      expect(status.by_category.food.budget).toBe(600);
      expect(status.by_category.food.remaining).toBe(100);
      expect(status.by_category.food.percentage).toBeCloseTo(83.33, 1);

      expect(status.by_category.activity.spent).toBe(300);
      expect(status.by_category.activity.budget).toBe(400);
      expect(status.by_category.activity.remaining).toBe(100);
      expect(status.by_category.activity.percentage).toBe(75);
    });

    it('should calculate destination budgets correctly', () => {
      const status = calculateBudgetStatus(mockBudget, mockTripData);

      expect(status.by_destination['Tokyo, Japan'].spent).toBe(1500); // 1000 + 500
      expect(status.by_destination['Tokyo, Japan'].budget).toBe(1500);
      expect(status.by_destination['Tokyo, Japan'].percentage).toBe(100);

      expect(status.by_destination['Paris, France'].spent).toBe(1100); // 800 + 300
      expect(status.by_destination['Paris, France'].budget).toBe(1500);
      expect(status.by_destination['Paris, France'].remaining).toBe(400);
      expect(status.by_destination['Paris, France'].percentage).toBeCloseTo(73.33, 1);
    });

    it('should generate alerts when budget exceeded', () => {
      // Set low budget to trigger alerts
      const lowBudget: TripBudget = {
        ...mockBudget,
        total_budget_usd: 2000,
        budgets_by_category: {
          ...mockBudget.budgets_by_category,
          accommodation: 1500
        }
      };

      const status = calculateBudgetStatus(lowBudget, mockTripData);

      expect(status.alerts.length).toBeGreaterThan(0);

      // Should have exceeded alert for total
      const exceededAlert = status.alerts.find(a => a.type === 'exceeded' && !a.category);
      expect(exceededAlert).toBeDefined();
      expect(exceededAlert!.over_by).toBeGreaterThan(0);

      // Should have exceeded alert for accommodation
      const accomAlert = status.alerts.find(a => a.type === 'exceeded' && a.category === 'accommodation');
      expect(accomAlert).toBeDefined();
    });

    it('should generate warning alerts at 90%', () => {
      // Set budget that will be at 90-100%
      const warningBudget: TripBudget = {
        ...mockBudget,
        total_budget_usd: 2800, // 2600 spent / 2800 = 92.86%
      };

      const status = calculateBudgetStatus(warningBudget, mockTripData);

      const warningAlert = status.alerts.find(a => a.type === 'warning');
      expect(warningAlert).toBeDefined();
      expect(warningAlert!.percentage).toBeGreaterThan(90);
    });

    it('should generate info alerts at 80%', () => {
      // Set budget that will be at 80-90%
      const infoBudget: TripBudget = {
        ...mockBudget,
        total_budget_usd: 3100, // 2600 / 3100 = 83.87%
      };

      const status = calculateBudgetStatus(infoBudget, mockTripData);

      const infoAlert = status.alerts.find(a => a.type === 'info');
      expect(infoAlert).toBeDefined();
      expect(infoAlert!.percentage).toBeGreaterThan(80);
      expect(infoAlert!.percentage).toBeLessThan(90);
    });

    it('should handle costs without destination_id', () => {
      const dataWithOrphanedCost: TripData = {
        ...mockTripData,
        costs: [
          ...mockTripData.costs,
          {
            id: 'orphaned',
            category: 'other',
            amount: 100,
            amount_usd: 100,
            currency: 'USD'
            // No destination_id
          }
        ]
      };

      const status = calculateBudgetStatus(mockBudget, dataWithOrphanedCost);

      expect(status.total_spent).toBe(2700); // 2600 + 100
    });
  });

  describe('createDefaultBudget', () => {
    it('should create budget with default 10% contingency', () => {
      const budget = createDefaultBudget(mockTripData);

      const totalCosts = 2600; // Sum of all costs
      const expectedBudget = totalCosts * 1.1;

      expect(budget.total_budget_usd).toBeCloseTo(expectedBudget, 1);
      expect(budget.contingency_pct).toBe(10);
    });

    it('should create budget with custom contingency', () => {
      const budget = createDefaultBudget(mockTripData, 20);

      const totalCosts = 2600;
      const expectedBudget = totalCosts * 1.2;

      expect(budget.total_budget_usd).toBeCloseTo(expectedBudget, 1);
      expect(budget.contingency_pct).toBe(20);
    });

    it('should create category budgets with contingency', () => {
      const budget = createDefaultBudget(mockTripData, 10);

      // Accommodation: 1800 * 1.1 = 1980
      expect(budget.budgets_by_category.accommodation).toBeCloseTo(1980, 1);

      // Food: 500 * 1.1 = 550
      expect(budget.budgets_by_category.food).toBeCloseTo(550, 1);

      // Activity: 300 * 1.1 = 330
      expect(budget.budgets_by_category.activity).toBeCloseTo(330, 1);
    });

    it('should create destination budgets with contingency', () => {
      const budget = createDefaultBudget(mockTripData, 10);

      // Tokyo: 1500 * 1.1 = 1650
      expect(budget.budgets_by_destination['Tokyo, Japan']).toBeCloseTo(1650, 1);

      // Paris: 1100 * 1.1 = 1210
      expect(budget.budgets_by_destination['Paris, France']).toBeCloseTo(1210, 1);
    });

    it('should set timestamps', () => {
      const budget = createDefaultBudget(mockTripData);

      expect(budget.created_at).toBeDefined();
      expect(budget.updated_at).toBeDefined();

      const createdDate = new Date(budget.created_at!);
      const updatedDate = new Date(budget.updated_at!);

      expect(createdDate.getTime()).toBeLessThanOrEqual(Date.now());
      expect(updatedDate.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should handle empty costs', () => {
      const emptyData: TripData = {
        locations: mockTripData.locations,
        legs: [],
        costs: [],
        countryNotes: {}
      };

      const budget = createDefaultBudget(emptyData);

      expect(budget.total_budget_usd).toBe(0);
      expect(Object.keys(budget.budgets_by_category).length).toBe(0);
      expect(Object.keys(budget.budgets_by_destination).length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle division by zero in percentage calculation', () => {
      const zeroBudget: TripBudget = {
        total_budget_usd: 0,
        budgets_by_category: {},
        budgets_by_destination: {},
        contingency_pct: 0,
        alerts: []
      };

      const status = calculateBudgetStatus(zeroBudget, mockTripData);

      expect(status.percentage_used).toBe(Infinity); // 2600 / 0
    });

    it('should handle negative remaining budget', () => {
      const lowBudget: TripBudget = {
        total_budget_usd: 1000,
        budgets_by_category: {
          accommodation: 500
        },
        budgets_by_destination: {},
        contingency_pct: 10,
        alerts: []
      };

      const status = calculateBudgetStatus(lowBudget, mockTripData);

      expect(status.total_remaining).toBeLessThan(0);
      expect(status.percentage_used).toBeGreaterThan(100);
    });

    it('should handle costs with amount_usd field', () => {
      const dataWithAmountUSD: TripData = {
        ...mockTripData,
        costs: mockTripData.costs.map(c => ({
          ...c,
          amount_usd: c.amount * 1.1 // Different from amount
        }))
      };

      const status = calculateBudgetStatus(mockBudget, dataWithAmountUSD);

      // Should use amount_usd
      expect(status.total_spent).toBe(2600 * 1.1);
    });
  });
});
