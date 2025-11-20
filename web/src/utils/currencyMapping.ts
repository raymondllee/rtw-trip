/**
 * Maps countries to their local currencies
 */
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // North America
  'United States': 'USD',
  'USA': 'USD', // Alias for United States
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
  'Switzerland': 'CHF',
  'Norway': 'NOK',
  'Sweden': 'SEK',
  'Denmark': 'DKK',

  // Asia
  'Japan': 'JPY',
  'China': 'CNY',
  'India': 'INR',
  'Thailand': 'THB',
  'Vietnam': 'VND',
  'Singapore': 'SGD',
  'Malaysia': 'MYR',
  'Indonesia': 'IDR',
  'Philippines': 'PHP',
  'South Korea': 'KRW',
  'Taiwan': 'TWD',
  'Bhutan': 'BTN',
  'Nepal': 'NPR',

  // Oceania
  'Australia': 'AUD',
  'New Zealand': 'NZD',
  'Fiji': 'FJD',

  // South America
  'Brazil': 'BRL',
  'Argentina': 'ARS',
  'Chile': 'CLP',
  'Peru': 'PEN',
  'Colombia': 'COP',

  // Africa
  'South Africa': 'ZAR',
  'Egypt': 'EGP',
  'Morocco': 'MAD',
  'Kenya': 'KES',
  'Tanzania': 'TZS',
  'Namibia': 'NAD',
  'Madagascar': 'MGA',

  // Middle East
  'United Arab Emirates': 'AED',
  'Saudi Arabia': 'SAR',
  'Israel': 'ILS',
  'Turkey': 'TRY',

  // Antarctica
  'Antarctica': 'USD', // No official currency, USD commonly used for logistics
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
