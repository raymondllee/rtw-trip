# Delete Orphaned Costs Script

## Overview

The `delete-orphaned-costs.js` script is a comprehensive utility for identifying and deleting costs that are not associated with any destination in your trip itinerary. It provides multiple safety modes, detailed reporting, and backup functionality to ensure safe data management.

## What are Orphaned Costs?

Orphaned costs are cost items that have one of the following issues:
- **Null/Undefined Destination**: The `destination_id` field is `null`, `undefined`, or empty
- **Invalid Destination**: The `destination_id` points to a destination that no longer exists in the itinerary
- **Malformed Destination**: The `destination_id` has an invalid format

## Features

### 🔍 **Comprehensive Analysis**
- Identifies all orphaned costs in your scenario
- Categorizes costs by type and reason for being orphaned
- Provides detailed breakdown by cost category (flight, accommodation, etc.)
- Shows total monetary impact of orphaned costs

### 🛡️ **Multiple Safety Modes**
- **Dry Run Mode** (default): Shows what would be deleted without actually deleting
- **Safe Mode**: Only deletes costs with `null`/`undefined` destination IDs
- **Aggressive Mode**: Deletes all orphaned costs including those with invalid destination IDs

### 💾 **Backup & Recovery**
- Optional backup creation before deletion
- Timestamped backup files with full cost data
- Easy restoration if needed

### 📊 **Detailed Reporting**
- Summary statistics and percentages
- Category-wise breakdown
- Verbose mode with individual cost details
- Clear indication of what will be deleted

### 🎯 **Interactive Features**
- Confirmation prompts before deletion
- Progress tracking during operations
- Error handling with detailed messages

## Installation & Setup

### Prerequisites
- Node.js (version 14 or higher)
- Access to the travel concierge API
- Appropriate permissions for the scenario

### Environment Variables
```bash
# Optional: Override API base URL (default: http://localhost:5001)
export API_BASE="http://your-api-server:port"
```

## Usage

### Basic Commands

#### 1. **Help Information**
```bash
node delete-orphaned-costs.js --help
```

#### 2. **Dry Run (Recommended First Step)**
```bash
node delete-orphaned-costs.js --scenario-id your-scenario-id --dry-run
```

#### 3. **Safe Mode with Backup**
```bash
node delete-orphaned-costs.js --scenario-id your-scenario-id --safe-mode --backup
```

#### 4. **Aggressive Mode with Confirmation**
```bash
node delete-orphaned-costs.js --scenario-id your-scenario-id --aggressive --interactive --backup
```

#### 5. **Verbose Output**
```bash
node delete-orphaned-costs.js --scenario-id your-scenario-id --dry-run --verbose
```

### Command Line Options

| Option | Short | Description |
|--------|-------|-------------|
| `--scenario-id` | `-s` | **Required**. Scenario ID to process |
| `--dry-run` | `-d` | Show what would be deleted without actually deleting (default) |
| `--safe-mode` | | Only delete costs with null/undefined destination_id |
| `--aggressive` | `-a` | Delete all orphaned costs including invalid IDs |
| `--backup` | `-b` | Create backup before deletion |
| `--interactive` | `-i` | Interactive mode with confirmation prompts |
| `--verbose` | `-v` | Detailed output with individual cost details |
| `--help` | `-h` | Show help information |

### Mode Explanations

#### Dry Run Mode (Default)
- **Purpose**: Analysis only, no changes made
- **Use Case**: First step to understand what orphaned costs exist
- **Safety**: 100% safe, no data modification

#### Safe Mode
- **Purpose**: Delete obviously orphaned costs
- **Use Case**: Clean up costs with null/undefined destinations
- **Safety**: Very safe, only removes clearly invalid data

#### Aggressive Mode
- **Purpose**: Clean up all orphaned costs
- **Use Case**: Complete cleanup when you're sure destinations are correct
- **Safety**: Use with caution and backup

## Output Examples

