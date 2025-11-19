# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Common data schema and types for travel-concierge agents."""

from typing import Any, Dict, Optional, Union

from google.genai import types
from pydantic import BaseModel, Field


# Convenient declaration for controlled generation.
json_response_config = types.GenerateContentConfig(
    response_mime_type="application/json"
)


class Room(BaseModel):
    """A room for selection."""
    is_available: bool = Field(
        description="Whether the room type is available for selection."
    )
    price_in_usd: int = Field(description="The cost of the room selection.")
    room_type: str = Field(
        description="Type of room, e.g. Twin with Balcon, King with Ocean View... etc."
    )


class RoomsSelection(BaseModel):
    """A list of rooms for selection."""
    rooms: list[Room]


class Hotel(BaseModel):
    """A hotel from the search."""
    name: str = Field(description="Name of the hotel")
    address: str = Field(description="Full address of the Hotel")
    check_in_time: str = Field(description="Time in HH:MM format, e.g. 16:00")
    check_out_time: str = Field(description="Time in HH:MM format, e.g. 15:30")
    thumbnail: str = Field(description="Hotel logo location")
    price: int = Field(description="Price of the room per night")


class HotelsSelection(BaseModel):
    """A list of hotels from the search."""
    hotels: list[Hotel]


class Seat(BaseModel):
    """A Seat from the search."""
    is_available: bool = Field(
        description="Whether the seat is available for selection."
    )
    price_in_usd: int = Field(description="The cost of the seat selection.")
    seat_number: str = Field(description="Seat number, e.g. 22A, 34F... etc.")


class SeatsSelection(BaseModel):
    """A list of seats from the search."""
    seats: list[list[Seat]]


class AirportEvent(BaseModel):
    """An Airport event."""
    city_name: str = Field(description="Name of the departure city")
    airport_code: str = Field(description="IATA code of the departure airport")
    timestamp: str = Field(description="ISO 8601 departure or arrival date and time")


class Flight(BaseModel):
    """A Flight search result."""
    flight_number: str = Field(
        description="Unique identifier for the flight, like BA123, AA31, etc."
    )
    departure: AirportEvent
    arrival: AirportEvent
    airlines: list[str] = Field(
        description="Airline names, e.g., American Airlines, Emirates"
    )
    airline_logo: str = Field(description="Airline logo location")
    price_in_usd: int = Field(description="Flight price in US dollars")
    number_of_stops: int = Field(description="Number of stops during the flight")


class FlightsSelection(BaseModel):
    """A list of flights from the search."""
    flights: list[Flight]


class Destination(BaseModel):
    """A destination recommendation."""
    name: str = Field(description="A Destination's Name")
    country: str = Field(description="The Destination's Country Name")
    image: str = Field(description="verified URL to an image of the destination")
    highlights: str = Field(description="Short description highlighting key features")
    rating: str = Field(description="Numerical rating (e.g., 4.5)")


class DestinationIdeas(BaseModel):
    """Destinations recommendation."""
    places: list[Destination]


class POI(BaseModel):
    """A Point Of Interest suggested by the agent."""
    place_name: str = Field(description="Name of the attraction")
    address: str = Field(
        description="An address or sufficient information to geocode for a Lat/Lon"
    )
    lat: str = Field(
        description="Numerical representation of Latitude of the location (e.g., 20.6843)"
    )
    long: str = Field(
        description="Numerical representation of Longitude of the location (e.g., -88.5678)"
    )
    review_ratings: str = Field(
        description="Numerical representation of rating (e.g. 4.8 , 3.0 , 1.0 etc)"
    )
    highlights: str = Field(description="Short description highlighting key features")
    image_url: str = Field(description="verified URL to an image of the destination")
    map_url: Optional[str] = Field(description="Verified URL to Google Map")
    place_id: Optional[str] = Field(description="Google Map place_id")


class POISuggestions(BaseModel):
    """Points of interest recommendation."""
    places: list[POI]


