export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TripLocation {
  // Primary identifiers
  id: string | number | null;
  name: string;

  // Geographic hierarchy (REQUIRED for proper filtering)
  // These fields are populated from Google Places API + region mappings
  country: string;                 // REQUIRED: Official country name from Places API
  region: string;                  // REQUIRED: Geographic region for filtering (e.g., "East Asia")
  city?: string;                   // City/locality from Places API
  administrative_area?: string;    // State/province from Places API
  country_code?: string;           // ISO 3166-1 alpha-2 code (e.g., "JP" for Japan)
  continent?: string;              // Continent (e.g., "Asia")

  // Trip planning details
  arrival_date?: string;
  departure_date?: string;
  duration_days?: number;
  activity_type?: string;
  highlights?: string[];
  airport_code?: string;
  transport_from_previous?: string;
  transport_segments?: TransportSegment[];

  // Places API metadata
  coordinates?: Coordinates;
  place_id?: string;               // Google Place ID (e.g., "ChIJ...")
  place_data?: PlaceData;          // Full Places API response
  timezone?: string;               // IANA timezone (e.g., "Asia/Tokyo")

  // Migration/legacy support
  _legacy_id?: string | number;
  _legacy_uuid?: string;
  _migrated_at?: string;
  _migration_source?: string;

  // Allow additional fields
  [key: string]: unknown;
}

export interface PlaceData {
  formatted_address?: string;
  types?: string[];
  country?: string;
  city?: string;
  administrative_area?: string;
  timezone?: string;
  [key: string]: unknown;
}

export interface TripSubLeg {
  name: string;
  countries?: string[];
  start_date?: string;
  end_date?: string;
}

export interface TripLeg {
  name: string;
  regions?: string[];
  sub_legs?: TripSubLeg[];
  start_date?: string;
  end_date?: string;
}

export interface TripCost {
  id: string;
  category: string;
  amount: number;
  currency?: string;
  destinationId?: string | number;
  notes?: string;
  [key: string]: unknown;
}

export interface TripTransportCost {
  fromDestinationId: string | number | null;
  toDestinationId: string | number | null;
  mode: string;
  cost: number;
  distanceMeters?: number;
}

export interface TripData {
  locations: TripLocation[];
  legs: TripLeg[];
  costs: TripCost[];
}

export interface TripScenarioVersion {
  id: string;
  versionNumber: number;
  versionName?: string;
  itineraryData: TripData;
  itineraryDataHash?: string;
  createdAt: Date;
  isNamed?: boolean;
  isAutosave?: boolean;
}

export interface TransportSegment {
  mode: string;
  cost?: number;
  researched_low?: number;
  researched_high?: number;
  vendor_name?: string;
  vendor_url?: string;
  notes?: string;
}
