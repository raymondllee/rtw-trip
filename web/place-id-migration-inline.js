/**
 * INLINE PLACE ID TO UUID MIGRATION
 *
 * Copy and paste this entire script into your browser console
 * when viewing your main app at http://localhost:5173/index.html
 *
 * SAFE: Run with preview mode first to see what will change
 */

(async function migratePlaceIdsInline() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔄 PLACE ID TO UUID MIGRATION');
  console.log('═══════════════════════════════════════════════════════\n');

  const scenarioId = window.currentScenarioId;
  if (!scenarioId) {
    console.error('❌ No scenario loaded. Please load a scenario first.');
    return;
  }

  console.log(`Scenario: ${scenarioId}\n`);

  // Get data
  const locations = window.appWorkingData?.locations || [];
  const costs = window.appWorkingData?.costs || [];
  const legs = window.appWorkingData?.legs || [];

  // Helper functions
  function isUUID(id) {
    if (typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  function isPlaceId(id) {
    if (typeof id !== 'string') return false;
    return id.startsWith('ChIJ') || id.startsWith('GhIJ') || id.startsWith('EhIJ');
  }

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Find locations to migrate
  const placeIdLocations = locations.filter(loc => isPlaceId(loc.id));
  const uuidLocations = locations.filter(loc => isUUID(loc.id));

  console.log('📊 Current state:');
  console.log(`  Total locations: ${locations.length}`);
  console.log(`  UUID-based: ${uuidLocations.length}`);
  console.log(`  Place ID-based: ${placeIdLocations.length} ← will migrate\n`);

  if (placeIdLocations.length === 0) {
    console.log('✅ No Place ID locations found. All good!');
    return;
  }

  // ASK FOR CONFIRMATION
  console.log('📋 Locations to migrate:\n');
  placeIdLocations.forEach((loc, i) => {
    console.log(`  ${i + 1}. ${loc.name}`);
    console.log(`     Current ID (Place ID): ${loc.id}`);
    console.log(`     Place ID will be preserved in: place_id field`);
  });

  console.log('\n⚠️ PREVIEW MODE');
  console.log('This is showing what WOULD happen. No changes yet.\n');

  // Generate migration map
  const migrationMap = new Map();
  const migratedLocations = [];

  console.log('🔄 Migration plan:\n');

  locations.forEach(loc => {
    if (isPlaceId(loc.id)) {
      const oldId = loc.id;
      const newId = generateUUID();
      migrationMap.set(oldId, newId);

      console.log(`📍 ${loc.name}`);
      console.log(`   Old ID: ${oldId}`);
      console.log(`   New ID: ${newId}`);
      console.log(`   Place ID preserved: ${oldId}\n`);

      migratedLocations.push({
        ...loc,
        id: newId,
        place_id: oldId, // Preserve Place ID
        _legacy_id: oldId,
        _migrated_at: new Date().toISOString()
      });
    } else {
      migrationMap.set(loc.id, loc.id);
      migratedLocations.push(loc);
    }
  });

  // Count affected costs
  const affectedCosts = costs.filter(cost => {
    const destId = cost.destination_id || cost.destinationId;
    return migrationMap.has(destId) && migrationMap.get(destId) !== destId;
  });

  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 MIGRATION SUMMARY (PREVIEW)');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Locations to migrate: ${placeIdLocations.length}`);
  console.log(`Costs to update: ${affectedCosts.length}`);
  console.log(`Place IDs to preserve: ${placeIdLocations.length}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Save migration functions for execution
  window.MIGRATION_DATA = {
    migrationMap,
    migratedLocations,
    scenarioId,
    placeIdCount: placeIdLocations.length,
    costCount: affectedCosts.length
  };

  console.log('✅ Preview complete!\n');
  console.log('💡 TO EXECUTE THE MIGRATION:\n');
  console.log('   1. Review the migration plan above');
  console.log('   2. Run: await executePlaceIdMigration()');
  console.log('   3. Then SAVE your scenario in the main app\n');

  // Define execution function
  window.executePlaceIdMigration = async function() {
    console.log('\n🚀 EXECUTING MIGRATION...\n');

    const data = window.MIGRATION_DATA;
    if (!data) {
      console.error('❌ No migration data. Run the preview first.');
      return;
    }

    try {
      // Update locations
      window.appWorkingData.locations = data.migratedLocations;

      // Update costs
      window.appWorkingData.costs = costs.map(cost => {
        const destId = cost.destination_id || cost.destinationId;
        const newId = data.migrationMap.get(destId);

        if (newId && newId !== destId) {
          return {
            ...cost,
            destination_id: newId,
            _legacy_destination_id: destId,
            _migrated_at: new Date().toISOString()
          };
        }
        return cost;
      });

      // Update legs
      window.appWorkingData.legs = legs.map(leg => ({
        ...leg,
        sub_legs: (leg.sub_legs || []).map(subLeg => {
          const newDestIds = (subLeg.destination_ids || []).map(id =>
            data.migrationMap.get(id) || id
          );
          return {
            ...subLeg,
            destination_ids: newDestIds
          };
        })
      }));

      console.log('✅ Working data updated!');
      console.log(`   - ${data.placeIdCount} locations migrated`);
      console.log(`   - ${data.costCount} costs updated`);

      // Save costs to API
      console.log('\n💾 Saving costs to API...');

      const costsByDest = new Map();
      window.appWorkingData.costs.forEach(cost => {
        const destId = cost.destination_id;
        if (!costsByDest.has(destId)) {
          costsByDest.set(destId, []);
        }
        costsByDest.get(destId).push(cost);
      });

      let savedCount = 0;
      for (const [destId, destCosts] of costsByDest) {
        const location = window.appWorkingData.locations.find(l => l.id === destId);
        const destName = location ? location.name : 'Unknown';

        const response = await fetch('http://localhost:5001/api/costs/bulk-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: data.scenarioId,
            scenario_id: data.scenarioId,
            destination_id: destId,
            destination_name: destName,
            cost_items: destCosts
          })
        });

        if (response.ok) {
          savedCount++;
          console.log(`  ✅ Saved ${destCosts.length} costs for ${destName}`);
        } else {
          console.error(`  ❌ Failed to save costs for ${destName}`);
        }
      }

      console.log(`\n✅ Saved costs for ${savedCount} destinations`);

      console.log('\n═══════════════════════════════════════════════════════');
      console.log('✅ MIGRATION COMPLETE!');
      console.log('═══════════════════════════════════════════════════════\n');

      console.log('⚠️ IMPORTANT: You must now SAVE the scenario in the main app');
      console.log('   to persist the location changes!\n');

      console.log('✅ Migration completed successfully!');
      console.log(`   - Migrated: ${data.placeIdCount} locations`);
      console.log(`   - Updated: ${data.costCount} costs`);
      console.log(`   - All Place IDs preserved in place_id field\n`);

      return {
        success: true,
        migrated: data.placeIdCount,
        costsUpdated: data.costCount
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);
      return { success: false, error: error.message };
    }
  };

})();