class LearningMoment(BaseModel):
    """
    Educational opportunity at a destination.

    Represents a specific learning experience, activity, or site visit
    that provides educational value for students during travel.
    """
    id: Optional[str] = Field(
        default=None,
        description="Unique identifier for the learning moment"
    )
    subject: str = Field(
        description="Academic subject: 'science', 'social_studies', 'language_arts', 'art', 'music', 'history', 'geography', 'culture', 'general'"
    )
    title: str = Field(description="Title of the learning moment")
    description: str = Field(description="Detailed description of the educational experience")
    type: str = Field(
        description="Type of learning: 'site_visit', 'activity', 'experience', 'observation', 'interaction', 'research'"
    )
    location: Optional[str] = Field(
        default=None,
        description="Specific site/museum/place within the destination"
    )
    estimated_duration_minutes: Optional[int] = Field(
        default=None,
        description="Expected duration in minutes"
    )
    estimated_cost_usd: Optional[float] = Field(
        default=None,
        description="Estimated cost in USD (admission, materials, etc.)"
    )
    age_appropriate_min: Optional[int] = Field(
        default=None,
        description="Minimum age for appropriateness"
    )
    age_appropriate_max: Optional[int] = Field(
        default=None,
        description="Maximum age for appropriateness"
    )
    standards_addressed: Optional[list[str]] = Field(
        default=None,
        description="Educational standards addressed (e.g., CA-NGSS-MS-LS2-1)"
    )
    tags: Optional[list[str]] = Field(
        default=None,
        description="Tags for categorization (e.g., hands-on, outdoor, museum, guided)"
    )


class AttractionEvent(BaseModel):
    """An Attraction."""
    event_type: str = Field(default="visit")
    description: str = Field(
        description="A title or description of the activity or the attraction visit"
    )
    address: str = Field(description="Full address of the attraction")
    start_time: str = Field(description="Time in HH:MM format, e.g. 16:00")
    end_time: str = Field(description="Time in HH:MM format, e.g. 16:00")
    booking_required: bool = Field(default=False)
    price: Optional[str] = Field(description="Some events may cost money")


class FlightEvent(BaseModel):
    """A Flight Segment in the itinerary."""
    event_type: str = Field(default="flight")
    description: str = Field(description="A title or description of the Flight")
    booking_required: bool = Field(default=True)
    departure_airport: str = Field(description="Airport code, i.e. SEA")
    arrival_airport: str = Field(description="Airport code, i.e. SAN")
    flight_number: str = Field(description="Flight number, e.g. UA5678")
    boarding_time: str = Field(description="Time in HH:MM format, e.g. 15:30")
    seat_number: str = Field(description="Seat Row and Position, e.g. 32A")
    departure_time: str = Field(description="Time in HH:MM format, e.g. 16:00")
    arrival_time: str = Field(description="Time in HH:MM format, e.g. 20:00")
    price: Optional[str] = Field(description="Total air fare")
    booking_id: Optional[str] = Field(
        description="Booking Reference ID, e.g LMN-012-STU"
    )


class HotelEvent(BaseModel):
    """A Hotel Booking in the itinerary."""
    event_type: str = Field(default="hotel")
    description: str = Field(description="A name, title or a description of the hotel")
    address: str = Field(description="Full address of the attraction")
    check_in_time: str = Field(description="Time in HH:MM format, e.g. 16:00")
    check_out_time: str = Field(description="Time in HH:MM format, e.g. 15:30")
    room_selection: str = Field()
    booking_required: bool = Field(default=True)
    price: Optional[str] = Field(description="Total hotel price including all nights")
    booking_id: Optional[str] = Field(
        description="Booking Reference ID, e.g ABCD12345678"
    )


class ItineraryDay(BaseModel):
    """A single day of events in the itinerary."""
    day_number: int = Field(
        description="Identify which day of the trip this represents, e.g. 1, 2, 3... etc."
    )
    date: str = Field(description="The Date this day YYYY-MM-DD format")
    events: list[Union[FlightEvent, HotelEvent, AttractionEvent]] = Field(
        default=[], description="The list of events for the day"
    )


