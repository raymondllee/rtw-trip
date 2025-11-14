import { TripData, TripLocation, TripCost } from '../types/trip';
import { COUNTRY_TO_REGION } from '../data/regionMappings';

/**
 * Represents a single visit period to a country
 */
export interface VisitPeriod {
  startDate: string;
  endDate: string;
  destinations: TripLocation[];
  days: number;
}

/**
 * Represents aggregated stay information for a country
 */
export interface CountryStay {
  country: string;
  countryCode?: string;
  continent?: string;
  region?: string;
  totalDays: number;
  destinations: TripLocation[];
  startDate?: string;
  endDate?: string;
  visits: VisitPeriod[];  // Track multiple separate visits
  totalCosts: number;
  costsByCategory: Record<string, number>;
  notes?: string;
}

/**
 * Represents aggregated stay information for a region
 */
export interface RegionStay {
  region: string;
  continent?: string;
  totalDays: number;
  totalWeeks: number;
  countries: string[];
  countryStays: CountryStay[];
  startDate?: string;
  endDate?: string;
  totalCosts: number;
}

/**
 * Calculate the number of days between two dates
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Group destinations into separate visit periods
 * Visits are considered separate if there's a gap of more than 1 day between them
 */
function groupIntoVisits(destinations: TripLocation[]): VisitPeriod[] {
  if (destinations.length === 0) return [];

  // Sort destinations by arrival date
  const sorted = [...destinations]
    .filter(d => d.arrival_date && d.departure_date)
    .sort((a, b) => a.arrival_date!.localeCompare(b.arrival_date!));

  if (sorted.length === 0) return [];

  const visits: VisitPeriod[] = [];
  let currentVisit: VisitPeriod = {
    startDate: sorted[0].arrival_date!,
    endDate: sorted[0].departure_date!,
    destinations: [sorted[0]],
    days: sorted[0].duration_days || 0
  };

  for (let i = 1; i < sorted.length; i++) {
    const dest = sorted[i];
    const prevDest = sorted[i - 1];

    // Calculate gap between previous departure and current arrival
    const gap = daysBetween(prevDest.departure_date!, dest.arrival_date!);

    // If gap is more than 1 day, it's a new visit
    if (gap > 1) {
      visits.push(currentVisit);
      currentVisit = {
        startDate: dest.arrival_date!,
        endDate: dest.departure_date!,
        destinations: [dest],
        days: dest.duration_days || 0
      };
    } else {
      // Continue current visit
      currentVisit.endDate = dest.departure_date!;
      currentVisit.destinations.push(dest);
      currentVisit.days += dest.duration_days || 0;
    }
  }

  // Don't forget the last visit
  visits.push(currentVisit);

  return visits;
}

/**
 * Aggregates destinations by country, calculating total days and costs
 * @param tripData The complete trip data including locations and costs
 * @returns Array of country stays sorted by start date
 */
