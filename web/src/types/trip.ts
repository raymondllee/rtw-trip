export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TripLocation {
  id: string | number | null;
  name: string;
  city?: string;
  country?: string;
  region?: string;
  arrival_date?: string;
  departure_date?: string;
  duration_days?: number;
  activity_type?: string;
  highlights?: string[];
  coordinates?: Coordinates;
  airport_code?: string;
  transport_from_previous?: string;
  transport_segments?: TransportSegment[];
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
