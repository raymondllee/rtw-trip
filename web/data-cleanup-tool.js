/**
 * Data Cleanup and Validation Tool
 * Comprehensive tool for validating and fixing data integrity issues
 */

import {
  validateDataIntegrity,
  findOrphanedCosts,
  validateUniqueDestinationIds,
  getCostsByDestination,
  reassignCosts,
  deleteCostsByDestination,
  normalizeId,
  isUUID,
  isPlaceId
} from './destination-id-manager.js';

// ============================================================================
// Data Fetching
// ============================================================================

/**
 * Fetch all data for a scenario
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

    // Get locations from working data or other source
    let locations = [];
    if (window.appWorkingData && window.appWorkingData.locations) {
      locations = window.appWorkingData.locations;
    }

    console.log(`✅ Loaded ${locations.length} locations and ${costs.length} costs`);

    return {
      scenarioId,
      locations,
      costs,
      legs: window.appWorkingData?.legs || []
    };
  } catch (error) {
    console.error('❌ Error fetching scenario data:', error);
    throw error;
  }
}

// ============================================================================
// Validation & Analysis
// ============================================================================

/**
 * Run comprehensive validation and return detailed report
 * @param {Object} data - Scenario data
 * @returns {Object} Detailed validation report
 */
function runComprehensiveValidation(data) {
  console.log('\n🔍 Running comprehensive validation...\n');

  const validation = validateDataIntegrity(data);

  // Additional custom checks
  const customChecks = {
    // Check for costs with null/undefined destination_id
    costsWithoutDestination: data.costs.filter(c => !c.destination_id && !c.destinationId),

    // Check for inconsistent field naming
    costsWithInconsistentNaming: data.costs.filter(c => {
      const hasDestId = c.destination_id !== undefined;
      const hasDestinationId = c.destinationId !== undefined;
      return hasDestId !== hasDestinationId; // XOR - only one is set
    }),

    // Check for duplicate cost IDs
    duplicateCostIds: findDuplicateCostIds(data.costs),

    // Check for locations without names
    locationsWithoutNames: data.locations.filter(loc => !loc.name || loc.name.trim() === ''),

    // Check for timestamp-based legacy IDs
    timestampIds: data.locations.filter(loc => {
      const id = String(loc.id);
      const numId = parseInt(id);
      return !isNaN(numId) && numId > 1000000000 && numId < 2000000000;
    })
  };

  // Print summary
  console.log('📊 VALIDATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total Locations: ${validation.summary.total_locations}`);
  console.log(`Total Costs: ${validation.summary.total_costs}`);
  console.log(`\nID Type Distribution:`);
  console.log(`  - UUID IDs: ${validation.summary.uuid_ids}`);
  console.log(`  - Place IDs: ${validation.summary.place_ids}`);
  console.log(`  - Legacy IDs: ${validation.summary.legacy_ids}`);
  console.log(`  - Timestamp IDs: ${customChecks.timestampIds.length}`);

  console.log('\n⚠️ ISSUES FOUND:');
  console.log(`  - Orphaned costs: ${validation.summary.orphaned_costs}`);
  console.log(`  - Costs without destination: ${customChecks.costsWithoutDestination.length}`);
  console.log(`  - Costs with inconsistent naming: ${customChecks.costsWithInconsistentNaming.length}`);
  console.log(`  - Duplicate cost IDs: ${customChecks.duplicateCostIds.length}`);
  console.log(`  - Locations without names: ${customChecks.locationsWithoutNames.length}`);

  if (validation.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    validation.errors.forEach(err => {
      console.log(`  - ${err.message}`);
    });
  }

  if (validation.warnings.length > 0) {
    console.log('\n⚠️ WARNINGS:');
    validation.warnings.forEach(warn => {
      console.log(`  - ${warn.message}`);
    });
  }

  console.log('═══════════════════════════════════════════════════════\n');

  return {
    ...validation,
    customChecks
  };
}

/**
 * Find duplicate cost IDs
 * @param {Array} costs
 * @returns {Array} Array of duplicate cost IDs
 */
function findDuplicateCostIds(costs) {
  const seen = new Set();
  const duplicates = [];

  costs.forEach(cost => {
    if (cost.id) {
      if (seen.has(cost.id)) {
        duplicates.push(cost.id);
      }
      seen.add(cost.id);
    }
  });

  return duplicates;
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Standardize field naming across all costs
 * @param {Array} costs
 * @returns {Array} Costs with standardized naming
 */
function standardizeFieldNaming(costs) {
  console.log('🔧 Standardizing field naming...');

  return costs.map(cost => {
    // Use destination_id as canonical field (snake_case)
    const destinationId = cost.destination_id || cost.destinationId;

    const standardized = {
      ...cost,
      destination_id: destinationId
    };

    // Remove the camelCase variant to avoid confusion
    delete standardized.destinationId;

    return standardized;
  });
}

/**
 * Handle orphaned costs interactively
 * @param {Array} orphanedCosts
 * @param {Array} locations
 * @returns {Object} Actions to take for each orphaned cost
 */
function analyzeOrphanedCosts(orphanedCosts, locations) {
  console.log('\n🔍 Analyzing orphaned costs...\n');

  const recommendations = [];

  orphanedCosts.forEach(cost => {
    const destId = cost.destination_id || cost.destinationId;

    // Try to find a similar location by name
    const costDescription = (cost.description || '').toLowerCase();
    const costNotes = (cost.notes || '').toLowerCase();

    const potentialMatches = locations.filter(loc => {
      const locName = (loc.name || '').toLowerCase();
      const locCity = (loc.city || '').toLowerCase();
      const locCountry = (loc.country || '').toLowerCase();

      return costDescription.includes(locName) ||
             costDescription.includes(locCity) ||
             costNotes.includes(locName) ||
             costNotes.includes(locCity);
    });

    recommendations.push({
      cost,
      invalidDestinationId: destId,
      potentialMatches,
      action: potentialMatches.length === 1 ? 'reassign' : potentialMatches.length > 1 ? 'review' : 'delete'
    });

    console.log(`📋 Cost: ${cost.category} - ${cost.description?.substring(0, 50)}...`);
    console.log(`   Invalid destination_id: ${destId}`);
    console.log(`   Amount: $${cost.amount_usd || cost.amount || 0}`);

    if (potentialMatches.length > 0) {
      console.log(`   Potential matches found: ${potentialMatches.length}`);
      potentialMatches.forEach(match => {
        console.log(`     - ${match.name} (${match.id})`);
      });
    } else {
      console.log(`   ⚠️ No potential matches found - recommend deletion`);
    }
    console.log('');
  });

  return recommendations;
}

/**
 * Clean up orphaned costs based on recommendations
 * @param {Array} costs
 * @param {Array} recommendations
 * @param {Object} options
 * @returns {Array} Cleaned costs
 */
function cleanupOrphanedCosts(costs, recommendations, options = {}) {
  const { autoReassign = true, autoDelete = false } = options;

  console.log('🧹 Cleaning up orphaned costs...');

  let cleanedCosts = [...costs];
  let reassignedCount = 0;
  let deletedCount = 0;
  let reviewCount = 0;

  recommendations.forEach(rec => {
    if (rec.action === 'reassign' && autoReassign && rec.potentialMatches.length === 1) {
      const newDestId = rec.potentialMatches[0].id;
      cleanedCosts = reassignCosts(cleanedCosts, [rec.cost.id], newDestId);
      console.log(`  ✅ Reassigned cost ${rec.cost.id} to ${rec.potentialMatches[0].name}`);
      reassignedCount++;
    } else if (rec.action === 'delete' && autoDelete) {
      cleanedCosts = cleanedCosts.filter(c => c.id !== rec.cost.id);
      console.log(`  🗑️ Deleted orphaned cost ${rec.cost.id}`);
      deletedCount++;
    } else {
      console.log(`  ⏭️ Skipped cost ${rec.cost.id} - requires manual review`);
      reviewCount++;
    }
  });

  console.log(`\n📊 Cleanup summary:`);
  console.log(`  - Reassigned: ${reassignedCount}`);
  console.log(`  - Deleted: ${deletedCount}`);
  console.log(`  - Requires review: ${reviewCount}`);

  return cleanedCosts;
}

/**
 * Remove duplicate cost entries
 * @param {Array} costs
 * @returns {Array} Deduplicated costs
 */
function deduplicateCosts(costs) {
  console.log('🔧 Removing duplicate cost entries...');

  const seen = new Set();
  const deduplicated = [];
  let duplicateCount = 0;

  costs.forEach(cost => {
    if (!cost.id) {
      // Keep costs without IDs
      deduplicated.push(cost);
      return;
    }

    if (!seen.has(cost.id)) {
      seen.add(cost.id);
      deduplicated.push(cost);
    } else {
      console.log(`  🗑️ Removing duplicate cost: ${cost.id}`);
      duplicateCount++;
    }
  });

  console.log(`  ✅ Removed ${duplicateCount} duplicate costs`);
  return deduplicated;
}

// ============================================================================
// Save Operations
// ============================================================================

/**
 * Save cleaned data back to Firestore
 * @param {string} scenarioId
 * @param {Array} costs
 * @param {Array} locations
 * @returns {Promise<boolean>} Success status
 */
async function saveCleanedData(scenarioId, costs, locations) {
  console.log('\n💾 Saving cleaned data to Firestore...');

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

    // Save each destination's costs using bulk-save
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
        })
      );
    });

    const results = await Promise.all(savePromises);
    const allSuccessful = results.every(r => r.ok);

    if (allSuccessful) {
      console.log('✅ All data saved successfully');

      // Update working data if available
      if (window.appWorkingData) {
        window.appWorkingData.costs = costs;
        window.appWorkingData.locations = locations;
        console.log('✅ Updated working data');
      }

      return true;
    } else {
      const failedCount = results.filter(r => !r.ok).length;
      console.error(`❌ ${failedCount} save operations failed`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error saving cleaned data:', error);
    return false;
  }
}

