"""
Currency Validation Service

Validates currency codes against ISO 4217 standard and provides
auto-correction for common AI errors.
"""

from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)


# ISO 4217 Currency Codes (Common currencies)
# Full list from: https://en.wikipedia.org/wiki/ISO_4217
VALID_CURRENCIES = {
    # Major Currencies
    'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD', 'NZD',

    # Asia-Pacific
    'INR', 'IDR', 'THB', 'SGD', 'MYR', 'PHP', 'VND', 'KRW', 'TWD', 'HKD',
    'BDT', 'PKR', 'LKR', 'MMK', 'KHR', 'LAK', 'NPR', 'BTN', 'MVR',

    # Middle East
    'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'ILS', 'TRY', 'IQD',
    'IRR', 'LBP', 'SYP', 'YER',

    # Africa
    'ZAR', 'EGP', 'MAD', 'TND', 'DZD', 'KES', 'NGN', 'GHS', 'UGX', 'TZS',
    'ETB', 'XAF', 'XOF', 'MUR', 'MWK', 'ZMW', 'BWP', 'NAD', 'SZL',

    # Europe
    'NOK', 'SEK', 'DKK', 'ISK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK',
    'RSD', 'BAM', 'MKD', 'ALL', 'RUB', 'UAH', 'BYN', 'MDL', 'GEL', 'AMD',
    'AZN', 'KZT', 'UZS', 'TJS', 'KGS', 'TMT',

    # Americas
    'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'PEN', 'VES', 'UYU', 'PYG', 'BOB',
    'CRC', 'GTQ', 'HNL', 'NIO', 'PAB', 'DOP', 'CUP', 'JMD', 'TTD', 'BBD',
    'BSD', 'BZD', 'XCD',

    # Caribbean & Pacific
    'FJD', 'PGK', 'TOP', 'WST', 'VUV', 'SBD', 'ANG', 'AWG', 'BMD', 'KYD',

    # Special
    'XDR',  # Special Drawing Rights (IMF)
}


# Common AI errors and their corrections
CURRENCY_CORRECTIONS = {
    # Plural forms
    'DOLLARS': 'USD',
    'DOLLAR': 'USD',
    'EUROS': 'EUR',
    'EURO': 'EUR',
    'POUNDS': 'GBP',
    'POUND': 'GBP',
    'YEN': 'JPY',
    'RUPEES': 'INR',
    'RUPEE': 'INR',
    'YUAN': 'CNY',
    'RENMINBI': 'CNY',
    'RMB': 'CNY',
    'WON': 'KRW',
    'BAHT': 'THB',
    'PESO': 'MXN',  # Ambiguous, defaulting to MXN
    'PESOS': 'MXN',
    'FRANC': 'CHF',
    'FRANCS': 'CHF',
    'RAND': 'ZAR',
    'RANDS': 'ZAR',
    'REAL': 'BRL',
    'REAIS': 'BRL',
    'DIRHAM': 'AED',
    'DIRHAMS': 'AED',
    'SHEKEL': 'ILS',
    'SHEKELS': 'ILS',
    'KRONA': 'SEK',
    'KRONOR': 'SEK',
    'KRONE': 'NOK',
    'KRONER': 'NOK',
    'ZLOTY': 'PLN',
    'FORINT': 'HUF',
    'LIRA': 'TRY',
    'LIRAS': 'TRY',
    'RUBLE': 'RUB',
    'RUBLES': 'RUB',
    'DINAR': 'KWD',  # Ambiguous, multiple countries use dinars
    'DINARS': 'KWD',

    # Invalid markers
    'N/A': 'USD',
    'NA': 'USD',
    'NULL': 'USD',
    'NONE': 'USD',
    'UNKNOWN': 'USD',
    '': 'USD',

    # Common typos
    'US': 'USD',
    'US$': 'USD',
    '$': 'USD',
    'EU': 'EUR',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR',
    '₽': 'RUB',
    '¢': 'USD',
}


