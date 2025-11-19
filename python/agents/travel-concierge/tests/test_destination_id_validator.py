"""
Unit tests for destination ID validation and resolution
"""

import pytest
from travel_concierge.tools.destination_id_validator import (
    is_uuid,
    is_place_id,
    is_valid_destination_id,
    slugify,
    build_destination_lookup,
    resolve_destination_id,
    validate_and_resolve_cost_destination_id,
    validate_cost_items
)


class TestUUIDValidation:
    """Test UUID validation functions"""

    def test_is_uuid_valid(self):
        """Test valid UUIDs are recognized"""
        valid_uuids = [
            "550e8400-e29b-41d4-a716-446655440000",
            "123e4567-e89b-42d3-a456-426614174000",
            "c9bf9e57-1685-4c89-bafb-ff5af830be8a"
        ]
        for uuid in valid_uuids:
            assert is_uuid(uuid) is True

    def test_is_uuid_invalid(self):
        """Test invalid UUIDs are rejected"""
        invalid_uuids = [
            "not-a-uuid",
            "tokyo_japan",
            "12345",
            "",
            None
        ]
        for uuid in invalid_uuids:
            assert is_uuid(uuid) is False

    def test_is_place_id_valid(self):
        """Test valid Place IDs are recognized"""
        valid_place_ids = [
            "ChIJN1t_tDeuEmsRUsoyG83frY4",
            "GhIJQWDl0CIeQUARxks3icF8U8A",
            "EhIJKWDl0CIeQUARxks3icF8U8A"
        ]
        for place_id in valid_place_ids:
            assert is_place_id(place_id) is True

    def test_is_place_id_invalid(self):
        """Test invalid Place IDs are rejected"""
        invalid_place_ids = [
            "not-a-place-id",
            "tokyo_japan",
            "",
            None
        ]
        for place_id in invalid_place_ids:
            assert is_place_id(place_id) is False

    def test_is_valid_destination_id(self):
        """Test combined validation"""
        valid_ids = [
            "550e8400-e29b-41d4-a716-446655440000",  # UUID
            "ChIJN1t_tDeuEmsRUsoyG83frY4"  # Place ID
        ]
        for id in valid_ids:
            assert is_valid_destination_id(id) is True

        invalid_ids = [
            "tokyo_japan",
            "12345",
            "",
            None
        ]
        for id in invalid_ids:
            assert is_valid_destination_id(id) is False


class TestSlugify:
    """Test slugify function"""

    def test_slugify_basic(self):
        """Test basic slugification"""
        assert slugify("Tokyo, Japan") == "tokyo_japan"
        assert slugify("New York") == "new_york"
        assert slugify("São Paulo") == "so_paulo"

    def test_slugify_special_chars(self):
        """Test slugify removes special characters"""
        assert slugify("Paris!@#$%") == "paris"
        assert slugify("City-Name") == "city_name"

    def test_slugify_empty(self):
        """Test slugify with empty string"""
        assert slugify("") == ""
        assert slugify(None) == ""


class TestDestinationLookup:
    """Test destination lookup building"""

    def test_build_destination_lookup(self):
        """Test building lookup map from locations"""
        locations = [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Tokyo, Japan",
                "city": "Tokyo",
                "country": "Japan"
            },
            {
                "id": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
                "name": "Paris, France",
                "city": "Paris",
                "country": "France",
                "_legacy_id": "paris_france"
            }
        ]

        lookup = build_destination_lookup(locations)

        # Should map UUID to itself
        assert lookup["550e8400-e29b-41d4-a716-446655440000".lower()] == "550e8400-e29b-41d4-a716-446655440000"

        # Should map name to UUID
        assert lookup["tokyo, japan"] == "550e8400-e29b-41d4-a716-446655440000"
        assert lookup["paris, france"] == "c9bf9e57-1685-4c89-bafb-ff5af830be8a"

        # Should map slug to UUID
        assert lookup["tokyo_japan"] == "550e8400-e29b-41d4-a716-446655440000"

        # Should map legacy ID to UUID
        assert lookup["paris_france"] == "c9bf9e57-1685-4c89-bafb-ff5af830be8a"