class Itinerary(BaseModel):
    """A multi-day itinerary."""
    trip_name: str = Field(
        description="Simple one liner to describe the trip. e.g. 'San Diego to Seattle Getaway'"
    )
    start_date: str = Field(description="Trip Start Date in YYYY-MM-DD format")
    end_date: str = Field(description="Trip End Date in YYYY-MM-DD format")
    origin: str = Field(description="Trip Origin, e.g. San Diego")
    destination: str = Field(description="Trip Destination, e.g. Seattle")
    days: list[ItineraryDay] = Field(
        default_factory=list, description="The multi-days itinerary"
    )


class UserProfile(BaseModel):
    """An example user profile."""
    allergies: list[str] = Field(
        default=[], description="A list of food allergies to avoid"
    )
    diet_preference: list[str] = Field(
        default=[], description="Vegetarian, Vegan... etc."
    )
    passport_nationality: str = Field(
        description="Nationality of traveler, e.g. US Citizen"
    )
    home_address: str = Field(description="Home address of traveler")
    home_transit_preference: str = Field(
        description="Preferred mode of transport around home, e.g. drive"
    )


class PackingList(BaseModel):
    """A list of things to pack for the trip."""
    items: list[str]


class CostChangeEvent(BaseModel):
    """A single change event in cost history (Recommendation F)."""
    timestamp: str = Field(description="ISO 8601 timestamp of the change")
    changed_by: str = Field(
        description="User ID or 'ai_research' or 'system'"
    )
    previous_value: Dict[str, Any] = Field(
        description="Previous values of changed fields"
    )
    new_value: Dict[str, Any] = Field(
        description="New values of changed fields"
    )
    change_reason: Optional[str] = Field(
        default=None,
        description="Reason: 'price_update', 'research', 'booking_confirmed', 'user_edit'"
    )
    fields_changed: list[str] = Field(
        description="List of field names that were changed"
    )


class CostHistory(BaseModel):
    """Complete history of changes to a cost item (Recommendation F)."""
    cost_id: str = Field(description="ID of the cost item")
    changes: list[CostChangeEvent] = Field(
        default_factory=list,
        description="List of change events in chronological order"
    )
    created_at: str = Field(description="ISO 8601 timestamp of cost creation")
    updated_at: str = Field(description="ISO 8601 timestamp of last update")


class PricingModel(BaseModel):
    """Pricing model configuration for cost items (Recommendation G)."""
    type: str = Field(
        default="fixed",
        description="Pricing type: 'fixed', 'per_day', 'per_night', 'per_person_day', 'per_person_night', 'custom'"
    )
    base_unit: Optional[str] = Field(
        default=None,
        description="Base time unit: 'day', 'night', 'week', 'month'"
    )
    scales_with_duration: Optional[bool] = Field(
        default=None,
        description="Whether cost scales with duration changes"
    )
    scales_with_travelers: Optional[bool] = Field(
        default=None,
        description="Whether cost scales with number of travelers"
    )
    minimum_charge: Optional[float] = Field(
        default=None,
        description="Minimum charge regardless of duration"
    )
    custom_formula: Optional[str] = Field(
        default=None,
        description="Custom formula for cost calculation (e.g., 'base + (days * daily_rate)')"
    )


class CostItem(BaseModel):
    """A single cost item for trip budgeting and tracking."""
    id: str = Field(description="Unique identifier for the cost item")
    category: str = Field(
        description="Cost category: 'flight', 'accommodation', 'activity', 'food', 'transport', 'education', 'educational_materials', 'educational_activities', 'other'"
    )
    description: str = Field(description="Description of the cost item")
    amount: float = Field(description="Cost amount in the original currency")
    currency: str = Field(
        description="ISO 4217 currency code, e.g., USD, EUR, JPY, GBP"
    )
    amount_usd: float = Field(
        description="Cost amount converted to USD for aggregation"
    )
    date: str = Field(description="Date of expense in YYYY-MM-DD format")
    destination_id: Optional[str] = Field(
        default=None, description="ID of the associated destination/location"
    )
    booking_status: str = Field(
        default="estimated",
        description="Status: 'estimated', 'researched', 'booked', 'paid'"
    )
    source: str = Field(
        default="manual",
        description="Source: 'manual', 'ai_estimate', 'web_research', 'booking_api'"
    )
    notes: Optional[str] = Field(default=None, description="Additional notes")

    # Pricing model configuration (Recommendation G)
    pricing_model: Optional[PricingModel] = Field(
        default=None,
        description="Explicit pricing model configuration for duration scaling"
    )

    # Cost history (Recommendation F)
    history: Optional[list[CostChangeEvent]] = Field(
        default=None,
        description="History of changes to this cost item"
    )
    created_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp of cost creation"
    )
    updated_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp of last update"
    )
    created_by: Optional[str] = Field(
        default=None,
        description="User ID or 'ai_research' or 'system'"
    )
    last_modified_by: Optional[str] = Field(
        default=None,
        description="User ID or 'ai_research' or 'system'"
    )