### Dry Run Output
```
[2024-01-20T10:30:00.000Z] INFO: Starting orphaned costs deletion for scenario: abc123
[2024-01-20T10:30:00.100Z] INFO: Mode: DRY RUN
[2024-01-20T10:30:00.100Z] INFO: Backup: NO
[2024-01-20T10:30:00.100Z] INFO: Interactive: NO
[2024-01-20T10:30:00.200Z] INFO: Fetching data...
[2024-01-20T10:30:01.500Z] INFO: Fetched 150 costs
[2024-01-20T10:30:02.000Z] INFO: Fetched 12 locations

================================================================================
📊 ORPHANED COSTS ANALYSIS REPORT
================================================================================

📈 SUMMARY:
  Total Costs: 150
  Orphaned Costs: 8
  Percentage: 5.33%
  Total Orphaned Amount: $1,250.00

🔍 BREAKDOWN BY REASON:
  Null/Undefined Destination: 5
  Invalid Destination ID: 3

📋 BREAKDOWN BY CATEGORY:
  flight:
    Total: 15 costs ($8,500.00)
    Orphaned: 2 costs ($600.00)
    Orphaned %: 13.33%
  accommodation:
    Total: 12 costs ($3,200.00)
    Orphaned: 1 costs ($150.00)
    Orphaned %: 8.33%
  ...
================================================================================

🎯 COSTS TO DELETE: 8 costs ($1,250.00)
[2024-01-20T10:30:03.000Z] INFO: Dry run completed. Use --safe-mode or --aggressive to actually delete costs.
```

### Interactive Confirmation
```
🎯 COSTS TO DELETE: 8 costs ($1,250.00)

Are you sure you want to delete 8 costs totaling $1,250.00? (y/N): y
[2024-01-20T10:30:05.000Z] INFO: Executing deletion...

================================================================================
🎉 DELETION RESULTS
================================================================================
✅ Successfully deleted: 8 costs
💾 Backup available: backup_costs_abc123_1705758600000.json
================================================================================
```

## Testing

### Run Tests
```bash
node test-delete-orphaned-costs.js
```

The test script includes:
- Mock data with various orphaned cost scenarios
- Validation of analysis logic
- Report generation testing
- Deletion logic verification

### Test Output Example
```
🚀 Starting Delete Orphaned Costs Script Tests
============================================================

🧪 Running test: Cost Analysis
──────────────────────────────────────────────────
✅ Test passed: Cost Analysis

🧪 Running test: Report Generation
──────────────────────────────────────────────────
📊 Generating test report...
[Detailed report output...]
✅ Test passed: Report Generation

🧪 Running test: Deletion Logic
──────────────────────────────────────────────────
✅ Safe mode would delete: 2 costs
✅ Aggressive mode would delete: 3 costs
✅ Test passed: Deletion Logic

============================================================
📋 TEST SUMMARY
============================================================
📊 Total costs analyzed: 6
🔍 Orphaned costs found: 3
💰 Total orphaned amount: $600.00
📋 Categories affected: food, transport, other
```

## Best Practices

### 1. **Always Start with Dry Run**
```bash
node delete-orphaned-costs.js --scenario-id your-id --dry-run --verbose
```

### 2. **Use Backup for Real Deletions**
```bash
node delete-orphaned-costs.js --scenario-id your-id --safe-mode --backup
```

### 3. **Interactive Mode for Important Scenarios**
```bash
node delete-orphaned-costs.js --scenario-id your-id --aggressive --interactive --backup
```

### 4. **Review Backup Files**
Backup files are named: `backup_costs_[scenario-id]_[timestamp].json`
They contain complete cost data for easy restoration.

### 5. **Monitor Results**
Keep track of deletion results and verify the data integrity afterward.

## Troubleshooting

### Common Issues

#### 1. **"Scenario ID is required"**
```bash
# Solution: Provide a valid scenario ID
node delete-orphaned-costs.js --scenario-id abc123 --dry-run
```

#### 2. **"Failed to fetch costs"**
- Check if the API server is running
- Verify the scenario ID exists
- Check network connectivity
- Ensure proper authentication

#### 3. **"No locations found"**
- This is a warning, not an error
- The script will still work and identify orphaned costs
- Consider checking if the scenario has proper itinerary data

#### 4. **Permission Errors**
- Ensure you have write permissions for backup files
- Check API access permissions for the scenario

### Debug Mode
Use verbose mode for detailed debugging:
```bash
node delete-orphaned-costs.js --scenario-id your-id --dry-run --verbose
```

## API Integration

The script integrates with the following API endpoints:
- `GET /api/costs?session_id={scenarioId}` - Fetch costs
- `GET /api/working-data?session_id={scenarioId}` - Fetch locations
- `GET /api/itinerary?session_id={scenarioId}` - Fallback for locations
- `DELETE /api/costs/{costId}?session_id={scenarioId}` - Delete individual costs

## Contributing

### Adding New Features
1. Follow the existing code structure and patterns
2. Add appropriate error handling and logging
3. Include tests for new functionality
4. Update documentation

### Code Style
- Use clear, descriptive function names
- Add comprehensive comments
- Follow the established logging patterns
- Maintain backward compatibility

## License

This script is part of the RTW Trip project and follows the same licensing terms.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Run the test script to verify functionality
3. Review the verbose output for detailed error information
4. Check the API server logs for additional context
