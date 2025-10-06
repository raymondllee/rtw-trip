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

"""Price research tools for getting real-world cost estimates."""

from datetime import datetime
from typing import Optional

from google.genai.types import Tool, FunctionDeclaration


def create_price_research_tool() -> Tool:
    """Create tool declaration for price research via web search."""
    return Tool(
        function_declarations=[
            FunctionDeclaration(
                name="research_flight_prices",
                description=(
                    "Research current flight prices between two destinations using web search. "
                    "Provides estimated costs for flights based on route, dates, and class of service."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "origin": {
                            "type": "string",
                            "description": "Origin city or airport code (e.g., 'New York' or 'JFK')",
                        },
                        "destination": {
                            "type": "string",
                            "description": "Destination city or airport code (e.g., 'Tokyo' or 'NRT')",
                        },
                        "departure_date": {
                            "type": "string",
                            "description": "Departure date in YYYY-MM-DD format",
                        },
                        "return_date": {
                            "type": "string",
                            "description": "Return date in YYYY-MM-DD format (optional for one-way)",
                        },
                        "class_of_service": {
                            "type": "string",
                            "description": "Class of service: economy, premium_economy, business, first",
                            "enum": ["economy", "premium_economy", "business", "first"],
                        },
                        "num_passengers": {
                            "type": "integer",
                            "description": "Number of passengers",
                        },
                    },
                    "required": ["origin", "destination", "departure_date"],
                },
            ),
            FunctionDeclaration(
                name="research_hotel_prices",
                description=(
                    "Research current hotel prices for a destination using web search. "
                    "Provides estimated costs for accommodations based on location, dates, and room type."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "City or area to search for hotels",
                        },
                        "check_in": {
                            "type": "string",
                            "description": "Check-in date in YYYY-MM-DD format",
                        },
                        "check_out": {
                            "type": "string",
                            "description": "Check-out date in YYYY-MM-DD format",
                        },
                        "num_rooms": {
                            "type": "integer",
                            "description": "Number of rooms needed",
                        },
                        "num_guests": {
                            "type": "integer",
                            "description": "Total number of guests",
                        },
                        "hotel_category": {
                            "type": "string",
                            "description": "Hotel category: budget, mid-range, upscale, luxury",
                            "enum": ["budget", "mid-range", "upscale", "luxury"],
                        },
                    },
                    "required": ["location", "check_in", "check_out"],
                },
            ),
            FunctionDeclaration(
                name="research_activity_prices",
                description=(
                    "Research typical prices for activities, tours, and attractions in a destination. "
                    "Provides cost estimates for common tourist activities."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "City or destination",
                        },
                        "activity_type": {
                            "type": "string",
                            "description": (
                                "Type of activity: museum, tour, adventure_sport, "
                                "water_activity, cultural_experience, entertainment, other"
                            ),
                            "enum": [
                                "museum",
                                "tour",
                                "adventure_sport",
                                "water_activity",
                                "cultural_experience",
                                "entertainment",
                                "other",
                            ],
                        },
                        "activity_name": {
                            "type": "string",
                            "description": "Specific activity or attraction name (optional)",
                        },
                        "num_people": {
                            "type": "integer",
                            "description": "Number of people",
                        },
                    },
                    "required": ["location", "activity_type"],
                },
            ),
            FunctionDeclaration(
                name="estimate_daily_budget",
                description=(
                    "Estimate typical daily budget for a destination including food, "
                    "local transport, and miscellaneous expenses."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "City or destination",
                        },
                        "budget_level": {
                            "type": "string",
                            "description": "Budget level: budget, mid-range, luxury",
                            "enum": ["budget", "mid-range", "luxury"],
                        },
                        "num_people": {
                            "type": "integer",
                            "description": "Number of people",
                        },
                    },
                    "required": ["location", "budget_level"],
                },
            ),
        ]
    )


# ============================================================================
# Price Research Function Implementations
# ============================================================================

