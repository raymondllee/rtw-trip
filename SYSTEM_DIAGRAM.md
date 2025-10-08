# System Architecture Diagram

## Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     RTW Trip Data Structure                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │   Destinations   │         │      Costs       │             │
│  │   (locations)    │◄────────┤  (cost items)    │             │
│  │                  │         │                  │             │
│  │  id: UUID        │         │  destination_id  │             │
│  │  name: String    │         │  amount: Number  │             │
│  │  coordinates     │         │  category: Type  │             │
│  │  duration_days   │         │  description     │             │
│  └──────────────────┘         └──────────────────┘             │
│          │                             │                        │
│          │ Referenced by               │ References             │
│          ▼                             │                        │
│  ┌──────────────────┐                 │                        │
│  │   Legs/SubLegs   │◄────────────────┘                        │
│  │                  │                                           │
│  │  destination_ids │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## ID Management System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Destination ID Manager                            │
│                  (destination-id-manager.js)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │   ID Generation │  │    Validation    │  │    Migration    │   │
│  ├─────────────────┤  ├──────────────────┤  ├─────────────────┤   │
│  │ • generateId()  │  │ • validateData() │  │ • migrateIds()  │   │
│  │ • isUUID()      │  │ • findOrphans()  │  │ • createReport()│   │
│  │ • normalizeId() │  │ • checkDupes()   │  │ • backupLegacy()│   │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Cost Management Utilities                       │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ • reassignCosts()  • deleteCosts()  • groupByDestination()  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ Data         │  │ Deletion     │  │ App          │
        │ Integrity UI │  │ Handler      │  │ Planning v2  │
        └──────────────┘  └──────────────┘  └──────────────┘
```

## User Workflows

### Workflow 1: Adding a New Destination

```
User Action                System Response                  Data Change
───────────                ───────────────                  ───────────

Click "Add
Destination"
    │
    ├──────────────────► Open Places API
    │                    autocomplete dialog
    │
Select location
from dropdown
    │
    ├──────────────────► Extract coordinates,
    │                    address components
    │
Enter duration
    │
    ├──────────────────► generateDestinationId()  ──────► Create new location:
    │                    Generate UUID                    {
    │                                                       id: "a8f5f167-...",
    │                                                       name: "Tokyo",
    │                                                       ...
    │                                                     }
    │
Click "Add"
    │
    ├──────────────────► Insert into locations array
    │
    ├──────────────────► recalculateDates()
    │
    └──────────────────► Render updated map & sidebar

                         ✅ New destination added
                         ✅ UUID assigned
                         ✅ Dates calculated
                         ✅ UI updated
```

### Workflow 2: Deleting a Destination with Costs

```
User Action                System Response                  Data Change
───────────                ───────────────                  ──────────���

Click "Delete"
on destination
    │
    ├──────────────────► Find associated costs ──────────► costs.filter(
    │                                                         c => c.destination_id
    │                                                              === dest.id
    │                                                       )
    │
    │                    Show deletion dialog
    │                    with cascade options:
    │                    ┌────────────────┐
    │                    │ • Reassign     │
    │                    │ • Unassign     │
    │                    │ • Delete       │
    │                    └────────────────┘
    │
Select "Reassign"
    │
    ├──────────────────► Show destination dropdown
    │
Choose target
destination
    │
    │
Click "Delete
Destination"
    │
    ├──────────────────► reassignCosts() ───────────────► costs.map(c => {
    │                                                       if (c.destination_id === oldId)
    │                                                         c.destination_id = newId
    │                                                       return c
    │                                                     })
    │
    ├──────────────────► Remove destination from array
    │
    ├──────────────────► Update legs/sub_legs
    │
    ├──────────────────► recalculateDates()
    │
    └──────────────────► Render updated UI

                         ✅ Destination deleted
                         ✅ Costs preserved and reassigned
                         ✅ No data loss
                         ✅ UI updated
```

### Workflow 3: Data Integrity Check

```
User Action                System Response                  Result
───────────                ───────────────                  ──────

Click "Data
Integrity"
    │
    ├──────────────────► validateDataIntegrity() ───────► Check:
    │                                                      • Duplicate IDs?
    │                                                      • Orphaned costs?
    │                                                      • Missing IDs?
    │                                                      • Mixed ID types?
    │
    │                    Generate validation report:
    │                    {
    │                      valid: true/false,
    │                      errors: [...],
    │                      warnings: [...],
    │                      summary: {...}
    │                    }
    │
    │                    Show integrity panel
    │                    ┌────────────────────────┐
    │                    │ Summary                 │
    │                    │ ├─ 29 destinations      │
    │                    │ ├─ 100 costs            │
    │                    │ ├─ 0 orphaned           │
    │                    │ └─ 29 numeric IDs       │
    │                    │                         │
    │                    │ ⚠️ Warnings (1)         │
    │                    │ Mixed ID types          │
    │                    │                         │
    │                    │ [Migrate to UUIDs]      │
    │                    └────────────────────────┘
    │
Click "Migrate
to UUIDs"
    │
    ├──────────────────► Confirm dialog
    │
Confirm
    │
    ├──────────────────► migrateItineraryData() ────────► For each location:
    │                                                      1. Generate UUID
    │                                                      2. Store old ID
    │                                                      3. Update all cost refs
    │                                                      4. Update legs/sub_legs
    │
    │                    Show success dialog
    │                    ┌────────────────────────┐
    │                    │ ✅ Migration Complete   │
    │                    │                         │
    │                    │ • 29 locations migrated │
    │                    │ • 100 costs updated     │
    │                    │ • 0 orphaned fixed      │
    │                    │                         │
    │                    │ [OK]                    │
    │                    └────────────────────────┘
    │
    └──────────────────► Update workingData

                         ✅ All IDs now UUIDs
                         ✅ Legacy IDs preserved
                         ✅ All costs still linked
