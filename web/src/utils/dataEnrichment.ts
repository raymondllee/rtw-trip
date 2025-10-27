/**
 * Data Enrichment Utility
 *
 * Enriches destinations with complete geographic hierarchy:
 * - Fetches missing country/city data from Google Places API
 * - Derives region from country using authoritative mappings
 * - Ensures all destinations have required fields for proper filtering
 *
 * This fixes the issue where destinations disappear when switching views.
 */

import type { TripLocation, TripData } from '../types/trip';
import { getRegionForCountry, hasRegionMapping } from '../data/regionMappings';
import { getRuntimeConfig } from '../config';

export interface EnrichmentReport {
  total: number;
  enriched: number;
  skipped: number;
  failed: number;
  details: Array<{
    id: string | number | null;
    name: string;
    status: 'enriched' | 'skipped' | 'failed';
    message: string;
    before?: Partial<TripLocation>;
    after?: Partial<TripLocation>;
  }>;
}

export interface ValidationResult {
  valid: number;
  missingCountry: number;
  missingRegion: number;
  unmappedCountry: number;
  locations: {
    valid: TripLocation[];
    missingCountry: TripLocation[];
    missingRegion: TripLocation[];
    unmappedCountry: TripLocation[];
  };
}

/**
 * Fetch place details from backend API
 */
