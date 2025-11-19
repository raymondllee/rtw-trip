"""
Destination ID Validation and Resolution

Provides strict validation for destination IDs to prevent orphaned costs.
Auto-resolves legacy IDs to UUIDs when possible.
"""

import re
from typing import Optional, Dict, List, Any
from difflib import SequenceMatcher


UUID_PATTERN = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    re.IGNORECASE
)

PLACE_ID_PREFIXES = ['ChIJ', 'GhIJ', 'EhIJ']


def is_uuid(dest_id: str) -> bool:
    """Check if an ID is a valid UUID v4."""
    if not dest_id or not isinstance(dest_id, str):
        return False
    return bool(UUID_PATTERN.match(dest_id.strip()))


def is_place_id(dest_id: str) -> bool:
    """Check if an ID is a Google Place ID."""
    if not dest_id or not isinstance(dest_id, str):
        return False
    return any(dest_id.startswith(prefix) for prefix in PLACE_ID_PREFIXES)


def is_valid_destination_id(dest_id: str) -> bool:
    """Check if destination ID is valid (UUID or Place ID)."""
    if not dest_id:
        return False
    return is_uuid(dest_id) or is_place_id(dest_id)


def slugify(text: str) -> str:
    """Create slug from destination name."""
    if not text:
        return ""
    # Convert to lowercase, replace spaces with underscores, remove special chars
    slug = text.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '_', slug)
    return slug


