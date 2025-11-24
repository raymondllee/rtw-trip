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
  curriculum_plan_ids?: string[];  // IDs of curriculum plans generated for this location
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
  category: CostCategory | string;  // Allow string for backwards compatibility
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

  // Additional metadata from main branch
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
  budgets_by_country: Record<string, number>;
  contingency_pct: number;  // e.g., 10% buffer
  alerts: BudgetAlert[];
  created_at?: string;
  updated_at?: string;
  // Notes for budget line items and groups
  category_notes?: Record<string, string>;  // Notes per category
  country_notes?: Record<string, string>;   // Notes per country
  category_group_note?: string;             // Note for entire category section
  country_group_note?: string;              // Note for entire country section
}

export interface TripData {
  locations: TripLocation[];
  legs: TripLeg[];
  costs: TripCost[];
  transport_segments?: TransportSegment[];  // Inter-destination transport
  countryNotes?: Record<string, string>;
  budget?: TripBudget;
  num_travelers?: number;  // Number of travelers (default: 1)
  traveler_composition?: {  // Optional detailed breakdown
    adults: number;
    children: number;
    ages?: number[];
  };
  traveler_ids?: string[]; // IDs of selected wellness users
  accommodation_preference?: 'budget' | 'mid-range' | 'higher-end' | 'luxurious';  // Accommodation preference for cost estimation
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
  id?: string;
  from_destination_id?: string | number;
  from_destination_name?: string;
  to_destination_id?: string | number;
  to_destination_name?: string;
  transport_mode?: string;
  transport_mode_icon?: string;
  distance_km?: number;
  duration_hours?: number;

  // Cost fields (prioritized: actual > researched_mid > estimated)
  estimated_cost_usd?: number;
  researched_cost_low?: number;
  researched_cost_mid?: number;
  researched_cost_high?: number;
  actual_cost_usd?: number;
  currency_local?: string;
  amount_local?: number;

  // Booking and research metadata
  booking_status?: 'estimated' | 'researched' | 'booked' | 'paid' | 'completed';
  research_sources?: string[];
  research_notes?: string;
  researched_at?: string;
  confidence_level?: 'high' | 'medium' | 'low';

  // Flight-specific details
  researched_airlines?: string[];
  researched_duration_hours?: number;
  researched_stops?: number;
  alternatives?: any[];
  researched_alternatives?: any[];

  // Additional fields
  auto_updated?: boolean;
  booking_link?: string;
  booking_reference?: string;
  notes?: string;
  num_travelers?: number;
  created_at?: string;
  updated_at?: string;

  // Legacy fields
  mode?: string;
  cost?: number;
  researched_low?: number;
  researched_high?: number;
  vendor_name?: string;
  vendor_url?: string;
}
