"""
Unit tests for currency validation service
"""

import pytest
from travel_concierge.tools.currency_validator import (
    CurrencyValidator,
    validate_currency,
    is_valid_currency
)


class TestCurrencyValidation:
    """Test currency code validation"""

    @pytest.fixture
    def validator(self):
        return CurrencyValidator()

    def test_is_valid_major_currencies(self, validator):
        """Test major currency codes are valid"""
        major_currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD']
        for currency in major_currencies:
            assert validator.is_valid(currency) is True

    def test_is_valid_invalid_codes(self, validator):
        """Test invalid codes are rejected"""
        invalid_codes = ['INVALID', 'XYZ', '123', '', None, 'N/A']
        for code in invalid_codes:
            assert validator.is_valid(code) is False

    def test_is_valid_case_insensitive(self, validator):
        """Test validation is case-insensitive"""
        assert validator.is_valid('usd') is True
        assert validator.is_valid('USD') is True
        assert validator.is_valid('Usd') is True


class TestCurrencyCorrection:
    """Test currency code auto-correction"""

    @pytest.fixture
    def validator(self):
        return CurrencyValidator()

    def test_correct_plural_forms(self, validator):
        """Test correction of plural forms"""
        assert validator.validate_and_fix('DOLLARS') == 'USD'
        assert validator.validate_and_fix('EUROS') == 'EUR'
        assert validator.validate_and_fix('POUNDS') == 'GBP'
        assert validator.validate_and_fix('YEN') == 'JPY'
        assert validator.validate_and_fix('RUPEES') == 'INR'

    def test_correct_invalid_markers(self, validator):
        """Test correction of invalid markers"""
        assert validator.validate_and_fix('N/A') == 'USD'
        assert validator.validate_and_fix('NULL') == 'USD'
        assert validator.validate_and_fix('NONE') == 'USD'
        assert validator.validate_and_fix('') == 'USD'

    def test_correct_symbols(self, validator):
        """Test correction of currency symbols"""
        assert validator.validate_and_fix('$') == 'USD'
        assert validator.validate_and_fix('€') == 'EUR'
        assert validator.validate_and_fix('£') == 'GBP'
        assert validator.validate_and_fix('¥') == 'JPY'
        assert validator.validate_and_fix('₹') == 'INR'

    def test_correct_common_typos(self, validator):
        """Test correction of common typos"""
        assert validator.validate_and_fix('US') == 'USD'
        assert validator.validate_and_fix('US$') == 'USD'
        assert validator.validate_and_fix('EU') == 'EUR'

    def test_valid_code_unchanged(self, validator):
        """Test valid codes are not changed"""
        assert validator.validate_and_fix('USD') == 'USD'
        assert validator.validate_and_fix('EUR') == 'EUR'
        assert validator.validate_and_fix('JPY') == 'JPY'


class TestCountryInference:
    """Test currency inference from country"""

    @pytest.fixture
    def validator(self):
        return CurrencyValidator()

    def test_infer_from_country(self, validator):
        """Test inferring currency from country name"""
        assert validator.validate_and_fix('INVALID', country='United States') == 'USD'
        assert validator.validate_and_fix('INVALID', country='Japan') == 'JPY'
        assert validator.validate_and_fix('INVALID', country='France') == 'EUR'
        assert validator.validate_and_fix('INVALID', country='United Kingdom') == 'GBP'

    def test_infer_from_country_partial_match(self, validator):
        """Test inferring from partial country name"""
        assert validator.validate_and_fix('INVALID', country='Paris, France') == 'EUR'
        assert validator.validate_and_fix('INVALID', country='Tokyo, Japan') == 'JPY'

    def test_infer_fallback_to_default(self, validator):
        """Test fallback when country not recognized"""
        assert validator.validate_and_fix('INVALID', country='Unknown Country') == 'USD'

    def test_infer_with_custom_default(self, validator):
        """Test custom default currency"""
        assert validator.validate_and_fix('INVALID', country='Unknown', default='EUR') == 'EUR'


class TestCostItemValidation:
    """Test cost item validation"""

    @pytest.fixture
    def validator(self):
        return CurrencyValidator()

    def test_validate_cost_item_valid(self, validator):
        """Test validating cost item with valid currency"""
        cost_item = {
            'amount': 1000,
            'currency': 'USD',
            'description': 'Hotel'
        }
        validated = validator.validate_cost_item(cost_item)
        assert validated['currency'] == 'USD'
        assert '_currency_auto_corrected' not in validated

    def test_validate_cost_item_auto_correct(self, validator):
        """Test auto-correcting invalid currency"""
        cost_item = {
            'amount': 1000,
            'currency': 'DOLLAR',
            'description': 'Hotel'
        }
        validated = validator.validate_cost_item(cost_item)
        assert validated['currency'] == 'USD'
        assert validated['_original_currency'] == 'DOLLAR'
        assert validated['_currency_auto_corrected'] is True

    def test_validate_cost_item_with_country(self, validator):
        """Test validating with country inference"""
        cost_item = {
            'amount': 1000,
            'currency': 'INVALID',
            'country': 'Japan',
            'description': 'Hotel'
        }
        validated = validator.validate_cost_item(cost_item)
        assert validated['currency'] == 'JPY'
        assert validated['_currency_auto_corrected'] is True


class TestConvenienceFunctions:
    """Test convenience functions"""

    def test_validate_currency_function(self):
        """Test validate_currency convenience function"""
        assert validate_currency('USD') == 'USD'
        assert validate_currency('DOLLAR') == 'USD'
        assert validate_currency('N/A') == 'USD'
        assert validate_currency('INVALID', country='Japan') == 'JPY'

    def test_is_valid_currency_function(self):
        """Test is_valid_currency convenience function"""
        assert is_valid_currency('USD') is True
        assert is_valid_currency('EUR') is True
        assert is_valid_currency('INVALID') is False
        assert is_valid_currency('') is False


class TestEdgeCases:
    """Test edge cases and error handling"""

    @pytest.fixture
    def validator(self):
        return CurrencyValidator()

    def test_validate_none(self, validator):
        """Test validating None returns default"""
        assert validator.validate_and_fix(None) == 'USD'
        assert validator.validate_and_fix(None, default='EUR') == 'EUR'

    def test_validate_empty_string(self, validator):
        """Test validating empty string returns default"""
        assert validator.validate_and_fix('') == 'USD'
        assert validator.validate_and_fix('  ') == 'USD'

    def test_validate_whitespace(self, validator):
        """Test validation handles whitespace"""
        assert validator.validate_and_fix('  USD  ') == 'USD'
        assert validator.validate_and_fix('\tEUR\n') == 'EUR'

    def test_validate_mixed_case(self, validator):
        """Test validation handles mixed case"""
        assert validator.validate_and_fix('usd') == 'USD'
        assert validator.validate_and_fix('Eur') == 'EUR'
        assert validator.validate_and_fix('jPy') == 'JPY'

    def test_unknown_3_letter_code(self, validator):
        """Test unknown 3-letter code is accepted with warning"""
        # Unknown but valid format codes are accepted
        result = validator.validate_and_fix('XXX')
        assert result == 'XXX'  # Passes through as-is


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
