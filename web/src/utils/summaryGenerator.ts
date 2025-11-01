/**
 * Non-AI Itinerary Summary Generator
 * Generates formatted HTML summaries from trip data
 */

import { TripData, TripLocation } from '../types/trip';
import { aggregateByCountry, groupByContinent, groupByRegion, calculateCountryStats, CountryStay } from './countryAggregator';
import { formatDateRange, formatDuration, formatCurrency, formatList, groupBy, getMonthName, getYear } from './summaryFormatters';

export interface SummaryOptions {
  showCosts: boolean;
  includeExecutive: boolean;
  includeDetailed: boolean;
  includeFinancial: boolean;
  includeTimeline: boolean;
  detailLevel: 'summary' | 'full';
  groupBy: 'country' | 'region' | 'leg';
}

export interface SummaryData {
  tripName: string;
  scenarioVersion?: number;
  scenarioUpdatedAt?: string;
  travelers: string[];
  startDate: string;
  endDate: string;
  totalDays: number;
  totalCost: number;
  stats: TripStats;
  countryStays: CountryStay[];
  continents: Map<string, CountryStay[]>;
  regions: Map<string, any>;
  locations: TripLocation[];
}

export interface ScenarioMetadata {
  name: string;
  version?: number;
  updatedAt?: string;
}

export interface TripStats {
  totalCountries: number;
  totalContinents: number;
  totalLocations: number;
  totalDays: number;
  totalCosts: number;
  averageDaysPerCountry: number;
  averageCostPerDay: number;
  longestStay: { country: string; days: number } | null;
  shortestStay: { country: string; days: number } | null;
  mostExpensive: { country: string; cost: number } | null;
  leastExpensive: { country: string; cost: number } | null;
  transportModes: Map<string, number>;
  activityTypes: Map<string, number>;
  costsByCategory: Record<string, number>;
  monthlyBreakdown: Map<string, { days: number; countries: string[] }>;
}

/**
 * Calculate comprehensive trip statistics
 */
export function calculateTripStats(tripData: TripData, countryStays: CountryStay[]): TripStats {
  const stats = calculateCountryStats(countryStays);

  // Find longest and shortest stays
  const countriesWithDays = countryStays.filter(c => c.totalDays > 0);
  let longestStay = null;
  let shortestStay = null;

  if (countriesWithDays.length > 0) {
    const sorted = [...countriesWithDays].sort((a, b) => b.totalDays - a.totalDays);
    longestStay = { country: sorted[0].country, days: sorted[0].totalDays };
    shortestStay = { country: sorted[sorted.length - 1].country, days: sorted[sorted.length - 1].totalDays };
  }

  // Find most and least expensive
  const countriesWithCosts = countryStays.filter(c => c.totalCosts > 0);
  let mostExpensive = null;
  let leastExpensive = null;

  if (countriesWithCosts.length > 0) {
    const sorted = [...countriesWithCosts].sort((a, b) => b.totalCosts - a.totalCosts);
    mostExpensive = { country: sorted[0].country, cost: sorted[0].totalCosts };
    leastExpensive = { country: sorted[sorted.length - 1].country, cost: sorted[sorted.length - 1].totalCosts };
  }

  // Count transport modes
  const transportModes = new Map<string, number>();
  tripData.locations.forEach(loc => {
    if (loc.transport_from_previous) {
      const mode = loc.transport_from_previous.toLowerCase();
      transportModes.set(mode, (transportModes.get(mode) || 0) + 1);
    }
    if (loc.transport_segments) {
      loc.transport_segments.forEach(seg => {
        const mode = seg.mode.toLowerCase();
        transportModes.set(mode, (transportModes.get(mode) || 0) + 1);
      });
    }
  });

  // Count activity types
  const activityTypes = new Map<string, number>();
  tripData.locations.forEach(loc => {
    if (loc.activity_type) {
      const type = loc.activity_type;
      activityTypes.set(type, (activityTypes.get(type) || 0) + 1);
    }
  });

  // Aggregate costs by category across all countries
  const costsByCategory: Record<string, number> = {};
  countryStays.forEach(country => {
    Object.entries(country.costsByCategory).forEach(([category, amount]) => {
      costsByCategory[category] = (costsByCategory[category] || 0) + amount;
    });
  });

  // Monthly breakdown
  const monthlyBreakdown = new Map<string, { days: number; countries: string[] }>();
  tripData.locations.forEach(loc => {
    if (loc.arrival_date) {
      const monthKey = `${getMonthName(loc.arrival_date)} ${getYear(loc.arrival_date)}`;
      if (!monthlyBreakdown.has(monthKey)) {
        monthlyBreakdown.set(monthKey, { days: 0, countries: [] });
      }
      const entry = monthlyBreakdown.get(monthKey)!;
      entry.days += loc.duration_days || 0;
      if (loc.country && !entry.countries.includes(loc.country)) {
        entry.countries.push(loc.country);
      }
    }
  });

  // Count continents
  const continents = new Set(countryStays.map(c => c.continent).filter(c => c));

  return {
    totalCountries: stats.totalCountries,
    totalContinents: continents.size,
    totalLocations: tripData.locations.length,
    totalDays: stats.totalDays,
    totalCosts: stats.totalCosts,
    averageDaysPerCountry: stats.averageDaysPerCountry,
    averageCostPerDay: stats.totalDays > 0 ? stats.totalCosts / stats.totalDays : 0,
    longestStay,
    shortestStay,
    mostExpensive,
    leastExpensive,
    transportModes,
    activityTypes,
    costsByCategory,
    monthlyBreakdown
  };
}