# Country to primary currency mapping
COUNTRY_TO_CURRENCY = {
    'united states': 'USD',
    'usa': 'USD',
    'us': 'USD',
    'america': 'USD',
    'united kingdom': 'GBP',
    'uk': 'GBP',
    'britain': 'GBP',
    'england': 'GBP',
    'scotland': 'GBP',
    'wales': 'GBP',
    'france': 'EUR',
    'germany': 'EUR',
    'italy': 'EUR',
    'spain': 'EUR',
    'portugal': 'EUR',
    'netherlands': 'EUR',
    'belgium': 'EUR',
    'austria': 'EUR',
    'greece': 'EUR',
    'ireland': 'EUR',
    'japan': 'JPY',
    'china': 'CNY',
    'india': 'INR',
    'australia': 'AUD',
    'canada': 'CAD',
    'switzerland': 'CHF',
    'new zealand': 'NZD',
    'singapore': 'SGD',
    'hong kong': 'HKD',
    'thailand': 'THB',
    'malaysia': 'MYR',
    'indonesia': 'IDR',
    'philippines': 'PHP',
    'vietnam': 'VND',
    'south korea': 'KRW',
    'korea': 'KRW',
    'taiwan': 'TWD',
    'mexico': 'MXN',
    'brazil': 'BRL',
    'argentina': 'ARS',
    'chile': 'CLP',
    'colombia': 'COP',
    'peru': 'PEN',
    'south africa': 'ZAR',
    'egypt': 'EGP',
    'morocco': 'MAD',
    'kenya': 'KES',
    'nigeria': 'NGN',
    'turkey': 'TRY',
    'uae': 'AED',
    'united arab emirates': 'AED',
    'dubai': 'AED',
    'saudi arabia': 'SAR',
    'israel': 'ILS',
    'russia': 'RUB',
    'poland': 'PLN',
    'czech republic': 'CZK',
    'czechia': 'CZK',
    'hungary': 'HUF',
    'romania': 'RON',
    'norway': 'NOK',
    'sweden': 'SEK',
    'denmark': 'DKK',
    'iceland': 'ISK',
    'croatia': 'EUR',  # Croatia adopted EUR in 2023
    'pakistan': 'PKR',
    'bangladesh': 'BDT',
    'sri lanka': 'LKR',
    'nepal': 'NPR',
    'myanmar': 'MMK',
    'cambodia': 'KHR',
    'laos': 'LAK',
}


class CurrencyValidator:
    """Validates and corrects currency codes."""

    def __init__(self):
        self.valid_currencies = VALID_CURRENCIES
        self.corrections = CURRENCY_CORRECTIONS
        self.country_map = COUNTRY_TO_CURRENCY

    def is_valid(self, currency_code: str) -> bool:
        """Check if currency code is valid."""
        if not currency_code or not isinstance(currency_code, str):
            return False
        return currency_code.strip().upper() in self.valid_currencies

    def validate_and_fix(
        self,
        currency_code: str,
        country: Optional[str] = None,
        default: str = 'USD'
    ) -> str:
        """
        Validate currency code and attempt to fix if invalid.

        Args:
            currency_code: Currency code to validate
            country: Optional country name to infer currency
            default: Default currency if all else fails

        Returns:
            Valid ISO 4217 currency code

        Raises:
            ValueError: If currency cannot be validated or fixed
        """
        if not currency_code:
            if country:
                return self._infer_from_country(country, default)
            return default

        # Normalize
        code = str(currency_code).strip().upper()

        # Already valid
        if code in self.valid_currencies:
            return code

        # Try corrections
        if code in self.corrections:
            corrected = self.corrections[code]
            logger.info(f"Auto-corrected currency '{currency_code}' -> '{corrected}'")
            return corrected

        # Try country inference
        if country:
            inferred = self._infer_from_country(country, default)
            logger.warning(
                f"Invalid currency '{currency_code}', inferred '{inferred}' from country '{country}'"
            )
            return inferred

        # Last resort: check if it's a 3-letter alphabetic code
        if len(code) == 3 and code.isalpha():
            logger.warning(
                f"Unknown currency code '{code}', using as-is. "
                f"This may not be a valid ISO 4217 code."
            )
            return code

        # Failed
        logger.error(
            f"Invalid currency code '{currency_code}', using default '{default}'"
        )
        return default

    def _infer_from_country(self, country: str, default: str = 'USD') -> str:
        """Infer currency from country name."""
        if not country:
            return default

        country_lower = country.lower().strip()

        # Direct lookup
        if country_lower in self.country_map:
            return self.country_map[country_lower]

        # Try partial match (e.g., "Paris, France" -> "France")
        for country_key, currency in self.country_map.items():
            if country_key in country_lower:
                logger.info(f"Inferred currency '{currency}' from country '{country}'")
                return currency

        logger.warning(f"Could not infer currency from country '{country}', using default")
        return default

    def validate_cost_item(
        self,
        cost_item: Dict,
        default: str = 'USD'
    ) -> Dict:
        """
        Validate and fix currency in a cost item.

        Args:
            cost_item: Cost item dictionary
            default: Default currency

        Returns:
            Cost item with validated currency
        """
        currency = cost_item.get('currency')
        country = cost_item.get('country')  # Some costs may have country field

        try:
            validated_currency = self.validate_and_fix(currency, country, default)

            if currency != validated_currency:
                cost_item['currency'] = validated_currency
                cost_item['_original_currency'] = currency
                cost_item['_currency_auto_corrected'] = True

            return cost_item

        except Exception as e:
            logger.error(f"Error validating currency for cost item: {e}")
            cost_item['currency'] = default
            cost_item['_currency_validation_error'] = str(e)
            return cost_item


# Singleton instance
_validator = CurrencyValidator()


def validate_currency(
    currency_code: str,
    country: Optional[str] = None,
    default: str = 'USD'
) -> str:
    """
    Validate currency code (convenience function).

    Args:
        currency_code: Currency code to validate
        country: Optional country name
        default: Default currency

    Returns:
        Valid ISO 4217 currency code
    """
    return _validator.validate_and_fix(currency_code, country, default)


def is_valid_currency(currency_code: str) -> bool:
    """Check if currency code is valid."""
    return _validator.is_valid(currency_code)
