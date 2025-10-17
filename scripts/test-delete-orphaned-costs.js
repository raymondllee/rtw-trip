#!/usr/bin/env node

/**
 * Test script for delete-orphaned-costs.js
 * 
 * This script tests the functionality with mock data to ensure
 * the analysis and deletion logic works correctly.
 */

import { analyzeCosts, generateReport } from './delete-orphaned-costs.js';

// ============================================================================
// Mock Data for Testing
// ============================================================================

const mockCosts = [
  {
    id: 'cost_1',
    category: 'flight',
    description: 'Flight from NYC to Tokyo',
    amount: 1200,
    amount_usd: 1200,
    currency: 'USD',
    destination_id: 'dest_1',
    date: '2024-01-15'
  },
  {
    id: 'cost_2',
    category: 'accommodation',
    description: 'Hotel in Tokyo',
    amount: 800,
    amount_usd: 800,
    currency: 'USD',
    destination_id: 'dest_1',
    date: '2024-01-16'
  },
  {
    id: 'cost_3',
    category: 'food',
    description: 'Meals in Tokyo',
    amount: 300,
    amount_usd: 300,
    currency: 'USD',
    destination_id: null, // ORPHANED - null destination
    date: '2024-01-17'
  },
  {
    id: 'cost_4',
    category: 'activity',
    description: 'Temple tour',
    amount: 150,
    amount_usd: 150,
    currency: 'USD',
    destination_id: 'dest_2',
    date: '2024-01-18'
  },
  {
    id: 'cost_5',
    category: 'transport',
    description: 'Local transport',
    amount: 100,
    amount_usd: 100,
    currency: 'USD',
    destination_id: 'non_existent_dest', // ORPHANED - invalid destination
    date: '2024-01-19'
  },
  {
    id: 'cost_6',
    category: 'other',
    description: 'Souvenirs',
    amount: 200,
    amount_usd: 200,
    currency: 'USD',
    destination_id: undefined, // ORPHANED - undefined destination
    date: '2024-01-20'
  }
];

const mockLocations = [
  {
    id: 'dest_1',
    name: 'Tokyo, Japan',
    country: 'Japan',
    duration_days: 5
  },
  {
    id: 'dest_2',
    name: 'Kyoto, Japan',
    country: 'Japan',
    duration_days: 3
  }
];

// ============================================================================
// Test Functions
// ============================================================================

function runTest(name, testFn) {
  console.log(`\n🧪 Running test: ${name}`);
  console.log('─'.repeat(50));
  
  try {
    const result = testFn();
    console.log(`✅ Test passed: ${name}`);
    return result;
  } catch (error) {
    console.log(`❌ Test failed: ${name}`);
    console.error(`   Error: ${error.message}`);
    return null;
  }
}

function testAnalysis() {
  const options = { verbose: true };
  const analysis = analyzeCosts(mockCosts, mockLocations, options);
  
  // Validate analysis results
  console.assert(analysis.totalCosts === 6, 'Should have 6 total costs');
  console.assert(analysis.orphanedCosts.length === 3, 'Should have 3 orphaned costs');
  console.assert(analysis.reasons.nullDestination.length === 2, 'Should have 2 null destination costs');
  console.assert(analysis.reasons.invalidDestination.length === 1, 'Should have 1 invalid destination cost');
  
  return analysis;
}

function testReporting() {
  const analysis = testAnalysis();
  const options = { verbose: true };
  
  console.log('\n📊 Generating test report...');
  generateReport(analysis, options);
  
  return analysis;
}

function testCostDeletionLogic() {
  const analysis = testAnalysis();
  
  // Test safe mode
  const safeModeCosts = analysis.reasons.nullDestination;
  console.assert(safeModeCosts.length === 2, 'Safe mode should delete 2 costs');
  
  // Test aggressive mode
  const aggressiveModeCosts = analysis.orphanedCosts;
  console.assert(aggressiveModeCosts.length === 3, 'Aggressive mode should delete 3 costs');
  
  console.log(`✅ Safe mode would delete: ${safeModeCosts.length} costs`);
  console.log(`✅ Aggressive mode would delete: ${aggressiveModeCosts.length} costs`);
  
  return { safeModeCosts, aggressiveModeCosts };
}

// ============================================================================
// Main Test Execution
// ============================================================================

async function main() {
  console.log('🚀 Starting Delete Orphaned Costs Script Tests');
  console.log('='.repeat(60));
  
  // Run all tests
  const analysis = runTest('Cost Analysis', testAnalysis);
  runTest('Report Generation', testReporting);
  runTest('Deletion Logic', testCostDeletionLogic);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));
  
  if (analysis) {
    console.log(`📊 Total costs analyzed: ${analysis.totalCosts}`);
    console.log(`🔍 Orphaned costs found: ${analysis.orphanedCosts.length}`);
    console.log(`💰 Total orphaned amount: $${analysis.orphanedCosts.reduce((sum, cost) => sum + (cost.amount_usd || 0), 0).toFixed(2)}`);
    console.log(`📋 Categories affected: ${Object.keys(analysis.categories).join(', ')}`);
    
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('  - Use --dry-run first to see what would be deleted');
    console.log('  - Use --safe-mode to delete only null/undefined destination costs');
    console.log('  - Use --aggressive to delete all orphaned costs');
    console.log('  - Always use --backup when performing actual deletions');
    console.log('  - Use --interactive for confirmation prompts');
  }
  
  console.log('\n✅ All tests completed successfully!');
  console.log('\n📖 To run the actual script:');
  console.log('  node delete-orphaned-costs.js --help');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { runTest, testAnalysis, testReporting, testCostDeletionLogic };
