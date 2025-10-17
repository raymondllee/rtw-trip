# Data Migration & Cleanup Guide

## Overview

This guide covers the tools available for migrating legacy destination IDs to UUIDs and cleaning up data integrity issues in your trip planning application.

## Tools Available

### 1. **Migration Preview Tool** (Recommended)
**File:** `migration-preview-tool.html`

A comprehensive web-based UI for validating, previewing, and executing migrations.

**Features:**
- Visual interface with progress indicators
- Dry-run mode for safe previews
- Multiple validation checks
- Orphaned cost analysis
- Cost distribution reports
- Step-by-step migration process

**Usage:**
```bash
# Open in browser
open web/migration-preview-tool.html
```

### 2. **Data Cleanup Tool**
**File:** `data-cleanup-tool.js`

Comprehensive JavaScript module for fixing data integrity issues.

**Functions:**
- `quickValidation(scenarioId)` - Run validation checks
- `showOrphanedCosts(scenarioId)` - Analyze orphaned costs
- `showCostDistribution(scenarioId)` - View cost breakdown
- `runDataCleanup(scenarioId, options)` - Execute cleanup

**Options:**
```javascript
{
  autoReassign: true,      // Auto-reassign orphaned costs when match found
  autoDelete: false,       // Auto-delete orphaned costs (use with caution)
  saveToDB: false,         // Save changes to Firestore
  standardizeNaming: true  // Standardize field naming (destination_id)
}
```

**Example Usage:**
```javascript
// Preview cleanup (dry-run)
await runDataCleanup('scenario-id', {
  autoReassign: true,
  autoDelete: false,
  saveToDB: false
});

// Execute cleanup with save
await runDataCleanup('scenario-id', {
  autoReassign: true,
  autoDelete: false,
  saveToDB: true
});
```

### 3. **UUID Migration Tool (Refactored)**
**File:** `uuid-migration-refactored.js`

Modern migration tool using modular architecture.

**Functions:**
- `previewMigration(scenarioId)` - Dry-run preview
- `migrateLegacyIdsToUUIDs(scenarioId, options)` - Execute migration
- `checkGeorgeTownStatus(scenarioId)` - Check specific location

**Options:**
```javascript
{
  dryRun: false,  // Preview without saving
  saveToDB: true  // Save changes to Firestore
}
```

**Example Usage:**
```javascript
// Preview migration (dry-run)
const preview = await previewMigration('scenario-id');

// Execute migration
const result = await migrateLegacyIdsToUUIDs('scenario-id', {
  dryRun: false,
  saveToDB: true
});
```

### 4. **Destination ID Manager**
**File:** `destination-id-manager.js`

Core utility library with ID management functions.

**Key Functions:**
- `generateDestinationId()` - Generate UUID
- `isUUID(id)` - Check if ID is UUID
- `isPlaceId(id)` - Check if ID is Google Place ID
- `validateDataIntegrity(data)` - Validate data
- `findOrphanedCosts(costs, locations)` - Find orphaned costs
- `migrateLocationIds(locations)` - Migrate location IDs
- `migrateCostDestinationIds(costs, map)` - Migrate cost IDs

## Common Workflows

### Workflow 1: Initial Validation

Before making any changes, understand your data:

```javascript
// 1. Run quick validation
const validation = await quickValidation('scenario-id');

// 2. Check for orphaned costs
const orphaned = await showOrphanedCosts('scenario-id');

// 3. View cost distribution
await showCostDistribution('scenario-id');
```

### Workflow 2: Clean Up Data Issues

Fix orphaned costs and inconsistent naming:

```javascript
// 1. Preview cleanup (safe, no changes)
await runDataCleanup('scenario-id', {
  autoReassign: true,
  autoDelete: false,
  saveToDB: false
});

// 2. Review console output

// 3. Execute cleanup
await runDataCleanup('scenario-id', {
  autoReassign: true,
  autoDelete: false,  // Set to true only if you want to delete orphaned costs
  saveToDB: true
});
```

### Workflow 3: Migrate to UUIDs

Migrate from legacy numeric IDs to UUIDs:

```javascript
// 1. Preview migration
const preview = await previewMigration('scenario-id');

// 2. Review what will change
console.log(`Will migrate ${preview.migrated} locations`);
console.log(`Will update ${preview.costsMigrated} costs`);

// 3. Execute migration
const result = await migrateLegacyIdsToUUIDs('scenario-id', {
  dryRun: false,
  saveToDB: true
});
```

### Workflow 4: Complete Data Cleanup + Migration

Run both cleanup and migration:

```javascript
// 1. Clean up data first
await runDataCleanup('scenario-id', {
  autoReassign: true,
  autoDelete: false,
  saveToDB: true,
  standardizeNaming: true
});

// 2. Then migrate to UUIDs
await migrateLegacyIdsToUUIDs('scenario-id', {
  dryRun: false,
  saveToDB: true
});

// 3. Validate final state
await quickValidation('scenario-id');
```

## Data Issues Detected

The tools can detect and fix:

### 1. **Orphaned Costs**
Costs that reference non-existent destination IDs.

**Solution:**
- Auto-reassign if clear match found
- Manual review if multiple matches
- Delete if no matches (optional)

### 2. **Inconsistent Field Naming**
Costs with mixed `destination_id` and `destinationId` fields.

**Solution:**
- Standardize to `destination_id` (snake_case)
- Remove deprecated `destinationId` field

### 3. **Duplicate Cost IDs**
Multiple costs with the same ID.

**Solution:**
- Keep first occurrence
- Remove duplicates

### 4. **Mixed ID Types**
Locations with different ID formats (UUID, Place ID, numeric, timestamp).

**Solution:**
- Migrate all to UUID format
- Preserve legacy IDs in `_legacy_id` field

### 5. **Locations Without Names**
Locations missing name field.

**Solution:**
- Flagged for manual review

## Validation Report

After running validation, you'll see:

```
📊 VALIDATION SUMMARY
═══════════════════════════════════════════════════════
Total Locations: 45
Total Costs: 230

ID Type Distribution:
  - UUID IDs: 40
  - Place IDs: 3
  - Legacy IDs: 2
  - Timestamp IDs: 2

⚠️ ISSUES FOUND:
  - Orphaned costs: 5
  - Costs without destination: 2
  - Costs with inconsistent naming: 12
  - Duplicate cost IDs: 0
  - Locations without names: 1
```

## Migration Report

After migration, you'll see:

```
📊 MIGRATION REPORT
═══════════════════════════════════════════════════════
Locations migrated: 2
Costs migrated: 15
Legs updated: 3

Before:
  - Legacy IDs: 2
  - Orphaned costs: 5

After:
  - Legacy IDs: 0
  - Orphaned costs: 0
```

## Safety Features

### Dry-Run Mode
All tools support dry-run mode to preview changes without modifying data.

### Rollback Information
Migration map is preserved in `_migration_metadata`:
```javascript
{
  migration_map: {
    "1760652823": "a1b2c3d4-e5f6-4abc-89de-f123456789ab"
  },
  migrated_at: "2025-10-17T10:30:00.000Z"
}
```

### Legacy ID Preservation
Original IDs are kept in `_legacy_id` and `_legacy_destination_id` fields.

### Working Data Sync
Changes are applied to both Firestore and `window.appWorkingData`.

## Troubleshooting

### Issue: Migration preview shows no changes needed
**Cause:** All locations already have UUIDs
**Action:** No migration needed

### Issue: Orphaned costs found
**Cause:** Costs reference deleted/modified destinations
**Action:** Run cleanup tool with auto-reassign

### Issue: Save failed but migration completed
**Cause:** Firestore API error
**Action:**
1. Check console for specific error
2. Verify network connection
3. Re-run migration with `saveToDB: true`

### Issue: Inconsistent naming detected
**Cause:** Mixed field naming conventions
**Action:** Run cleanup with `standardizeNaming: true`

## Best Practices

1. **Always start with validation**
   ```javascript
   await quickValidation('scenario-id');
   ```

2. **Use dry-run mode first**
   ```javascript
   await previewMigration('scenario-id');
   ```

3. **Clean up before migrating**
   - Fix orphaned costs first
   - Standardize naming
   - Then migrate IDs

4. **Review console output**
   - Check what will change
   - Verify migration map
   - Look for warnings

5. **Backup before major changes**
   - Export scenario data
   - Take Firestore snapshot

6. **Test on one scenario first**
   - Validate on smaller dataset
   - Then apply to all scenarios

## File Structure

```
web/
├── destination-id-manager.js          # Core utility library
├── data-cleanup-tool.js               # Data cleanup functions
├── uuid-migration-refactored.js       # Modern migration tool
├── uuid-migration.js                  # Legacy migration (deprecated)
├── migration-preview-tool.html        # Visual UI tool
└── migration-tool.html                # Legacy UI (deprecated)
```

## Recommended Approach

**For new users:**
1. Open `migration-preview-tool.html` in browser
2. Use the visual interface for all operations
3. Follow the UI workflow

**For advanced users:**
1. Load individual modules in browser console
2. Use JavaScript functions directly
3. Customize options as needed

**For developers:**
1. Import from `destination-id-manager.js`
2. Build custom migration scripts
3. Integrate into existing workflows

## Support

If you encounter issues:
1. Check console output for errors
2. Review validation report
3. Use dry-run mode to diagnose
4. Check MIGRATION_GUIDE.md (this file)
