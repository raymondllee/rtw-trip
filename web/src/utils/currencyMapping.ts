/**
 * Maps countries to their local currencies
 */
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // North America
  'United States': 'USD',
  'Canada': 'CAD',
  'Mexico': 'USD', // USD commonly accepted

  // Europe
  'France': 'EUR',
  'Germany': 'EUR',
  'Italy': 'EUR',
  'Spain': 'EUR',
  'Portugal': 'EUR',
  'Netherlands': 'EUR',
  'Belgium': 'EUR',
  'Austria': 'EUR',
  'Greece': 'EUR',
  'Ireland': 'EUR',
  'United Kingdom': 'GBP',
  'Switzerland': 'USD', // CHF not yet supported, use USD
  'Norway': 'USD', // NOK not yet supported, use USD
  'Sweden': 'USD', // SEK not yet supported, use USD
  'Denmark': 'USD', // DKK not yet supported, use USD

  // Asia
  'Japan': 'JPY',
  'China': 'CNY',
  'India': 'INR',
  'Thailand': 'THB',
  'Vietnam': 'VND',
  'Singapore': 'SGD',
  'Malaysia': 'USD', // MYR not yet supported, use USD
  'Indonesia': 'USD', // IDR not yet supported, use USD
  'Philippines': 'USD', // PHP not yet supported, use USD
  'South Korea': 'USD', // KRW not yet supported, use USD
  'Taiwan': 'USD', // TWD not yet supported, use USD

  // Oceania
  'Australia': 'AUD',
  'New Zealand': 'NZD',
  'Fiji': 'FJD',

  // South America
  'Brazil': 'USD', // BRL not yet supported, use USD
  'Argentina': 'USD', // ARS not yet supported, use USD
  'Chile': 'USD', // CLP not yet supported, use USD
  'Peru': 'USD', // PEN not yet supported, use USD
  'Colombia': 'USD', // COP not yet supported, use USD

  // Africa
  'South Africa': 'USD', // ZAR not yet supported, use USD
  'Egypt': 'USD', // EGP not yet supported, use USD
  'Morocco': 'USD', // MAD not yet supported, use USD
  'Kenya': 'USD', // KES not yet supported, use USD
  'Tanzania': 'USD', // TZS not yet supported, use USD

  // Middle East
  'United Arab Emirates': 'USD', // AED not yet supported, use USD
  'Saudi Arabia': 'USD', // SAR not yet supported, use USD
  'Israel': 'USD', // ILS not yet supported, use USD
  'Turkey': 'USD', // TRY not yet supported, use USD
};

/**
 * Gets the local currency for a given country
 * @param country - The country name
 * @returns The currency code (e.g., 'FJD', 'USD', 'EUR')
 */
export function getLocalCurrency(country: string): string {
  return COUNTRY_CURRENCY_MAP[country] || 'USD';
}

/**
 * Gets the local currency for a destination based on trip data
 * @param destinationId - The destination ID
 * @param locations - Array of trip locations
 * @returns The currency code for the destination's country
 */
export function getCurrencyForDestination(
  destinationId: string | number | null | undefined,
  locations: any[]
): string {
  if (!destinationId) return 'USD';

  const location = locations.find(loc => loc.id === destinationId);
  if (!location?.country) return 'USD';

  return getLocalCurrency(location.country);
}
