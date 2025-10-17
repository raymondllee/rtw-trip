# Example Usage: Delete Orphaned Costs Script

This document provides practical examples of how to use the `delete-orphaned-costs.js` script in different scenarios.

## Quick Start

### 1. Always Start with Dry Run
```bash
# Basic dry run to see what orphaned costs exist
node delete-orphaned-costs.js --scenario-id your-scenario-id --dry-run

# With verbose output for detailed information
node delete-orphaned-costs.js --scenario-id your-scenario-id --dry-run --verbose
```

### 2. Safe Cleanup (Recommended for First Time)
```bash
# Safe mode with backup - only deletes costs with null/undefined destinations
node delete-orphaned-costs.js --scenario-id your-scenario-id --safe-mode --backup --verbose
```

### 3. Complete Cleanup (Use with Caution)
```bash
# Aggressive mode with interactive confirmation and backup
node delete-orphaned-costs.js --scenario-id your-scenario-id --aggressive --interactive --backup --verbose
```

## Real-World Scenarios

### Scenario 1: Initial Data Cleanup
You've just imported data and notice some costs don't have proper destination associations.

```bash
# Step 1: Analyze the situation
node delete-orphaned-costs.js --scenario-id abc123 --dry-run --verbose

# Step 2: If you're comfortable with the results, run safe cleanup
node delete-orphaned-costs.js --scenario-id abc123 --safe-mode --backup

# Step 3: Review results and consider aggressive mode if needed
node delete-orphaned-costs.js --scenario-id abc123 --aggressive --interactive --backup
```

### Scenario 2: Regular Maintenance
You want to periodically clean up orphaned costs that accumulate over time.

```bash
# Create a maintenance script (maintenance-cleanup.sh)
#!/bin/bash

SCENARIO_ID="your-scenario-id"
DATE=$(date +%Y-%m-%d)

echo "Starting orphaned costs cleanup for $SCENARIO_ID on $DATE"

# Step 1: Analysis
echo "Step 1: Analyzing orphaned costs..."
node delete-orphaned-costs.js --scenario-id $SCENARIO_ID --dry-run --verbose

# Step 2: Safe cleanup
echo "Step 2: Performing safe cleanup..."
node delete-orphaned-costs.js --scenario-id $SCENARIO_ID --safe-mode --backup

echo "Cleanup completed. Check backup files for recovery options."
```

### Scenario 3: Data Migration Cleanup
After migrating data from another system, you have costs with invalid destination IDs.

```bash
# Step 1: Comprehensive analysis
node delete-orphaned-costs.js --scenario-id migrated-scenario --dry-run --verbose

# Step 2: If many costs are orphaned, review with interactive mode
node delete-orphaned-costs.js --scenario-id migrated-scenario --aggressive --interactive --backup --verbose

# Step 3: Keep backup for potential data recovery needs
# Backup file: backup_costs_migrated-scenario_[timestamp].json
```

## Output Interpretation

### Understanding the Analysis Report

```
================================================================================
📊 ORPHANED COSTS ANALYSIS REPORT
================================================================================

📈 SUMMARY:
  Total Costs: 150
  Orphaned Costs: 8
  Percentage: 5.33%
  Total Orphaned Amount: $1,250.00
```

**What this means:**
- You have 150 total costs in your scenario
- 8 of them are orphaned (not associated with any destination)
- This represents 5.33% of your total costs
- The orphaned costs total $1,250

```
🔍 BREAKDOWN BY REASON:
  Null/Undefined Destination: 5
  Invalid Destination ID: 3
```

**What this means:**
- 5 costs have no destination ID at all (null/undefined)
- 3 costs have destination IDs that don't match any existing destination

```
📋 BREAKDOWN BY CATEGORY:
  food:
    Total: 25 costs ($750.00)
    Orphaned: 3 costs ($150.00)
    Orphaned %: 12.00%
```

**What this means:**
- You have 25 food costs totaling $750
- 3 of those food costs are orphaned ($150 total)
- 12% of your food costs are orphaned

## Safety Best Practices

### 1. Always Use Backup
```bash
# Always include --backup when performing actual deletions
node delete-orphaned-costs.js --scenario-id abc123 --safe-mode --backup
```

### 2. Use Interactive Mode for Important Scenarios
```bash
# Interactive mode prevents accidental deletions
node delete-orphaned-costs.js --scenario-id abc123 --aggressive --interactive --backup
```

