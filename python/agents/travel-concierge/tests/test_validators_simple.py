"""
Simple standalone tests for validators (no external dependencies)
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from travel_concierge.tools.destination_id_validator import (
    is_uuid,
    is_place_id,
    is_valid_destination_id,
    slugify
)

from travel_concierge.tools.currency_validator import (
    CurrencyValidator,
    validate_currency,
    is_valid_currency
)

def test_uuid_validation():
    """Test UUID validation"""
    print("Testing UUID validation...")

    # Valid UUIDs
    assert is_uuid("550e8400-e29b-41d4-a716-446655440000") is True
    assert is_uuid("c9bf9e57-1685-4c89-bafb-ff5af830be8a") is True

    # Invalid
    assert is_uuid("not-a-uuid") is False
    assert is_uuid("tokyo_japan") is False
    assert is_uuid("") is False
    assert is_uuid(None) is False

    print("✓ UUID validation tests passed")

def test_place_id_validation():
    """Test Place ID validation"""
    print("Testing Place ID validation...")

    # Valid Place IDs
    assert is_place_id("ChIJN1t_tDeuEmsRUsoyG83frY4") is True
    assert is_place_id("GhIJQWDl0CIeQUARxks3icF8U8A") is True

    # Invalid
    assert is_place_id("not-a-place-id") is False
    assert is_place_id("") is False

    print("✓ Place ID validation tests passed")

def test_destination_id_validation():
    """Test combined destination ID validation"""
    print("Testing destination ID validation...")

    # Valid IDs
    assert is_valid_destination_id("550e8400-e29b-41d4-a716-446655440000") is True
    assert is_valid_destination_id("ChIJN1t_tDeuEmsRUsoyG83frY4") is True

    # Invalid IDs
    assert is_valid_destination_id("tokyo_japan") is False
    assert is_valid_destination_id("12345") is False

    print("✓ Destination ID validation tests passed")

def test_slugify():
    """Test slugify function"""
    print("Testing slugify...")

    assert slugify("Tokyo, Japan") == "tokyo_japan"
    assert slugify("New York") == "new_york"
    assert slugify("São Paulo") == "so_paulo"
    assert slugify("") == ""

    print("✓ Slugify tests passed")

def test_currency_validation():
    """Test currency validation"""
    print("Testing currency validation...")

    validator = CurrencyValidator()

    # Valid currencies
    assert validator.is_valid('USD') is True
    assert validator.is_valid('EUR') is True
    assert validator.is_valid('JPY') is True

    # Invalid currencies
    assert validator.is_valid('INVALID') is False
    assert validator.is_valid('') is False
    assert validator.is_valid(None) is False

    # Case insensitive
    assert validator.is_valid('usd') is True
    assert validator.is_valid('Eur') is True

    print("✓ Currency validation tests passed")

def test_currency_correction():
    """Test currency auto-correction"""
    print("Testing currency auto-correction...")

    validator = CurrencyValidator()

    # Plural forms
    assert validator.validate_and_fix('DOLLARS') == 'USD'
    assert validator.validate_and_fix('EUROS') == 'EUR'
    assert validator.validate_and_fix('YEN') == 'JPY'
    assert validator.validate_and_fix('POUNDS') == 'GBP'

    # Invalid markers
    assert validator.validate_and_fix('N/A') == 'USD'
    assert validator.validate_and_fix('NULL') == 'USD'
    assert validator.validate_and_fix('NONE') == 'USD'

    # Symbols
    assert validator.validate_and_fix('$') == 'USD'
    assert validator.validate_and_fix('€') == 'EUR'
    assert validator.validate_and_fix('£') == 'GBP'

    # Valid codes unchanged
    assert validator.validate_and_fix('USD') == 'USD'
    assert validator.validate_and_fix('EUR') == 'EUR'

    print("✓ Currency correction tests passed")

def test_currency_country_inference():
    """Test currency inference from country"""
    print("Testing currency country inference...")

    validator = CurrencyValidator()

    assert validator.validate_and_fix('INVALID', country='United States') == 'USD'
    assert validator.validate_and_fix('INVALID', country='Japan') == 'JPY'
    assert validator.validate_and_fix('INVALID', country='France') == 'EUR'
    assert validator.validate_and_fix('INVALID', country='Tokyo, Japan') == 'JPY'
    assert validator.validate_and_fix('INVALID', country='Paris, France') == 'EUR'

    print("✓ Currency country inference tests passed")

def test_convenience_functions():
    """Test convenience functions"""
    print("Testing convenience functions...")

    assert validate_currency('USD') == 'USD'
    assert validate_currency('DOLLAR') == 'USD'
    assert validate_currency('N/A') == 'USD'
    assert validate_currency('INVALID', country='Japan') == 'JPY'

    assert is_valid_currency('USD') is True
    assert is_valid_currency('EUR') is True
    assert is_valid_currency('INVALID') is False

    print("✓ Convenience function tests passed")

def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("Running Validator Tests")
    print("=" * 60)
    print()

    tests = [
        test_uuid_validation,
        test_place_id_validation,
        test_destination_id_validation,
        test_slugify,
        test_currency_validation,
        test_currency_correction,
        test_currency_country_inference,
        test_convenience_functions
    ]

    failed = []
    for test in tests:
        try:
            test()
        except AssertionError as e:
            print(f"✗ {test.__name__} FAILED: {e}")
            failed.append(test.__name__)
        except Exception as e:
            print(f"✗ {test.__name__} ERROR: {e}")
            failed.append(test.__name__)

    print()
    print("=" * 60)
    if failed:
        print(f"FAILED: {len(failed)} test(s) failed")
        for name in failed:
            print(f"  - {name}")
        return 1
    else:
        print(f"SUCCESS: All {len(tests)} tests passed! ✓")
        return 0

if __name__ == '__main__':
    exit_code = run_all_tests()
    sys.exit(exit_code)
