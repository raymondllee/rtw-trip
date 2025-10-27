# Geographic Data Normalization

## Problem Statement

Destinations were disappearing when switching between different views (leg view, sub-leg view, all destinations) due to inconsistent geographic data fields.

### Root Cause
- **Leg view** filters by `location.region` field
- **Sub-leg view** filters by `location.country` field
- **All destinations** shows everything (no filtering)

If a destination was missing either `country` or `region`, it would:
- ✅ Show in "All destinations" (no filtering)
- ❌ Disappear in leg view (if missing `region`)
- ❌ Disappear in sub-leg view (if missing `country`)

## Solution Implemented

### 1. Authoritative Region Mapping
**File:** `web/src/data/regionMappings.ts`

Created comprehensive mapping of countries → regions covering:
- 240+ countries worldwide
- Hierarchical structure: Country → Continent → Region → Subregion
- Consistent naming (e.g., "China" always maps to "East Asia")

```typescript
{
  'China': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' },
  'Japan': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' },
  // ... all countries
}
```

Helper functions:
- `getRegionForCountry(country)` - Get region for a country
- `getCountriesInRegion(region)` - Get all countries in a region
- `getAllRegions()` - Get list of all regions
- `hasRegionMapping(country)` - Check if country is mapped

### 2. Enhanced TypeScript Types
**File:** `web/src/types/trip.ts`

Updated `TripLocation` interface to require geographic fields:

```typescript
export interface TripLocation {
  // REQUIRED fields for filtering
  country: string;                 // From Places API
  region: string;                  // Derived from country mapping

  // Optional but recommended
  city?: string;
  administrative_area?: string;
  country_code?: string;           // ISO 3166-1 alpha-2
  continent?: string;

  // ... other fields
}
```

### 3. Enhanced Backend API
**File:** `python/agents/travel-concierge/travel_concierge/tools/place_resolver.py`

Updated `_parse_address_components()` to extract:
- `country` (long_name: "Japan")
- `country_code` (short_name: "JP")
- `city` (locality)
- `administrative_area` (state/province)

Updated `get_place_details()` to:
- Include country_code in response
- Fetch timezone for coordinates
- Return complete geographic hierarchy

### 4. Data Enrichment Utility
**File:** `web/src/utils/dataEnrichment.ts`

Created utilities to:
- **Enrich individual destination**: Fetch missing country from Places API, derive region from mapping
- **Enrich all destinations**: Batch process with progress tracking
- **Validate destinations**: Check for missing/invalid geographic data
- **Generate reports**: Human-readable validation and enrichment reports

Functions:
```typescript
enrichDestination(location, options) → { enriched, location, message }
enrichAllDestinations(tripData, options) → EnrichmentReport
validateDestinations(tripData) → ValidationResult
```

### 5. Updated Filtering Logic
**File:** `web/src/app/initMapApp.ts`

Enhanced filtering with validation warnings:

```typescript
function filterByLeg(data, legName) {
  return locations.filter(location => {
    if (!location.region) {
      console.warn(`Location "${location.name}" missing region - won't appear in leg view`);
      return false;
    }
    return legRegions.includes(location.region);
  });
}

function filterBySubLeg(data, legName, subLegName) {
  return locations.filter(location => {
    if (!location.country) {
      console.warn(`Location "${location.name}" missing country - won't appear in sub-leg view`);
      return false;
    }
    return subLegCountries.includes(location.country);
  });
}
```

### 6. Updated Add Destination Flow
**File:** `web/src/app/initMapApp.ts`

Modified `addNewDestination()` to:
1. **Get country from Places API** (REQUIRED)
2. **Derive region from country** using authoritative mapping
3. **Block addition** if country cannot be determined
4. Store complete geographic hierarchy including:
   - country, country_code, city, administrative_area
   - region, continent (derived)
   - timezone (from Places API)

### 7. Data Validation UI
**File:** `web/src/dataValidationUi.ts`

Created comprehensive validation panel:
- **Summary cards**: Show counts of valid/invalid destinations
- **Auto-fix button**: Enriches missing data from Places API
- **Validation details**: Lists destinations missing country/region
- **Warning banner**: Shows on app load if issues detected
- **Progress tracking**: Real-time progress during enrichment

**File:** `web/index.html`

Added menu item:
```html
<button id="geo-validation-btn" class="dropdown-item">
  <span class="icon">🌍</span>
  <span>Geographic Data</span>
  <span id="geo-validation-badge"></span>
