/**
 * Authoritative mapping of countries to geographic regions.
 *
 * This ensures consistent region assignment across all destinations,
 * resolving the issue where destinations appear in individual legs
 * but disappear when viewing regional or all destinations.
 *
 * Structure:
 * - continent: Top-level geographic division
 * - region: Specific sub-region for filtering (matches leg.regions)
 * - subregion: Alternative/additional regional classification
 */

export interface RegionMapping {
  continent: string;
  region: string;
  subregion?: string;
}

export const COUNTRY_TO_REGION: Record<string, RegionMapping> = {
  // East Asia
  'China': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' },
  'Japan': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' },
  'South Korea': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' },
  'North Korea': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' },
  'Taiwan': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' },
  'Mongolia': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' },
  'Hong Kong': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' },
  'Macau': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' },

  // Southeast Asia
  'Thailand': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },
  'Vietnam': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },
  'Malaysia': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },
  'Singapore': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },
  'Indonesia': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },
  'Philippines': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },
  'Myanmar': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },
  'Cambodia': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },
  'Laos': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },
  'Brunei': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },
  'Timor-Leste': { continent: 'Asia', region: 'Southeast Asia', subregion: 'South-Eastern Asia' },

  // South Asia
  'India': { continent: 'Asia', region: 'South Asia', subregion: 'Southern Asia' },
  'Pakistan': { continent: 'Asia', region: 'South Asia', subregion: 'Southern Asia' },
  'Bangladesh': { continent: 'Asia', region: 'South Asia', subregion: 'Southern Asia' },
  'Sri Lanka': { continent: 'Asia', region: 'South Asia', subregion: 'Southern Asia' },
  'Nepal': { continent: 'Asia', region: 'South Asia', subregion: 'Southern Asia' },
  'Bhutan': { continent: 'Asia', region: 'South Asia', subregion: 'Southern Asia' },
  'Maldives': { continent: 'Asia', region: 'South Asia', subregion: 'Southern Asia' },
  'Afghanistan': { continent: 'Asia', region: 'South Asia', subregion: 'Southern Asia' },

  // Central Asia
  'Kazakhstan': { continent: 'Asia', region: 'Central Asia', subregion: 'Central Asia' },
  'Uzbekistan': { continent: 'Asia', region: 'Central Asia', subregion: 'Central Asia' },
  'Turkmenistan': { continent: 'Asia', region: 'Central Asia', subregion: 'Central Asia' },
  'Kyrgyzstan': { continent: 'Asia', region: 'Central Asia', subregion: 'Central Asia' },
  'Tajikistan': { continent: 'Asia', region: 'Central Asia', subregion: 'Central Asia' },

  // Middle East / Western Asia
  'United Arab Emirates': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Saudi Arabia': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Israel': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Jordan': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Lebanon': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Syria': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Iraq': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Iran': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Kuwait': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Qatar': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Bahrain': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Oman': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Yemen': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Turkey': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Cyprus': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Armenia': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Azerbaijan': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },
  'Georgia': { continent: 'Asia', region: 'Middle East', subregion: 'Western Asia' },

  // Western Europe
  'United Kingdom': { continent: 'Europe', region: 'Western Europe', subregion: 'Northern Europe' },
  'Ireland': { continent: 'Europe', region: 'Western Europe', subregion: 'Northern Europe' },
  'France': { continent: 'Europe', region: 'Western Europe', subregion: 'Western Europe' },
  'Germany': { continent: 'Europe', region: 'Western Europe', subregion: 'Western Europe' },
  'Netherlands': { continent: 'Europe', region: 'Western Europe', subregion: 'Western Europe' },
  'Belgium': { continent: 'Europe', region: 'Western Europe', subregion: 'Western Europe' },
  'Luxembourg': { continent: 'Europe', region: 'Western Europe', subregion: 'Western Europe' },
  'Switzerland': { continent: 'Europe', region: 'Western Europe', subregion: 'Western Europe' },
  'Austria': { continent: 'Europe', region: 'Western Europe', subregion: 'Western Europe' },
  'Liechtenstein': { continent: 'Europe', region: 'Western Europe', subregion: 'Western Europe' },
  'Monaco': { continent: 'Europe', region: 'Western Europe', subregion: 'Western Europe' },

  // Southern Europe
  'Spain': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Portugal': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Italy': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Greece': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Croatia': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Slovenia': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Bosnia and Herzegovina': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Montenegro': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Albania': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'North Macedonia': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Serbia': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Malta': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'San Marino': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Vatican City': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },
  'Andorra': { continent: 'Europe', region: 'Southern Europe', subregion: 'Southern Europe' },

  // Northern Europe
  'Norway': { continent: 'Europe', region: 'Northern Europe', subregion: 'Northern Europe' },
  'Sweden': { continent: 'Europe', region: 'Northern Europe', subregion: 'Northern Europe' },
  'Finland': { continent: 'Europe', region: 'Northern Europe', subregion: 'Northern Europe' },
  'Denmark': { continent: 'Europe', region: 'Northern Europe', subregion: 'Northern Europe' },
  'Iceland': { continent: 'Europe', region: 'Northern Europe', subregion: 'Northern Europe' },
  'Estonia': { continent: 'Europe', region: 'Northern Europe', subregion: 'Northern Europe' },
  'Latvia': { continent: 'Europe', region: 'Northern Europe', subregion: 'Northern Europe' },
  'Lithuania': { continent: 'Europe', region: 'Northern Europe', subregion: 'Northern Europe' },

  // Eastern Europe
  'Poland': { continent: 'Europe', region: 'Eastern Europe', subregion: 'Eastern Europe' },
  'Czech Republic': { continent: 'Europe', region: 'Eastern Europe', subregion: 'Eastern Europe' },
  'Slovakia': { continent: 'Europe', region: 'Eastern Europe', subregion: 'Eastern Europe' },
  'Hungary': { continent: 'Europe', region: 'Eastern Europe', subregion: 'Eastern Europe' },
  'Romania': { continent: 'Europe', region: 'Eastern Europe', subregion: 'Eastern Europe' },
  'Bulgaria': { continent: 'Europe', region: 'Eastern Europe', subregion: 'Eastern Europe' },
  'Ukraine': { continent: 'Europe', region: 'Eastern Europe', subregion: 'Eastern Europe' },
  'Belarus': { continent: 'Europe', region: 'Eastern Europe', subregion: 'Eastern Europe' },
  'Moldova': { continent: 'Europe', region: 'Eastern Europe', subregion: 'Eastern Europe' },
  'Russia': { continent: 'Europe', region: 'Eastern Europe', subregion: 'Eastern Europe' },

  // North Africa
  'Egypt': { continent: 'Africa', region: 'North Africa', subregion: 'Northern Africa' },
  'Morocco': { continent: 'Africa', region: 'North Africa', subregion: 'Northern Africa' },
  'Algeria': { continent: 'Africa', region: 'North Africa', subregion: 'Northern Africa' },
  'Tunisia': { continent: 'Africa', region: 'North Africa', subregion: 'Northern Africa' },
  'Libya': { continent: 'Africa', region: 'North Africa', subregion: 'Northern Africa' },
  'Sudan': { continent: 'Africa', region: 'North Africa', subregion: 'Northern Africa' },

  // East Africa
  'Kenya': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Tanzania': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Uganda': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Rwanda': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Ethiopia': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Somalia': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Djibouti': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Eritrea': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'South Sudan': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Burundi': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Madagascar': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Mauritius': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Seychelles': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },
  'Comoros': { continent: 'Africa', region: 'East Africa', subregion: 'Eastern Africa' },

  // West Africa
  'Nigeria': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Ghana': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Senegal': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Ivory Coast': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  "Côte d'Ivoire": { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Benin': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Togo': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Burkina Faso': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Mali': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Niger': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Guinea': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Sierra Leone': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Liberia': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Mauritania': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Gambia': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Guinea-Bissau': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },
  'Cape Verde': { continent: 'Africa', region: 'West Africa', subregion: 'Western Africa' },

  // Southern Africa
  'South Africa': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },
  'Namibia': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },
  'Botswana': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },
  'Zimbabwe': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },
  'Zambia': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },
  'Mozambique': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },
  'Malawi': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },
  'Angola': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },
  'Lesotho': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },
  'Eswatini': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },
  'Swaziland': { continent: 'Africa', region: 'Southern Africa', subregion: 'Southern Africa' },

  // Central Africa
  'Democratic Republic of the Congo': { continent: 'Africa', region: 'Central Africa', subregion: 'Middle Africa' },
  'Republic of the Congo': { continent: 'Africa', region: 'Central Africa', subregion: 'Middle Africa' },
  'Cameroon': { continent: 'Africa', region: 'Central Africa', subregion: 'Middle Africa' },
  'Central African Republic': { continent: 'Africa', region: 'Central Africa', subregion: 'Middle Africa' },
  'Chad': { continent: 'Africa', region: 'Central Africa', subregion: 'Middle Africa' },
  'Gabon': { continent: 'Africa', region: 'Central Africa', subregion: 'Middle Africa' },
  'Equatorial Guinea': { continent: 'Africa', region: 'Central Africa', subregion: 'Middle Africa' },
  'São Tomé and Príncipe': { continent: 'Africa', region: 'Central Africa', subregion: 'Middle Africa' },

  // North America
  'United States': { continent: 'North America', region: 'North America', subregion: 'Northern America' },
  'USA': { continent: 'North America', region: 'North America', subregion: 'Northern America' }, // Alias for United States
  'Canada': { continent: 'North America', region: 'North America', subregion: 'Northern America' },
  'Mexico': { continent: 'North America', region: 'Central America', subregion: 'Central America' },
  'Guatemala': { continent: 'North America', region: 'Central America', subregion: 'Central America' },
  'Belize': { continent: 'North America', region: 'Central America', subregion: 'Central America' },
  'Honduras': { continent: 'North America', region: 'Central America', subregion: 'Central America' },
  'El Salvador': { continent: 'North America', region: 'Central America', subregion: 'Central America' },
  'Nicaragua': { continent: 'North America', region: 'Central America', subregion: 'Central America' },
  'Costa Rica': { continent: 'North America', region: 'Central America', subregion: 'Central America' },
  'Panama': { continent: 'North America', region: 'Central America', subregion: 'Central America' },

  // Caribbean
  'Jamaica': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Cuba': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Dominican Republic': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Haiti': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Puerto Rico': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Trinidad and Tobago': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Bahamas': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Barbados': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Saint Lucia': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Grenada': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Saint Vincent and the Grenadines': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Antigua and Barbuda': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Dominica': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },
  'Saint Kitts and Nevis': { continent: 'North America', region: 'Caribbean', subregion: 'Caribbean' },

  // South America
  'Brazil': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Argentina': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Chile': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Peru': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Colombia': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Venezuela': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Ecuador': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Bolivia': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Paraguay': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Uruguay': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Guyana': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'Suriname': { continent: 'South America', region: 'South America', subregion: 'South America' },
  'French Guiana': { continent: 'South America', region: 'South America', subregion: 'South America' },

  // Oceania - Australia & New Zealand
  'Australia': { continent: 'Oceania', region: 'Australia and New Zealand', subregion: 'Australia and New Zealand' },
  'New Zealand': { continent: 'Oceania', region: 'Australia and New Zealand', subregion: 'Australia and New Zealand' },

  // Oceania - Pacific Islands
  'Fiji': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Melanesia' },
  'Papua New Guinea': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Melanesia' },
  'Solomon Islands': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Melanesia' },
  'Vanuatu': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Melanesia' },
  'New Caledonia': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Melanesia' },
  'Samoa': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Polynesia' },
  'Tonga': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Polynesia' },
  'Tuvalu': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Polynesia' },
  'French Polynesia': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Polynesia' },
  'Cook Islands': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Polynesia' },
  'Kiribati': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Micronesia' },
  'Marshall Islands': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Micronesia' },
  'Micronesia': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Micronesia' },
  'Palau': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Micronesia' },
  'Nauru': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Micronesia' },
  'Northern Mariana Islands': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Micronesia' },
  'Guam': { continent: 'Oceania', region: 'Pacific Islands', subregion: 'Micronesia' },
};

