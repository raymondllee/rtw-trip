#!/usr/bin/env python3
"""
Migration Script: Add UUID IDs to All Costs in Firestore

This script adds unique UUID 'id' fields to all costs that don't have them.
It updates costs in place in the latest version of each scenario.

Usage:
    python3 migrate-add-cost-ids.py --scenario-id SCENARIO_ID [--dry-run]
    python3 migrate-add-cost-ids.py --all-scenarios [--dry-run]
"""

import sys
import argparse
import uuid
from datetime import datetime
from google.cloud import firestore


def add_ids_to_costs(costs):
    """Add UUID ids to costs that don't have them."""
    modified_count = 0

    for cost in costs:
        if 'id' not in cost or not cost.get('id'):
            cost['id'] = str(uuid.uuid4())
            modified_count += 1

    return costs, modified_count


def migrate_scenario(db, scenario_id, dry_run=False, auto_confirm=False):
    """Migrate costs in a single scenario."""
    print(f"\n{'='*80}")
    print(f"Migrating scenario: {scenario_id}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"{'='*80}")

    scenario_ref = db.collection('scenarios').document(scenario_id)
    scenario_doc = scenario_ref.get()

    if not scenario_doc.exists:
        print(f"❌ Scenario not found: {scenario_id}")
        return False

    # Get latest version
    versions = list(
        scenario_ref
            .collection('versions')
            .order_by('versionNumber', direction=firestore.Query.DESCENDING)
            .limit(1)
            .stream()
    )

    if not versions:
        print(f"⚠️  No versions found for scenario: {scenario_id}")
        return False

    latest_version_ref = versions[0].reference
    latest_version_data = versions[0].to_dict() or {}
    version_number = latest_version_data.get('versionNumber', 0)

    print(f"📍 Working on version: {version_number}")

    itinerary_data = latest_version_data.get('itineraryData', {}) or {}
    costs = itinerary_data.get('costs', [])

    if not costs:
        print(f"ℹ️  No costs found in this scenario")
        return True

    print(f"📊 Total costs: {len(costs)}")

    # Check how many costs need IDs
    costs_without_ids = sum(1 for c in costs if 'id' not in c or not c.get('id'))
    costs_with_ids = len(costs) - costs_without_ids

    print(f"   - Costs with IDs: {costs_with_ids}")
    print(f"   - Costs without IDs: {costs_without_ids}")

    if costs_without_ids == 0:
        print(f"✅ All costs already have IDs - no migration needed!")
        return True

    # Add IDs to costs
    migrated_costs, modified_count = add_ids_to_costs(costs)

    print(f"\n📝 Migration plan:")
    print(f"   - Will add IDs to {modified_count} costs")

    # Show sample of costs that will be updated
    if modified_count > 0:
        print(f"\n📋 Sample costs that will get IDs:")
        sample_count = min(5, modified_count)
        costs_needing_ids = [c for c in migrated_costs if 'id' in c][-sample_count:]

        for i, cost in enumerate(costs_needing_ids, 1):
            dest_id = cost.get('destination_id', 'null')
            dest_id_short = dest_id[:8] + '...' if dest_id and dest_id != 'null' else 'null'
            print(f"   {i}. {cost.get('category'):15} ${cost.get('amount', 0):7.2f} "
                  f"dest:{dest_id_short:12} -> id:{cost['id'][:13]}...")

    if dry_run:
        print(f"\n🔍 DRY RUN - No changes will be made")
        print(f"   Run without --dry-run to apply changes")
        return True

    # Confirm before making changes
    if not auto_confirm:
        print(f"\n⚠️  About to modify {modified_count} costs in Firestore")
        response = input(f"Continue? (yes/no): ")

        if response.lower() not in ['yes', 'y']:
            print(f"❌ Migration cancelled by user")
            return False

    # Update Firestore
    print(f"\n💾 Updating Firestore...")

    try:
        # Update the itinerary data with migrated costs
        itinerary_data['costs'] = migrated_costs

        latest_version_ref.update({
            'itineraryData': itinerary_data,
            'lastModified': datetime.utcnow().isoformat()
        })

        print(f"✅ Successfully migrated {modified_count} costs!")
        print(f"   Scenario: {scenario_id}")
        print(f"   Version: {version_number}")

        return True

    except Exception as e:
        print(f"❌ Error updating Firestore: {e}")
        import traceback
        traceback.print_exc()
        return False


def migrate_all_scenarios(db, dry_run=False, auto_confirm=False):
    """Migrate costs in all scenarios."""
    print(f"\n{'='*80}")
    print(f"Migrating ALL scenarios")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"{'='*80}")

    scenarios = db.collection('scenarios').stream()
    scenario_ids = [scenario.id for scenario in scenarios]

    print(f"\nFound {len(scenario_ids)} scenarios")

    if not scenario_ids:
        print("No scenarios found")
        return

    if not dry_run and not auto_confirm:
        print(f"\n⚠️  This will migrate costs in {len(scenario_ids)} scenarios!")
        response = input(f"Continue? (yes/no): ")

        if response.lower() not in ['yes', 'y']:
            print(f"❌ Migration cancelled by user")
            return

    success_count = 0
    error_count = 0

    for scenario_id in scenario_ids:
        try:
            if migrate_scenario(db, scenario_id, dry_run, auto_confirm):
                success_count += 1
            else:
                error_count += 1
        except Exception as e:
            print(f"❌ Error migrating scenario {scenario_id}: {e}")
            error_count += 1

    print(f"\n{'='*80}")
    print(f"Migration complete!")
    print(f"{'='*80}")
    print(f"✅ Successfully migrated: {success_count} scenarios")
    if error_count > 0:
        print(f"❌ Errors: {error_count} scenarios")


def main():
    parser = argparse.ArgumentParser(
        description='Add UUID IDs to all costs in Firestore scenarios'
    )
    parser.add_argument(
        '--scenario-id',
        help='Scenario ID to migrate'
    )
    parser.add_argument(
        '--all-scenarios',
        action='store_true',
        help='Migrate all scenarios'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be changed without making changes'
    )
    parser.add_argument(
        '--yes',
        action='store_true',
        help='Auto-confirm changes (skip confirmation prompts)'
    )

    args = parser.parse_args()

    if not args.scenario_id and not args.all_scenarios:
        parser.print_help()
        print("\nError: Must specify either --scenario-id or --all-scenarios")
        sys.exit(1)

    if args.scenario_id and args.all_scenarios:
        print("Error: Cannot specify both --scenario-id and --all-scenarios")
        sys.exit(1)

    # Initialize Firestore
    try:
        db = firestore.Client()
        print("✅ Connected to Firestore")
    except Exception as e:
        print(f"❌ Failed to connect to Firestore: {e}")
        sys.exit(1)

    # Run migration
    if args.all_scenarios:
        migrate_all_scenarios(db, args.dry_run, args.yes)
    else:
        success = migrate_scenario(db, args.scenario_id, args.dry_run, args.yes)
        sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