class TestResolveDestinationId:
    """Test destination ID resolution"""

    @pytest.fixture
    def locations(self):
        return [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Tokyo, Japan",
                "city": "Tokyo",
                "country": "Japan"
            },
            {
                "id": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
                "name": "Paris, France",
                "city": "Paris",
                "country": "France"
            }
        ]

    def test_resolve_valid_uuid(self, locations):
        """Test resolving already valid UUID"""
        cost_item = {"destination_id": "550e8400-e29b-41d4-a716-446655440000"}
        resolved = resolve_destination_id(cost_item, locations, strict=False)
        assert resolved == "550e8400-e29b-41d4-a716-446655440000"

    def test_resolve_legacy_id(self, locations):
        """Test resolving legacy string ID"""
        cost_item = {"destination_id": "tokyo_japan", "description": "Hotel in Tokyo"}
        resolved = resolve_destination_id(cost_item, locations, strict=False)
        assert resolved == "550e8400-e29b-41d4-a716-446655440000"

    def test_resolve_from_description(self, locations):
        """Test resolving from description"""
        cost_item = {
            "destination_id": "unknown",
            "description": "Accommodation in Paris",
            "notes": "Hotel near Eiffel Tower"
        }
        resolved = resolve_destination_id(cost_item, locations, strict=False)
        assert resolved == "c9bf9e57-1685-4c89-bafb-ff5af830be8a"

    def test_resolve_fuzzy_match(self, locations):
        """Test fuzzy matching"""
        cost_item = {"destination_id": "Tokyo Japan"}
        resolved = resolve_destination_id(cost_item, locations, strict=False)
        assert resolved == "550e8400-e29b-41d4-a716-446655440000"

    def test_resolve_strict_failure(self, locations):
        """Test strict mode raises error on failure"""
        cost_item = {"destination_id": "unknown_city"}
        with pytest.raises(ValueError):
            resolve_destination_id(cost_item, locations, strict=True)


class TestValidateCostItems:
    """Test cost item validation"""

    @pytest.fixture
    def locations(self):
        return [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Tokyo, Japan",
                "city": "Tokyo",
                "country": "Japan"
            }
        ]

    def test_validate_valid_cost(self, locations):
        """Test validating cost with valid UUID"""
        costs = [
            {
                "id": "cost1",
                "destination_id": "550e8400-e29b-41d4-a716-446655440000",
                "category": "accommodation",
                "amount": 1000
            }
        ]
        validated, warnings = validate_cost_items(costs, locations)
        assert len(validated) == 1
        assert len(warnings) == 0
        assert validated[0]["destination_id"] == "550e8400-e29b-41d4-a716-446655440000"

    def test_validate_auto_resolve(self, locations):
        """Test auto-resolving legacy IDs"""
        costs = [
            {
                "id": "cost1",
                "destination_id": "tokyo_japan",
                "category": "accommodation",
                "amount": 1000,
                "description": "Hotel in Tokyo"
            }
        ]
        validated, warnings = validate_cost_items(costs, locations, auto_resolve=True)
        assert len(validated) == 1
        assert len(warnings) == 1
        assert validated[0]["destination_id"] == "550e8400-e29b-41d4-a716-446655440000"
        assert validated[0]["_auto_resolved"] is True
        assert validated[0]["_legacy_destination_id"] == "tokyo_japan"

    def test_validate_multiple_costs(self, locations):
        """Test validating multiple costs"""
        costs = [
            {
                "id": "cost1",
                "destination_id": "550e8400-e29b-41d4-a716-446655440000",
                "category": "accommodation",
                "amount": 1000
            },
            {
                "id": "cost2",
                "destination_id": "tokyo_japan",
                "category": "food",
                "amount": 500
            }
        ]
        validated, warnings = validate_cost_items(costs, locations, auto_resolve=True)
        assert len(validated) == 2
        assert len(warnings) == 1  # One warning for auto-resolution


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
