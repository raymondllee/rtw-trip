/**
 * Place ID to UUID Migration Tool
 * Migrates destinations using Place IDs as primary keys to UUID-based IDs
 * while preserving Place IDs as metadata
 */

import {
  generateDestinationId,
  isUUID,
  isPlaceId,
  normalizeId,
  validateDataIntegrity,
  createMigrationReport
} from './destination-id-manager.js';

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchScenarioData(scenarioId) {
  console.log('📦 Fetching scenario data...');

  try {
    // Fetch costs from API
    const costsResponse = await fetch(`http://localhost:5001/api/costs?session_id=${scenarioId}`);
    if (!costsResponse.ok) {
      throw new Error(`Failed to fetch costs: ${costsResponse.statusText}`);
    }

    const costsData = await costsResponse.json();
    const costs = costsData.costs || [];
    console.log(`✅ Loaded ${costs.length} costs from API`);

    // Get locations from working data
    let locations = [];
    if (window.appWorkingData && window.appWorkingData.locations) {
      locations = window.appWorkingData.locations;
      console.log(`✅ Loaded ${locations.length} locations from working data`);
    } else {
      throw new Error('No location data available in window.appWorkingData');
    }

    // Get legs from working data
    const legs = window.appWorkingData?.legs || [];

    return {
      scenarioId,
      locations,
      costs,
      legs
    };
  } catch (error) {
    console.error('❌ Error fetching scenario data:', error);
    throw error;
  }
}

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Generate migration map for Place ID locations
 * @param {Array} locations
 * @returns {Map} Map of old Place ID to new UUID
 */
function generatePlaceIdMigrationMap(locations) {
  const migrationMap = new Map();

  locations.forEach(location => {
    const oldId = location.id;

    if (isPlaceId(oldId)) {
      // Generate new UUID for this Place ID location
      const newId = generateDestinationId();
      migrationMap.set(normalizeId(oldId), newId);
      console.log(`  📍 ${location.name}`);
      console.log(`     Old: ${oldId} (Place ID)`);
      console.log(`     New: ${newId} (UUID)`);
    } else {
      // Keep existing UUID/other IDs as-is
      migrationMap.set(normalizeId(oldId), oldId);
    }
  });

  return migrationMap;
}

/**
 * Migrate a location from Place ID to UUID
 * @param {Object} location
 * @param {string} newId
 * @returns {Object} Migrated location
 */
function migrateLocationToUUID(location, newId) {
  const oldId = location.id;

  // Ensure place_id is preserved
  const placeId = location.place_id || (isPlaceId(oldId) ? oldId : null);

  const migratedLocation = {
    ...location,
    id: newId,
    place_id: placeId, // Preserve Place ID as metadata
    _legacy_id: oldId,
    _migrated_at: new Date().toISOString(),
    _migration_type: 'place_id_to_uuid'
  };

  // Ensure place_data.place_id is also set if place_data exists
  if (migratedLocation.place_data && placeId) {
    migratedLocation.place_data = {
      ...migratedLocation.place_data,
      place_id: placeId
    };
  }

  return migratedLocation;
}

/**
 * Migrate locations from Place IDs to UUIDs
 * @param {Array} locations
 * @param {Map} migrationMap
 * @returns {Array} Migrated locations
 */
function migrateLocations(locations, migrationMap) {
  return locations.map(location => {
    const oldId = normalizeId(location.id);
    const newId = migrationMap.get(oldId);

    if (newId === location.id) {
      // No change needed
      return location;
    }

    return migrateLocationToUUID(location, newId);
  });
}

/**
 * Migrate costs to use new UUIDs
 * @param {Array} costs
 * @param {Map} migrationMap
 * @returns {Array} Migrated costs
 */
function migrateCosts(costs, migrationMap) {
  return costs.map(cost => {
    const oldDestId = normalizeId(cost.destination_id || cost.destinationId);
    const newDestId = migrationMap.get(oldDestId);

    // If no mapping found or no change, keep original
    if (!newDestId || newDestId === (cost.destination_id || cost.destinationId)) {
      return cost;
    }

    return {
      ...cost,
      destination_id: newDestId,
      _legacy_destination_id: oldDestId,
      _migrated_at: new Date().toISOString()
    };
  });
}

/**
 * Migrate leg destination IDs
 * @param {Array} legs
 * @param {Map} migrationMap
 * @returns {Array} Migrated legs
 */
