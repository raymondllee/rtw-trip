/**
 * Budget Tracking Utility (Recommendation J)
 * Calculates budget status, alerts, and provides budget management functions
 */

import type { TripBudget, BudgetAlert, TripCost, TripData } from '../types/trip';
import { calculateDestinationCosts } from '../../cost-utils';

export interface BudgetStatus {
  total_budget: number;
  total_spent: number;
  total_remaining: number;
  percentage_used: number;
  alerts: BudgetAlert[];
  by_category: Record<string, {
    budget: number;
    spent: number;
    remaining: number;
    percentage: number;
  }>;
  by_country: Record<string, {
    budget: number;
    spent: number;
    remaining: number;
    percentage: number;
  }>;
}

/**
 * Calculate total costs by category from cost items
 */
function calculateCostsByCategory(costs: TripCost[]): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const cost of costs) {
    const category = cost.category || 'other';
    const amount = cost.amount_usd || cost.amount || 0;
    totals[category] = (totals[category] || 0) + amount;
  }

  return totals;
}

/**
 * Calculate total costs by country from cost items
 */
function calculateCostsByCountry(costs: TripCost[], tripData: TripData): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const cost of costs) {
    const destId = cost.destination_id || cost.destinationId;
    if (!destId) continue;

    // Find country from location data
    const location = tripData.locations.find(loc => loc.id === destId);
    const country = location?.country;
    if (!country) continue;

    const amount = cost.amount_usd || cost.amount || 0;
    totals[country] = (totals[country] || 0) + amount;
  }

  return totals;
}

/**
 * Generate budget alerts based on spending vs budget
 */
function generateBudgetAlerts(
  budget: TripBudget,
  costsByCategory: Record<string, number>,
  costsByCountry: Record<string, number>,
  totalSpent: number
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  // Check total budget
  const totalPercentage = (totalSpent / budget.total_budget_usd) * 100;
  if (totalPercentage > 100) {
    alerts.push({
      type: 'exceeded',
      current_spend: totalSpent,
      budget_amount: budget.total_budget_usd,
      over_by: totalSpent - budget.total_budget_usd,
      percentage: totalPercentage,
      message: `Total budget exceeded by $${(totalSpent - budget.total_budget_usd).toFixed(0)} (${totalPercentage.toFixed(1)}%)`
    });
  } else if (totalPercentage > 90) {
    alerts.push({
      type: 'warning',
      current_spend: totalSpent,
      budget_amount: budget.total_budget_usd,
      percentage: totalPercentage,
      message: `Total budget at ${totalPercentage.toFixed(1)}% - approaching limit`
    });
  } else if (totalPercentage > 80) {
    alerts.push({
      type: 'info',
      current_spend: totalSpent,
      budget_amount: budget.total_budget_usd,
      percentage: totalPercentage,
      message: `Total budget at ${totalPercentage.toFixed(1)}%`
    });
  }

  // Check category budgets
  for (const [category, budgetAmount] of Object.entries(budget.budgets_by_category)) {
    const spent = costsByCategory[category] || 0;
    const percentage = (spent / budgetAmount) * 100;

    if (percentage > 100) {
      alerts.push({
        type: 'exceeded',
        category,
        current_spend: spent,
        budget_amount: budgetAmount,
        over_by: spent - budgetAmount,
        percentage,
        message: `${category} budget exceeded by $${(spent - budgetAmount).toFixed(0)}`
      });
    } else if (percentage > 90) {
      alerts.push({
        type: 'warning',
        category,
        current_spend: spent,
        budget_amount: budgetAmount,
        percentage,
        message: `${category} budget at ${percentage.toFixed(1)}%`
      });
    }
  }

  // Check country budgets
  for (const [country, budgetAmount] of Object.entries(budget.budgets_by_country || {})) {
    const spent = costsByCountry[country] || 0;
    const percentage = (spent / budgetAmount) * 100;

    if (percentage > 100) {
      alerts.push({
        type: 'exceeded',
        destination: country,
        current_spend: spent,
        budget_amount: budgetAmount,
        over_by: spent - budgetAmount,
        percentage,
        message: `${country} budget exceeded by $${(spent - budgetAmount).toFixed(0)}`
      });
    } else if (percentage > 90) {
      alerts.push({
        type: 'warning',
        destination: country,
        current_spend: spent,
        budget_amount: budgetAmount,
        percentage,
        message: `${country} budget at ${percentage.toFixed(1)}%`
      });
    }
  }

  return alerts;
}

/**
 * Calculate comprehensive budget status
 */
export function calculateBudgetStatus(budget: TripBudget, tripData: TripData): BudgetStatus {
  const costs = tripData.costs || [];

  // Calculate totals
  const costsByCategory = calculateCostsByCategory(costs);
  const costsByCountry = calculateCostsByCountry(costs, tripData);

  const totalSpent = Object.values(costsByCategory).reduce((sum, val) => sum + val, 0);
  const totalRemaining = budget.total_budget_usd - totalSpent;
  const percentageUsed = (totalSpent / budget.total_budget_usd) * 100;

  // Generate alerts
  const alerts = generateBudgetAlerts(budget, costsByCategory, costsByCountry, totalSpent);

  // Calculate by-category status
  const by_category: Record<string, any> = {};
  for (const [category, budgetAmount] of Object.entries(budget.budgets_by_category)) {
    const spent = costsByCategory[category] || 0;
    by_category[category] = {
      budget: budgetAmount,
      spent,
      remaining: budgetAmount - spent,
      percentage: (spent / budgetAmount) * 100
    };
  }

  // Calculate by-country status
  const by_country: Record<string, any> = {};
  for (const [country, budgetAmount] of Object.entries(budget.budgets_by_country || {})) {
    const spent = costsByCountry[country] || 0;
    by_country[country] = {
      budget: budgetAmount,
      spent,
      remaining: budgetAmount - spent,
      percentage: (spent / budgetAmount) * 100
    };
  }

  return {
    total_budget: budget.total_budget_usd,
    total_spent: totalSpent,
    total_remaining: totalRemaining,
    percentage_used: percentageUsed,
    alerts,
    by_category,
    by_country
  };
}

/**
 * Create a default budget based on current costs
 */
export function createDefaultBudget(tripData: TripData, contingencyPct: number = 10): TripBudget {
  const costs = tripData.costs || [];
  const costsByCategory = calculateCostsByCategory(costs);
  const costsByCountry = calculateCostsByCountry(costs, tripData);

  const totalSpent = Object.values(costsByCategory).reduce((sum, val) => sum + val, 0);

  // Add contingency buffer
  const totalBudget = totalSpent * (1 + contingencyPct / 100);

  // Create category budgets with buffer
  const budgets_by_category: Record<string, number> = {};
  for (const [category, spent] of Object.entries(costsByCategory)) {
    budgets_by_category[category] = spent * (1 + contingencyPct / 100);
  }

  // Create country budgets with buffer
  const budgets_by_country: Record<string, number> = {};
  for (const [country, spent] of Object.entries(costsByCountry)) {
    budgets_by_country[country] = spent * (1 + contingencyPct / 100);
  }

  return {
    total_budget_usd: totalBudget,
    budgets_by_category,
    budgets_by_country,
    contingency_pct: contingencyPct,
    alerts: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