/**
 * Get region information for a country.
 * Returns null if country not found in mapping.
 */
export function getRegionForCountry(country: string): RegionMapping | null {
  // Try exact match first
  if (COUNTRY_TO_REGION[country]) {
    return COUNTRY_TO_REGION[country];
  }

  // Try case-insensitive match
  const lowerCountry = country.toLowerCase();
  for (const [key, value] of Object.entries(COUNTRY_TO_REGION)) {
    if (key.toLowerCase() === lowerCountry) {
      return value;
    }
  }

  return null;
}

/**
 * Get all countries in a specific region.
 */
export function getCountriesInRegion(region: string): string[] {
  return Object.entries(COUNTRY_TO_REGION)
    .filter(([_, mapping]) => mapping.region === region)
    .map(([country, _]) => country);
}

/**
 * Get all unique regions.
 */
export function getAllRegions(): string[] {
  const regions = new Set<string>();
  Object.values(COUNTRY_TO_REGION).forEach(mapping => regions.add(mapping.region));
  return Array.from(regions).sort();
}

/**
 * Get all unique continents.
 */
export function getAllContinents(): string[] {
  const continents = new Set<string>();
  Object.values(COUNTRY_TO_REGION).forEach(mapping => continents.add(mapping.continent));
  return Array.from(continents).sort();
}

/**
 * Validate if a country has a region mapping.
 */
export function hasRegionMapping(country: string): boolean {
  return getRegionForCountry(country) !== null;
}