export function aggregateByCountry(tripData: TripData): CountryStay[] {
  const countryMap = new Map<string, CountryStay>();

  // Group destinations by country
  tripData.locations.forEach(location => {
    if (!location.country) return;

    const country = location.country;

    if (!countryMap.has(country)) {
      // Initialize country stay
      const regionMapping = COUNTRY_TO_REGION[country];
      countryMap.set(country, {
        country,
        countryCode: location.country_code,
        continent: location.continent || regionMapping?.continent,
        region: location.region || regionMapping?.region,
        totalDays: 0,
        destinations: [],
        visits: [],
        totalCosts: 0,
        costsByCategory: {}
      });
    }

    const countryStay = countryMap.get(country)!;

    // Add destination
    countryStay.destinations.push(location);

    // Add days
    if (location.duration_days) {
      countryStay.totalDays += location.duration_days;
    }

    // Track date range (overall)
    if (location.arrival_date) {
      if (!countryStay.startDate || location.arrival_date < countryStay.startDate) {
        countryStay.startDate = location.arrival_date;
      }
    }

    if (location.departure_date) {
      if (!countryStay.endDate || location.departure_date > countryStay.endDate) {
        countryStay.endDate = location.departure_date;
      }
    }
  });

  // Calculate separate visits for each country
  for (const countryStay of countryMap.values()) {
    countryStay.visits = groupIntoVisits(countryStay.destinations);
  }

  // Aggregate costs by country
  console.log(`🔍 [countryAggregator] Starting cost aggregation with ${tripData.costs.length} total costs`);

  // Track cost IDs to detect duplicates
  const costIdCount = new Map<string, number>();
  const costIdsByCountry = new Map<string, Set<string>>();

  tripData.costs.forEach(cost => {
    if (!cost.destinationId && !cost.destination_id) return;

    const destId = cost.destinationId || cost.destination_id;

    // Find the destination and its country
    const destination = tripData.locations.find(loc => loc.id === destId);
    if (!destination?.country) return;

    const countryStay = countryMap.get(destination.country);
    if (!countryStay) return;

    // Track cost ID usage for duplicate detection
    const costId = cost.id || `${destId}-${cost.category}-${cost.amount}`;
    costIdCount.set(costId, (costIdCount.get(costId) || 0) + 1);

    if (!costIdsByCountry.has(destination.country)) {
      costIdsByCountry.set(destination.country, new Set());
    }
    costIdsByCountry.get(destination.country)!.add(costId);

    // Add to total costs - use amount_usd if available, otherwise fallback to amount
    const costAmount = (cost as any).amount_usd ?? cost.amount ?? 0;
    countryStay.totalCosts += costAmount;

    // Add to category costs
    const category = cost.category || 'other';
    countryStay.costsByCategory[category] = (countryStay.costsByCategory[category] || 0) + costAmount;
  });

  // Log duplicate detection results
  const duplicates = Array.from(costIdCount.entries()).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.warn(`⚠️ [countryAggregator] Found ${duplicates.length} duplicate cost IDs:`);
    duplicates.forEach(([id, count]) => {
      console.warn(`  - Cost ID "${id}" appears ${count} times`);
    });
  }

  // Log cost counts by country with sample cost details
  for (const [country, costIds] of costIdsByCountry) {
    const countryStay = countryMap.get(country);
    if (countryStay) {
      console.log(`💰 [countryAggregator] ${country}: ${costIds.size} unique costs = $${countryStay.totalCosts.toLocaleString()}`);

      // Show sample costs for countries with suspiciously high totals
      if (countryStay.totalCosts > 100000) {
        const countryCosts = tripData.costs.filter(cost => {
          const destId = cost.destinationId || cost.destination_id;
          const destination = tripData.locations.find(loc => loc.id === destId);
          return destination?.country === country;
        }).slice(0, 5); // Show first 5 costs

        console.warn(`  ⚠️ Sample costs (first 5) - NOW USING amount_usd:`);
        countryCosts.forEach(cost => {
          const costAmount = (cost as any).amount_usd ?? cost.amount ?? 0;
          console.warn(`    - ${cost.category}: amount=${cost.amount?.toLocaleString()}, amount_usd=${(cost as any).amount_usd} → USING: $${costAmount}`);
        });
      }
    }
  }

  // Convert to array and sort by start date
  const countryStays = Array.from(countryMap.values());
  countryStays.sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return a.startDate.localeCompare(b.startDate);
  });

  // Add notes from tripData.countryNotes if available
  if (tripData.countryNotes) {
    countryStays.forEach(stay => {
      if (tripData.countryNotes![stay.country]) {
        stay.notes = tripData.countryNotes![stay.country];
      }
    });
  }

  return countryStays;
}

/**
 * Groups country stays by continent for hierarchical display
 * @param countryStays Array of country stays
 * @returns Map of continent to country stays
 */
export function groupByContinent(countryStays: CountryStay[]): Map<string, CountryStay[]> {
  const continentMap = new Map<string, CountryStay[]>();

  countryStays.forEach(stay => {
    const continent = stay.continent || 'Unknown';

    if (!continentMap.has(continent)) {
      continentMap.set(continent, []);
    }

    continentMap.get(continent)!.push(stay);
  });

  return continentMap;
}

/**
 * Groups country stays by region for hierarchical display
 * @param countryStays Array of country stays
 * @returns Map of region to aggregated region stays
 */
export function groupByRegion(countryStays: CountryStay[]): Map<string, RegionStay> {
  const regionMap = new Map<string, RegionStay>();

  countryStays.forEach(stay => {
    const region = stay.region || 'Unknown';

    if (!regionMap.has(region)) {
      regionMap.set(region, {
        region,
        continent: stay.continent,
        totalDays: 0,
        totalWeeks: 0,
        countries: [],
        countryStays: [],
        totalCosts: 0
      });
    }

    const regionStay = regionMap.get(region)!;
    regionStay.countryStays.push(stay);
    regionStay.totalDays += stay.totalDays;
    regionStay.totalCosts += stay.totalCosts;

    // Track unique countries
    if (!regionStay.countries.includes(stay.country)) {
      regionStay.countries.push(stay.country);
    }

    // Track date range
    if (stay.startDate) {
      if (!regionStay.startDate || stay.startDate < regionStay.startDate) {
        regionStay.startDate = stay.startDate;
      }
    }

    if (stay.endDate) {
      if (!regionStay.endDate || stay.endDate > regionStay.endDate) {
        regionStay.endDate = stay.endDate;
      }
    }
  });

  // Calculate weeks for each region
  for (const regionStay of regionMap.values()) {
    regionStay.totalWeeks = Math.round((regionStay.totalDays / 7) * 10) / 10; // Round to 1 decimal
  }

  return regionMap;
}

/**
 * Calculates summary statistics for country stays
 * @param countryStays Array of country stays
 * @returns Summary statistics
 */
export function calculateCountryStats(countryStays: CountryStay[]) {
  return {
    totalCountries: countryStays.length,
    totalDays: countryStays.reduce((sum, stay) => sum + stay.totalDays, 0),
    totalCosts: countryStays.reduce((sum, stay) => sum + stay.totalCosts, 0),
    averageDaysPerCountry: countryStays.length > 0
      ? Math.round(countryStays.reduce((sum, stay) => sum + stay.totalDays, 0) / countryStays.length)
      : 0
  };
}