async function fetchPlaceDetails(placeId: string): Promise<any | null> {
  try {
    const config = getRuntimeConfig();
    const response = await fetch(`${config.apiBaseUrl}/api/places/details/${encodeURIComponent(placeId)}`);

    if (!response.ok) {
      console.warn(`Failed to fetch place details for ${placeId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.status === 'success') {
      return data;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching place details for ${placeId}:`, error);
    return null;
  }
}

/**
 * Enrich a single destination with geographic data
 */
export async function enrichDestination(
  location: TripLocation,
  options: { forceRefresh?: boolean } = {}
): Promise<{ enriched: boolean; location: TripLocation; message: string }> {
  console.log(`\n🔧 Enriching: ${location.name}`);

  const before = {
    country: location.country,
    region: location.region,
    city: location.city,
    administrative_area: location.administrative_area,
    country_code: location.country_code,
    continent: location.continent,
    timezone: location.timezone
  };

  console.log('   Before:', before);

  // Check what fields are missing
  const missingFields: string[] = [];
  if (!location.country) missingFields.push('country');
  if (!location.region) missingFields.push('region');
  if (!location.country_code) missingFields.push('country_code');
  if (!location.continent) missingFields.push('continent');
  if (!location.timezone) missingFields.push('timezone');
  if (!location.city) missingFields.push('city');

  // Check if this is an Antarctic destination that needs correction
  const isAntarcticDestination =
    location.name.toLowerCase().includes('antarc') ||
    location.notes?.toLowerCase().includes('antarc') ||
    location.activity_type?.toLowerCase().includes('antarc');

  const needsAntarcticCorrection = isAntarcticDestination && location.country !== 'Antarctica';

  console.log('   Missing fields:', missingFields);
  if (needsAntarcticCorrection) {
    console.log('   🧊 Antarctic destination with wrong country - needs correction');
  }

  // Skip if all fields are complete and not forcing refresh and doesn't need Antarctic correction
  if (!options.forceRefresh && missingFields.length === 0 && !needsAntarcticCorrection) {
    console.log('   ⏭️  Skipping - all fields complete');
    return {
      enriched: false,
      location,
      message: 'All fields complete'
    };
  }

  let enriched = false;
  const messages: string[] = [];
  const updated = { ...location };

  // Step 1: Fetch from Places API if we have a place_id and are missing ANY field
  if (updated.place_id && (missingFields.length > 0 || options.forceRefresh)) {
    console.log(`   📍 Fetching from Places API: ${updated.place_id}`);
    const placeDetails = await fetchPlaceDetails(updated.place_id);
    if (placeDetails) {
      console.log('   ✅ Places API response:', placeDetails);
      let fieldsEnriched = 0;

      // Update all available fields from Places API
      if (placeDetails.country && !updated.country) {
        console.log(`      Setting country: "${placeDetails.country}"`);
        updated.country = placeDetails.country;
        fieldsEnriched++;
      }
      if (placeDetails.city && !updated.city) {
        console.log(`      Setting city: "${placeDetails.city}"`);
        updated.city = placeDetails.city;
        fieldsEnriched++;
      }
      if (placeDetails.administrative_area && !updated.administrative_area) {
        console.log(`      Setting administrative_area: "${placeDetails.administrative_area}"`);
        updated.administrative_area = placeDetails.administrative_area;
        fieldsEnriched++;
      }
      if (placeDetails.country_code && !updated.country_code) {
        console.log(`      Setting country_code: "${placeDetails.country_code}"`);
        updated.country_code = placeDetails.country_code;
        fieldsEnriched++;
      }
      if (placeDetails.coordinates && !updated.coordinates) {
        console.log(`      Setting coordinates: ${placeDetails.coordinates.lat}, ${placeDetails.coordinates.lng}`);
        updated.coordinates = placeDetails.coordinates;
        fieldsEnriched++;
      }
      if (placeDetails.timezone && !updated.timezone) {
        console.log(`      Setting timezone: "${placeDetails.timezone}"`);
        updated.timezone = placeDetails.timezone;
        fieldsEnriched++;
      }

      if (fieldsEnriched > 0) {
        enriched = true;
        messages.push(`Fetched ${fieldsEnriched} field(s) from Places API`);
      }
    } else {
      console.log('   ❌ Failed to fetch from Places API');
      messages.push('Failed to fetch from Places API');
    }
  }

  // Step 2: Try to get country from place_data if still missing
  if (!updated.country && updated.place_data?.country) {
    console.log(`   📦 Getting country from place_data: "${updated.place_data.country}"`);
    updated.country = updated.place_data.country;
    enriched = true;
    messages.push('Got country from place_data');
  }

  // Step 2b: Special handling for Antarctica (reuse isAntarcticDestination from earlier)
  // Antarctic expeditions often depart from Argentina/Chile but should be classified as Antarctica
  if (isAntarcticDestination && updated.country !== 'Antarctica') {
    console.log(`   🧊 Detected Antarctic destination - overriding country to "Antarctica"`);
    console.log(`      Original country: "${updated.country}"`);
    updated.country = 'Antarctica';

    // Set display coordinates to Antarctic Peninsula for map visualization
    // (keeps actual coordinates as departure port for logistics/routing)
    if (!updated.display_coordinates) {
      updated.display_coordinates = {
        lat: -64.8,  // Antarctic Peninsula
        lng: -62.5
      };
      console.log(`   📍 Set display coordinates to Antarctic Peninsula (-64.8, -62.5)`);
      messages.push('Set display coordinates to Antarctic Peninsula');
    }

    enriched = true;
    messages.push('Detected as Antarctic destination - set country to Antarctica');
  }

  // Step 3: Derive region and continent from country using mapping (if we have country)
  if (updated.country) {
    console.log(`   🗺️  Looking up region mapping for country: "${updated.country}"`);
    const regionMapping = getRegionForCountry(updated.country);
    if (regionMapping) {
      console.log('   ✅ Found mapping:', regionMapping);

      // ALWAYS update region from mapping if it doesn't match
      // This fixes cases where region was incorrectly set to administrative_area
      const correctRegion = regionMapping.region;
      if (updated.region !== correctRegion) {
        console.log(`   🔄 Correcting region: "${updated.region}" → "${correctRegion}"`);
        updated.region = correctRegion;
        enriched = true;
        messages.push(`Updated region to "${correctRegion}"`);
      }

      // ALWAYS update continent from mapping if it doesn't match
      // This fixes cases where continent is incorrect (e.g., Antarctica showing as South America)
      const correctContinent = regionMapping.continent;
      if (updated.continent !== correctContinent) {
        console.log(`   🔄 Correcting continent: "${updated.continent}" → "${correctContinent}"`);
        updated.continent = correctContinent;
        enriched = true;
        messages.push(`Updated continent to "${correctContinent}"`);
      }
    } else {
      console.log(`   ⚠️  No region mapping found for country: "${updated.country}"`);
      messages.push(`⚠️ No region mapping found for country: ${updated.country}`);
    }
  }

  // Step 4: Mark migration metadata
  if (enriched) {
    updated._migration_source = 'data_enrichment';
    updated._migrated_at = new Date().toISOString();
  }

  console.log('   After:', {
    country: updated.country,
    region: updated.region,
    city: updated.city,
    administrative_area: updated.administrative_area,
    country_code: updated.country_code,
    continent: updated.continent,
    timezone: updated.timezone
  });
  console.log(`   ✅ Enriched: ${enriched}, Message: ${messages.join('; ')}`);

  return {
    enriched,
    location: updated,
    message: messages.length > 0 ? messages.join('; ') : 'No enrichment needed'
  };
}

/**
 * Enrich all destinations in trip data
 */
export async function enrichAllDestinations(
  tripData: TripData,
  options: { forceRefresh?: boolean; onProgress?: (progress: number, current: string) => void } = {}
): Promise<EnrichmentReport> {
  const report: EnrichmentReport = {
    total: tripData.locations.length,
    enriched: 0,
    skipped: 0,
    failed: 0,
    details: []
  };

  for (let i = 0; i < tripData.locations.length; i++) {
    const location = tripData.locations[i];

    if (options.onProgress) {
      options.onProgress(
        Math.round(((i + 1) / tripData.locations.length) * 100),
        location.name
      );
    }

    const before = {
      country: location.country,
      region: location.region,
      city: location.city
    };

    try {
      const result = await enrichDestination(location, options);

      // Update the location in the array
      tripData.locations[i] = result.location;

      if (result.enriched) {
        report.enriched++;
        report.details.push({
          id: location.id,
          name: location.name,
          status: 'enriched',
          message: result.message,
          before,
          after: {
            country: result.location.country,
            region: result.location.region,
            city: result.location.city
          }
        });
      } else {
        report.skipped++;
        report.details.push({
          id: location.id,
          name: location.name,
          status: 'skipped',
          message: result.message
        });
      }
    } catch (error) {
      report.failed++;
      report.details.push({
        id: location.id,
        name: location.name,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return report;
}

/**
 * Validate all destinations have required fields
 */
export function validateDestinations(tripData: TripData): ValidationResult {
  const result: ValidationResult = {
    valid: 0,
    missingCountry: 0,
    missingRegion: 0,
    unmappedCountry: 0,
    locations: {
      valid: [],
      missingCountry: [],
      missingRegion: [],
      unmappedCountry: []
    }
  };

  for (const location of tripData.locations) {
    let isValid = true;
    let needsEnrichment = false;

    // Check for missing country
    if (!location.country) {
      result.missingCountry++;
      result.locations.missingCountry.push(location);
      isValid = false;
      needsEnrichment = true;
    }

    // Check for missing region
    if (!location.region) {
      result.missingRegion++;
      result.locations.missingRegion.push(location);
      isValid = false;
      needsEnrichment = true;
    }

    // Check if country has a region mapping
    if (location.country && !hasRegionMapping(location.country)) {
      result.unmappedCountry++;
      result.locations.unmappedCountry.push(location);
      isValid = false;
      needsEnrichment = true;
    }

    // NEW: Check if region doesn't match the mapping (e.g., "Shandong" instead of "East Asia")
    if (location.country && location.region) {
      const regionMapping = getRegionForCountry(location.country);
      if (regionMapping) {
        if (location.region !== regionMapping.region) {
          console.log(`⚠️ ${location.name}: region "${location.region}" doesn't match mapping "${regionMapping.region}"`);
          result.missingRegion++; // Count as missing region so button stays enabled
          result.locations.missingRegion.push(location);
          isValid = false;
          needsEnrichment = true;
        }
        // Also check if continent doesn't match
        if (location.continent !== regionMapping.continent) {
          console.log(`⚠️ ${location.name}: continent "${location.continent}" doesn't match mapping "${regionMapping.continent}"`);
          result.missingRegion++; // Count as issue so button stays enabled
          result.locations.missingRegion.push(location);
          isValid = false;
          needsEnrichment = true;
        }
      }
    }

    // NEW: Check for Antarctic destinations with wrong classification
    const isAntarcticDestination =
      location.name.toLowerCase().includes('antarc') ||
      location.notes?.toLowerCase().includes('antarc') ||
      location.activity_type?.toLowerCase().includes('antarc');

    if (isAntarcticDestination && location.country !== 'Antarctica') {
      console.log(`⚠️ ${location.name}: Antarctic destination incorrectly classified as "${location.country}"`);
      result.missingCountry++; // Count as missing so button stays enabled
      result.locations.missingCountry.push(location);
      isValid = false;
      needsEnrichment = true;
    }

    // NEW: Check for missing other important fields
    if (!location.country_code || !location.continent || !location.timezone) {
      needsEnrichment = true;
      // Don't mark as invalid, but button should still be enabled
    }

    if (isValid && !needsEnrichment) {
      result.valid++;
      result.locations.valid.push(location);
    }
  }

  return result;
}

/**
 * Generate a human-readable report
 */
export function formatEnrichmentReport(report: EnrichmentReport): string {
  let output = `
# Data Enrichment Report

**Total Destinations:** ${report.total}
**Successfully Enriched:** ${report.enriched}
**Skipped (already complete):** ${report.skipped}
**Failed:** ${report.failed}

## Details

`;

  const enrichedItems = report.details.filter(d => d.status === 'enriched');
  if (enrichedItems.length > 0) {
    output += `### Enriched Destinations (${enrichedItems.length})\n\n`;
    for (const item of enrichedItems) {
      output += `- **${item.name}**\n`;
      output += `  - Before: country="${item.before?.country || 'missing'}", region="${item.before?.region || 'missing'}"\n`;
      output += `  - After: country="${item.after?.country}", region="${item.after?.region}"\n`;
      output += `  - ${item.message}\n\n`;
    }
  }

  const failedItems = report.details.filter(d => d.status === 'failed');
  if (failedItems.length > 0) {
    output += `### Failed Destinations (${failedItems.length})\n\n`;
    for (const item of failedItems) {
      output += `- **${item.name}**: ${item.message}\n`;
    }
  }

  return output;
}

/**
 * Format a single location's full data for detailed view
 */
function formatLocationDetails(loc: TripLocation, indent: string = '  '): string {
  let output = '';

  // Geographic fields
  output += `${indent}🌍 Geographic Data:\n`;
  output += `${indent}  - Country: ${loc.country || '❌ MISSING'}\n`;
  output += `${indent}  - Region: ${loc.region || '❌ MISSING'}\n`;
  output += `${indent}  - City: ${loc.city || 'N/A'}\n`;
  output += `${indent}  - Country Code: ${loc.country_code || 'N/A'}\n`;
  output += `${indent}  - Continent: ${loc.continent || 'N/A'}\n`;
  output += `${indent}  - Administrative Area: ${loc.administrative_area || 'N/A'}\n`;

  // Places API data
  output += `${indent}🔍 Places API:\n`;
  output += `${indent}  - Place ID: ${loc.place_id || 'N/A'}\n`;
  output += `${indent}  - Coordinates: ${loc.coordinates ? `${loc.coordinates.lat}, ${loc.coordinates.lng}` : 'N/A'}\n`;
  output += `${indent}  - Timezone: ${loc.timezone || 'N/A'}\n`;

  // Trip planning fields
  if (loc.arrival_date || loc.departure_date || loc.duration_days) {
    output += `${indent}📅 Dates:\n`;
    output += `${indent}  - Arrival: ${loc.arrival_date || 'N/A'}\n`;
    output += `${indent}  - Departure: ${loc.departure_date || 'N/A'}\n`;
    output += `${indent}  - Duration: ${loc.duration_days ? `${loc.duration_days} days` : 'N/A'}\n`;
  }

  // Activity info
  if (loc.activity_type || loc.highlights || loc.airport_code) {
    output += `${indent}🎯 Activity:\n`;
    output += `${indent}  - Type: ${loc.activity_type || 'N/A'}\n`;
    output += `${indent}  - Airport: ${loc.airport_code || 'N/A'}\n`;
    if (loc.highlights && loc.highlights.length > 0) {
      output += `${indent}  - Highlights: ${loc.highlights.join(', ')}\n`;
    }
  }

  // Transport data
  if (loc.transport_from_previous) {
    output += `${indent}🚗 Transport: ${loc.transport_from_previous}\n`;
  }
  if (loc.transport_segments && loc.transport_segments.length > 0) {
    output += `${indent}🚗 Transport Segments: ${loc.transport_segments.length} segment(s)\n`;
    loc.transport_segments.forEach((seg, idx) => {
      output += `${indent}    ${idx + 1}. ${seg.mode}`;
      if (seg.cost) output += ` - $${seg.cost}`;
      if (seg.vendor_name) output += ` (${seg.vendor_name})`;
      output += '\n';
    });
  }

  // Migration/legacy metadata
  const migrationFields = [];
  if (loc._legacy_id) migrationFields.push(`Legacy ID: ${loc._legacy_id}`);
  if (loc._legacy_uuid) migrationFields.push(`Legacy UUID: ${loc._legacy_uuid}`);
  if (loc._migration_source) migrationFields.push(`Source: ${loc._migration_source}`);
  if (loc._migrated_at) migrationFields.push(`Migrated: ${loc._migrated_at}`);

  if (migrationFields.length > 0) {
    output += `${indent}📝 Migration: ${migrationFields.join(', ')}\n`;
  }

  return output;
}

/**
 * Format validation result
 */
export function formatValidationResult(result: ValidationResult): string {
  let output = `
# Destination Validation Report

**Total Valid:** ${result.valid}
**Missing Country:** ${result.missingCountry}
**Missing Region:** ${result.missingRegion}
**Unmapped Country:** ${result.unmappedCountry}

`;

  if (result.locations.missingCountry.length > 0) {
    output += `## Destinations Missing Country (${result.locations.missingCountry.length})\n\n`;
    for (const loc of result.locations.missingCountry) {
      output += `### ${loc.name} (ID: ${loc.id})\n`;
      output += formatLocationDetails(loc);
      output += '\n';
    }
  }

  if (result.locations.missingRegion.length > 0) {
    output += `## Destinations Missing Region (${result.locations.missingRegion.length})\n\n`;
    for (const loc of result.locations.missingRegion) {
      output += `### ${loc.name} (ID: ${loc.id})\n`;
      output += formatLocationDetails(loc);
      output += '\n';
    }
  }

  if (result.locations.unmappedCountry.length > 0) {
    output += `## Destinations with Unmapped Countries (${result.locations.unmappedCountry.length})\n\n`;
    output += 'These countries need to be added to regionMappings.ts:\n\n';
    const uniqueCountries = new Set(result.locations.unmappedCountry.map(l => l.country).filter(Boolean));
    const countriesArray = Array.from(uniqueCountries);
    for (const country of countriesArray) {
      const locs = result.locations.unmappedCountry.filter(l => l.country === country);
      output += `### ${country} (${locs.length} destination${locs.length > 1 ? 's' : ''})\n\n`;
      for (const loc of locs) {
        output += `#### ${loc.name} (ID: ${loc.id})\n`;
        output += formatLocationDetails(loc);
        output += '\n';
      }
    }
  }

  // Add section for all valid destinations
  if (result.locations.valid.length > 0) {
    output += `## ✅ Valid Destinations (${result.locations.valid.length})\n\n`;
    output += 'These destinations have complete geographic data:\n\n';
    for (const loc of result.locations.valid) {
      output += `### ${loc.name} (ID: ${loc.id})\n`;
      output += formatLocationDetails(loc);
      output += '\n';
    }
  }

  return output;
}
