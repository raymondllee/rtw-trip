"use strict";
/**
 * Budget Tracking Utility (Recommendation J)
 * Calculates budget status, alerts, and provides budget management functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBudgetStatus = calculateBudgetStatus;
exports.createDefaultBudget = createDefaultBudget;
/**
 * Calculate total costs by category from cost items
 */
function calculateCostsByCategory(costs) {
    var totals = {};
    for (var _i = 0, costs_1 = costs; _i < costs_1.length; _i++) {
        var cost = costs_1[_i];
        var category = cost.category || 'other';
        var amount = cost.amount_usd || cost.amount || 0;
        totals[category] = (totals[category] || 0) + amount;
    }
    return totals;
}
/**
 * Calculate total costs by country from cost items
 */
function calculateCostsByCountry(costs, tripData) {
    var totals = {};
    var _loop_1 = function (cost) {
        var destId = cost.destination_id || cost.destinationId;
        if (!destId)
            return "continue";
        // Find country from location data
        var location_1 = tripData.locations.find(function (loc) { return loc.id === destId; });
        var country = location_1 === null || location_1 === void 0 ? void 0 : location_1.country;
        if (!country)
            return "continue";
        var amount = cost.amount_usd || cost.amount || 0;
        totals[country] = (totals[country] || 0) + amount;
    };
    for (var _i = 0, costs_2 = costs; _i < costs_2.length; _i++) {
        var cost = costs_2[_i];
        _loop_1(cost);
    }
    return totals;
}
/**
 * Generate budget alerts based on spending vs budget
 */
function generateBudgetAlerts(budget, costsByCategory, costsByCountry, totalSpent) {
    var alerts = [];
    // Check total budget
    var totalPercentage = (totalSpent / budget.total_budget_usd) * 100;
    if (totalPercentage > 100) {
        alerts.push({
            type: 'exceeded',
            current_spend: totalSpent,
            budget_amount: budget.total_budget_usd,
            over_by: totalSpent - budget.total_budget_usd,
            percentage: totalPercentage,
            message: "Total budget exceeded by $".concat((totalSpent - budget.total_budget_usd).toFixed(0), " (").concat(totalPercentage.toFixed(1), "%)")
        });
    }
    else if (totalPercentage > 90) {
        alerts.push({
            type: 'warning',
            current_spend: totalSpent,
            budget_amount: budget.total_budget_usd,
            percentage: totalPercentage,
            message: "Total budget at ".concat(totalPercentage.toFixed(1), "% - approaching limit")
        });
    }
    else if (totalPercentage > 80) {
        alerts.push({
            type: 'info',
            current_spend: totalSpent,
            budget_amount: budget.total_budget_usd,
            percentage: totalPercentage,
            message: "Total budget at ".concat(totalPercentage.toFixed(1), "%")
        });
    }
    // Check category budgets
    for (var _i = 0, _a = Object.entries(budget.budgets_by_category); _i < _a.length; _i++) {
        var _b = _a[_i], category = _b[0], budgetAmount = _b[1];
        var spent = costsByCategory[category] || 0;
        var percentage = (spent / budgetAmount) * 100;
        if (percentage > 100) {
            alerts.push({
                type: 'exceeded',
                category: category,
                current_spend: spent,
                budget_amount: budgetAmount,
                over_by: spent - budgetAmount,
                percentage: percentage,
                message: "".concat(category, " budget exceeded by $").concat((spent - budgetAmount).toFixed(0))
            });
        }
        else if (percentage > 90) {
            alerts.push({
                type: 'warning',
                category: category,
                current_spend: spent,
                budget_amount: budgetAmount,
                percentage: percentage,
                message: "".concat(category, " budget at ").concat(percentage.toFixed(1), "%")
            });
        }
    }
    // Check country budgets
    for (var _c = 0, _d = Object.entries(budget.budgets_by_country || {}); _c < _d.length; _c++) {
        var _e = _d[_c], country = _e[0], budgetAmount = _e[1];
        var spent = costsByCountry[country] || 0;
        var percentage = (spent / budgetAmount) * 100;
        if (percentage > 100) {
            alerts.push({
                type: 'exceeded',
                destination: country,
                current_spend: spent,
                budget_amount: budgetAmount,
                over_by: spent - budgetAmount,
                percentage: percentage,
                message: "".concat(country, " budget exceeded by $").concat((spent - budgetAmount).toFixed(0))
            });
        }
        else if (percentage > 90) {
            alerts.push({
                type: 'warning',
                destination: country,
                current_spend: spent,
                budget_amount: budgetAmount,
                percentage: percentage,
                message: "".concat(country, " budget at ").concat(percentage.toFixed(1), "%")
            });
        }
    }
    return alerts;
}
/**
 * Calculate comprehensive budget status
 */