function migrateLegs(legs, migrationMap) {
  return legs.map(leg => {
    const migratedSubLegs = (leg.sub_legs || []).map(subLeg => {
      const oldDestIds = subLeg.destination_ids || [];
      const newDestIds = oldDestIds.map(oldId =>
        migrationMap.get(normalizeId(oldId)) || oldId
      );

      // Check if any IDs changed
      const hasChanges = oldDestIds.some((oldId, i) =>
        normalizeId(oldId) !== normalizeId(newDestIds[i])
      );

      if (!hasChanges) return subLeg;

      return {
        ...subLeg,
        destination_ids: newDestIds,
        _legacy_destination_ids: oldDestIds,
        _migrated_at: new Date().toISOString()
      };
    });

    return {
      ...leg,
      sub_legs: migratedSubLegs
    };
  });
}

// ============================================================================
// Save Operations
// ============================================================================

/**
 * Update working data with migrated values
 * @param {Array} migratedLocations
 * @param {Array} migratedCosts
 * @param {Array} migratedLegs
 */
function updateWorkingData(migratedLocations, migratedCosts, migratedLegs) {
  if (!window.appWorkingData) {
    console.warn('⚠️ No working data available to update');
    return;
  }

  window.appWorkingData.locations = migratedLocations;
  window.appWorkingData.costs = migratedCosts;
  window.appWorkingData.legs = migratedLegs;

  console.log('✅ Updated window.appWorkingData with migrated data');
}

/**
 * Save migrated costs to API
 * @param {string} scenarioId
 * @param {Array} costs
 * @param {Array} locations
 * @returns {Promise<boolean>}
 */
async function saveMigratedCosts(scenarioId, costs, locations) {
  console.log('💾 Saving migrated costs to API...');

  try {
    // Group costs by destination
    const costsByDestination = new Map();
    costs.forEach(cost => {
      const destId = cost.destination_id;
      if (!costsByDestination.has(destId)) {
        costsByDestination.set(destId, []);
      }
      costsByDestination.get(destId).push(cost);
    });

    // Save each destination's costs
    const savePromises = [];

    costsByDestination.forEach((destinationCosts, destinationId) => {
      const location = locations.find(loc => loc.id === destinationId);
      const destinationName = location ? location.name : 'Unknown Destination';

      savePromises.push(
        fetch('http://localhost:5001/api/costs/bulk-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: scenarioId,
            scenario_id: scenarioId,
            destination_id: destinationId,
            destination_name: destinationName,
            cost_items: destinationCosts
          })
        }).then(response => {
          if (!response.ok) {
            console.error(`❌ Failed to save costs for ${destinationName}:`, response.statusText);
          } else {
            console.log(`  ✅ Saved ${destinationCosts.length} costs for ${destinationName}`);
          }
          return response;
        })
      );
    });

    const results = await Promise.all(savePromises);
    const allSuccessful = results.every(r => r.ok);

    if (allSuccessful) {
      console.log('✅ All costs saved successfully');
      return true;
    } else {
      const failedCount = results.filter(r => !r.ok).length;
      console.error(`❌ ${failedCount}/${results.length} save operations failed`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error saving migrated costs:', error);
    return false;
  }
}

// ============================================================================
// Main Migration Function
// ============================================================================

/**
 * Migrate Place ID destinations to UUID-based IDs
 * @param {string} scenarioId
 * @param {Object} options
 * @returns {Promise<Object>} Migration results
 */
