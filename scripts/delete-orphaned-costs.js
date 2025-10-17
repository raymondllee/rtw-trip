#!/usr/bin/env node

/**
 * Delete Orphaned Costs Script
 * 
 * This script identifies and deletes costs that are not associated with any destination.
 * It provides multiple safety modes and detailed reporting before performing any deletions.
 * 
 * Usage:
 *   node delete-orphaned-costs.js --scenario-id [id] --dry-run
 *   node delete-orphaned-costs.js --scenario-id [id] --safe-mode
 *   node delete-orphaned-costs.js --scenario-id [id] --aggressive --backup
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const readline = require('readline');

// ============================================================================
// Configuration & Constants
// ============================================================================

const API_BASE = process.env.API_BASE || 'http://localhost:5001';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Cost categories for reporting
const COST_CATEGORIES = ['flight', 'accommodation', 'activity', 'food', 'transport', 'other'];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    scenarioId: null,
    dryRun: false,
    safeMode: false,
    aggressiveMode: false,
    backup: false,
    interactive: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--scenario-id':
      case '-s':
        options.scenarioId = args[++i];
        break;
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      case '--safe-mode':
        options.safeMode = true;
        break;
      case '--aggressive':
      case '-a':
        options.aggressiveMode = true;
        break;
      case '--backup':
      case '-b':
        options.backup = true;
        break;
      case '--interactive':
      case '-i':
        options.interactive = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
Delete Orphaned Costs Script

USAGE:
  node delete-orphaned-costs.js [OPTIONS]

REQUIRED OPTIONS:
  --scenario-id, -s <id>     Scenario ID to process

MODE OPTIONS:
  --dry-run, -d              Show what would be deleted without actually deleting (default)
  --safe-mode                Only delete costs with null/undefined destination_id
  --aggressive, -a           Delete all orphaned costs including those with invalid IDs

SAFETY OPTIONS:
  --backup, -b               Create backup before deletion
  --interactive, -i          Interactive mode with confirmation prompts

OTHER OPTIONS:
  --verbose, -v              Detailed output
  --help, -h                 Show this help message

EXAMPLES:
  # Dry run to see what would be deleted
  node delete-orphaned-costs.js --scenario-id abc123 --dry-run

  # Safe mode with backup
  node delete-orphaned-costs.js --scenario-id abc123 --safe-mode --backup

  # Aggressive mode with confirmation
  node delete-orphaned-costs.js --scenario-id abc123 --aggressive --interactive

  # Verbose output
  node delete-orphaned-costs.js --scenario-id abc123 --dry-run --verbose
`);
}

/**
 * Log message with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] ${level}:`;
  console.log(`${prefix} ${message}`);
}

/**
 * Verbose logging
 */
function logVerbose(message, options) {
  if (options.verbose) {
    log(message, 'DEBUG');
  }
}

/**
 * Make HTTP request with error handling
 */
async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    timeout: DEFAULT_TIMEOUT,
    ...options
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create interactive prompt
 */
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Ask user for confirmation
 */
