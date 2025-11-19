/**
 * Dynamic Leg Manager
 *
 * Automatically discovers legs and sub-legs from destination data.
 * - Legs are created from continents
 * - Sub-legs are created from countries within each continent
 * - Always stays in sync with current destinations
 */

import type { TripData, TripLeg, TripSubLeg, TripLocation } from '../types/trip';

export interface DynamicLegStructure {
  legs: TripLeg[];
  stats: {
    totalDestinations: number;
    continents: number;
    countries: number;
  };
}

/**
 * Generate dynamic leg structure from destinations
 */
export function generateDynamicLegs(data: TripData): DynamicLegStructure {
  console.log('🔄 Generating dynamic legs from destinations...');

  const locations = data.locations || [];

  // Group destinations by continent
  const continentMap = new Map<string, TripLocation[]>();

  for (const location of locations) {
    if (!location.continent) {
      console.warn(`⚠️ Location "${location.name}" missing continent - will not appear in leg view`);
      continue;
    }

    if (!continentMap.has(location.continent)) {
      continentMap.set(location.continent, []);
    }
    continentMap.get(location.continent)!.push(location);
  }

  // Sort continents by destination count (descending)
  const sortedContinents = Array.from(continentMap.entries())
    .sort((a, b) => b[1].length - a[1].length);

  // Create legs from continents
  const legs: TripLeg[] = sortedContinents.map(([continent, destinations]) => {
    // Group destinations by country within this continent
    const countryMap = new Map<string, TripLocation[]>();

    for (const location of destinations) {
      if (!location.country) {
        console.warn(`⚠️ Location "${location.name}" missing country - will not appear in sub-leg view`);
        continue;
      }

      if (!countryMap.has(location.country)) {
        countryMap.set(location.country, []);
      }
      countryMap.get(location.country)!.push(location);
    }

    // Get unique countries for this continent
    const countries = Array.from(countryMap.keys());

    // Create sub-legs from countries
    const subLegs: TripSubLeg[] = Array.from(countryMap.entries())
      .sort((a, b) => b[1].length - a[1].length) // Sort by destination count
      .map(([country, countryDestinations]) => {
        return {
          name: country,
          countries: [country] // Sub-leg is now just the country itself
        };
      });

    return {
      name: continent,
      regions: countries, // Store countries in regions field for compatibility
      sub_legs: subLegs
    };
  });

  const stats = {
    totalDestinations: locations.length,
    continents: legs.length,
    countries: legs.reduce((sum, leg) => sum + (leg.sub_legs?.length || 0), 0)
  };

  console.log('✅ Dynamic legs generated:');
  console.log(`   Destinations: ${stats.totalDestinations}`);
  console.log(`   Continents: ${stats.continents}`);
  console.log(`   Countries: ${stats.countries}`);

  legs.forEach(leg => {
    console.log(`   📍 ${leg.name}: ${leg.regions?.length || 0} countries, ${leg.sub_legs?.length || 0} sub-legs`);
  });

  return { legs, stats };
}

/**
 * Get dynamic legs, with fallback to stored legs if needed
 */
export function getLegsForData(data: TripData, options: { useDynamic?: boolean } = {}): TripLeg[] {
  const useDynamic = options.useDynamic !== false; // Default to dynamic

  if (useDynamic) {
    // Generate dynamic legs from destinations
    const { legs } = generateDynamicLegs(data);
    return legs;
  } else {
    // Fallback to stored legs (backward compatibility)
    return data.legs || [];
  }
}

/**
 * Check if all destinations have required geographic data for dynamic legs
 */
export function validateGeographicData(data: TripData): {
  valid: boolean;
  missingContinent: TripLocation[];
  missingRegion: TripLocation[];
  missingCountry: TripLocation[];
} {
  const locations = data.locations || [];

  const result = {
    valid: true,
    missingContinent: [] as TripLocation[],
    missingRegion: [] as TripLocation[], // Keep for backward compatibility but not used
    missingCountry: [] as TripLocation[]
  };

  for (const location of locations) {
    if (!location.continent) {
      result.missingContinent.push(location);
      result.valid = false;
    }
    // Region is no longer required
    if (!location.country) {
      result.missingCountry.push(location);
      result.valid = false;
    }
  }

  return result;
}

/**
 * Get a human-readable summary of the dynamic leg structure
 */
export function getLegSummary(legs: TripLeg[]): string {
  let summary = '=== DYNAMIC LEG STRUCTURE ===\n\n';

  legs.forEach(leg => {
    const countryCount = leg.regions?.length || 0;
    const subLegCount = leg.sub_legs?.length || 0;

    summary += `📍 ${leg.name}\n`;
    summary += `   Countries: ${leg.regions?.join(', ') || 'none'}\n`;
    summary += `   Sub-legs: ${subLegCount}\n`;

    if (leg.sub_legs && leg.sub_legs.length > 0) {
      leg.sub_legs.forEach(subLeg => {
        summary += `      - ${subLeg.name}\n`;
      });
    }

    summary += '\n';
  });

  return summary;
}