</button>
```

## How It Works

### Data Flow for New Destinations

1. User searches for location (e.g., "Tokyo, Japan")
2. Google Places API returns:
   - `place_id`
   - `address_components` including country: "Japan"
   - Coordinates, timezone, etc.
3. Backend enriches with full details
4. Frontend:
   - Extracts `country = "Japan"` from API response
   - Looks up `getRegionForCountry("Japan")` → `{ continent: "Asia", region: "East Asia" }`
   - Creates destination with complete hierarchy
5. Destination saved with both `country` and `region`

### Data Flow for Existing Destinations

1. User clicks "Geographic Data" in menu
2. Validation checks all destinations:
   - Missing country?
   - Missing region?
   - Unmapped country?
3. If issues found:
   - Shows warning banner
   - Badge shows ⚠️
4. User clicks "Auto-Fix Missing Data"
5. For each destination:
   - If has `place_id`: Fetch details from Places API → extract country
   - If has `country`: Derive region from mapping
   - Update destination in-place
6. Report shows what was enriched/failed

## Expected Behavior After Normalization

### ✅ China Leg View
Filters by `location.region === "East Asia"` or `"Southeast Asia"`
- Shows: All destinations with matching regions
- Example: Beijing, Shanghai, Guilin (all have `region: "East Asia"`)

### ✅ "All Asia" Sub-leg View
Filters by `location.country` in sub-leg's countries array
- Shows: All destinations where country is in ["China", "Japan", "Thailand", ...]
- Example: Beijing (`country: "China"`), Tokyo (`country: "Japan"`)

### ✅ All Destinations View
No filtering - shows everything

## Files Modified

### Created
- `web/src/data/regionMappings.ts` - Country → region authoritative mapping
- `web/src/utils/dataEnrichment.ts` - Enrichment and validation utilities
- `web/src/dataValidationUi.ts` - Validation UI components

### Modified
- `web/src/types/trip.ts` - Made country/region required in TripLocation interface
- `web/src/app/initMapApp.ts` - Enhanced filtering, updated addNewDestination(), integrated validation UI
- `web/index.html` - Added geographic validation menu item
- `python/agents/travel-concierge/travel_concierge/tools/place_resolver.py` - Enhanced to return country_code and timezone

## Usage

### For Users

1. **Check validation status**:
   - Look at badge next to "Geographic Data" menu item
   - ✓ = All good, ⚠️ = Issues detected

2. **Fix issues**:
   - Click "Geographic Data" in menu
   - Review missing data
   - Click "Auto-Fix Missing Data"
   - Wait for enrichment to complete
   - Save scenario

3. **Add new destinations**:
   - Search for location
   - App automatically derives region from country
   - If country can't be determined, addition is blocked

### For Developers

#### Validate data programmatically:
```typescript
import { validateDestinations } from './utils/dataEnrichment';

const validation = validateDestinations(tripData);
console.log(`Valid: ${validation.valid}, Missing country: ${validation.missingCountry}`);
```

#### Enrich data programmatically:
```typescript
import { enrichAllDestinations } from './utils/dataEnrichment';

const report = await enrichAllDestinations(tripData, {
  forceRefresh: false,
  onProgress: (pct, current) => console.log(`${pct}%: ${current}`)
});
```

#### Add new country to mapping:
```typescript
// web/src/data/regionMappings.ts
export const COUNTRY_TO_REGION: Record<string, RegionMapping> = {
  // ... existing mappings
  'New Country': { continent: 'Asia', region: 'East Asia', subregion: 'Eastern Asia' }
};
```

## Benefits

1. **Consistent Filtering**: Destinations always have required fields
2. **No More Disappearing**: Same destinations show in all relevant views
3. **Authoritative Source**: Single source of truth for country → region mapping
4. **Automatic Enrichment**: Places API + mapping = complete data
5. **User-Friendly**: Clear UI for validating and fixing issues
6. **Developer-Friendly**: Validation warnings in console, type safety

## Migration Path

For existing scenarios with incomplete data:

1. Open scenario
2. If banner appears, click "Fix Now"
3. Or manually: Menu → Geographic Data → Auto-Fix Missing Data
4. Review enrichment report
5. Save scenario

All changes are non-destructive - original data preserved in legacy fields.

## Technical Notes

### Why Both country AND region?

- **country**: Specific (e.g., "Japan") - used for sub-leg filtering
- **region**: Broader grouping (e.g., "East Asia") - used for leg filtering

Can't use just country because:
- Legs group multiple countries (e.g., "China leg" includes Vietnam stops)
- Need broader classification than individual countries

Can't use just region because:
- Sub-legs need country-specific filtering
- Places API returns country, not region
- Users think in terms of countries, not regions

### Why Authoritative Mapping?

Alternative approaches considered:
1. ❌ Let users assign regions manually → Inconsistent, error-prone
2. ❌ Derive from Places API types → Google doesn't return "East Asia"
3. ✅ **Authoritative mapping** → Consistent, validated, single source of truth

### Performance

- Region lookup: O(1) hash map lookup
- Enrichment: Network-bound (Places API calls)
- Validation: O(n) scan through destinations
- UI updates: Debounced, non-blocking

## Future Enhancements

1. **Firestore cache** for Places API responses (reduce API costs)
2. **Bulk enrichment** on scenario import
3. **Region suggestions** based on neighboring destinations
4. **Custom regions** for users with different groupings
5. **Conflict detection** if country mapping changes
