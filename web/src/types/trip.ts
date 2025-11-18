export interface Coordinates {
  lat: number;
  lng: number;
}

// Learning moment - educational opportunities at a location
export interface LearningMoment {
  id?: string;
  subject: 'science' | 'social_studies' | 'language_arts' | 'art' | 'music' | 'history' | 'geography' | 'culture' | 'general';
  title: string;
  description: string;
  type: 'site_visit' | 'activity' | 'experience' | 'observation' | 'interaction' | 'research';
  location?: string;  // Specific site/museum/place within the destination
  estimated_duration_minutes?: number;
  estimated_cost_usd?: number;
  age_appropriate_min?: number;  // Minimum age
  age_appropriate_max?: number;  // Maximum age
  standards_addressed?: string[];  // e.g., ["CA-NGSS-MS-LS2-1"]
  tags?: string[];  // e.g., ["hands-on", "outdoor", "museum", "guided"]
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
  learning_moments?: LearningMoment[];  // Educational opportunities at this location
  airport_code?: string;
  transport_from_previous?: string;
  transport_segments?: TransportSegment[];

  // Places API metadata
  coordinates?: Coordinates;
  display_coordinates?: Coordinates; // Override for map display (e.g., Antarctica shows at Peninsula, not Ushuaia)
  place_id?: string;               // Google Place ID (e.g., "ChIJ...")
  place_data?: PlaceData;          // Full Places API response
  timezone?: string;               // IANA timezone (e.g., "Asia/Tokyo")
  data_source?: 'autocomplete' | 'text_search' | 'geocoding' | 'manual'; // Track where data came from

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

export type CostCategory =
  | 'flight'
  | 'accommodation'
  | 'activity'
  | 'food'
  | 'transport'
  | 'education'           // Educational materials and activities
  | 'educational_materials'  // Books, subscriptions, apps, resources
  | 'educational_activities' // Museum admissions, tours, classes, workshops
  | 'other';

export interface TripCost {
  id: string;
  category: CostCategory | string;  // Allow string for backwards compatibility
  amount: number;
  currency?: string;
  destinationId?: string | number;
  notes?: string;
  description?: string;
  booking_status?: 'estimated' | 'researched' | 'booked' | 'paid';
  source?: 'manual' | 'ai_estimate' | 'web_research' | 'booking_api';
  amount_usd?: number;  // Cost converted to USD
  date?: string;  // YYYY-MM-DD
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
  countryNotes?: Record<string, string>;
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