### 3. Review Backup Files
After running with backup, check the backup file:
```bash
# View backup contents
cat backup_costs_abc123_1705758600000.json | jq '.'
```

### 4. Test with Non-Critical Scenarios First
Practice with test scenarios before running on important data:
```bash
# Test with a dummy scenario first
node delete-orphaned-costs.js --scenario-id test-scenario --dry-run --verbose
```

## Troubleshooting Common Situations

### "No costs found in this scenario"
```bash
# Verify the scenario ID exists and has costs
node delete-orphaned-costs.js --scenario-id verify-id --dry-run --verbose
```

### "No locations found for this scenario"
This is a warning, not an error. The script will still work:
```bash
# Costs with any destination ID will be considered orphaned
node delete-orphaned-costs.js --scenario-id scenario-id --aggressive --dry-run
```

### High Percentage of Orphaned Costs
If you see a high percentage (>20%), investigate before deleting:
```bash
# Use verbose mode to see all orphaned cost details
node delete-orphaned-costs.js --scenario-id scenario-id --dry-run --verbose

# Consider manual review before aggressive cleanup
node delete-orphaned-costs.js --scenario-id scenario-id --safe-mode --interactive --backup
```

## Integration with Workflows

### Automated Cleanup (Scheduled)
```bash
# Create a scheduled job (crontab -e)
# Run safe cleanup every Sunday at 2 AM
0 2 * * 0 /path/to/scripts/maintenance-cleanup.sh >> /var/log/cleanup.log 2>&1
```

### Pre-Deployment Validation
```bash
# Validate data before deploying changes
#!/bin/bash
echo "Pre-deployment data validation..."
node delete-orphaned-costs.js --scenario-id production --dry-run --verbose

if [ $? -eq 0 ]; then
    echo "✅ Data validation passed"
else
    echo "❌ Data validation failed"
    exit 1
fi
```

### Post-Migration Cleanup
```bash
# After data migration, perform cleanup in stages
#!/bin/bash

SCENARIO_ID="migrated-data"

echo "Stage 1: Analysis"
node delete-orphaned-costs.js --scenario-id $SCENARIO_ID --dry-run --verbose

echo "Stage 2: Safe cleanup"
node delete-orphaned-costs.js --scenario-id $SCENARIO_ID --safe-mode --backup

echo "Stage 3: Review and aggressive cleanup"
read -p "Review safe cleanup results. Continue with aggressive cleanup? (y/N): " confirm
if [[ $confirm == [yY] ]]; then
    node delete-orphaned-costs.js --scenario-id $SCENARIO_ID --aggressive --interactive --backup
fi
```

## Recovery Procedures

### Restoring from Backup
If you need to restore deleted costs:

1. **Locate the backup file:**
   ```bash
   ls -la backup_costs_*.json
   ```

2. **Review backup contents:**
   ```bash
   cat backup_costs_scenario-id_timestamp.json | jq '.costs | length'
   ```

3. **Manual restoration:** (Requires custom script or API calls)
   - Extract costs from backup file
   - Use the API to re-insert costs
   - Or contact system administrator for assistance

### Partial Recovery
If you accidentally deleted too many costs:

1. **Stop any running cleanup operations**
2. **Review the backup file to identify needed costs**
3. **Contact support for restoration assistance**
4. **Consider using safe mode for future operations**

## Advanced Usage

### Custom API Endpoint
```bash
# Use custom API server
API_BASE="https://production-api.example.com" node delete-orphaned-costs.js --scenario-id abc123 --dry-run
```

### Batch Processing Multiple Scenarios
```bash
#!/bin/bash
# Process multiple scenarios
SCENARIOS=("scenario1" "scenario2" "scenario3")

for scenario in "${SCENARIOS[@]}"; do
    echo "Processing scenario: $scenario"
    node delete-orphaned-costs.js --scenario-id $scenario --safe-mode --backup
    echo "Completed: $scenario"
    echo "---"
done
```

### Logging and Monitoring
```bash
# Create detailed logs
node delete-orphaned-costs.js --scenario-id abc123 --dry-run --verbose > cleanup_analysis.log 2>&1

# Monitor log file for patterns
grep -i "orphaned\|error\|warning" cleanup_analysis.log
```

This comprehensive guide should help you use the orphaned costs deletion script safely and effectively in various scenarios.
