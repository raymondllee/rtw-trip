/**
 * Inline Validation Script
 * Run this directly in the browser console of your main app
 * Usage: Just paste this entire script into console and run
 */

(async function runInlineValidation() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 DATA VALIDATION & CLEANUP TOOL');
  console.log('═══════════════════════════════════════════════════════\n');

  // Get scenario ID
  const scenarioId = window.currentScenarioId;
  if (!scenarioId) {
    console.error('❌ No scenario loaded. Please load a scenario first.');
    return;
  }

  console.log(`📦 Scenario ID: ${scenarioId}\n`);

  // Get data
  const locations = window.appWorkingData?.locations || [];
  const costs = window.appWorkingData?.costs || [];

  console.log(`📍 Locations: ${locations.length}`);
  console.log(`💰 Costs: ${costs.length}\n`);

  // Helper functions
  function isUUID(id) {
    if (typeof id !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  function isPlaceId(id) {
    if (typeof id !== 'string') return false;
    return id.startsWith('ChIJ') || id.startsWith('GhIJ') || id.startsWith('EhIJ');
  }

  function isTimestampId(id) {
    if (!id) return false;
    const numId = parseInt(id);
    return !isNaN(numId) && numId > 1000000000 && numId < 2000000000;
  }

  function normalizeId(id) {
    if (id === null || id === undefined) return '';
    return String(id).trim();
  }

  // Analyze locations
  console.log('🔍 ANALYZING LOCATIONS\n');

  const uuidLocations = locations.filter(loc => isUUID(loc.id));
  const placeIdLocations = locations.filter(loc => isPlaceId(loc.id));
  const legacyLocations = locations.filter(loc => !isUUID(loc.id) && !isPlaceId(loc.id));
  const timestampLocations = legacyLocations.filter(loc => isTimestampId(loc.id));

  console.log(`ID Type Distribution:`);
  console.log(`  ✓ UUID IDs: ${uuidLocations.length}`);
  console.log(`  ✓ Place IDs: ${placeIdLocations.length}`);
  console.log(`  ⚠️ Legacy IDs: ${legacyLocations.length}`);
  console.log(`  ⚠️ Timestamp IDs: ${timestampLocations.length}\n`);

  if (legacyLocations.length > 0) {
    console.log('📋 Locations with Legacy IDs (need migration):');
    legacyLocations.forEach(loc => {
      const idType = isTimestampId(loc.id) ? 'timestamp' : 'legacy';
      console.log(`  - ${loc.name} (ID: ${loc.id}) [${idType}]`);
    });
    console.log('');
  }

  // Check for duplicates
  const idCounts = new Map();
  locations.forEach(loc => {
    const id = normalizeId(loc.id);
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  });
  const duplicates = Array.from(idCounts.entries()).filter(([id, count]) => count > 1);

  if (duplicates.length > 0) {
    console.log('⚠️ DUPLICATE LOCATION IDs:');
    duplicates.forEach(([id, count]) => {
      console.log(`  - ID ${id} appears ${count} times`);
    });
    console.log('');
  }

  // Analyze costs
  console.log('💰 ANALYZING COSTS\n');

  const validLocationIds = new Set(locations.map(loc => normalizeId(loc.id)));

  const orphanedCosts = costs.filter(cost => {
    const destId = cost.destination_id || cost.destinationId;
    if (!destId) return false;
    return !validLocationIds.has(normalizeId(destId));
  });

  const costsWithoutDest = costs.filter(c => !c.destination_id && !c.destinationId);

  console.log(`Cost Status:`);
  console.log(`  ✓ Valid costs: ${costs.length - orphanedCosts.length - costsWithoutDest.length}`);
  console.log(`  ⚠️ Orphaned costs: ${orphanedCosts.length}`);
  console.log(`  ⚠️ Costs without destination: ${costsWithoutDest.length}\n`);

  if (orphanedCosts.length > 0) {
    console.log('💔 ORPHANED COSTS (referencing non-existent destinations):');
    orphanedCosts.forEach((cost, i) => {
      const destId = cost.destination_id || cost.destinationId;
      console.log(`  ${i + 1}. ${cost.category || 'N/A'}: ${(cost.description || 'No description').substring(0, 50)}`);
      console.log(`     Amount: $${cost.amount_usd || cost.amount || 0}`);
      console.log(`     Invalid destination_id: ${destId}`);

      // Try to find a match
      const desc = (cost.description || '').toLowerCase();
      const notes = (cost.notes || '').toLowerCase();
      const possibleMatches = locations.filter(loc => {
        const name = (loc.name || '').toLowerCase();
        const city = (loc.city || '').toLowerCase();
        return desc.includes(name) || desc.includes(city) ||
               notes.includes(name) || notes.includes(city);
      });

      if (possibleMatches.length > 0) {
        console.log(`     💡 Possible matches: ${possibleMatches.map(m => m.name).join(', ')}`);
      }
      console.log('');
    });
  }

  // Cost distribution by destination
  console.log('📊 COST DISTRIBUTION BY DESTINATION\n');

  const costsByDest = new Map();
  locations.forEach(loc => {
    costsByDest.set(normalizeId(loc.id), {
      location: loc,
      costs: []
    });
  });

  costs.forEach(cost => {
    const destId = normalizeId(cost.destination_id || cost.destinationId);
    if (costsByDest.has(destId)) {
      costsByDest.get(destId).costs.push(cost);
    }
  });

  const sortedDests = Array.from(costsByDest.entries())
    .map(([id, data]) => ({
      name: data.location.name,
      count: data.costs.length,
      total: data.costs.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0)
    }))
    .sort((a, b) => b.total - a.total);

  sortedDests.forEach(dest => {
    if (dest.count > 0) {
      console.log(`  ${dest.name}: ${dest.count} costs, $${dest.total.toFixed(2)} total`);
    }
  });

  // Summary and recommendations
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');

  const issues = [];
  if (legacyLocations.length > 0) issues.push(`${legacyLocations.length} legacy IDs`);
  if (orphanedCosts.length > 0) issues.push(`${orphanedCosts.length} orphaned costs`);
  if (duplicates.length > 0) issues.push(`${duplicates.length} duplicate IDs`);
  if (costsWithoutDest.length > 0) issues.push(`${costsWithoutDest.length} costs without destination`);

  if (issues.length === 0) {
    console.log('✅ No issues found! Your data is clean.');
  } else {
    console.log('⚠️ Issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    console.log('');

    console.log('💡 RECOMMENDATIONS:');
    if (legacyLocations.length > 0) {
      console.log(`  1️⃣ Migrate ${legacyLocations.length} legacy IDs to UUIDs`);
      console.log(`     Run: await migrateLegacyIdsToUUIDs('${scenarioId}')`);
    }
    if (orphanedCosts.length > 0) {
      console.log(`  2️⃣ Clean up ${orphanedCosts.length} orphaned costs`);
      console.log(`     Run: await runDataCleanup('${scenarioId}', { autoReassign: true, saveToDB: true })`);
    }
    if (duplicates.length > 0) {
      console.log(`  3️⃣ Fix ${duplicates.length} duplicate location IDs (manual review needed)`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ Validation complete!');
  console.log('═══════════════════════════════════════════════════════\n');

  // Store results for later use
  window.validationResults = {
    scenarioId,
    locations: {
      total: locations.length,
      uuid: uuidLocations.length,
      placeId: placeIdLocations.length,
      legacy: legacyLocations.length,
      timestamp: timestampLocations.length,
      duplicates: duplicates.length
    },
    costs: {
      total: costs.length,
      valid: costs.length - orphanedCosts.length - costsWithoutDest.length,
      orphaned: orphanedCosts.length,
      withoutDest: costsWithoutDest.length
    },
    details: {
      legacyLocations,
      orphanedCosts,
      duplicates,
      costsByDest: sortedDests
    }
  };

  console.log('💾 Results saved to: window.validationResults');

})();