class CostsByCategory(BaseModel):
    """Cost breakdown by category."""
    flight: float = Field(default=0.0, description="Total flight costs in USD")
    accommodation: float = Field(default=0.0, description="Total accommodation costs in USD")
    activity: float = Field(default=0.0, description="Total activity costs in USD")
    food: float = Field(default=0.0, description="Total food costs in USD")
    transport: float = Field(default=0.0, description="Total transport costs in USD")
    other: float = Field(default=0.0, description="Total other costs in USD")


class DestinationCost(BaseModel):
    """Aggregated costs for a destination."""
    destination_id: str = Field(description="ID of the destination")
    destination_name: str = Field(description="Name of the destination")
    costs_by_category: CostsByCategory
    total_usd: float = Field(description="Total costs for this destination in USD")
    cost_per_day: float = Field(description="Average cost per day in USD")
    currency_breakdown: dict[str, float] = Field(
        default_factory=dict,
        description="Costs broken down by original currency"
    )


class CostSummary(BaseModel):
    """Overall cost summary for the trip."""
    total_usd: float = Field(description="Total trip cost in USD")
    costs_by_category: CostsByCategory
    costs_by_destination: list[DestinationCost] = Field(default_factory=list)
    cost_per_person: Optional[float] = Field(
        default=None, description="Cost per person if travelers count is known"
    )
    cost_per_day: float = Field(description="Average cost per day")
    currency_totals: dict[str, float] = Field(
        default_factory=dict,
        description="Total costs by currency"
    )


# ============================================================================
# Cost Research Agent Types
# ============================================================================

class CostResearchRequest(BaseModel):
    """Request to research costs for a specific destination."""
    destination_name: str = Field(description="Full destination name (e.g., 'Bangkok, Thailand')")
    destination_id: str = Field(description="ID linking to itinerary destination")
    duration_days: int = Field(description="Number of days staying in this destination")
    arrival_date: str = Field(description="Arrival date in YYYY-MM-DD format")
    departure_date: str = Field(description="Departure date in YYYY-MM-DD format")
    num_travelers: int = Field(default=1, description="Number of travelers")
    travel_style: str = Field(
        default="mid-range",
        description="Travel style preference: 'budget', 'mid-range', or 'luxury'"
    )
    previous_destination: Optional[str] = Field(
        default=None,
        description="Previous destination name for flight pricing (if applicable)"
    )
    next_destination: Optional[str] = Field(
        default=None,
        description="Next destination name for flight pricing (if applicable)"
    )


class CostResearchResult(BaseModel):
    """Research results for a specific cost category."""
    category: str = Field(
        description="Cost category: 'accommodation', 'flight', 'food', 'transport', 'activity'"
    )
    amount_low: float = Field(description="Lower bound estimate in USD")
    amount_mid: float = Field(description="Typical/recommended estimate in USD")
    amount_high: float = Field(description="Upper bound estimate in USD")
    currency_local: str = Field(description="Local currency code as valid 3-letter ISO 4217 code (e.g., 'USD', 'EUR', 'THB', 'JPY', 'GBP', 'CNY'). NEVER use 'N/A' or null. Default to 'USD' if unknown.")
    amount_local: float = Field(description="Typical amount in local currency")
    sources: list[str] = Field(
        default_factory=list,
        description="URLs of sources used for research"
    )
    confidence: str = Field(
        description="Confidence level: 'high', 'medium', or 'low'"
    )
    notes: str = Field(
        description="Key findings, booking tips, or important context"
    )
    researched_at: str = Field(description="ISO timestamp when research was conducted")


