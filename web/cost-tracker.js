/**
 * Cost Tracking System
 * Manages cost items, currency conversion, and aggregation for trip budgeting
 */

// ============================================================================
// Type Definitions (matching Python schema)
// ============================================================================

/**
 * @typedef {Object} CostItem
 * @property {string} id - Unique identifier
 * @property {'flight'|'accommodation'|'activity'|'food'|'transport'|'other'} category
 * @property {string} description
 * @property {number} amount - Amount in original currency
 * @property {string} currency - ISO 4217 currency code (USD, EUR, JPY, etc.)
 * @property {number} amountUSD - Amount converted to USD
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {number|null} destinationId - Associated destination ID
 * @property {'estimated'|'researched'|'booked'|'paid'} bookingStatus
 * @property {'manual'|'ai_estimate'|'web_research'|'booking_api'} source
 * @property {string|null} notes
 */

/**
 * @typedef {Object} CostsByCategory
 * @property {number} flight
 * @property {number} accommodation
 * @property {number} activity
 * @property {number} food
 * @property {number} transport
 * @property {number} other
 */

/**
 * @typedef {Object} DestinationCost
 * @property {number} destinationId
 * @property {string} destinationName
 * @property {CostsByCategory} costsByCategory
 * @property {number} totalUSD
 * @property {number} costPerDay
 * @property {Object.<string, number>} currencyBreakdown
 */

/**
 * @typedef {Object} CostSummary
 * @property {number} totalUSD
 * @property {CostsByCategory} costsByCategory
 * @property {DestinationCost[]} costsByDestination
 * @property {number|null} costPerPerson
 * @property {number} costPerDay
 * @property {Object.<string, number>} currencyTotals
 */

// ============================================================================
// Cost Tracker Class
// ============================================================================

class CostTracker {
  constructor() {
    this.costs = []; // Array of CostItem
    this.exchangeRates = {}; // Cache of exchange rates
    this.exchangeRateCache = null;
    this.exchangeRateCacheTime = null;
    this.CACHE_DURATION_MS = 3600000; // 1 hour
  }

