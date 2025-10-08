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

from typing import Optional, Union

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


class CostItem(BaseModel):
    """A single cost item for trip budgeting and tracking."""
    id: str = Field(description="Unique identifier for the cost item")
    category: str = Field(
        description="Cost category: 'flight', 'accommodation', 'activity', 'food', 'transport', 'other'"
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
    currency_local: str = Field(description="Local currency code (e.g., 'THB', 'JPY')")
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
    """Complete cost research results for a destination."""
    destination_id: str = Field(description="ID of the destination")
    destination_name: str = Field(description="Name of the destination")
    accommodation: CostResearchResult = Field(
        description="Accommodation costs (total for stay)"
    )
    flights: CostResearchResult = Field(
        description="Flight costs (inbound and/or outbound)"
    )
    food_daily: CostResearchResult = Field(
        description="Daily food costs per person"
    )
    transport_daily: CostResearchResult = Field(
        description="Daily local transport costs per person"
    )
    activities: CostResearchResult = Field(
        description="Total activity and attraction costs for stay"
    )
    total_low: float = Field(description="Total low estimate in USD")
    total_mid: float = Field(description="Total typical estimate in USD")
    total_high: float = Field(description="Total high estimate in USD")
    cost_per_day_mid: float = Field(
        description="Average cost per day (mid estimate) in USD"
    )
    research_summary: str = Field(
        description="Overall insights, tips, and recommendations"
    )
