/**
 * Place ID Migration Utility
 *
 * Migrates destinations from UUIDs to Google Place IDs
 */

/**
 * Check if an ID is a Google Place ID
 */
function isPlaceId(id) {
  if (!id || typeof id !== 'string') return false;
  return id.startsWith('ChIJ') || id.startsWith('GhIJ') || id.startsWith('EhIJ');
}

/**
 * Check if an ID is a UUID
 */
function isUUID(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Resolve a location query to a Place ID
 */
async function resolvePlaceId(query, locationObj = null) {
  try {
    const payload = { query };

    // Add location type hint if available
    if (locationObj?.type) {
      payload.location_type = locationObj.type;
    }

    const response = await fetch('http://localhost:5001/api/places/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn(`⚠️ Could not resolve Place ID for "${query}"`);
      return null;
    }

    const data = await response.json();
    return data.status === 'success' ? data : null;

  } catch (error) {
    console.error(`❌ Error resolving Place ID for "${query}":`, error);
    return null;
  }
}

/**
 * Migrate a single destination from UUID to Place ID
 */
async function migrateDestination(destination) {
  // Skip if already using Place ID
  if (isPlaceId(destination.id)) {
    console.log(`✅ ${destination.name} already uses Place ID: ${destination.id}`);
    return {
      ...destination,
      _already_migrated: true
    };
  }

  // Build query string for Place lookup
  const query = [destination.name, destination.city, destination.country]
    .filter(Boolean)
    .join(', ');

  console.log(`🔍 Looking up Place ID for: ${query}`);

  const placeInfo = await resolvePlaceId(query, destination);

  if (placeInfo) {
    console.log(`✅ Found Place ID for ${destination.name}: ${placeInfo.place_id}`);

    return {
      ...destination,
      id: placeInfo.place_id,
      _legacy_uuid: destination.id,  // Keep old UUID for reference
      _migrated_at: new Date().toISOString(),

      // Update coordinates if more accurate
      coordinates: placeInfo.coordinates,

      // Add enriched place data
      place_data: {
        formatted_address: placeInfo.formatted_address,
        types: placeInfo.types,
        country: placeInfo.country,
        city: placeInfo.city,
        timezone: placeInfo.timezone
      }
    };
  } else {
    console.warn(`⚠️ Could not find Place ID for ${destination.name}, keeping UUID`);
    return {
      ...destination,
      _migration_failed: true,
      _is_custom: true  // Mark as custom location without Place ID
    };
  }
}

/**
 * Migrate all destinations in the itinerary to Place IDs
 */
async function migrateAllDestinations(locations) {
  console.log('🚀 Starting Place ID migration...');
  console.log(`📍 Total destinations: ${locations.length}`);

  const migrated = [];
  const idMapping = new Map(); // old UUID -> new Place ID

  for (const location of locations) {
    const migratedLocation = await migrateDestination(location);
    migrated.push(migratedLocation);

    // Track ID changes
    if (location.id !== migratedLocation.id) {
      idMapping.set(location.id, migratedLocation.id);
    }

    // Small delay to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('✅ Migration complete!');
  console.log(`📊 ${idMapping.size} destinations migrated to Place IDs`);
  console.log(`📊 ${migrated.filter(l => isPlaceId(l.id)).length} total Place IDs`);
  console.log(`📊 ${migrated.filter(l => l._is_custom).length} custom locations (kept UUIDs)`);

  return {
    locations: migrated,
    idMapping: idMapping
  };
}

/**
 * Update cost destination_ids to use new Place IDs
 */
function migrateCostIds(costs, idMapping) {
  console.log('🔄 Updating cost destination_ids...');

  const updated = costs.map(cost => {
    const oldId = cost.destination_id;
    const newId = idMapping.get(oldId);

    if (newId) {
      console.log(`  ✓ Updated cost ${cost.id}: ${oldId} → ${newId}`);
      return {
        ...cost,
        destination_id: newId,
        _legacy_destination_id: oldId
      };
    }

    return cost;
  });

  console.log(`✅ Updated ${idMapping.size} cost destination_ids`);
  return updated;
}

/**
 * Full migration workflow
 */
async function migrateToPlaceIds(itineraryData) {
  const { locations, costs } = itineraryData;

  // Step 1: Migrate destinations
  const { locations: migratedLocations, idMapping } = await migrateAllDestinations(locations);

  // Step 2: Update cost references
  const migratedCosts = migrateCostIds(costs || [], idMapping);

  return {
    ...itineraryData,
    locations: migratedLocations,
    costs: migratedCosts,
    _migration_metadata: {
      migrated_at: new Date().toISOString(),
      destinations_migrated: idMapping.size,
      costs_updated: costs?.filter(c => idMapping.has(c.destination_id)).length || 0
    }
  };
}

// Export functions
window.PlaceMigration = {
  isPlaceId,
  isUUID,
  resolvePlaceId,
  migrateDestination,
  migrateAllDestinations,
  migrateCostIds,
  migrateToPlaceIds
};

console.log('✅ Place ID migration utilities loaded');
console.log('Usage: await PlaceMigration.migrateToPlaceIds(workingData)');
