/**
 * UUID Migration Utility
 * Migrates legacy destination IDs to UUIDs and updates associated costs
 */

// Simple UUID generator (fallback if crypto.randomUUID not available)
function generateDestinationId() {
  // Use crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 generation for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Normalize ID to string format for consistent comparison
function normalizeId(id) {
  if (id === null || id === undefined) {
    return '';
  }
  return String(id).trim();
}

// Check if a location has a legacy ID (non-UUID)
function hasLegacyId(location) {
  const id = location.id;
  if (!id || typeof id !== 'string') return true;
  
  // Check if it's a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return !uuidRegex.test(id);
}

// Check if an ID is a timestamp (like 1760652823)
function isTimestampId(id) {
  if (!id) return false;
  const numId = parseInt(id);
  return !isNaN(numId) && numId > 1000000000 && numId < 2000000000;
}

// Migrate a single location from legacy ID to UUID
function migrateLocationToUUID(location) {
  if (!hasLegacyId(location)) {
    return location; // Already has UUID
  }

  const oldId = location.id;
  const newId = generateDestinationId();
  
  console.log(`🔄 Migrating location: ${location.name}`);
  console.log(`   Old ID: ${oldId} (${isTimestampId(oldId) ? 'timestamp' : 'legacy'})`);
  console.log(`   New ID: ${newId}`);

  // Create new location object with UUID
  const migratedLocation = {
    ...location,
    id: newId,
    _legacy_id: oldId, // Keep legacy ID for reference
    _migrated_at: new Date().toISOString()
  };

  return migratedLocation;
}

// Migrate costs to use new destination UUID
function migrateCostsToUUID(costs, oldId, newId) {
  let migratedCount = 0;
  
  const migratedCosts = costs.map(cost => {
    // Check if this cost belongs to the migrated location
    if (cost.destination_id === oldId || cost.destinationId === oldId) {
      migratedCount++;
      console.log(`   💰 Migrating cost: ${cost.category} - ${cost.description?.substring(0, 30)}...`);
      
      return {
        ...cost,
        destination_id: newId,
        destinationId: newId, // Update both field names
        _legacy_destination_id: oldId,
        _migrated_at: new Date().toISOString()
      };
    }
    return cost;
  });

  console.log(`✅ Migrated ${migratedCount} costs for ${oldId} -> ${newId}`);
  return migratedCosts;
}

// Main migration function
async function migrateLegacyIdsToUUIDs(scenarioId) {
  console.log('🚀 Starting UUID migration for scenario:', scenarioId);
  
  try {
    // Fetch current data from Firestore
    const response = await fetch(`/api/costs?session_id=${scenarioId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    
    const data = await response.json();
    const costs = data.costs || [];
    console.log(`📦 Loaded ${costs.length} costs from Firestore`);
    
    // Get scenario data with locations from Firestore
    const locations = [];
    
    // Try to get locations from the current working data if available
    if (window.appWorkingData && window.appWorkingData.locations) {
      locations.push(...window.appWorkingData.locations);
      console.log(`📍 Loaded ${locations.length} locations from app working data`);
    } else {
      console.log('⚠️ No location data available in app working data');
    }
    
    console.log(`📍 Loaded ${locations.length} locations`);
    
    // Find locations with legacy IDs
    const legacyLocations = locations.filter(hasLegacyId);
    console.log(`🔍 Found ${legacyLocations.length} locations with legacy IDs:`);
    
    legacyLocations.forEach(loc => {
      const idType = isTimestampId(loc.id) ? 'timestamp' : 'legacy';
      console.log(`   - ${loc.name} (${loc.id}) [${idType}]`);
    });
    
    if (legacyLocations.length === 0) {
      console.log('✅ No legacy IDs found. Migration complete.');
      return { success: true, migrated: 0 };
    }
    
    // Migrate each legacy location
    let totalMigratedCosts = 0;
    const migrationMap = new Map();
    
    for (const location of legacyLocations) {
      const oldId = location.id;
      const newLocation = migrateLocationToUUID(location);
      const newId = newLocation.id;
      
      // Store migration mapping
      migrationMap.set(oldId, newId);
      
      // Migrate associated costs
      const migratedCosts = migrateCostsToUUID(costs, oldId, newId);
      totalMigratedCosts += migratedCosts.filter(c => 
        c.destination_id === newId || c.destinationId === newId
      ).length - costs.filter(c => 
        c.destination_id === oldId || c.destinationId === oldId
      ).length;
      
      // Update the location in the locations array
      const index = locations.findIndex(loc => loc.id === oldId);
      if (index !== -1) {
        locations[index] = newLocation;
      }
    }
    
    // Save migrated data back to Firestore using bulk-save for costs and update working data
    console.log('💾 Saving migrated data to Firestore...');
    
    // First, update the working data in the current app
    if (window.appWorkingData) {
      // Update locations in working data
      migrationMap.forEach((newId, oldId) => {
        const locationIndex = window.appWorkingData.locations.findIndex(loc => loc.id === oldId);
        if (locationIndex !== -1) {
          window.appWorkingData.locations[locationIndex].id = newId;
          window.appWorkingData.locations[locationIndex]._legacy_id = oldId;
          window.appWorkingData.locations[locationIndex]._migrated_at = new Date().toISOString();
        }
      });
      
      // Update costs in working data
      window.appWorkingData.costs = window.appWorkingData.costs.map(cost => {
        const oldId = cost.destination_id || cost.destinationId;
        if (migrationMap.has(oldId)) {
          const newId = migrationMap.get(oldId);
          return {
            ...cost,
            destination_id: newId,
            destinationId: newId,
            _legacy_destination_id: oldId,
            _migrated_at: new Date().toISOString()
          };
        }
        return cost;
      });
      
      console.log('✅ Updated working data with migrated IDs');
    }
    
    // Save migrated costs to Firestore using bulk-save
    const migratedCosts = costs.map(cost => {
      const oldId = cost.destination_id || cost.destinationId;
      if (migrationMap.has(oldId)) {
        const newId = migrationMap.get(oldId);
        return {
          ...cost,
          destination_id: newId,
          destinationId: newId,
          _legacy_destination_id: oldId,
          _migrated_at: new Date().toISOString()
        };
      }
      return cost;
    });
    
    // Group costs by destination for bulk-save
    const costsByDestination = new Map();
    migratedCosts.forEach(cost => {
      const destId = cost.destination_id;
      if (!costsByDestination.has(destId)) {
        costsByDestination.set(destId, []);
      }
      costsByDestination.get(destId).push(cost);
    });
    
    // Save each destination's costs
    let savePromises = [];
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
        })
      );
    });
    
    const saveResults = await Promise.all(savePromises);
    const saveResponse = { ok: saveResults.every(r => r.ok) };
    
    if (!saveResponse.ok) {
      throw new Error(`Failed to save migrated data: ${saveResponse.statusText}`);
    }
    
    console.log('✅ Migration completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Locations migrated: ${legacyLocations.length}`);
    console.log(`   - Costs migrated: ${totalMigratedCosts}`);
    console.log(`   - Migration map:`, Object.fromEntries(migrationMap));
    
    return {
      success: true,
      migrated: legacyLocations.length,
      costsMigrated: totalMigratedCosts,
      migrationMap: Object.fromEntries(migrationMap)
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error: error.message };
  }
}

// Function to check for George Town specifically
async function checkGeorgeTownStatus(scenarioId) {
  console.log('🔍 Checking George Town, Penang status...');
  
  try {
    // Get locations from the current working data if available
    let locations = [];
    
    if (window.appWorkingData && window.appWorkingData.locations) {
      locations.push(...window.appWorkingData.locations);
      console.log(`📍 Loaded ${locations.length} locations from app working data`);
    } else {
      console.log('⚠️ No location data available in app working data');
    }
    
    const georgeTown = locations.find(loc => 
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
    
    // Check associated costs
    const costsResponse = await fetch(`/api/costs?session_id=${scenarioId}`);
    if (costsResponse.ok) {
      const costsData = await costsResponse.json();
      const georgeTownCosts = costsData.costs?.filter(cost => 
        cost.destination_id === georgeTown.id || cost.destinationId === georgeTown.id
      ) || [];
      
      console.log(`💰 Associated costs: ${georgeTownCosts.length}`);
      georgeTownCosts.forEach(cost => {
        console.log(`   - ${cost.category}: $${cost.amount_usd} (${cost.destination_id})`);
      });
    }
    
    return georgeTown;
    
  } catch (error) {
    console.error('❌ Error checking George Town status:', error);
    return null;
  }
}

// Export functions for use in the browser console
window.migrateLegacyIdsToUUIDs = migrateLegacyIdsToUUIDs;
window.checkGeorgeTownStatus = checkGeorgeTownStatus;
window.hasLegacyId = hasLegacyId;
window.isTimestampId = isTimestampId;

console.log('✅ UUID Migration Utility loaded. Available functions:');
console.log('  - migrateLegacyIdsToUUIDs(scenarioId)');
console.log('  - checkGeorgeTownStatus(scenarioId)');
console.log('  - hasLegacyId(location)');
console.log('  - isTimestampId(id)');