function calculateBudgetStatus(budget, tripData) {
    var costs = tripData.costs || [];
    // Calculate totals
    var costsByCategory = calculateCostsByCategory(costs);
    var costsByCountry = calculateCostsByCountry(costs, tripData);
    var totalSpent = Object.values(costsByCategory).reduce(function (sum, val) { return sum + val; }, 0);
    var totalRemaining = budget.total_budget_usd - totalSpent;
    var percentageUsed = (totalSpent / budget.total_budget_usd) * 100;
    // Generate alerts
    var alerts = generateBudgetAlerts(budget, costsByCategory, costsByCountry, totalSpent);
    // Calculate by-category status
    var by_category = {};
    for (var _i = 0, _a = Object.entries(budget.budgets_by_category); _i < _a.length; _i++) {
        var _b = _a[_i], category = _b[0], budgetAmount = _b[1];
        var spent = costsByCategory[category] || 0;
        by_category[category] = {
            budget: budgetAmount,
            spent: spent,
            remaining: budgetAmount - spent,
            percentage: (spent / budgetAmount) * 100
        };
    }
    // Calculate by-country status
    var by_country = {};
    for (var _c = 0, _d = Object.entries(budget.budgets_by_country || {}); _c < _d.length; _c++) {
        var _e = _d[_c], country = _e[0], budgetAmount = _e[1];
        var spent = costsByCountry[country] || 0;
        by_country[country] = {
            budget: budgetAmount,
            spent: spent,
            remaining: budgetAmount - spent,
            percentage: (spent / budgetAmount) * 100
        };
    }
    return {
        total_budget: budget.total_budget_usd,
        total_spent: totalSpent,
        total_remaining: totalRemaining,
        percentage_used: percentageUsed,
        alerts: alerts,
        by_category: by_category,
        by_country: by_country
    };
}
/**
 * Create a default budget based on current costs
 */
function createDefaultBudget(tripData, contingencyPct) {
    if (contingencyPct === void 0) { contingencyPct = 10; }
    var costs = tripData.costs || [];
    var costsByCategory = calculateCostsByCategory(costs);
    var costsByCountry = calculateCostsByCountry(costs, tripData);
    var totalSpent = Object.values(costsByCategory).reduce(function (sum, val) { return sum + val; }, 0);
    // Add contingency buffer
    var totalBudget = totalSpent * (1 + contingencyPct / 100);
    // Create category budgets with buffer
    var budgets_by_category = {};
    for (var _i = 0, _a = Object.entries(costsByCategory); _i < _a.length; _i++) {
        var _b = _a[_i], category = _b[0], spent = _b[1];
        budgets_by_category[category] = spent * (1 + contingencyPct / 100);
    }
    // Create country budgets with buffer
    var budgets_by_country = {};
    for (var _c = 0, _d = Object.entries(costsByCountry); _c < _d.length; _c++) {
        var _e = _d[_c], country = _e[0], spent = _e[1];
        budgets_by_country[country] = spent * (1 + contingencyPct / 100);
    }
    return {
        total_budget_usd: totalBudget,
        budgets_by_category: budgets_by_category,
        budgets_by_country: budgets_by_country,
        contingency_pct: contingencyPct,
        alerts: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}
