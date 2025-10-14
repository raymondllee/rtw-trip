# Destination ID and Cost Linking System

## Overview

This document explains the robust destination ID and cost linking system implemented for the RTW Trip planner. The platform now uses **Google Place IDs as the canonical identifier** for real-world destinations, with UUIDs retained as a fallback for custom or unmapped locations. This delivers stable, deduplicated identifiers while preserving backward compatibility with legacy data.

## System Architecture

### Core Components

1. **[destination-id-manager.js](web/destination-id-manager.js)** - Core ID management, validation, and migration utilities
2. **[place-id-migration.js](web/place-id-migration.js)** - Browser utility for upgrading itineraries to Place IDs
3. **[travel_concierge/tools/place_resolver.py](python/agents/travel-concierge/travel_concierge/tools/place_resolver.py)** - Server-side Google Places API integration, caching, and timezone enrichment
4. **[data-integrity-ui.js](web/data-integrity-ui.js)** - User interface for validation and cleanup
5. **[destination-deletion-handler.js](web/destination-deletion-handler.js)** - Cascade deletion handling

### ID Structure

- **Canonical Destinations**: Google Place IDs (e.g., `ChIJ51cu8IcbXWARiRtXIothAS4`)
- **Custom Destinations**: UUID v4 fallback (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- **Legacy Destinations**: Historic numeric IDs are still recognized and can be migrated
- **Backward Compatibility**: UUIDs and numeric IDs remain valid; migration tools upgrade them to Place IDs where possible

## How IDs Work

### Destination ID Assignment

When a user selects a location via the Google Places-powered destination picker, the front-end calls `/api/places/details/<place_id>` to obtain the canonical ID and rich metadata (coordinates, timezone, formatted address). The resulting destination object looks like:

```json
{
  "id": "ChIJ51cu8IcbXWARiRtXIothAS4",
  "name": "Tokyo",
  "city": "Tokyo",
  "country": "Japan",
  "coordinates": { "lat": 35.6764226, "lng": 139.650027 },
  "timezone": "Asia/Tokyo",
  "place_data": {
    "formatted_address": "Tokyo, Japan",
    "types": ["locality", "political"],
    "timezone_name": "Japan Standard Time"
  }
}
```

If a destination cannot be resolved to a Place ID (for example, a bespoke sailing route or a private island), the UI falls back to `generateDestinationId()` to issue a UUID.

### Cost Linking

Each cost item links to a destination via the `destination_id` field:

```json
{
  "id": "cost_123",
  "category": "accommodation",
  "description": "Hotel in Tokyo",
  "amount": 1200.0,
  "currency": "USD",
  "destination_id": "ChIJ51cu8IcbXWARiRtXIothAS4",
  // ... other fields
}
```

### Key Principles

1. **Stable IDs**: Place IDs uniquely identify real-world locations and remain stable across sessions
2. **Deduplication**: Adding "Tokyo, Japan" twice returns the same Place ID, preventing duplicates
3. **Rich Metadata**: Every canonical destination includes timezone, address components, and coordinates
4. **Referential Integrity**: Costs and legs reference canonical IDs; validation ensures they stay in sync
5. **Fallback Support**: UUIDs continue to cover custom locations so no itinerary content is lost

## Data Migration

### Migrating to Place IDs

Use the browser migration utility to upgrade an itinerary in memory:

```javascript
// Run in the browser console while viewing the itinerary
const result = await PlaceMigration.migrateToPlaceIds(window.appWorkingData);
console.log(result._migration_metadata);
```

The tool:

1. Resolves every destination name to a Place ID via `/api/places/resolve`
2. Updates `locations[i].id` to the new Place ID and stores `_legacy_uuid` for reference
3. Rewrites `costs[*].destination_id` using the generated mapping
4. Marks unresolved destinations with `_is_custom` (these keep their UUIDs)

### Migration Metadata

After migration, a destination includes both the new canonical ID and history fields:

```json
{
  "id": "ChIJ51cu8IcbXWARiRtXIothAS4",
  "_legacy_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "_migrated_at": "2025-02-02T18:45:12Z",
  "place_data": { ... }
}
```

## Data Validation

### Running Validation

```javascript
import { validateDataIntegrity } from './destination-id-manager.js';

const validation = validateDataIntegrity(data);

if (!validation.valid) {
  console.error('Errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings);
}
```

### Validation Checks

The system validates:

- ✅ **Unique Destination IDs**: No duplicate IDs
- ✅ **Orphaned Costs**: Costs referencing non-existent destinations
- ✅ **Missing IDs**: Destinations without IDs
- ✅ **ID Format Consistency**: Warns about mixed numeric/UUID IDs

### Using the Data Integrity UI

```javascript
import { showDataIntegrityPanel } from './data-integrity-ui.js';

// Show integrity panel
showDataIntegrityPanel(currentData, (updatedData) => {
  // Handle updated data
  saveData(updatedData);
});
```

## Handling Orphaned Costs

### Finding Orphaned Costs

```javascript
import { findOrphanedCosts } from './destination-id-manager.js';

const orphaned = findOrphanedCosts(costs, locations);
console.log(`Found ${orphaned.length} orphaned costs`);
```

### Reassigning Orphaned Costs

```javascript
import { reassignCosts } from './destination-id-manager.js';

// Reassign specific costs to a new destination
const updatedCosts = reassignCosts(
  costs,
  ['cost_123', 'cost_456'], // IDs of orphaned costs
  'new-destination-uuid'     // New destination ID
);
```

### Deleting Orphaned Costs

```javascript
// Remove orphaned costs
const cleanedCosts = costs.filter(cost => {
  const orphanedIds = new Set(orphaned.map(c => c.id));
  return !orphanedIds.has(cost.id);
});
```

## Destination Deletion

### Cascade Deletion Options

When deleting a destination with associated costs, you have three options:

#### 1. Delete Associated Costs

```javascript
import { handleDestinationDeletion } from './destination-deletion-handler.js';

const updatedData = handleDestinationDeletion(data, destinationId, {
  strategy: 'delete', // Permanently delete costs
  recalculateDates: true
});
```

#### 2. Keep Costs as Unassigned

```javascript
const updatedData = handleDestinationDeletion(data, destinationId, {
  strategy: 'unassign', // Sets destination_id to null
  recalculateDates: true
});
```

#### 3. Reassign to Another Destination

```javascript
const updatedData = handleDestinationDeletion(data, destinationId, {
  strategy: 'reassign',
  reassignDestId: 'another-destination-uuid',
  recalculateDates: true
});
```

### Using the Deletion Dialog

```javascript
import { showDestinationDeletionDialog } from './destination-deletion-handler.js';

showDestinationDeletionDialog(destination, associatedCosts, (options) => {
  const updatedData = handleDestinationDeletion(data, destination.id, options);
  saveData(updatedData);
});
```

## Integration Examples

### Example 1: Adding a New Destination (Place ID workflow)

```javascript
import { generateDestinationId, normalizeId } from './destination-id-manager.js';

async function addNewDestination(data, locationQuery) {
  const placeInfo = await PlaceMigration.resolvePlaceId(locationQuery);

  const id = placeInfo?.place_id ?? generateDestinationId(); // Fallback for custom locations

  const newDestination = {
    id,
    name: placeInfo?.name ?? locationQuery,
    country: placeInfo?.country ?? null,
    city: placeInfo?.city ?? null,
    region: placeInfo?.administrative_area ?? 'Custom',
    coordinates: placeInfo?.coordinates ?? null,
    timezone: placeInfo?.timezone ?? null,
    place_data: placeInfo || null,
    duration_days: 3,
    arrival_date: null,
    departure_date: null
  };

  const existing = new Set((data.locations || []).map(loc => normalizeId(loc.id)));
  if (existing.has(normalizeId(id))) {
    throw new Error(`Destination already exists with ID ${id}`);
  }

  return {
    ...data,
    locations: [...data.locations, newDestination]
  };
}
```

### Example 2: Adding Costs for a Destination

```javascript
import { normalizeId } from './destination-id-manager.js';

function addCostToDestination(data, destinationId, costInfo) {
  const newCost = {
    id: `cost_${Date.now()}`,
    category: costInfo.category,
    description: costInfo.description,
    amount: costInfo.amount,
    currency: costInfo.currency || 'USD',
    destination_id: normalizeId(destinationId),
    booking_status: 'estimated',
    source: 'manual'
  };

  return {
    ...data,
    costs: [...data.costs, newCost]
  };
}
```

### Example 3: Reordering Destinations

```javascript
// When reordering, IDs stay the same - no cost updates needed!
function reorderDestinations(data, fromIndex, toIndex) {
  const locations = [...data.locations];
  const [movedLocation] = locations.splice(fromIndex, 1);
  locations.splice(toIndex, 0, movedLocation);

  return {
    ...data,
    locations
  };
}
```

### Example 4: Bulk Cost Management

```javascript
import { getCostsByDestination } from './destination-id-manager.js';

// Get all costs grouped by destination
const costsByDest = getCostsByDestination(costs, locations);

// Process costs for each destination
costsByDest.forEach((costs, destinationId) => {
  if (destinationId === '_orphaned') {
    console.log('Orphaned costs:', costs);
  } else {
    const total = costs.reduce((sum, c) => sum + c.amount_usd, 0);
    console.log(`Destination ${destinationId}: $${total}`);
  }
});
```

## Best Practices

### 1. Always Resolve Canonical IDs First

❌ **Don't** invent ad-hoc identifiers such as incremental numbers or custom strings.

✅ **Do** resolve a Place ID via `PlaceMigration.resolvePlaceId()` or `/api/places/details/<place_id>` and only fall back to `generateDestinationId()` when the resolver cannot find a match (e.g., bespoke or offline destinations).

### 2. Validate Before Saving

```javascript
import { validateDataIntegrity } from './destination-id-manager.js';

function saveItinerary(data) {
  const validation = validateDataIntegrity(data);

  if (!validation.valid) {
    console.error('Cannot save invalid data:', validation.errors);
    return false;
  }

  // Proceed with save
  return true;
}
```

### 3. Handle Orphaned Costs Proactively

```javascript
import { findOrphanedCosts } from './destination-id-manager.js';

// Check for orphans before major operations
const orphaned = findOrphanedCosts(data.costs, data.locations);
if (orphaned.length > 0) {
  // Show warning to user
  alert(`Warning: ${orphaned.length} costs are not linked to destinations`);
}
```

### 4. Use Cascade Deletion

```javascript
import { showDestinationDeletionDialog } from './destination-deletion-handler.js';

// Always use the deletion dialog for destinations with costs
if (associatedCosts.length > 0) {
  showDestinationDeletionDialog(destination, associatedCosts, handleDelete);
} else {
  // Safe to delete directly
  deleteDestination(destination.id);
}
```

### 5. Normalize IDs for Comparison

```javascript
import { normalizeId } from './destination-id-manager.js';

// Always normalize when comparing IDs
const destId = normalizeId(destination.id);
const costDestId = normalizeId(cost.destination_id);

if (destId === costDestId) {
  // Match!
}
```

## Migration Guide

### Step-by-Step Migration

1. **Backup Your Data**
   - Export your scenario from Firestore before making changes
   - Use the web interface "Export" feature

2. **Run Data Integrity Check**
   ```javascript
   import { validateDataIntegrity } from './destination-id-manager.js';
   const validation = validateDataIntegrity(originalData);
   console.log('Pre-migration validation:', validation);
   ```

3. **Perform Migration**
  ```javascript
  const migratedData = await PlaceMigration.migrateToPlaceIds(originalData);
  ```

4. **Review Migration Report**
   ```javascript
   import { createMigrationReport } from './destination-id-manager.js';
   const report = createMigrationReport(originalData, migratedData);
   console.log('Migration report:', report);
   ```

5. **Validate Migrated Data**
   ```javascript
   const postValidation = validateDataIntegrity(migratedData);
   console.log('Post-migration validation:', postValidation);
   ```

6. **Save Migrated Data**
   ```javascript
   const json = JSON.stringify(migratedData, null, 2);
   // Save to file or database
   ```

### What Gets Migrated

- ✅ Destination IDs in `locations` array
- ✅ `destination_id` fields in all costs
- ✅ `destination_ids` arrays in legs/sub-legs
- ✅ Legacy IDs preserved in `_legacy_id` fields
- ✅ Migration timestamp added to each item

## Troubleshooting

### Common Issues

**Issue**: Costs showing as orphaned after migration

**Solution**: Check if the migration completed successfully:
```javascript
const validation = validateDataIntegrity(migratedData);
console.log('Orphaned costs:', validation.summary.orphaned_costs);
```

---

**Issue**: Duplicate destination IDs detected

**Solution**: Run the validation and check for duplicates:
```javascript
import { validateUniqueDestinationIds } from './destination-id-manager.js';
const check = validateUniqueDestinationIds(data.locations);
if (!check.valid) {
  console.log('Duplicates:', check.duplicates);
}
```

---

**Issue**: Mixed legacy ID formats (numeric / UUID / custom strings)

**Solution**: Complete the Place ID migration:
```javascript
const migratedData = await PlaceMigration.migrateToPlaceIds(data);
```

## API Reference

### ID Generation

- `generateDestinationId()` - Generate new UUID
- `isUUID(id)` - Check if ID is UUID format
- `isPlaceId(id)` - Check if ID uses Google Place ID prefixes
- `normalizeId(id)` - Convert ID to string for comparison

### Validation

- `validateDataIntegrity(data)` - Full integrity check
- `validateUniqueDestinationIds(locations)` - Check for duplicates
- `findOrphanedCosts(costs, locations)` - Find orphaned costs

### Migration

- `PlaceMigration.resolvePlaceId(query)` - Resolve a location name to Place ID (browser helper)
- `PlaceMigration.migrateToPlaceIds(data)` - Bulk migration (locations + costs)
- `migrateItineraryData(data)` - Legacy helper to normalize numeric IDs → UUIDs
- `createMigrationReport(original, migrated)` - Generate migration report
- `migrateLocationIds(locations)` - Legacy location-only migration
- `migrateCostDestinationIds(costs, map)` - Legacy cost migration helper

### Cost Management

- `reassignCosts(costs, costIds, destId)` - Reassign costs
- `deleteCostsByDestination(costs, destId)` - Delete costs
- `getCostsByDestination(costs, locations)` - Group costs

### Deletion

- `handleDestinationDeletion(data, destId, options)` - Delete with cascade
- `showDestinationDeletionDialog(dest, costs, callback)` - Show UI

## Performance Considerations

- **Place Resolution**: ~50-100ms per unique destination with caching (Google Places API)
- **UUID Generation**: ~0.001ms per ID (used only for custom locations)
- **Validation**: ~5-10ms for 1000 locations + 5000 costs
- **Migration**: ~50-100ms per destination (uncached) or ~5ms (cached)
- **No Database Impact**: All operations are in-memory; persistence handled separately

## Future Enhancements

Potential improvements:

1. **Undo/Redo**: Track deletion history for rollback
2. **Bulk Operations**: Multi-select destinations for bulk reassignment
3. **Cost Templates**: Reuse cost structures across destinations
4. **Conflict Resolution**: Merge duplicate destinations
5. **Import/Export**: Better handling of external data sources

## Support

For issues or questions:
- Check the validation output for specific error messages
- Review this documentation
- Check the console for detailed logging
- Use the Data Integrity UI for interactive troubleshooting