def build_destination_lookup(locations: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    Build a lookup map from various identifiers to canonical UUIDs.

    Returns:
        Dict mapping {identifier -> uuid}
    """
    lookup = {}

    for location in locations:
        loc_id = location.get('id')
        if not loc_id or not is_valid_destination_id(str(loc_id)):
            continue

        loc_id_str = str(loc_id).strip()

        # Map UUID to itself
        lookup[loc_id_str.lower()] = loc_id_str

        # Map name variants
        name = location.get('name') or location.get('city')
        if name:
            lookup[name.lower().strip()] = loc_id_str
            lookup[slugify(name)] = loc_id_str

        # Map legacy ID if present
        legacy_id = location.get('_legacy_id')
        if legacy_id:
            lookup[str(legacy_id).strip().lower()] = loc_id_str

        # Map country + city combination
        city = location.get('city')
        country = location.get('country')
        if city and country:
            combined = f"{city}, {country}"
            lookup[combined.lower().strip()] = loc_id_str
            lookup[slugify(combined)] = loc_id_str

    return lookup


def find_best_match(query: str, candidates: List[str], threshold: float = 0.6) -> Optional[str]:
    """
    Find best fuzzy match for destination name.

    Args:
        query: Destination identifier to match
        candidates: List of possible destination names
        threshold: Minimum similarity ratio (0.0-1.0)

    Returns:
        Best matching candidate or None
    """
    query_lower = query.lower().strip()
    best_match = None
    best_ratio = threshold

    for candidate in candidates:
        candidate_lower = candidate.lower().strip()

        # Exact match
        if query_lower == candidate_lower:
            return candidate

        # Fuzzy match
        ratio = SequenceMatcher(None, query_lower, candidate_lower).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = candidate

    return best_match


def resolve_destination_id(
    cost_item: Dict[str, Any],
    locations: List[Dict[str, Any]],
    strict: bool = True
) -> Optional[str]:
    """
    Attempt to resolve a cost item's destination_id to a valid UUID.

    Args:
        cost_item: Cost item with destination_id or description
        locations: List of location objects with UUIDs
        strict: If True, raise ValueError on unresolvable IDs

    Returns:
        Resolved UUID or None

    Raises:
        ValueError: If strict=True and ID cannot be resolved
    """
    dest_id = cost_item.get('destination_id')

    # Already valid UUID or Place ID
    if dest_id and is_valid_destination_id(str(dest_id)):
        return str(dest_id).strip()

    # Build lookup map
    lookup = build_destination_lookup(locations)

    # Try exact lookup
    if dest_id:
        dest_id_norm = str(dest_id).strip().lower()
        if dest_id_norm in lookup:
            resolved = lookup[dest_id_norm]
            print(f"✓ Resolved '{dest_id}' -> '{resolved}' via exact match")
            return resolved

    # Try fuzzy matching on description
    description = cost_item.get('description', '')
    notes = cost_item.get('notes', '')
    search_text = f"{description} {notes}".lower()

    # Build candidate names
    candidates = []
    for loc in locations:
        name = loc.get('name') or loc.get('city')
        if name:
            candidates.append(name)

    # Find destination name in description
    for loc in locations:
        name = loc.get('name') or loc.get('city')
        if name and name.lower() in search_text:
            loc_id = loc.get('id')
            if is_valid_destination_id(str(loc_id)):
                print(f"✓ Resolved via description match: '{name}' -> '{loc_id}'")
                return str(loc_id).strip()

    # Fuzzy match as last resort
    if dest_id:
        best_match = find_best_match(str(dest_id), candidates, threshold=0.7)
        if best_match:
            matched_uuid = lookup.get(best_match.lower().strip())
            if matched_uuid:
                print(f"✓ Fuzzy matched '{dest_id}' -> '{best_match}' -> '{matched_uuid}'")
                return matched_uuid

    # Failed to resolve
    if strict:
        raise ValueError(
            f"Cannot resolve destination_id '{dest_id}' to a valid UUID. "
            f"Available destinations: {[loc.get('name') for loc in locations]}"
        )

    print(f"⚠️ WARNING: Could not resolve destination_id: {dest_id}")
    return None


def validate_and_resolve_cost_destination_id(
    cost_item: Dict[str, Any],
    locations: List[Dict[str, Any]],
    auto_resolve: bool = True,
    strict: bool = False
) -> Dict[str, Any]:
    """
    Validate and resolve a cost item's destination_id.

    Args:
        cost_item: Cost item to validate
        locations: List of valid locations
        auto_resolve: Attempt to auto-resolve invalid IDs
        strict: Raise error if ID cannot be resolved

    Returns:
        Cost item with validated destination_id

    Raises:
        ValueError: If validation fails and strict=True
    """
    dest_id = cost_item.get('destination_id')

    # No destination_id - may be valid for some cost types
    if not dest_id:
        if strict:
            raise ValueError("Cost item missing destination_id")
        return cost_item

    dest_id_str = str(dest_id).strip()

    # Already valid
    if is_valid_destination_id(dest_id_str):
        cost_item['destination_id'] = dest_id_str
        return cost_item

    # Attempt auto-resolution
    if auto_resolve:
        resolved_id = resolve_destination_id(cost_item, locations, strict=strict)
        if resolved_id:
            cost_item['destination_id'] = resolved_id
            cost_item['_auto_resolved'] = True
            cost_item['_legacy_destination_id'] = dest_id
            return cost_item

    # Resolution failed
    if strict:
        raise ValueError(
            f"Invalid destination_id '{dest_id}' (must be UUID or Place ID). "
            f"This cost will become orphaned."
        )

    # Log warning but allow
    print(f"⚠️ WARNING: Cost has non-UUID destination_id: {dest_id}")
    print(f"   Category: {cost_item.get('category')}")
    print(f"   Description: {cost_item.get('description')}")
    print(f"   This cost may become orphaned!")

    return cost_item


def validate_cost_items(
    cost_items: List[Dict[str, Any]],
    locations: List[Dict[str, Any]],
    auto_resolve: bool = True,
    strict: bool = False
) -> tuple[List[Dict[str, Any]], List[str]]:
    """
    Validate and resolve destination IDs for a list of cost items.

    Args:
        cost_items: List of cost items to validate
        locations: List of valid locations
        auto_resolve: Attempt to auto-resolve invalid IDs
        strict: Raise error on first validation failure

    Returns:
        Tuple of (validated_costs, warnings)

    Raises:
        ValueError: If any validation fails and strict=True
    """
    validated_costs = []
    warnings = []

    for i, cost_item in enumerate(cost_items):
        try:
            validated_cost = validate_and_resolve_cost_destination_id(
                cost_item.copy(),
                locations,
                auto_resolve=auto_resolve,
                strict=strict
            )
            validated_costs.append(validated_cost)

            if validated_cost.get('_auto_resolved'):
                warnings.append(
                    f"Cost #{i+1} ({cost_item.get('category')}): "
                    f"Auto-resolved '{cost_item.get('destination_id')}' -> "
                    f"'{validated_cost['destination_id']}'"
                )

        except ValueError as e:
            if strict:
                raise
            warnings.append(f"Cost #{i+1}: {str(e)}")
            validated_costs.append(cost_item)

    return validated_costs, warnings
