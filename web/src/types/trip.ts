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

export interface PricingModel {
  type: 'fixed' | 'per_day' | 'per_night' | 'per_person_day' | 'per_person_night' | 'custom';
  base_unit?: 'day' | 'night' | 'week' | 'month';
  scales_with_duration?: boolean;
  scales_with_travelers?: boolean;
  minimum_charge?: number;
  custom_formula?: string;
}

export interface CostChangeEvent {
  timestamp: string;
  changed_by: string;  // user_id or 'ai_research' or 'system'
  previous_value: Partial<TripCost>;
  new_value: Partial<TripCost>;
  change_reason?: string;  // 'price_update', 'research', 'booking_confirmed', 'user_edit'
  fields_changed: string[];
}

export interface CostHistory {
  cost_id: string;
  changes: CostChangeEvent[];
  created_at: string;
  updated_at: string;
}

export interface TripCost {
  id: string;
  category: string;
  amount: number;
  currency?: string;
  destinationId?: string | number;
  destination_id?: string | number;  // Support both naming conventions
  notes?: string;
  description?: string;

  // Pricing model configuration (Recommendation G)
  pricing_model?: PricingModel;

  // Cost history (Recommendation F)
  history?: CostChangeEvent[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  last_modified_by?: string;

  // Legacy/fallback fields for duration scaling
  scale_with_duration?: boolean;
  duration_invariant?: boolean;
  duration_sensitive?: boolean;
  amount_per_day?: number;
  daily_rate?: number;
  unit?: string;
  time_unit?: string;
  period?: string;

  [key: string]: unknown;
}

export interface TripTransportCost {
  fromDestinationId: string | number | null;
  toDestinationId: string | number | null;
  mode: string;
  cost: number;
  distanceMeters?: number;
}

export interface BudgetAlert {
  type: 'info' | 'warning' | 'exceeded';
  category?: string;
  destination?: string;
  current_spend: number;
  budget_amount: number;
  over_by?: number;
  percentage: number;
  message: string;
}

export interface TripBudget {
  total_budget_usd: number;
  budgets_by_category: Record<string, number>;
  budgets_by_destination: Record<string, number>;
  contingency_pct: number;  // e.g., 10% buffer
  alerts: BudgetAlert[];
  created_at?: string;
  updated_at?: string;
}

export interface TripData {
  locations: TripLocation[];
  legs: TripLeg[];
  costs: TripCost[];
  countryNotes?: Record<string, string>;
  budget?: TripBudget;
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