  /**
   * Generate unique ID for cost item
   * @returns {string}
   */
  generateId() {
    return `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Fetch current exchange rates (cached)
   * @returns {Promise<Object.<string, number>>}
   */
  async getExchangeRates() {
    const now = Date.now();

    // Return cached rates if valid
    if (this.exchangeRateCache &&
        this.exchangeRateCacheTime &&
        (now - this.exchangeRateCacheTime) < this.CACHE_DURATION_MS) {
      return this.exchangeRateCache;
    }

    try {
      // Using exchangerate-api.com free tier (1500 requests/month)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();

      this.exchangeRateCache = data.rates;
      this.exchangeRateCacheTime = now;

      return data.rates;
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);

      // Fallback to hardcoded rates if API fails
      return {
        USD: 1.00,
        EUR: 0.92,
        GBP: 0.79,
        JPY: 149.50,
        CNY: 7.24,
        INR: 83.12,
        BRL: 4.97,
        ARS: 350.00,
        IDR: 15625.00,
        PHP: 56.25,
        SGD: 1.35,
        MYR: 4.72,
        TWD: 31.50,
        KRW: 1320.00,
        NPR: 133.00,
        BTN: 83.12,
        DKK: 6.89,
        SEK: 10.87,
        NOK: 10.95,
        ISK: 138.50,
        TZS: 2500.00,
        RWF: 1305.00,
        NZD: 1.68,
        AUD: 1.54
      };
    }
  }

  /**
   * Convert amount from one currency to USD
   * @param {number} amount
   * @param {string} fromCurrency
   * @returns {Promise<number>}
   */
  async convertToUSD(amount, fromCurrency) {
    if (fromCurrency === 'USD') {
      return amount;
    }

    const rates = await this.getExchangeRates();
    const rate = rates[fromCurrency];

    if (!rate) {
      console.warn(`Exchange rate not found for ${fromCurrency}, using 1:1`);
      return amount;
    }

    return amount / rate;
  }

  /**
   * Add a cost item
   * @param {Partial<CostItem>} costData
   * @returns {Promise<CostItem>}
   */
  async addCost(costData) {
    const amountUSD = await this.convertToUSD(costData.amount, costData.currency);

    const costItem = {
      id: costData.id || this.generateId(),
      category: costData.category || 'other',
      description: costData.description || '',
      amount: costData.amount,
      currency: costData.currency || 'USD',
      amountUSD: amountUSD,
      date: costData.date || new Date().toISOString().split('T')[0],
      destinationId: costData.destinationId || null,
      bookingStatus: costData.bookingStatus || 'estimated',
      source: costData.source || 'manual',
      notes: costData.notes || null
    };

    this.costs.push(costItem);
    return costItem;
  }

  /**
   * Update a cost item
   * @param {string} id
   * @param {Partial<CostItem>} updates
   * @returns {Promise<CostItem|null>}
   */
  async updateCost(id, updates) {
    const index = this.costs.findIndex(c => c.id === id);
    if (index === -1) return null;

    const existing = this.costs[index];

    // Recalculate USD amount if amount or currency changed
    let amountUSD = existing.amountUSD;
    if (updates.amount !== undefined || updates.currency !== undefined) {
      const newAmount = updates.amount !== undefined ? updates.amount : existing.amount;
      const newCurrency = updates.currency !== undefined ? updates.currency : existing.currency;
      amountUSD = await this.convertToUSD(newAmount, newCurrency);
    }

    this.costs[index] = {
      ...existing,
      ...updates,
      amountUSD
    };

    return this.costs[index];
  }

  /**
   * Delete a cost item
   * @param {string} id
   * @returns {boolean}
   */
  deleteCost(id) {
    const index = this.costs.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.costs.splice(index, 1);
    return true;
  }

  /**
   * Get cost item by ID
   * @param {string} id
   * @returns {CostItem|null}
   */
  getCost(id) {
    return this.costs.find(c => c.id === id) || null;
  }

  /**
   * Get all cost items
   * @returns {CostItem[]}
   */
  getAllCosts() {
    return [...this.costs];
  }

  /**
   * Filter costs by various criteria
   * @param {Object} filters
   * @param {number} [filters.destinationId]
   * @param {string} [filters.category]
   * @param {string} [filters.startDate]
   * @param {string} [filters.endDate]
   * @returns {CostItem[]}
   */
  filterCosts(filters = {}) {
    return this.costs.filter(cost => {
      if (filters.destinationId !== undefined && cost.destinationId !== filters.destinationId) {
        return false;
      }
      if (filters.category && cost.category !== filters.category) {
        return false;
      }
      if (filters.startDate && cost.date < filters.startDate) {
        return false;
      }
      if (filters.endDate && cost.date > filters.endDate) {
        return false;
      }
      return true;
    });
  }

  /**
   * Calculate costs by category
   * @param {CostItem[]} costs
   * @returns {CostsByCategory}
   */
  calculateCostsByCategory(costs = this.costs) {
    const categories = {
      flight: 0,
      accommodation: 0,
      activity: 0,
      food: 0,
      transport: 0,
      other: 0
    };

    costs.forEach(cost => {
      if (categories.hasOwnProperty(cost.category)) {
        categories[cost.category] += cost.amountUSD;
      } else {
        categories.other += cost.amountUSD;
      }
    });

    return categories;
  }

  /**
   * Calculate costs by destination
   * @param {Object[]} destinations - Array of destination objects with id and name
   * @returns {DestinationCost[]}
   */
  calculateCostsByDestination(destinations) {
    return destinations.map(dest => {
      const destCosts = this.filterCosts({ destinationId: dest.id });
      const totalUSD = destCosts.reduce((sum, cost) => sum + cost.amountUSD, 0);
      const costsByCategory = this.calculateCostsByCategory(destCosts);

      // Calculate currency breakdown
      const currencyBreakdown = {};
      destCosts.forEach(cost => {
        currencyBreakdown[cost.currency] =
          (currencyBreakdown[cost.currency] || 0) + cost.amount;
      });

      // Calculate cost per day (assuming duration_days exists on destination)
      const costPerDay = dest.duration_days > 0 ? totalUSD / dest.duration_days : 0;

      return {
        destinationId: dest.id,
        destinationName: dest.name,
        costsByCategory,
        totalUSD,
        costPerDay,
        currencyBreakdown
      };
    });
  }

  /**
   * Get comprehensive cost summary
   * @param {Object} options
   * @param {Object[]} [options.destinations] - Destinations for breakdown
   * @param {number} [options.travelerCount] - Number of travelers
   * @param {number} [options.totalDays] - Total trip days
   * @returns {CostSummary}
   */
  getCostSummary(options = {}) {
    const totalUSD = this.costs.reduce((sum, cost) => sum + cost.amountUSD, 0);
    const costsByCategory = this.calculateCostsByCategory();

    const costsByDestination = options.destinations
      ? this.calculateCostsByDestination(options.destinations)
      : [];

    const costPerPerson = options.travelerCount
      ? totalUSD / options.travelerCount
      : null;

    const costPerDay = options.totalDays
      ? totalUSD / options.totalDays
      : 0;

    // Calculate currency totals
    const currencyTotals = {};
    this.costs.forEach(cost => {
      currencyTotals[cost.currency] =
        (currencyTotals[cost.currency] || 0) + cost.amount;
    });

    return {
      totalUSD,
      costsByCategory,
      costsByDestination,
      costPerPerson,
      costPerDay,
      currencyTotals
    };
  }

  /**
   * Load costs from JSON data
   * @param {CostItem[]} costsData
   */
  loadCosts(costsData) {
    this.costs = costsData || [];
  }

  /**
   * Export costs as JSON
   * @returns {CostItem[]}
   */
  exportCosts() {
    return this.costs;
  }
}

// ============================================================================
// Export
// ============================================================================

if (typeof window !== 'undefined') {
  window.CostTracker = CostTracker;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CostTracker };
}