def research_flight_prices(
    origin: str,
    destination: str,
    departure_date: str,
    return_date: Optional[str] = None,
    class_of_service: str = "economy",
    num_passengers: int = 1,
) -> dict:
    """
    Research flight prices using web search.

    In production, this would use Google Search API or flight booking APIs.
    For now, returns structured prompt for LLM to search the web.
    """
    trip_type = "round-trip" if return_date else "one-way"

    search_prompt = f"""
    Search for {trip_type} {class_of_service} class flights:
    - From: {origin}
    - To: {destination}
    - Departure: {departure_date}
    {f"- Return: {return_date}" if return_date else ""}
    - Passengers: {num_passengers}

    Find current prices from major airlines and booking sites like:
    - Google Flights
    - Kayak
    - Expedia
    - Airline websites

    Provide:
    1. Typical price range for this route
    2. Recommended airlines
    3. Average flight duration
    4. Number of stops (direct vs connecting)
    5. Best days to fly for lower prices

    Return estimated cost in both local currency and USD.
    """

    return {
        "status": "search_required",
        "search_prompt": search_prompt,
        "route": f"{origin} to {destination}",
        "dates": f"{departure_date}" + (f" to {return_date}" if return_date else ""),
        "passengers": num_passengers,
        "class": class_of_service,
    }


def research_hotel_prices(
    location: str,
    check_in: str,
    check_out: str,
    num_rooms: int = 1,
    num_guests: int = 2,
    hotel_category: str = "mid-range",
) -> dict:
    """
    Research hotel prices using web search.

    In production, this would use hotel booking APIs.
    For now, returns structured prompt for LLM to search the web.
    """
    search_prompt = f"""
    Search for {hotel_category} hotels in {location}:
    - Check-in: {check_in}
    - Check-out: {check_out}
    - Rooms: {num_rooms}
    - Guests: {num_guests}

    Find current prices from booking sites like:
    - Booking.com
    - Hotels.com
    - Airbnb (for apartments/homes)
    - Local hotel websites

    Provide:
    1. Average nightly rate for {hotel_category} category
    2. Total cost for the stay
    3. Popular neighborhoods/areas to stay
    4. Typical amenities included
    5. Recommended booking strategy (book early vs last minute)

    Return estimated cost in both local currency and USD.
    """

    return {
        "status": "search_required",
        "search_prompt": search_prompt,
        "location": location,
        "dates": f"{check_in} to {check_out}",
        "rooms": num_rooms,
        "guests": num_guests,
        "category": hotel_category,
    }


def research_activity_prices(
    location: str,
    activity_type: str,
    activity_name: Optional[str] = None,
    num_people: int = 1,
) -> dict:
    """
    Research activity and attraction prices.

    Returns structured prompt for LLM to search the web.
    """
    activity_spec = activity_name if activity_name else f"{activity_type} activities"

    search_prompt = f"""
    Search for prices of {activity_spec} in {location}:
    - Activity type: {activity_type}
    - Number of people: {num_people}

    Find information from:
    - Viator
    - GetYourGuide
    - TripAdvisor
    - Local tour operator websites
    - Attraction official websites

    Provide:
    1. Typical price range for {activity_type} activities
    2. Specific pricing for popular activities
    3. Whether prices include transport, meals, equipment
    4. Best time to book (advance vs day-of)
    5. Group discounts available

    Return estimated cost in both local currency and USD.
    """

    return {
        "status": "search_required",
        "search_prompt": search_prompt,
        "location": location,
        "activity_type": activity_type,
        "activity_name": activity_name,
        "num_people": num_people,
    }


def estimate_daily_budget(
    location: str,
    budget_level: str = "mid-range",
    num_people: int = 1,
) -> dict:
    """
    Estimate daily budget for a destination.

    Returns structured prompt for LLM to search the web.
    """
    search_prompt = f"""
    Estimate typical daily budget for {num_people} person(s) in {location}:
    - Budget level: {budget_level}

    Research from travel guides and budget sites like:
    - Budget Your Trip
    - Numbeo
    - Rome2Rio
    - Travel blogs and forums

    Break down daily costs for:
    1. Food (breakfast, lunch, dinner, snacks)
       - Street food vs restaurants
       - Grocery costs if cooking
    2. Local transportation
       - Public transit passes
       - Taxi/rideshare costs
       - Bike/scooter rentals
    3. Miscellaneous
       - Bottled water
       - Souvenirs
       - Tips
       - Phone/data

    Provide:
    - Low, average, and high estimates for {budget_level} level
    - Cost comparison to other destinations
    - Money-saving tips

    Return estimated daily budget in both local currency and USD.
    """

    return {
        "status": "search_required",
        "search_prompt": search_prompt,
        "location": location,
        "budget_level": budget_level,
        "num_people": num_people,
    }


# Map function names to implementations for the agent to call
PRICE_RESEARCH_FUNCTIONS = {
    "research_flight_prices": research_flight_prices,
    "research_hotel_prices": research_hotel_prices,
    "research_activity_prices": research_activity_prices,
    "estimate_daily_budget": estimate_daily_budget,
}
