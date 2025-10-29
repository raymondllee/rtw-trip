#!/usr/bin/env python3
"""
Migration script to remove duplicate flight cost items from scenarios.

This script removes all cost items with category='flight' from scenario versions,
as flights are now tracked separately via TransportSegment objects to avoid
double-counting costs.

Usage:
    # From project root directory:
    cd python/agents/travel-concierge
    poetry run python ../../../scripts/migrate_remove_flight_costs.py [--dry-run] [--scenario-id SCENARIO_ID]

Options:
    --dry-run         Preview changes without modifying the database
    --scenario-id ID  Only process a specific scenario (defaults to all scenarios)
"""

import argparse
from typing import Dict, Any, List

try:
    from google.cloud import firestore
except ImportError as e:
    print(f"❌ Error importing google.cloud.firestore: {e}")
    print("\nThis script must be run with Poetry from the travel-concierge directory:")
    print("  cd python/agents/travel-concierge")
    print("  poetry run python ../../../scripts/migrate_remove_flight_costs.py --dry-run")
    exit(1)


def remove_flight_costs_from_itinerary(itinerary_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove all flight category costs from itinerary data.

    Args:
        itinerary_data: The itinerary data dictionary

    Returns:
        Dictionary with statistics about removed costs
    """
    costs = itinerary_data.get('costs', [])

    original_count = len(costs)
    flight_costs = [c for c in costs if c.get('category') == 'flight']
    flight_cost_total = sum(float(c.get('amount_usd', c.get('amount', 0))) for c in flight_costs)

    # Remove all flight costs (modify in place)
    itinerary_data['costs'] = [c for c in costs if c.get('category') != 'flight']

    return {
        'original_cost_count': original_count,
        'flight_cost_count': len(flight_costs),
        'flight_cost_total_usd': flight_cost_total,
        'remaining_cost_count': len(itinerary_data['costs']),
        'modified': len(flight_costs) > 0
    }


def migrate_scenario(db: firestore.Client, scenario_id: str, dry_run: bool = False) -> Dict[str, Any]:
    """
    Migrate a single scenario by removing flight costs from all its versions.

    Args:
        db: Firestore client instance
        scenario_id: The scenario ID to migrate
        dry_run: If True, only preview changes without modifying

    Returns:
        Dictionary with migration statistics
    """
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Processing scenario: {scenario_id}")

    # Get scenario document
    scenario_ref = db.collection('scenarios').document(scenario_id)
    scenario_doc = scenario_ref.get()

    if not scenario_doc.exists:
        print(f"  ⚠️  Scenario not found")
        return {'error': 'not_found', 'scenario_id': scenario_id}

    # Get all versions from subcollection
    versions_ref = scenario_ref.collection('versions')
    version_docs = list(versions_ref.stream())

    print(f"  Found {len(version_docs)} version(s)")

    total_flight_costs_removed = 0
    total_flight_cost_usd = 0
    versions_modified = 0

    for version_doc in version_docs:
        version_data = version_doc.to_dict()
        version_num = version_data.get('versionNumber', 'unknown')
        itinerary_data = version_data.get('itineraryData', {})

        if not itinerary_data:
            continue

        stats = remove_flight_costs_from_itinerary(itinerary_data)

        if stats['modified']:
            versions_modified += 1
            total_flight_costs_removed += stats['flight_cost_count']
            total_flight_cost_usd += stats['flight_cost_total_usd']

            print(f"    Version {version_num}: Removed {stats['flight_cost_count']} flight cost(s) " +
                  f"(${stats['flight_cost_total_usd']:.2f}) - {stats['remaining_cost_count']} costs remain")

            # Update version in Firestore
            if not dry_run:
                version_data['itineraryData'] = itinerary_data
                version_doc.reference.set(version_data)

    if not dry_run and versions_modified > 0:
        print(f"  ✅ Updated {versions_modified} version(s) in Firestore")

    return {
        'scenario_id': scenario_id,
        'versions_modified': versions_modified,
        'total_versions': len(version_docs),
        'total_flight_costs_removed': total_flight_costs_removed,
        'total_flight_cost_usd': total_flight_cost_usd
    }


def migrate_all_scenarios(db: firestore.Client, dry_run: bool = False) -> List[Dict[str, Any]]:
    """
    Migrate all scenarios in the database.

    Args:
        db: Firestore client instance
        dry_run: If True, only preview changes without modifying

    Returns:
        List of migration statistics for each scenario
    """
    print(f"\n{'='*80}")
    print(f"{'DRY RUN - ' if dry_run else ''}Migration: Remove Flight Cost Items")
    print(f"{'='*80}")

    # Get all scenarios
    scenarios_ref = db.collection('scenarios')
    scenario_docs = list(scenarios_ref.stream())
    scenario_ids = [doc.id for doc in scenario_docs]

    print(f"\nFound {len(scenario_ids)} scenario(s) to process")

    results = []
    for scenario_id in scenario_ids:
        result = migrate_scenario(db, scenario_id, dry_run)
        results.append(result)

    return results


def print_summary(results: List[Dict[str, Any]], dry_run: bool = False):
    """Print migration summary statistics."""
    print(f"\n{'='*80}")
    print(f"{'DRY RUN - ' if dry_run else ''}Migration Summary")
    print(f"{'='*80}")

    total_scenarios = len(results)
    scenarios_modified = sum(1 for r in results if r.get('versions_modified', 0) > 0)
    total_versions_modified = sum(r.get('versions_modified', 0) for r in results)
    total_flight_costs = sum(r.get('total_flight_costs_removed', 0) for r in results)
    total_usd = sum(r.get('total_flight_cost_usd', 0) for r in results)

    print(f"Scenarios processed: {total_scenarios}")
    print(f"Scenarios modified: {scenarios_modified}")
    print(f"Versions modified: {total_versions_modified}")
    print(f"Flight costs removed: {total_flight_costs}")
    print(f"Total flight cost amount: ${total_usd:,.2f}")

    if dry_run:
        print(f"\n⚠️  This was a DRY RUN. No changes were made to the database.")
        print(f"Run without --dry-run to apply these changes.")
    else:
        print(f"\n✅ Migration completed successfully!")


def main():
    parser = argparse.ArgumentParser(
        description='Remove duplicate flight cost items from scenarios'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying the database'
    )
    parser.add_argument(
        '--scenario-id',
        type=str,
        help='Only process a specific scenario ID'
    )

    args = parser.parse_args()

    # Initialize Firestore client
    try:
        db = firestore.Client()
        print("✅ Connected to Firestore")
    except Exception as e:
        print(f"❌ Failed to connect to Firestore: {e}")
        print("\nMake sure:")
        print("  1. You have valid GCP credentials configured")
        print("  2. GOOGLE_APPLICATION_CREDENTIALS is set, or")
        print("  3. You're running in a GCP environment with default credentials")
        exit(1)

    # Run migration
    if args.scenario_id:
        # Single scenario migration
        result = migrate_scenario(db, args.scenario_id, args.dry_run)
        results = [result]
    else:
        # All scenarios migration
        results = migrate_all_scenarios(db, args.dry_run)

    # Print summary
    print_summary(results, args.dry_run)


if __name__ == '__main__':
    main()
