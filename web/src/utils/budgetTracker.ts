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
  by_destination: Record<string, {
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
 * Calculate total costs by destination from cost items
 */
function calculateCostsByDestination(costs: TripCost[], tripData: TripData): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const cost of costs) {
    const destId = cost.destination_id || cost.destinationId;
    if (!destId) continue;

    // Find destination name
    const location = tripData.locations.find(loc => loc.id === destId);
    const destName = location?.name || location?.city || String(destId);

    const amount = cost.amount_usd || cost.amount || 0;
    totals[destName] = (totals[destName] || 0) + amount;
  }

  return totals;
}

/**
 * Generate budget alerts based on spending vs budget
 */
function generateBudgetAlerts(
  budget: TripBudget,
  costsByCategory: Record<string, number>,
  costsByDestination: Record<string, number>,
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

  // Check destination budgets
  for (const [destination, budgetAmount] of Object.entries(budget.budgets_by_destination)) {
    const spent = costsByDestination[destination] || 0;
    const percentage = (spent / budgetAmount) * 100;

    if (percentage > 100) {
      alerts.push({
        type: 'exceeded',
        destination,
        current_spend: spent,
        budget_amount: budgetAmount,
        over_by: spent - budgetAmount,
        percentage,
        message: `${destination} budget exceeded by $${(spent - budgetAmount).toFixed(0)}`
      });
    } else if (percentage > 90) {
      alerts.push({
        type: 'warning',
        destination,
        current_spend: spent,
        budget_amount: budgetAmount,
        percentage,
        message: `${destination} budget at ${percentage.toFixed(1)}%`
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
  const costsByDestination = calculateCostsByDestination(costs, tripData);

  const totalSpent = Object.values(costsByCategory).reduce((sum, val) => sum + val, 0);
  const totalRemaining = budget.total_budget_usd - totalSpent;
  const percentageUsed = (totalSpent / budget.total_budget_usd) * 100;

  // Generate alerts
  const alerts = generateBudgetAlerts(budget, costsByCategory, costsByDestination, totalSpent);

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

  // Calculate by-destination status
  const by_destination: Record<string, any> = {};
  for (const [destination, budgetAmount] of Object.entries(budget.budgets_by_destination)) {
    const spent = costsByDestination[destination] || 0;
    by_destination[destination] = {
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
    by_destination
  };
}

/**
 * Create a default budget based on current costs
 */
export function createDefaultBudget(tripData: TripData, contingencyPct: number = 10): TripBudget {
  const costs = tripData.costs || [];
  const costsByCategory = calculateCostsByCategory(costs);
  const costsByDestination = calculateCostsByDestination(costs, tripData);

  const totalSpent = Object.values(costsByCategory).reduce((sum, val) => sum + val, 0);

  // Add contingency buffer
  const totalBudget = totalSpent * (1 + contingencyPct / 100);

  // Create category budgets with buffer
  const budgets_by_category: Record<string, number> = {};
  for (const [category, spent] of Object.entries(costsByCategory)) {
    budgets_by_category[category] = spent * (1 + contingencyPct / 100);
  }

  // Create destination budgets with buffer
  const budgets_by_destination: Record<string, number> = {};
  for (const [destination, spent] of Object.entries(costsByDestination)) {
    budgets_by_destination[destination] = spent * (1 + contingencyPct / 100);
  }

  return {
    total_budget_usd: totalBudget,
    budgets_by_category,
    budgets_by_destination,
    contingency_pct: contingencyPct,
    alerts: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