class DestinationCostResearch(BaseModel):
    """Complete cost research results for a destination.

    NOTE: 'flights' field removed - inter-destination flights are tracked separately
    via TransportSegment objects to avoid double-counting costs.
    """
    destination_id: str = Field(description="ID of the destination")
    destination_name: str = Field(description="Name of the destination")
    accommodation: CostResearchResult = Field(
        description="Accommodation costs (total for stay)"
    )
    food_daily: CostResearchResult = Field(
        description="Daily food costs per person"
    )
    transport_daily: CostResearchResult = Field(
        description="Daily local transport costs per person (taxis, buses, subway, etc. within destination)"
    )
    activities: CostResearchResult = Field(
        description="Total activity and attraction costs for stay"
    )
    total_low: float = Field(description="Total low estimate in USD (sum of 4 categories)")
    total_mid: float = Field(description="Total typical estimate in USD (sum of 4 categories)")
    total_high: float = Field(description="Total high estimate in USD (sum of 4 categories)")
    cost_per_day_mid: float = Field(
        description="Average cost per day (mid estimate) in USD"
    )
    research_summary: str = Field(
        description="Overall insights, tips, and recommendations"
    )


# ============================================================================
# Transport Segment Types
# ============================================================================

class AlternativeRoute(BaseModel):
    """Alternative routing option for transport between destinations."""
    from_location: str = Field(description="Alternative origin airport/city")
    to_location: str = Field(description="Alternative destination airport/city")
    cost_low: float = Field(description="Low-end cost estimate in USD for this route")
    cost_mid: float = Field(description="Typical cost estimate in USD for this route")
    cost_high: float = Field(description="High-end cost estimate in USD for this route")
    savings_vs_primary: float = Field(
        description="Cost savings compared to primary route (negative if more expensive)"
    )
    distance_from_original_km: float = Field(
        description="Distance in km from the intended origin/destination"
    )
    airlines: list[str] = Field(
        default_factory=list,
        description="Airlines that serve this alternative route"
    )
    typical_stops: int = Field(
        default=0,
        description="Number of stops: 0=direct, 1=one-stop, etc."
    )
    typical_duration_hours: float = Field(
        description="Typical flight duration in hours"
    )
    notes: str = Field(
        description="Why this alternative is worth considering (e.g., 'Save $800 with one layover')"
    )


