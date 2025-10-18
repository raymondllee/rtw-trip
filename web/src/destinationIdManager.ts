// @ts-nocheck
/**
 * Destination ID Management System
 * Handles UUID-based stable IDs for destinations with backward compatibility
 */

// ============================================================================
// ID Generation
// ============================================================================

const PLACE_ID_PREFIXES = ['ChIJ', 'GhIJ', 'EhIJ'];

/**
 * Generate a unique UUID for a destination
 * @returns {string} UUID v4 string
 */
export function generateDestinationId() {
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

/**
 * Check if an ID is a UUID (vs legacy numeric ID)
 * @param {string|number} id
 * @returns {boolean}
 */
export function isUUID(id) {
  if (typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Check if an ID matches Google Place ID format
 * @param {string} id
 * @returns {boolean}
 */
export function isPlaceId(id) {
  if (typeof id !== 'string') return false;
  return PLACE_ID_PREFIXES.some(prefix => id.startsWith(prefix));
}

/**
 * Normalize ID to string format for consistent comparison
 * @param {string|number} id
 * @returns {string}
 */
export function normalizeId(id) {
  if (id === null || id === undefined) {
    return '';
  }
  return String(id).trim();
}

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Generate a migration mapping from old numeric IDs to new UUIDs
 * @param {Array} locations - Array of location objects
 * @returns {Map<string|number, string>} Map of old ID to new UUID
 */
export function generateIdMigrationMap(locations) {
  const migrationMap = new Map();

  locations.forEach(location => {
    const oldId = location.id;

    // Skip if already using UUID
    if (isUUID(oldId) || isPlaceId(oldId)) {
      migrationMap.set(normalizeId(oldId), oldId);
      return;
    }

    // Generate new UUID for legacy numeric ID
    const newId = generateDestinationId();
    migrationMap.set(normalizeId(oldId), newId);
  });

  return migrationMap;
}

/**
 * Migrate locations from numeric IDs to UUIDs
 * @param {Array} locations - Array of location objects
 * @param {Map} migrationMap - Optional pre-generated migration map
 * @returns {Object} { locations: Array, migrationMap: Map }
 */
export function migrateLocationIds(locations, migrationMap = null) {
  if (!migrationMap) {
    migrationMap = generateIdMigrationMap(locations);
  }

  const migratedLocations = locations.map(location => {
    const oldId = normalizeId(location.id);
    const newId = migrationMap.get(oldId);

    return {
      ...location,
      id: newId,
      _legacy_id: location.id, // Keep legacy ID for reference
      _migrated_at: new Date().toISOString()
    };
  });

  return {
    locations: migratedLocations,
    migrationMap
  };
}

/**
 * Migrate cost items to use new destination UUIDs
 * @param {Array} costs - Array of cost objects
 * @param {Map} migrationMap - Map of old destination ID to new UUID
 * @returns {Array} Migrated costs
 */
export function migrateCostDestinationIds(costs, migrationMap) {
  return costs.map(cost => {
    const oldDestId = normalizeId(cost.destination_id || cost.destinationId);
    const newDestId = migrationMap.get(oldDestId);

    // If no mapping found, keep original (might be null/undefined)
    const migratedDestId = newDestId || cost.destination_id || cost.destinationId;

    return {
      ...cost,
      destination_id: migratedDestId,
      destinationId: migratedDestId, // Support both naming conventions
      _legacy_destination_id: cost.destination_id || cost.destinationId
    };
  });
}

/**
 * Perform full data migration from numeric to UUID-based IDs
 * @param {Object} data - Itinerary data with locations and costs
 * @returns {Object} Migrated data with migration metadata
 */
export function migrateItineraryData(data) {
  const locations = data.locations || [];
  const costs = data.costs || [];

  // Generate migration map
  const { locations: migratedLocations, migrationMap } = migrateLocationIds(locations);

  // Migrate costs
  const migratedCosts = migrateCostDestinationIds(costs, migrationMap);

  // Migrate destination_ids in legs/sub_legs if they exist
  const legs = data.legs || [];
  const migratedLegs = legs.map(leg => {
    const migratedSubLegs = (leg.sub_legs || []).map(subLeg => {
      const oldDestIds = subLeg.destination_ids || [];
      const newDestIds = oldDestIds.map(oldId =>
        migrationMap.get(normalizeId(oldId)) || oldId
      );

      return {
        ...subLeg,
        destination_ids: newDestIds,
        _legacy_destination_ids: oldDestIds
      };
    });

    return {
      ...leg,
      sub_legs: migratedSubLegs
    };
  });

  return {
    ...data,
    locations: migratedLocations,
    costs: migratedCosts,
    legs: migratedLegs,
    _migration_metadata: {
      migrated_at: new Date().toISOString(),
      migration_map: Object.fromEntries(migrationMap),
      locations_migrated: migratedLocations.filter(l => l._migrated_at).length,
      costs_migrated: migratedCosts.filter(c => c._legacy_destination_id).length
    }
  };
}

// ============================================================================
// Validation & Integrity Checks
// ============================================================================

/**
 * Find costs that reference non-existent destinations (orphaned costs)
 * @param {Array} costs - Array of cost objects
 * @param {Array} locations - Array of location objects
 * @returns {Array} Orphaned cost objects
 */
export function findOrphanedCosts(costs, locations) {
  const validDestinationIds = new Set(
    locations.map(loc => normalizeId(loc.id))
  );

  return costs.filter(cost => {
    const destId = cost.destination_id || cost.destinationId;

    // Null/undefined destination_id is valid (unassigned costs)
    if (!destId) return false;

    return !validDestinationIds.has(normalizeId(destId));
  });
}

/**
 * Validate that all destination IDs are unique
 * @param {Array} locations - Array of location objects
 * @returns {Object} { valid: boolean, duplicates: Array }
 */
export function validateUniqueDestinationIds(locations) {
  const seen = new Set();
  const duplicates = [];

  locations.forEach(location => {
    const id = normalizeId(location.id);
    if (seen.has(id)) {
      duplicates.push(location);
    }
    seen.add(id);
  });

  return {
    valid: duplicates.length === 0,
    duplicates
  };
}

/**
 * Validate data integrity
 * @param {Object} data - Itinerary data
 * @returns {Object} Validation result with errors and warnings
 */
export function validateDataIntegrity(data) {
  const locations = data.locations || [];
  const costs = data.costs || [];

  const errors = [];
  const warnings = [];

  // Check for duplicate destination IDs
  const uniqueCheck = validateUniqueDestinationIds(locations);
  if (!uniqueCheck.valid) {
    errors.push({
      type: 'duplicate_destination_ids',
      message: `Found ${uniqueCheck.duplicates.length} duplicate destination IDs`,
      data: uniqueCheck.duplicates
    });
  }

  // Check for orphaned costs
  const orphanedCosts = findOrphanedCosts(costs, locations);
  if (orphanedCosts.length > 0) {
    warnings.push({
      type: 'orphaned_costs',
      message: `Found ${orphanedCosts.length} costs with invalid destination references`,
      data: orphanedCosts
    });
  }

  // Check for locations without IDs
  const locationsWithoutIds = locations.filter(loc => !loc.id);
  if (locationsWithoutIds.length > 0) {
    errors.push({
      type: 'missing_destination_ids',
      message: `Found ${locationsWithoutIds.length} locations without IDs`,
      data: locationsWithoutIds
    });
  }

  // Check for mixed ID types (numeric and UUID)
  const uuidIds = locations.filter(loc => isUUID(loc.id));
  const placeIds = locations.filter(loc => isPlaceId(loc.id));
  const legacyIds = locations.filter(loc => !isUUID(loc.id) && !isPlaceId(loc.id));

  if (legacyIds.length > 0 && (uuidIds.length > 0 || placeIds.length > 0)) {
    warnings.push({
      type: 'mixed_id_types',
      message: `Data contains legacy IDs (${legacyIds.length}) mixed with UUIDs (${uuidIds.length}) and Place IDs (${placeIds.length})`,
      data: { legacyIds, uuidIds, placeIds }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      total_locations: locations.length,
      total_costs: costs.length,
      orphaned_costs: orphanedCosts.length,
      legacy_ids: legacyIds.length,
      uuid_ids: uuidIds.length,
      place_ids: placeIds.length
    }
  };
}

// ============================================================================
// Cost Management Utilities
// ============================================================================

/**
 * Reassign orphaned costs to a specific destination
 * @param {Array} costs - Array of cost objects
 * @param {Array} orphanedCostIds - IDs of costs to reassign
 * @param {string} newDestinationId - Destination ID to reassign to
 * @returns {Array} Updated costs array
 */
export function reassignCosts(costs, orphanedCostIds, newDestinationId) {
  const orphanedSet = new Set(orphanedCostIds);

  return costs.map(cost => {
    if (orphanedSet.has(cost.id)) {
      return {
        ...cost,
        destination_id: newDestinationId,
        destinationId: newDestinationId,
        _reassigned_at: new Date().toISOString(),
        _previous_destination_id: cost.destination_id || cost.destinationId
      };
    }
    return cost;
  });
}

/**
 * Delete costs associated with a destination
 * @param {Array} costs - Array of cost objects
 * @param {string} destinationId - Destination ID
 * @returns {Array} Filtered costs array
 */
export function deleteCostsByDestination(costs, destinationId) {
  const normalizedDestId = normalizeId(destinationId);

  return costs.filter(cost => {
    const costDestId = normalizeId(cost.destination_id || cost.destinationId);
    return costDestId !== normalizedDestId;
  });
}

/**
 * Get costs grouped by destination
 * @param {Array} costs - Array of cost objects
 * @param {Array} locations - Array of location objects
 * @returns {Map<string, Array>} Map of destination ID to costs
 */
export function getCostsByDestination(costs, locations) {
  const costMap = new Map();

  // Initialize with all locations
  locations.forEach(loc => {
    costMap.set(normalizeId(loc.id), []);
  });

  // Add special category for orphaned costs
  costMap.set('_orphaned', []);

  // Group costs
  costs.forEach(cost => {
    const destId = normalizeId(cost.destination_id || cost.destinationId);

    if (destId && costMap.has(destId)) {
      costMap.get(destId).push(cost);
    } else if (destId) {
      // Orphaned cost
      costMap.get('_orphaned').push(cost);
    }
  });

  return costMap;
}

// ============================================================================
// Export Helper for Migration
// ============================================================================

/**
 * Create a migration report
 * @param {Object} originalData - Original data before migration
 * @param {Object} migratedData - Data after migration
 * @returns {Object} Migration report
 */
export function createMigrationReport(originalData, migratedData) {
  const originalValidation = validateDataIntegrity(originalData);
  const migratedValidation = validateDataIntegrity(migratedData);

  return {
    timestamp: new Date().toISOString(),
    original: {
      locations: originalData.locations?.length || 0,
      costs: originalData.costs?.length || 0,
      validation: originalValidation
    },
    migrated: {
      locations: migratedData.locations?.length || 0,
      costs: migratedData.costs?.length || 0,
      validation: migratedValidation
    },
    migration_map: migratedData._migration_metadata?.migration_map || {},
    improvements: {
      orphaned_costs_fixed: Math.max(0,
        originalValidation.summary.orphaned_costs - migratedValidation.summary.orphaned_costs
      ),
      id_format_unified: migratedValidation.summary.legacy_ids === 0 &&
        (migratedValidation.summary.uuid_ids + migratedValidation.summary.place_ids) === (migratedData.locations?.length || 0)
    }
  };
}