async function askConfirmation(question) {
  const rl = createPrompt();
  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Fetch all costs for a scenario
 */
async function fetchCosts(scenarioId, options) {
  logVerbose(`Fetching costs for scenario: ${scenarioId}`, options);
  
  try {
    const data = await makeRequest(`${API_BASE}/api/costs?session_id=${scenarioId}`);
    logVerbose(`Fetched ${data.costs?.length || 0} costs`, options);
    return data.costs || [];
  } catch (error) {
    log(`Failed to fetch costs: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Fetch locations/destinations for a scenario
 */
async function fetchLocations(scenarioId, options) {
  logVerbose(`Fetching locations for scenario: ${scenarioId}`, options);
  
  try {
    // Try to get locations from working data first
    const workingDataUrl = `${API_BASE}/api/working-data?session_id=${scenarioId}`;
    let locations = [];
    
    try {
      const workingData = await makeRequest(workingDataUrl);
      locations = workingData.locations || [];
    } catch (error) {
      logVerbose(`Could not fetch working data: ${error.message}`, options);
      // Fallback: try to get locations from itinerary data
      try {
        const itineraryData = await makeRequest(`${API_BASE}/api/itinerary?session_id=${scenarioId}`);
        locations = itineraryData.locations || [];
      } catch (itineraryError) {
        logVerbose(`Could not fetch itinerary data: ${itineraryError.message}`, options);
      }
    }
    
    logVerbose(`Fetched ${locations.length} locations`, options);
    return locations;
  } catch (error) {
    log(`Failed to fetch locations: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Create backup of costs before deletion
 */
async function createBackup(scenarioId, costs, options) {
  if (!options.backup) {
    return null;
  }

  log(`Creating backup of ${costs.length} costs...`, options);
  
  try {
    const backupData = {
      scenarioId,
      timestamp: new Date().toISOString(),
      costs: costs,
      totalCosts: costs.length
    };

    const backupFileName = `backup_costs_${scenarioId}_${Date.now()}.json`;
    
    // Save backup file
    const fs = require('fs').promises;
    await fs.writeFile(backupFileName, JSON.stringify(backupData, null, 2));
    
    log(`Backup created: ${backupFileName}`, 'SUCCESS');
    return backupFileName;
  } catch (error) {
    log(`Failed to create backup: ${error.message}`, 'ERROR');
    throw error;
  }
}

// ============================================================================
// Cost Analysis Functions
// ============================================================================

/**
 * Analyze costs and identify orphaned ones
 */
function analyzeCosts(costs, locations, options) {
  logVerbose('Analyzing costs for orphaned entries...', options);
  
  const locationIds = new Set(locations.map(loc => String(loc.id)));
  const analysis = {
    totalCosts: costs.length,
    orphanedCosts: [],
    categories: {},
    reasons: {
      nullDestination: [],
      invalidDestination: [],
      malformedDestination: []
    }
  };

  costs.forEach(cost => {
    const destId = cost.destination_id || cost.destinationId;
    
    // Categorize by amount for reporting
    const amount = cost.amount_usd || cost.amount || 0;
    const category = cost.category || 'other';
    
    if (!analysis.categories[category]) {
      analysis.categories[category] = {
        count: 0,
        totalAmount: 0,
        orphanedCount: 0,
        orphanedAmount: 0
      };
    }
    
    analysis.categories[category].count++;
    analysis.categories[category].totalAmount += amount;

    // Check if cost is orphaned
    let isOrphaned = false;
    let reason = null;

    if (destId === null || destId === undefined || destId === '') {
      isOrphaned = true;
      reason = 'nullDestination';
      analysis.reasons.nullDestination.push(cost);
    } else if (!locationIds.has(String(destId))) {
      isOrphaned = true;
      reason = 'invalidDestination';
      analysis.reasons.invalidDestination.push(cost);
    }

    if (isOrphaned) {
      analysis.orphanedCosts.push(cost);
      analysis.categories[category].orphanedCount++;
      analysis.categories[category].orphanedAmount += amount;
    }
  });

  return analysis;
}

/**
 * Generate detailed report of analysis
 */
function generateReport(analysis, options) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 ORPHANED COSTS ANALYSIS REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n📈 SUMMARY:`);
  console.log(`  Total Costs: ${analysis.totalCosts}`);
  console.log(`  Orphaned Costs: ${analysis.orphanedCosts.length}`);
  console.log(`  Percentage: ${((analysis.orphanedCosts.length / analysis.totalCosts) * 100).toFixed(2)}%`);

  const totalOrphanedAmount = analysis.orphanedCosts.reduce((sum, cost) => 
    sum + (cost.amount_usd || cost.amount || 0), 0
  );
  console.log(`  Total Orphaned Amount: $${totalOrphanedAmount.toFixed(2)}`);

  console.log(`\n🔍 BREAKDOWN BY REASON:`);
  console.log(`  Null/Undefined Destination: ${analysis.reasons.nullDestination.length}`);
  console.log(`  Invalid Destination ID: ${analysis.reasons.invalidDestination.length}`);

  console.log(`\n📋 BREAKDOWN BY CATEGORY:`);
  Object.entries(analysis.categories).forEach(([category, data]) => {
    console.log(`  ${category}:`);
    console.log(`    Total: ${data.count} costs ($${data.totalAmount.toFixed(2)})`);
    console.log(`    Orphaned: ${data.orphanedCount} costs ($${data.orphanedAmount.toFixed(2)})`);
    if (data.count > 0) {
      console.log(`    Orphaned %: ${((data.orphanedCount / data.count) * 100).toFixed(2)}%`);
    }
  });

  if (options.verbose && analysis.orphanedCosts.length > 0) {
    console.log(`\n📝 ORPHANED COSTS DETAIL:`);
    analysis.orphanedCosts.forEach((cost, index) => {
      const amount = cost.amount_usd || cost.amount || 0;
      const destId = cost.destination_id || cost.destinationId || 'null';
      console.log(`  ${index + 1}. ${cost.category} - $${amount.toFixed(2)} - ${cost.description?.substring(0, 50) || 'No description'}...`);
      console.log(`     Destination ID: ${destId}`);
      console.log(`     Cost ID: ${cost.id}`);
    });
  }

  console.log('\n' + '='.repeat(80));
}

// ============================================================================
// Deletion Functions
// ============================================================================

/**
 * Determine which costs to delete based on mode
 */
function getCostsToDelete(analysis, options) {
  if (options.dryRun) {
    return [];
  }

  let costsToDelete = [];

  if (options.safeMode) {
    // Safe mode: only delete costs with null/undefined destination
    costsToDelete = analysis.reasons.nullDestination;
  } else if (options.aggressiveMode) {
    // Aggressive mode: delete all orphaned costs
    costsToDelete = analysis.orphanedCosts;
  }

  return costsToDelete;
}

/**
 * Delete costs via API
 */
async function deleteCosts(scenarioId, costsToDelete, options) {
  if (costsToDelete.length === 0) {
    log('No costs to delete', 'INFO');
    return { deleted: 0, errors: [] };
  }

  log(`Deleting ${costsToDelete.length} costs...`, options);
  
  const results = {
    deleted: 0,
    errors: []
  };

  // Delete costs one by one to handle errors gracefully
  for (const cost of costsToDelete) {
    try {
      await makeRequest(`${API_BASE}/api/costs/${cost.id}?session_id=${scenarioId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      results.deleted++;
      logVerbose(`Deleted cost: ${cost.id}`, options);
    } catch (error) {
      const errorMsg = `Failed to delete cost ${cost.id}: ${error.message}`;
      results.errors.push(errorMsg);
      log(errorMsg, 'ERROR');
    }
  }

  return results;
}

// ============================================================================
// Main Execution Function
// ============================================================================

/**
 * Main execution function
 */
async function main() {
  const options = parseArgs();

  // Validate required arguments
  if (!options.scenarioId) {
    console.error('Error: Scenario ID is required. Use --scenario-id <id>');
    showHelp();
    process.exit(1);
  }

  // Set default mode if none specified
  if (!options.safeMode && !options.aggressiveMode) {
    options.dryRun = true;
  }

  log(`Starting orphaned costs deletion for scenario: ${options.scenarioId}`);
  log(`Mode: ${options.dryRun ? 'DRY RUN' : (options.safeMode ? 'SAFE MODE' : 'AGGRESSIVE MODE')}`);
  log(`Backup: ${options.backup ? 'YES' : 'NO'}`);
  log(`Interactive: ${options.interactive ? 'YES' : 'NO'}`);

  try {
    // Step 1: Fetch data
    log('Fetching data...');
    const costs = await fetchCosts(options.scenarioId, options);
    const locations = await fetchLocations(options.scenarioId, options);

    if (costs.length === 0) {
      log('No costs found in this scenario', 'INFO');
      return;
    }

    if (locations.length === 0) {
      log('Warning: No locations found for this scenario', 'WARNING');
    }

    // Step 2: Analyze costs
    log('Analyzing costs...');
    const analysis = analyzeCosts(costs, locations, options);

    // Step 3: Generate report
    generateReport(analysis, options);

    // Step 4: Determine costs to delete
    const costsToDelete = getCostsToDelete(analysis, options);

    if (costsToDelete.length === 0) {
      if (options.dryRun) {
        log('Dry run completed. No costs would be deleted.', 'SUCCESS');
      } else {
        log('No costs found matching the deletion criteria.', 'INFO');
      }
      return;
    }

    // Step 5: Show what will be deleted
    const totalAmount = costsToDelete.reduce((sum, cost) => 
      sum + (cost.amount_usd || cost.amount || 0), 0
    );
    
    console.log(`\n🎯 COSTS TO DELETE: ${costsToDelete.length} costs ($${totalAmount.toFixed(2)})`);
    
    if (!options.dryRun) {
      // Step 6: Create backup if requested
      let backupFile = null;
      if (options.backup) {
        backupFile = await createBackup(options.scenarioId, costsToDelete, options);
      }

      // Step 7: Interactive confirmation
      if (options.interactive) {
        const confirmed = await askConfirmation(
          `\nAre you sure you want to delete ${costsToDelete.length} costs totaling $${totalAmount.toFixed(2)}?`
        );
        
        if (!confirmed) {
          log('Operation cancelled by user', 'INFO');
          if (backupFile) {
            log(`Backup file preserved: ${backupFile}`, 'INFO');
          }
          return;
        }
      }

      // Step 8: Execute deletion
      log('Executing deletion...');
      const results = await deleteCosts(options.scenarioId, costsToDelete, options);

      // Step 9: Report results
      console.log('\n' + '='.repeat(80));
      console.log('🎉 DELETION RESULTS');
      console.log('='.repeat(80));
      console.log(`✅ Successfully deleted: ${results.deleted} costs`);
      
      if (results.errors.length > 0) {
        console.log(`❌ Errors encountered: ${results.errors.length}`);
        results.errors.forEach(error => {
          console.log(`   - ${error}`);
        });
      }

      if (backupFile) {
        console.log(`💾 Backup available: ${backupFile}`);
      }

      console.log('='.repeat(80));
    } else {
      log('Dry run completed. Use --safe-mode or --aggressive to actually delete costs.', 'SUCCESS');
    }

  } catch (error) {
    log(`Script failed: ${error.message}`, 'ERROR');
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// ============================================================================
// Execute Script
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main, analyzeCosts, generateReport, deleteCosts };