class TransportSegment(BaseModel):
    """Inter-destination transport segment with costs and details."""
    id: str = Field(description="Unique identifier for the transport segment")
    from_destination_id: str = Field(description="ID of the origin destination")
    from_destination_name: str = Field(description="Name of the origin destination")
    to_destination_id: str = Field(description="ID of the target destination")
    to_destination_name: str = Field(description="Name of the target destination")

    # Transport details
    transport_mode: str = Field(
        description="Primary transport mode: 'plane', 'train', 'bus', 'ferry', 'car', 'other'"
    )
    transport_mode_icon: str = Field(
        default="✈️",
        description="Emoji icon for transport mode"
    )

    # Distance and duration
    distance_km: float = Field(description="Distance between destinations in kilometers")
    duration_hours: Optional[float] = Field(
        default=None,
        description="Estimated travel duration in hours"
    )

    # Cost information
    estimated_cost_usd: float = Field(
        description="Estimated cost in USD for all travelers"
    )
    researched_cost_low: Optional[float] = Field(
        default=None,
        description="Researched low-end cost in USD"
    )
    researched_cost_mid: Optional[float] = Field(
        default=None,
        description="Researched typical cost in USD"
    )
    researched_cost_high: Optional[float] = Field(
        default=None,
        description="Researched high-end cost in USD"
    )
    actual_cost_usd: Optional[float] = Field(
        default=None,
        description="Actual booked cost in USD"
    )
    currency_local: Optional[str] = Field(
        default=None,
        description="Local currency code (ISO 4217)"
    )
    amount_local: Optional[float] = Field(
        default=None,
        description="Cost in local currency"
    )

    # Booking and status
    booking_status: str = Field(
        default="estimated",
        description="Status: 'estimated', 'researched', 'booked', 'paid', 'completed'"
    )
    confidence_level: str = Field(
        default="low",
        description="Confidence in cost estimate: 'low', 'medium', 'high'"
    )

    # Research and sources
    research_sources: list[str] = Field(
        default_factory=list,
        description="URLs and sources used for cost research"
    )
    research_notes: Optional[str] = Field(
        default=None,
        description="Key findings, tips, or booking recommendations"
    )
    researched_at: Optional[str] = Field(
        default=None,
        description="ISO timestamp when research was conducted"
    )

    # Additional details
    alternatives: list[str] = Field(
        default_factory=list,
        description="Alternative transport options considered"
    )
    researched_alternatives: list[AlternativeRoute] = Field(
        default_factory=list,
        description="Detailed alternative routing options with cost savings"
    )
    researched_airlines: list[str] = Field(
        default_factory=list,
        description="Airlines/carriers found during research"
    )
    researched_duration_hours: Optional[float] = Field(
        default=None,
        description="Researched typical flight/travel duration in hours"
    )
    researched_stops: Optional[int] = Field(
        default=None,
        description="Researched number of stops (0=direct, 1=one-stop, etc.)"
    )
    auto_updated: bool = Field(
        default=False,
        description="Flag indicating costs were auto-updated from research"
    )
    booking_link: Optional[str] = Field(
        default=None,
        description="URL for booking this transport"
    )
    booking_reference: Optional[str] = Field(
        default=None,
        description="Booking confirmation number"
    )
    notes: Optional[str] = Field(
        default=None,
        description="Additional notes, considerations, or reminders"
    )

    # Metadata
    num_travelers: int = Field(
        default=3,
        description="Number of travelers for cost calculation (2 adults + 1 child)"
    )
    created_at: Optional[str] = Field(
        default=None,
        description="ISO timestamp when segment was created"
    )
    updated_at: Optional[str] = Field(
        default=None,
        description="ISO timestamp when segment was last updated"
    )


class TransportResearchRequest(BaseModel):
    """Request to research transport options between two destinations."""
    segment_id: str = Field(description="ID of the transport segment to research")
    from_destination_name: str = Field(description="Origin city/destination name")
    to_destination_name: str = Field(description="Target city/destination name")
    from_country: Optional[str] = Field(default=None, description="Origin country")
    to_country: Optional[str] = Field(default=None, description="Target country")
    departure_date: Optional[str] = Field(
        default=None,
        description="Approximate departure date in YYYY-MM-DD format"
    )
    num_travelers: int = Field(default=3, description="Number of travelers (2 adults + 1 child)")
    preferred_modes: list[str] = Field(
        default_factory=list,
        description="Preferred transport modes to research"
    )
    travel_style: str = Field(
        default="mid-range",
        description="Travel style: 'budget', 'mid-range', or 'luxury'"
    )


class TransportResearchResult(BaseModel):
    """Research results for transport between destinations."""
    segment_id: str = Field(description="ID of the transport segment")
    transport_mode: str = Field(description="Researched transport mode")
    cost_low: float = Field(description="Low-end cost estimate in USD")
    cost_mid: float = Field(description="Typical cost estimate in USD")
    cost_high: float = Field(description="High-end cost estimate in USD")
    duration_hours: float = Field(description="Estimated travel duration in hours")
    currency_local: str = Field(description="Local currency code")
    amount_local: float = Field(description="Typical cost in local currency")
    sources: list[str] = Field(
        default_factory=list,
        description="Research sources and URLs"
    )
    booking_tips: str = Field(
        description="Recommendations for booking this transport"
    )
    alternatives: list[AlternativeRoute] = Field(
        default_factory=list,
        description="Alternative routing options found (different airports/cities)"
    )
    airlines: list[str] = Field(
        default_factory=list,
        description="Airlines/carriers that serve this route"
    )
    typical_duration_hours: float = Field(
        description="Typical flight/travel duration in hours"
    )
    typical_stops: int = Field(
        default=0,
        description="Number of stops: 0=direct, 1=one-stop, etc."
    )
    confidence: str = Field(description="Confidence level: 'high', 'medium', 'low'")
    researched_at: str = Field(description="ISO timestamp of research")