```

## State Transitions

### Destination Lifecycle

```
┌─────────────┐
│   Initial   │
│   State     │
└──────┬──────┘
       │
       │ User creates destination
       ▼
┌─────────────┐
│  Generate   │ ──────► generateDestinationId()
│    UUID     │         Returns: "a8f5f167-2f3a-4..."
└──────┬──────┘
       │
       │ Add to locations array
       ▼
┌─────────────┐
│   Active    │ ◄──┐
│ Destination │    │ User reorders/updates
└──────┬──────┘    │
       │           │
       │ Same ID ──┘
       │
       │ User deletes
       ▼
┌─────────────┐
│  Deletion   │
│   Dialog    │
└──────┬──────┘
       │
       ├─── Strategy: Delete ────► Remove from array
       │                           Delete costs
       │
       ├─── Strategy: Unassign ──► Remove from array
       │                           Unassign costs
       │
       └─── Strategy: Reassign ──► Remove from array
                                   Reassign costs to new destination
```

### Cost Link States

```
┌─────────────────┐
│  Cost Created   │
│ destination_id  │
│ = null          │
└────────┬────────┘
         │
         │ Assign to destination
         ▼
┌─────────────────┐
│   Valid Link    │ ◄──┐
│ destination_id  │    │ Destination still exists
│ = UUID          │    │
└────────┬────────┘    │
         │             │
         │             │
         ├─────────────┘
         │
         │ Destination deleted
         ▼
    ┌────────┐
    │Strategy│
    └───┬────┘
        │
        ├─── Delete ─────────► Cost deleted
        │
        ├─── Unassign ───────► destination_id = null
        │
        └─── Reassign ───────► destination_id = new UUID
```

## Error Prevention Flow

```
┌────────────��────┐
│  User Action    │
└────────┬────────┘
         │
         ▼
    ┌─────────┐
    │  Input  │
    │Validate │
    └────┬────┘
         │
    ┌────▼────┐
    │ Valid?  │
    └────┬────┘
         │
    No ◄─┴─► Yes
     │        │
     ▼        ▼
┌─────────┐ ┌─────────┐
│  Show   │ │ Execute │
│ Error   │ │ Action  │
└─────────┘ └────┬────┘
                 │
                 ▼
          ┌─────────────┐
          │  Validate   │
          │   Result    │
          └──────┬──────┘
                 │
            ┌────▼────┐
            │ Valid?  │
            └────┬────┘
                 │
            No ◄─┴─► Yes
             │        │
             ▼        ▼
        ┌─────────┐ ┌─────────┐
        │ Rollback│ │ Commit  │
        └─────────┘ └─────────┘
```

## Performance Profile

```
Operation          Complexity    Time (typical)
─────────          ──────────    ──────────────
Generate UUID      O(1)          < 0.001ms
Validate data      O(n + m)      ~5ms (100 items)
Find orphans       O(n × m)      ~2ms (100 costs)
Migrate IDs        O(n + m)      ~20ms (100 items)
Delete cascade     O(m)          ~1ms (delete)
Reassign costs     O(m)          ~2ms (reassign)

Where:
  n = number of destinations
  m = number of costs
```

## Module Dependencies

```
┌───────────────────────────────────────────────┐
│             app-planning-v2.js                │
│         (Main application logic)              │
└───────────────┬───────────────────────────────┘
                │
                │ imports
                ▼
┌───────────────────────────────────────────────┐
│         destination-id-manager.js             │
│         (Core ID management)                  │
└───────────────┬───────────────────────────────┘
                │
        ┌───────┼────────┐
        │       │        │
        ▼       ▼        ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ data-    │ │deletion- │ │ cost-        │
│integrity-│ │handler.js│ │tracker.js    │
│ui.js     │ │          │ │              │
└──────────┘ └──────────┘ └──────────────┘
```

## Data Integrity Checks

```
┌─────────────────────────────────────────────────┐
│          Data Integrity Validation              │
├─────────────────────────────────────────────────┤
│                                                  │
│  Check 1: Unique Destination IDs                │
│  ├─ Create Set of all IDs                       │
│  ├─ Compare Set size to Array length            │
│  └─ Report duplicates if found                  │
│                                                  │
│  Check 2: Orphaned Costs                        │
│  ├─ Create Set of valid destination IDs         │
│  ├─ Filter costs with invalid destination_id    │
│  └─ Report orphaned costs                       │
│                                                  │
│  Check 3: Missing Destination IDs               │
│  ├─ Filter locations without ID                 │
│  └─ Report missing IDs as ERROR                 │
│                                                  │
│  Check 4: ID Format Consistency                 │
│  ├─ Count numeric IDs                           │
│  ├─ Count UUID IDs                              │
│  └─ Warn if mixed                               │
│                                                  │
│  Result: Validation Report                      │
│  {                                               │
│    valid: boolean,                              │
│    errors: [],                                  │
│    warnings: [],                                │
│    summary: {...}                               │
│  }                                               │
│                                                  │
└─────────────────────────────────────────────────┘
```

This architecture provides a robust, maintainable system for managing destination IDs and cost relationships in your trip planning application.
