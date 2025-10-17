/**
 * UUID Migration Utility (Refactored)
 * Migrates legacy destination IDs to UUIDs and updates associated costs
 *
 * This version uses the modular destination-id-manager.js library
 */

import {
  generateDestinationId,
  isUUID,
  isPlaceId,
  normalizeId,
  migrateLocationIds,
  migrateCostDestinationIds,
  validateDataIntegrity,
  createMigrationReport
} from './destination-id-manager.js';

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Fetch scenario data from Firestore and working data
 * @param {string} scenarioId
 * @returns {Promise<Object>} Combined data object
 */
async function fetchScenarioData(scenarioId) {
  console.log('📦 Fetching scenario data...');

  try {
    // Fetch costs from Firestore
    const costsResponse = await fetch(`/api/costs?session_id=${scenarioId}`);
    if (!costsResponse.ok) {
      throw new Error(`Failed to fetch costs: ${costsResponse.statusText}`);
    }

    const costsData = await costsResponse.json();
    const costs = costsData.costs || [];
    console.log(`✅ Loaded ${costs.length} costs from Firestore`);

    // Get locations from working data
    let locations = [];
    if (window.appWorkingData && window.appWorkingData.locations) {
      locations = window.appWorkingData.locations;
      console.log(`✅ Loaded ${locations.length} locations from working data`);
    } else {
      console.warn('⚠️ No location data available in working data');
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
// Migration Analysis
// ============================================================================

/**
 * Check if a location has a legacy ID (non-UUID, non-PlaceID)
 * @param {Object} location
 * @returns {boolean}
 */
function hasLegacyId(location) {
  const id = location.id;
  if (!id || typeof id !== 'string') return true;

  return !isUUID(id) && !isPlaceId(id);
}

/**
 * Check if an ID is a timestamp (like 1760652823)
 * @param {string|number} id
 * @returns {boolean}
 */
function isTimestampId(id) {
  if (!id) return false;
  const numId = parseInt(id);
  return !isNaN(numId) && numId > 1000000000 && numId < 2000000000;
}

/**
 * Analyze locations and identify migration candidates
 * @param {Array} locations
 * @returns {Object} Analysis results
 */
function analyzeMigrationCandidates(locations) {
  const legacyLocations = locations.filter(hasLegacyId);
  const timestampLocations = legacyLocations.filter(loc => isTimestampId(loc.id));
  const uuidLocations = locations.filter(loc => isUUID(loc.id));
  const placeIdLocations = locations.filter(loc => isPlaceId(loc.id));

  console.log('🔍 Migration Analysis:');
  console.log(`  - Total locations: ${locations.length}`);
  console.log(`  - UUID-based: ${uuidLocations.length}`);
  console.log(`  - Place ID-based: ${placeIdLocations.length}`);
  console.log(`  - Legacy IDs: ${legacyLocations.length}`);
  console.log(`  - Timestamp IDs: ${timestampLocations.length}`);

  if (legacyLocations.length > 0) {
    console.log('\n📋 Locations requiring migration:');
    legacyLocations.forEach(loc => {
      const idType = isTimestampId(loc.id) ? 'timestamp' : 'legacy';
      console.log(`  - ${loc.name} (${loc.id}) [${idType}]`);
    });
  }

  return {
    total: locations.length,
    legacy: legacyLocations,
    timestamp: timestampLocations,
    uuid: uuidLocations,
    placeId: placeIdLocations,
    needsMigration: legacyLocations.length > 0
  };
}

// ============================================================================
// Migration Operations
// ============================================================================

/**
 * Migrate leg destination IDs
 * @param {Array} legs
 * @param {Map} migrationMap
 * @returns {Array} Migrated legs
 */
function migrateLegDestinationIds(legs, migrationMap) {
  return legs.map(leg => {
    const migratedSubLegs = (leg.sub_legs || []).map(subLeg => {
      const oldDestIds = subLeg.destination_ids || [];
      const newDestIds = oldDestIds.map(oldId =>
        migrationMap.get(normalizeId(oldId)) || oldId
      );

      return {
        ...subLeg,
        destination_ids: newDestIds,
        _legacy_destination_ids: oldDestIds
      };
    });

    return {
      ...leg,
      sub_legs: migratedSubLegs
    };
  });
}

/**
 * Update working data with migrated IDs
 * @param {Object} migrationMap
 * @param {Array} migratedLocations
 * @param {Array} migratedCosts
 * @param {Array} migratedLegs
 */
function updateWorkingData(migrationMap, migratedLocations, migratedCosts, migratedLegs) {
  if (!window.appWorkingData) {
    console.warn('⚠️ No working data available to update');
    return;
  }

  window.appWorkingData.locations = migratedLocations;
  window.appWorkingData.costs = migratedCosts;
  window.appWorkingData.legs = migratedLegs;

  console.log('✅ Updated working data with migrated IDs');
}

/**
 * Save migrated costs to Firestore using bulk-save
 * @param {string} scenarioId
 * @param {Array} costs
 * @param {Array} locations
 * @returns {Promise<boolean>} Success status
 */
async function saveMigratedCosts(scenarioId, costs, locations) {
  console.log('💾 Saving migrated costs to Firestore...');

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
        fetch('/api/costs/bulk-save', {
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
 * Migrate legacy IDs to UUIDs
 * @param {string} scenarioId
 * @param {Object} options - Migration options
 * @returns {Promise<Object>} Migration results
 */
async function migrateLegacyIdsToUUIDs(scenarioId, options = {}) {
  const { dryRun = false, saveToDB = true } = options;

  console.log('🚀 Starting UUID migration for scenario:', scenarioId);
  if (dryRun) {
    console.log('⚠️ DRY RUN MODE - No changes will be saved');
  }
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Step 1: Fetch current data
    const originalData = await fetchScenarioData(scenarioId);

    // Step 2: Validate original data
    console.log('\n🔍 Validating original data...');
    const beforeValidation = validateDataIntegrity(originalData);
    if (beforeValidation.errors.length > 0) {
      console.warn('⚠️ Data validation found errors:');
      beforeValidation.errors.forEach(err => console.warn(`  - ${err.message}`));
    }

    // Step 3: Analyze migration candidates
    const analysis = analyzeMigrationCandidates(originalData.locations);

    if (!analysis.needsMigration) {
      console.log('\n✅ No legacy IDs found. Migration not needed.');
      return {
        success: true,
        migrated: 0,
        message: 'All locations already have UUIDs or Place IDs'
      };
    }

    // Step 4: Perform migration
    console.log('\n🔄 Performing migration...');

    // Migrate locations
    const { locations: migratedLocations, migrationMap } = migrateLocationIds(originalData.locations);
    console.log(`✅ Migrated ${analysis.legacy.length} locations`);

    // Migrate costs
    const migratedCosts = migrateCostDestinationIds(originalData.costs, migrationMap);
    const migratedCostCount = migratedCosts.filter(c => c._legacy_destination_id).length;
    console.log(`✅ Migrated ${migratedCostCount} costs`);

    // Migrate legs
    const migratedLegs = migrateLegDestinationIds(originalData.legs, migrationMap);
    console.log(`✅ Updated ${migratedLegs.length} legs`);

    // Step 5: Validate migrated data
    console.log('\n🔍 Validating migrated data...');
    const migratedData = {
      ...originalData,
      locations: migratedLocations,
      costs: migratedCosts,
      legs: migratedLegs
    };
    const afterValidation = validateDataIntegrity(migratedData);

    // Step 6: Generate migration report
    const migrationReport = createMigrationReport(originalData, migratedData);

    console.log('\n📊 MIGRATION REPORT');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Locations migrated: ${analysis.legacy.length}`);
    console.log(`Costs migrated: ${migratedCostCount}`);
    console.log(`Legs updated: ${migratedLegs.length}`);
    console.log('\nBefore:');
    console.log(`  - Legacy IDs: ${beforeValidation.summary.legacy_ids}`);
    console.log(`  - Orphaned costs: ${beforeValidation.summary.orphaned_costs}`);
    console.log('\nAfter:');
    console.log(`  - Legacy IDs: ${afterValidation.summary.legacy_ids}`);
    console.log(`  - Orphaned costs: ${afterValidation.summary.orphaned_costs}`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Step 7: Save changes
    let saved = false;
    if (!dryRun && saveToDB) {
      // Update working data first
      updateWorkingData(migrationMap, migratedLocations, migratedCosts, migratedLegs);

      // Save to Firestore
      saved = await saveMigratedCosts(scenarioId, migratedCosts, migratedLocations);

      if (saved) {
        console.log('\n✅ Migration completed and saved successfully!');
      } else {
        console.error('\n❌ Migration completed but save failed');
        console.error('   Working data has been updated, but Firestore sync failed');
        console.error('   You may need to manually verify or re-run the migration');
      }
    } else if (dryRun) {
      console.log('\n✅ Migration dry-run completed successfully!');
      console.log('   No changes were saved. Run with { dryRun: false } to apply changes.');
    } else {
      console.log('\n✅ Migration completed (not saved to DB)');
      console.log('   Run with { saveToDB: true } to save changes.');
    }

    return {
      success: true,
      dryRun,
      saved,
      migrated: analysis.legacy.length,
      costsMigrated: migratedCostCount,
      migrationMap: Object.fromEntries(migrationMap),
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

// ============================================================================
// Helper Functions for Browser Console
// ============================================================================

/**
 * Check George Town specifically (legacy function for backward compatibility)
 * @param {string} scenarioId
 */
async function checkGeorgeTownStatus(scenarioId) {
  console.log('🔍 Checking George Town, Penang status...');

  try {
    const data = await fetchScenarioData(scenarioId);

    const georgeTown = data.locations.find(loc =>
      loc.name?.includes('George Town') ||
      (loc.city === 'George Town' && loc.country?.includes('Penang'))
    );

    if (!georgeTown) {
      console.log('❌ George Town, Penang not found in locations');
      return null;
    }

    console.log('📍 George Town, Penang found:');
    console.log(`   ID: ${georgeTown.id}`);
    console.log(`   Name: ${georgeTown.name}`);
    console.log(`   City: ${georgeTown.city}`);
    console.log(`   Country: ${georgeTown.country}`);
    console.log(`   Has legacy ID: ${hasLegacyId(georgeTown)}`);
    console.log(`   Is timestamp ID: ${isTimestampId(georgeTown.id)}`);
    console.log(`   Is UUID: ${isUUID(georgeTown.id)}`);
    console.log(`   Is Place ID: ${isPlaceId(georgeTown.id)}`);

    // Check associated costs
    const georgeTownCosts = data.costs.filter(cost =>
      cost.destination_id === georgeTown.id || cost.destinationId === georgeTown.id
    );

    console.log(`\n💰 Associated costs: ${georgeTownCosts.length}`);
    if (georgeTownCosts.length > 0) {
      georgeTownCosts.forEach(cost => {
        console.log(`   - ${cost.category}: $${cost.amount_usd || cost.amount || 0}`);
      });
    }

    return georgeTown;

  } catch (error) {
    console.error('❌ Error checking George Town status:', error);
    return null;
  }
}

/**
 * Quick migration preview (dry-run)
 * @param {string} scenarioId
 */
async function previewMigration(scenarioId) {
  return await migrateLegacyIdsToUUIDs(scenarioId, { dryRun: true });
}

// ============================================================================
// Exports for Browser Console
// ============================================================================

window.migrateLegacyIdsToUUIDs = migrateLegacyIdsToUUIDs;
window.previewMigration = previewMigration;
window.checkGeorgeTownStatus = checkGeorgeTownStatus;
window.hasLegacyId = hasLegacyId;
window.isTimestampId = isTimestampId;

console.log('✅ UUID Migration Utility (Refactored) loaded. Available functions:');
console.log('  - previewMigration(scenarioId) - Dry-run migration preview');
console.log('  - migrateLegacyIdsToUUIDs(scenarioId, options) - Perform migration');
console.log('      Options: { dryRun: false, saveToDB: true }');
console.log('  - checkGeorgeTownStatus(scenarioId) - Check George Town specifically');
console.log('  - hasLegacyId(location) - Check if location has legacy ID');
console.log('  - isTimestampId(id) - Check if ID is timestamp-based');