async function migratePlaceIdsToUUIDs(scenarioId, options = {}) {
  const { dryRun = false, saveToDB = true } = options;

  console.log('═══════════════════════════════════════════════════════');
  console.log('🔄 PLACE ID TO UUID MIGRATION');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Scenario: ${scenarioId}`);
  if (dryRun) {
    console.log('⚠️ DRY RUN MODE - No changes will be saved');
  }
  console.log('');

  try {
    // Step 1: Fetch data
    const originalData = await fetchScenarioData(scenarioId);

    // Step 2: Validate original data
    console.log('\n🔍 Validating original data...');
    const beforeValidation = validateDataIntegrity(originalData);

    // Count Place ID locations
    const placeIdLocations = originalData.locations.filter(loc => isPlaceId(loc.id));
    const uuidLocations = originalData.locations.filter(loc => isUUID(loc.id));

    console.log(`\n📊 Current state:`);
    console.log(`  - Total locations: ${originalData.locations.length}`);
    console.log(`  - UUID-based: ${uuidLocations.length}`);
    console.log(`  - Place ID-based: ${placeIdLocations.length} ← will be migrated`);
    console.log(`  - Total costs: ${originalData.costs.length}`);

    if (placeIdLocations.length === 0) {
      console.log('\n✅ No Place ID locations found. Migration not needed.');
      return {
        success: true,
        migrated: 0,
        message: 'All locations already use UUIDs'
      };
    }

    // Step 3: Generate migration map
    console.log('\n🔄 Generating migration map...\n');
    const migrationMap = generatePlaceIdMigrationMap(originalData.locations);

    const placeIdsToMigrate = Array.from(migrationMap.entries())
      .filter(([oldId, newId]) => oldId !== newId);

    console.log(`\n📋 Will migrate ${placeIdsToMigrate.length} locations\n`);

    // Step 4: Perform migration
    console.log('🔨 Performing migration...\n');

    const migratedLocations = migrateLocations(originalData.locations, migrationMap);
    const migratedCosts = migrateCosts(originalData.costs, migrationMap);
    const migratedLegs = migrateLegs(originalData.legs, migrationMap);

    const migratedCostCount = migratedCosts.filter(c => c._legacy_destination_id).length;

    console.log(`✅ Migrated ${placeIdsToMigrate.length} locations`);
    console.log(`✅ Updated ${migratedCostCount} cost references`);
    console.log(`✅ Updated ${migratedLegs.length} legs\n`);

    // Step 5: Validate migrated data
    console.log('🔍 Validating migrated data...\n');
    const migratedData = {
      ...originalData,
      locations: migratedLocations,
      costs: migratedCosts,
      legs: migratedLegs
    };
    const afterValidation = validateDataIntegrity(migratedData);

    // Step 6: Generate report
    const migrationReport = createMigrationReport(originalData, migratedData);

    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Locations migrated: ${placeIdsToMigrate.length}`);
    console.log(`Costs updated: ${migratedCostCount}`);
    console.log(`Place IDs preserved: ${placeIdsToMigrate.length}`);
    console.log('\nBefore:');
    console.log(`  - UUID locations: ${uuidLocations.length}`);
    console.log(`  - Place ID locations: ${placeIdLocations.length}`);
    console.log('\nAfter:');
    console.log(`  - UUID locations: ${migratedLocations.filter(l => isUUID(l.id)).length}`);
    console.log(`  - Place ID locations: ${migratedLocations.filter(l => isPlaceId(l.id)).length}`);
    console.log(`  - Place IDs stored as metadata: ${migratedLocations.filter(l => l.place_id).length}`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Step 7: Save changes
    let saved = false;
    if (!dryRun && saveToDB) {
      // Update working data first
      updateWorkingData(migratedLocations, migratedCosts, migratedLegs);

      // Save to API
      saved = await saveMigratedCosts(scenarioId, migratedCosts, migratedLocations);

      if (saved) {
        console.log('\n✅ Migration completed and saved successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Save the scenario to persist location changes');
        console.log('   2. Verify all costs are correctly associated');
        console.log('   3. Check that Place IDs are preserved in place_id field');
      } else {
        console.error('\n❌ Migration completed but save failed');
        console.error('   Working data updated, but API sync failed');
      }
    } else if (dryRun) {
      console.log('\n✅ Dry-run completed successfully!');
      console.log('   Run with { dryRun: false } to apply changes.');
    } else {
      console.log('\n✅ Migration completed (not saved to DB)');
    }

    return {
      success: true,
      dryRun,
      saved,
      migrated: placeIdsToMigrate.length,
      costsMigrated: migratedCostCount,
      migrationMap: Object.fromEntries(
        Array.from(migrationMap.entries()).filter(([oldId, newId]) => oldId !== newId)
      ),
      migrationReport,
      beforeValidation,
      afterValidation,
      migratedData: dryRun ? null : migratedData
    };

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Preview Place ID to UUID migration
 * @param {string} scenarioId
 */
async function previewPlaceIdMigration(scenarioId) {
  return await migratePlaceIdsToUUIDs(scenarioId, { dryRun: true });
}

// ============================================================================
// Exports
// ============================================================================

window.migratePlaceIdsToUUIDs = migratePlaceIdsToUUIDs;
window.previewPlaceIdMigration = previewPlaceIdMigration;

console.log('✅ Place ID to UUID Migration Tool loaded. Available functions:');
console.log('  - previewPlaceIdMigration(scenarioId) - Dry-run preview');
console.log('  - migratePlaceIdsToUUIDs(scenarioId, options) - Execute migration');
console.log('      Options: { dryRun: false, saveToDB: true }');