// ============================================================================
// Main Cleanup Function
// ============================================================================

/**
 * Run comprehensive data cleanup
 * @param {string} scenarioId
 * @param {Object} options - Cleanup options
 * @returns {Promise<Object>} Cleanup results
 */
async function runDataCleanup(scenarioId, options = {}) {
  const {
    autoReassign = true,
    autoDelete = false,
    saveToDB = false,
    standardizeNaming = true
  } = options;

  console.log('🚀 Starting comprehensive data cleanup...');
  console.log('Options:', { autoReassign, autoDelete, saveToDB, standardizeNaming });
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Step 1: Fetch data
    const data = await fetchScenarioData(scenarioId);

    // Step 2: Run validation
    const validation = runComprehensiveValidation(data);

    // Step 3: Clean up costs
    let cleanedCosts = [...data.costs];

    // Standardize field naming
    if (standardizeNaming) {
      cleanedCosts = standardizeFieldNaming(cleanedCosts);
    }

    // Deduplicate costs
    const duplicates = validation.customChecks.duplicateCostIds;
    if (duplicates.length > 0) {
      cleanedCosts = deduplicateCosts(cleanedCosts);
    }

    // Handle orphaned costs
    const orphanedCosts = findOrphanedCosts(cleanedCosts, data.locations);
    if (orphanedCosts.length > 0) {
      const recommendations = analyzeOrphanedCosts(orphanedCosts, data.locations);
      cleanedCosts = cleanupOrphanedCosts(cleanedCosts, recommendations, { autoReassign, autoDelete });
    }

    // Step 4: Re-validate
    console.log('\n🔍 Re-validating cleaned data...\n');
    const afterValidation = validateDataIntegrity({
      ...data,
      costs: cleanedCosts
    });

    console.log('📊 AFTER CLEANUP:');
    console.log(`  - Orphaned costs: ${afterValidation.summary.orphaned_costs}`);
    console.log(`  - Total costs: ${afterValidation.summary.total_costs}`);

    // Step 5: Save if requested
    let saved = false;
    if (saveToDB) {
      saved = await saveCleanedData(scenarioId, cleanedCosts, data.locations);
    } else {
      console.log('\n⏭️ Skipping save (dry-run mode)');
      console.log('   To save changes, run with { saveToDB: true }');
    }

    const results = {
      success: true,
      beforeValidation: validation,
      afterValidation,
      changes: {
        costsStandardized: standardizeNaming,
        duplicatesRemoved: duplicates.length,
        orphanedCostsProcessed: orphanedCosts.length,
        saved
      },
      cleanedData: {
        costs: cleanedCosts,
        locations: data.locations
      }
    };

    console.log('\n✅ Cleanup completed successfully!');
    return results;

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// Quick Analysis Functions
// ============================================================================

/**
 * Quick validation check (read-only)
 * @param {string} scenarioId
 */
async function quickValidation(scenarioId) {
  const data = await fetchScenarioData(scenarioId);
  return runComprehensiveValidation(data);
}

/**
 * Show orphaned costs details
 * @param {string} scenarioId
 */
async function showOrphanedCosts(scenarioId) {
  const data = await fetchScenarioData(scenarioId);
  const orphanedCosts = findOrphanedCosts(data.costs, data.locations);

  if (orphanedCosts.length === 0) {
    console.log('✅ No orphaned costs found!');
    return [];
  }

  return analyzeOrphanedCosts(orphanedCosts, data.locations);
}

/**
 * Show cost distribution by destination
 * @param {string} scenarioId
 */
async function showCostDistribution(scenarioId) {
  const data = await fetchScenarioData(scenarioId);
  const costsByDest = getCostsByDestination(data.costs, data.locations);

  console.log('\n💰 COST DISTRIBUTION BY DESTINATION\n');
  console.log('═══════════════════════════════════════════════════════');

  costsByDest.forEach((costs, destId) => {
    if (destId === '_orphaned' && costs.length === 0) return;

    const location = data.locations.find(loc => loc.id === destId);
    const name = location ? location.name : (destId === '_orphaned' ? 'ORPHANED' : 'Unknown');
    const total = costs.reduce((sum, c) => sum + (c.amount_usd || c.amount || 0), 0);

    console.log(`\n${name} (${destId})`);
    console.log(`  Costs: ${costs.length}`);
    console.log(`  Total: $${total.toFixed(2)}`);

    if (costs.length <= 5) {
      costs.forEach(c => {
        console.log(`    - ${c.category}: $${c.amount_usd || c.amount || 0} - ${c.description || 'N/A'}`);
      });
    }
  });

  console.log('\n═══════════════════════════════════════════════════════');

  return costsByDest;
}

// ============================================================================
// Exports
// ============================================================================

window.runDataCleanup = runDataCleanup;
window.quickValidation = quickValidation;
window.showOrphanedCosts = showOrphanedCosts;
window.showCostDistribution = showCostDistribution;

console.log('✅ Data Cleanup Tool loaded. Available functions:');
console.log('  - quickValidation(scenarioId) - Read-only validation check');
console.log('  - showOrphanedCosts(scenarioId) - Show orphaned cost details');
console.log('  - showCostDistribution(scenarioId) - Show cost breakdown by destination');
console.log('  - runDataCleanup(scenarioId, options) - Full cleanup with options:');
console.log('      { autoReassign: true, autoDelete: false, saveToDB: false, standardizeNaming: true }');