/**
 * Prepare summary data from trip data
 */
export function prepareSummaryData(tripData: TripData, scenarioMetadata?: ScenarioMetadata): SummaryData {
  const countryStays = aggregateByCountry(tripData);
  const continents = groupByContinent(countryStays);
  const regions = groupByRegion(countryStays);
  const stats = calculateTripStats(tripData, countryStays);

  // Determine trip dates
  const allDates = tripData.locations
    .filter(loc => loc.arrival_date)
    .map(loc => new Date(loc.arrival_date!).getTime());

  const startDate = allDates.length > 0
    ? new Date(Math.min(...allDates)).toISOString().split('T')[0]
    : '';

  const allEndDates = tripData.locations
    .filter(loc => loc.departure_date)
    .map(loc => new Date(loc.departure_date!).getTime());

  const endDate = allEndDates.length > 0
    ? new Date(Math.max(...allEndDates)).toISOString().split('T')[0]
    : '';

  // Use scenario name if provided, otherwise extract from first leg or use default
  const tripName = scenarioMetadata?.name
    || (tripData.legs.length > 0 && tripData.legs[0].name)
    || 'World Travel Itinerary';

  // Extract travelers (placeholder - could be added to trip data)
  const travelers: string[] = [];

  return {
    tripName,
    scenarioVersion: scenarioMetadata?.version,
    scenarioUpdatedAt: scenarioMetadata?.updatedAt,
    travelers,
    startDate,
    endDate,
    totalDays: stats.totalDays,
    totalCost: stats.totalCosts,
    stats,
    countryStays,
    continents,
    regions,
    locations: tripData.locations
  };
}

/**
 * Generate route visualization data
 */
export function generateRouteVisualization(summaryData: SummaryData): string[] {
  const route: string[] = [];

  // Get locations in chronological order
  const sortedLocations = [...summaryData.locations]
    .filter(loc => loc.arrival_date)
    .sort((a, b) => {
      const dateA = new Date(a.arrival_date!).getTime();
      const dateB = new Date(b.arrival_date!).getTime();
      return dateA - dateB;
    });

  // Group by country in order
  let currentCountry = '';
  sortedLocations.forEach(loc => {
    if (loc.country && loc.country !== currentCountry) {
      currentCountry = loc.country;
      route.push(currentCountry);
    }
  });

  return route;
}

/**
 * Extract highlights from locations
 */
export function extractHighlights(locations: TripLocation[], maxHighlights: number = 20): string[] {
  const allHighlights: string[] = [];

  locations.forEach(loc => {
    if (loc.highlights && Array.isArray(loc.highlights)) {
      allHighlights.push(...loc.highlights);
    }
  });

  // Remove duplicates and limit
  const uniqueHighlights = Array.from(new Set(allHighlights));
  return uniqueHighlights.slice(0, maxHighlights);
}

/**
 * Group locations by month
 */
export function groupLocationsByMonth(locations: TripLocation[]): Map<string, TripLocation[]> {
  return groupBy(
    locations.filter(loc => loc.arrival_date),
    loc => `${getMonthName(loc.arrival_date!)} ${getYear(loc.arrival_date!)}`
  );
}

/**
 * Get top N countries by a metric
 */
export function getTopCountries(
  countryStays: CountryStay[],
  metric: 'days' | 'cost',
  limit: number = 5
): CountryStay[] {
  const sorted = [...countryStays].sort((a, b) => {
    if (metric === 'days') {
      return b.totalDays - a.totalDays;
    } else {
      return b.totalCosts - a.totalCosts;
    }
  });

  return sorted.slice(0, limit);
}

/**
 * Calculate cost breakdown percentages
 */
export function calculateCostPercentages(costsByCategory: Record<string, number>): Record<string, number> {
  const total = Object.values(costsByCategory).reduce((sum, amount) => sum + amount, 0);
  const percentages: Record<string, number> = {};

  if (total > 0) {
    Object.entries(costsByCategory).forEach(([category, amount]) => {
      percentages[category] = (amount / total) * 100;
    });
  }

  return percentages;
}

/**
 * Default summary options
 */
export const DEFAULT_SUMMARY_OPTIONS: SummaryOptions = {
  showCosts: true,
  includeExecutive: true,
  includeDetailed: true,
  includeFinancial: true,
  includeTimeline: true,
  detailLevel: 'full',
  groupBy: 'country'
};
