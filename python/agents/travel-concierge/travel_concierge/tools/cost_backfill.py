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

"""Cost backfill service for automatically estimating trip costs."""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from travel_concierge.tools.cost_tracker import CostTrackerService
from travel_concierge.tools.price_research import (
    research_flight_prices,
    research_hotel_prices,
    research_activity_prices,
    estimate_daily_budget,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DestinationProfile:
    """Profile for cost estimation based on destination characteristics."""

    def __init__(self, destination: dict):
        self.destination = destination
        self.name = destination.get("name", "Unknown")
        self.country = destination.get("country", "Unknown")
        self.region = destination.get("region", "Unknown")
        self.duration_days = destination.get("duration_days", 0)
        self.activity_type = destination.get("activity_type", "")
        self.highlights = destination.get("highlights", [])
        self.arrival_date = destination.get("arrival_date")
        self.departure_date = destination.get("departure_date")

    def get_hotel_category(self) -> str:
        """Determine hotel category based on activity type and region."""
        if self.activity_type in ["diving", "mountain climbing"]:
            return "mid-range"  # Focus on activity over luxury
        elif self.activity_type in ["city exploration", "cultural exploration"]:
            return "upscale"  # Better locations for sightseeing
        elif self.activity_type in ["transit", "buffer days"]:
            return "budget"  # Minimal stay
        else:
            return "mid-range"

    def get_daily_budget_level(self) -> str:
        """Determine daily budget level based on destination characteristics."""
        if self.country in ["Japan", "Singapore", "Norway", "Iceland"]:
            return "luxury"  # High cost countries
        elif self.country in ["Indonesia", "Philippines", "Malaysia", "Thailand", "Vietnam"]:
            return "budget"  # Lower cost countries
        else:
            return "mid-range"

    def get_activity_categories(self) -> List[str]:
        """Get activity cost categories based on destination highlights."""
        categories = []

        if self.activity_type == "diving":
            categories.extend(["water_activity", "adventure_sport"])
        elif self.activity_type == "trekking":
            categories.extend(["adventure_sport", "tour"])
        elif self.activity_type == "cultural exploration":
            categories.extend(["cultural_experience", "museum", "tour"])
        elif self.activity_type == "city exploration":
            categories.extend(["cultural_experience", "entertainment", "tour"])
        elif self.activity_type == "wildlife":
            categories.extend(["tour", "adventure_sport"])
        elif self.activity_type == "nature exploration":
            categories.extend(["tour", "adventure_sport"])

        return categories or ["other"]


class CostBackfillService:
    """Service for automatically backfilling costs for trip destinations."""

    def __init__(self, cost_tracker: CostTrackerService):
        self.cost_tracker = cost_tracker
        self.progress = {"processed": 0, "total": 0, "errors": []}

    def load_itinerary_data(self, file_path: str) -> dict:
        """Load itinerary data from JSON file."""
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            logger.info(f"Loaded itinerary with {len(data.get('locations', []))} destinations")
            return data
        except Exception as e:
            logger.error(f"Failed to load itinerary: {e}")
            raise

    def get_destinations_by_leg(self, itinerary: dict, leg_name: str) -> List[dict]:
        """Get destinations for a specific leg of the trip."""
        legs = itinerary.get("legs", [])
        all_locations = itinerary.get("locations", [])

        # Find the leg
        target_leg = None
        for leg in legs:
            if leg.get("name") == leg_name:
                target_leg = leg
                break

        if not target_leg:
            raise ValueError(f"Leg '{leg_name}' not found in itinerary")

        # Get destination IDs for this leg
        destination_ids = set()
        for sub_leg in target_leg.get("sub_legs", []):
            destination_ids.update(sub_leg.get("destination_ids", []))

        # Return matching destinations
        destinations = []
        for location in all_locations:
            if location.get("id") in destination_ids:
                destinations.append(location)

        logger.info(f"Found {len(destinations)} destinations for {leg_name}")
        return destinations

    def estimate_flight_cost(
        self,
        origin: dict,
        destination: dict,
        passengers: int = 3
    ) -> Tuple[float, str]:
        """Estimate flight cost between two destinations."""
        try:
            origin_code = origin.get("airport_code", "")
            dest_code = destination.get("airport_code", "")
            departure_date = destination.get("arrival_date", "")

            if not all([origin_code, dest_code, departure_date]):
                logger.warning(f"Missing flight data: {origin_code}->{dest_code}")
                return 0.0, "Missing flight data"

            # Use price research tool
            result = research_flight_prices(
                origin=origin_code,
                destination=dest_code,
                departure_date=departure_date,
                num_passengers=passengers,
                class_of_service="economy"
            )

            # For now, return estimated cost based on route distance
            # In production, this would use actual web search results
            estimated_cost = self._estimate_flight_cost_by_region(origin, destination, passengers)

            return estimated_cost, "Estimated"

        except Exception as e:
            logger.error(f"Error estimating flight cost: {e}")
            return 0.0, f"Error: {str(e)}"

    def _estimate_flight_cost_by_region(
        self, origin: dict, destination: dict, passengers: int
    ) -> float:
        """Estimate flight cost based on regions (fallback method)."""
        origin_region = origin.get("region", "")
        dest_region = destination.get("region", "")

        # Base costs per passenger for different route types
        regional_costs = {
            ("Southeast Asia", "Southeast Asia"): 150,
            ("Southeast Asia", "East Asia"): 300,
            ("East Asia", "Southeast Asia"): 300,
            ("East Asia", "East Asia"): 200,
            ("South Asia", "Southeast Asia"): 250,
            ("Southeast Asia", "South Asia"): 250,
            ("South Asia", "East Asia"): 400,
            ("East Asia", "South Asia"): 400,
        }

        # Default to higher cost for unknown routes
        base_cost = regional_costs.get((origin_region, dest_region), 500)
        return base_cost * passengers

    def estimate_accommodation_cost(
        self, destination: DestinationProfile, guests: int = 3
    ) -> Tuple[float, str]:
        """Estimate accommodation cost for a destination."""
        try:
            if destination.duration_days <= 1:
                return 0.0, "No overnight stay"

            hotel_category = destination.get_hotel_category()

            # Use price research tool
            result = research_hotel_prices(
                location=destination.name,
                check_in=destination.arrival_date,
                check_out=destination.departure_date,
                num_rooms=2,  # Assume 2 rooms for 3 guests
                num_guests=guests,
                hotel_category=hotel_category
            )

            # Estimate cost based on destination and category
            nightly_rate = self._estimate_hotel_cost_by_destination(destination, hotel_category)
            total_cost = nightly_rate * destination.duration_days

            return total_cost, f"Estimated {hotel_category} hotel"

        except Exception as e:
            logger.error(f"Error estimating accommodation cost: {e}")
            return 0.0, f"Error: {str(e)}"

    def _estimate_hotel_cost_by_destination(
        self, destination: DestinationProfile, hotel_category: str
    ) -> float:
        """Estimate hotel cost based on destination characteristics."""
        # Base nightly rates per room by category
        base_rates = {
            "budget": 50,
            "mid-range": 120,
            "upscale": 200,
            "luxury": 350
        }

        base_rate = base_rates.get(hotel_category, 120)

        # Adjust by country cost multiplier
        country_multipliers = {
            "Japan": 1.5,
            "Singapore": 1.4,
            "Hong Kong": 1.3,
            "Norway": 1.6,
            "Iceland": 1.5,
            "Indonesia": 0.6,
            "Philippines": 0.7,
            "Malaysia": 0.8,
            "Thailand": 0.7,
            "Vietnam": 0.6,
            "India": 0.5,
            "Nepal": 0.4,
            "Bhutan": 0.8,
        }

        multiplier = country_multipliers.get(destination.country, 1.0)
        return base_rate * multiplier

    def estimate_activity_costs(
        self, destination: DestinationProfile, people: int = 3
    ) -> List[Tuple[str, float, str]]:
        """Estimate activity costs for a destination."""
        activities = []
        activity_categories = destination.get_activity_categories()

        for category in activity_categories:
            try:
                result = research_activity_prices(
                    location=destination.name,
                    activity_type=category,
                    num_people=people
                )

                # Estimate cost based on activity type and destination
                cost = self._estimate_activity_cost_by_type(destination, category, people)
                description = f"{category.replace('_', ' ').title()} activities"

                activities.append((description, cost, f"Estimated {category}"))

            except Exception as e:
                logger.error(f"Error estimating activity cost for {category}: {e}")
                continue

        return activities

    def _estimate_activity_cost_by_type(
        self, destination: DestinationProfile, activity_type: str, people: int
    ) -> float:
        """Estimate activity cost based on type and destination."""
        # Base costs per person by activity type
        base_costs = {
            "water_activity": 100,  # Diving, snorkeling
            "adventure_sport": 150,  # Trekking, climbing
            "cultural_experience": 50,  # Temples, museums
            "museum": 25,
            "tour": 75,
            "entertainment": 60,
            "other": 50
        }

        base_cost = base_costs.get(activity_type, 50)

        # Adjust by destination cost of living
        cost_multipliers = {
            "Japan": 1.3,
            "Singapore": 1.2,
            "Norway": 1.4,
            "Iceland": 1.3,
            "Indonesia": 0.8,
            "Philippines": 0.9,
            "Thailand": 0.8,
            "Vietnam": 0.7,
            "Nepal": 0.6,
            "Bhutan": 0.9,
        }

        multiplier = cost_multipliers.get(destination.country, 1.0)

        # Adjust for special activities
        if destination.activity_type == "diving" and activity_type == "water_activity":
            base_cost *= 2  # Diving is expensive
        elif destination.activity_type == "mountain climbing" and activity_type == "adventure_sport":
            base_cost *= 3  # Mountain climbing is very expensive

        return base_cost * people * multiplier

    def estimate_daily_costs(
        self, destination: DestinationProfile, people: int = 3
    ) -> Tuple[float, float, float]:
        """Estimate daily costs for food, transport, and miscellaneous."""
        try:
            budget_level = destination.get_daily_budget_level()

            result = estimate_daily_budget(
                location=destination.name,
                budget_level=budget_level,
                num_people=people
            )

            # Estimate daily costs by category
            daily_food, daily_transport, daily_misc = self._estimate_daily_costs_by_destination(
                destination, budget_level, people
            )

            total_days = destination.duration_days
            total_food = daily_food * total_days
            total_transport = daily_transport * total_days
            total_misc = daily_misc * total_days

            return total_food, total_transport, total_misc

        except Exception as e:
            logger.error(f"Error estimating daily costs: {e}")
            return 0.0, 0.0, 0.0

    def _estimate_daily_costs_by_destination(
        self, destination: DestinationProfile, budget_level: str, people: int
    ) -> Tuple[float, float, float]:
        """Estimate daily costs by category for a destination."""
        # Base daily costs per person by budget level
        base_costs = {
            "budget": {"food": 25, "transport": 10, "misc": 15},
            "mid-range": {"food": 50, "transport": 20, "misc": 30},
            "luxury": {"food": 100, "transport": 40, "misc": 60}
        }

        costs = base_costs.get(budget_level, base_costs["mid-range"])

        # Country multipliers
        country_multipliers = {
            "Japan": 1.5,
            "Singapore": 1.4,
            "Norway": 1.6,
            "Iceland": 1.5,
            "Switzerland": 1.6,
            "Denmark": 1.4,
            "Indonesia": 0.7,
            "Philippines": 0.8,
            "Malaysia": 0.8,
            "Thailand": 0.7,
            "Vietnam": 0.6,
            "India": 0.5,
            "Nepal": 0.4,
            "Bhutan": 0.7,
        }

        multiplier = country_multipliers.get(destination.country, 1.0)

        daily_food = costs["food"] * people * multiplier
        daily_transport = costs["transport"] * people * multiplier
        daily_misc = costs["misc"] * people * multiplier

        return daily_food, daily_transport, daily_misc

    def backfill_destination_costs(
        self,
        destination: dict,
        previous_destination: Optional[dict] = None,
        people: int = 3
    ) -> bool:
        """Backfill costs for a single destination."""
        try:
            profile = DestinationProfile(destination)
            logger.info(f"Processing destination: {profile.name} ({profile.duration_days} days)")

            # Flight cost (if not first destination)
            if previous_destination:
                flight_cost, flight_desc = self.estimate_flight_cost(
                    previous_destination, destination, people
                )
                if flight_cost > 0:
                    self.cost_tracker.add_cost(
                        category="flight",
                        description=f"Flight from {previous_destination.get('name')} to {profile.name}",
                        amount=flight_cost,
                        currency="USD",
                        date=profile.arrival_date,
                        destination_id=destination.get("id"),
                        booking_status="estimated",
                        source="ai_estimate",
                        notes=flight_desc
                    )

            # Accommodation cost
            accommodation_cost, accomm_desc = self.estimate_accommodation_cost(profile, people)
            if accommodation_cost > 0:
                self.cost_tracker.add_cost(
                    category="accommodation",
                    description=f"Accommodation in {profile.name}",
                    amount=accommodation_cost,
                    currency="USD",
                    date=profile.arrival_date,
                    destination_id=destination.get("id"),
                    booking_status="estimated",
                    source="ai_estimate",
                    notes=accomm_desc
                )

            # Activity costs
            activities = self.estimate_activity_costs(profile, people)
            for activity_desc, activity_cost, activity_notes in activities:
                if activity_cost > 0:
                    self.cost_tracker.add_cost(
                        category="activity",
                        description=activity_desc,
                        amount=activity_cost,
                        currency="USD",
                        date=profile.arrival_date,
                        destination_id=destination.get("id"),
                        booking_status="estimated",
                        source="ai_estimate",
                        notes=activity_notes
                    )

            # Daily costs (food, transport, miscellaneous)
            food_cost, transport_cost, misc_cost = self.estimate_daily_costs(profile, people)

            if food_cost > 0:
                self.cost_tracker.add_cost(
                    category="food",
                    description=f"Meals in {profile.name}",
                    amount=food_cost,
                    currency="USD",
                    date=profile.arrival_date,
                    destination_id=destination.get("id"),
                    booking_status="estimated",
                    source="ai_estimate",
                    notes="Estimated daily food costs"
                )

            if transport_cost > 0:
                self.cost_tracker.add_cost(
                    category="transport",
                    description=f"Local transport in {profile.name}",
                    amount=transport_cost,
                    currency="USD",
                    date=profile.arrival_date,
                    destination_id=destination.get("id"),
                    booking_status="estimated",
                    source="ai_estimate",
                    notes="Estimated local transport costs"
                )

            if misc_cost > 0:
                self.cost_tracker.add_cost(
                    category="other",
                    description=f"Miscellaneous expenses in {profile.name}",
                    amount=misc_cost,
                    currency="USD",
                    date=profile.arrival_date,
                    destination_id=destination.get("id"),
                    booking_status="estimated",
                    source="ai_estimate",
                    notes="Estimated miscellaneous costs"
                )

            self.progress["processed"] += 1
            logger.info(f"Completed cost backfill for {profile.name}")
            return True

        except Exception as e:
            error_msg = f"Error processing destination {destination.get('name', 'Unknown')}: {e}"
            logger.error(error_msg)
            self.progress["errors"].append(error_msg)
            return False

    def backfill_leg_costs(
        self,
        itinerary: dict,
        leg_name: str,
        people: int = 3
    ) -> Dict:
        """Backfill costs for all destinations in a leg."""
        try:
            destinations = self.get_destinations_by_leg(itinerary, leg_name)
            self.progress["total"] = len(destinations)
            self.progress["processed"] = 0
            self.progress["errors"] = []

            logger.info(f"Starting cost backfill for {leg_name} with {len(destinations)} destinations")

            # Process each destination
            previous_destination = None
            for i, destination in enumerate(destinations):
                success = self.backfill_destination_costs(
                    destination, previous_destination, people
                )
                if success:
                    previous_destination = destination

            # Get cost summary
            summary = self.cost_tracker.get_cost_summary(
                destinations=destinations,
                traveler_count=people,
                total_days=sum(d.get("duration_days", 0) for d in destinations)
            )

            result = {
                "leg": leg_name,
                "destinations_processed": self.progress["processed"],
                "total_destinations": self.progress["total"],
                "errors": self.progress["errors"],
                "total_cost_usd": summary.total_usd,
                "cost_per_person": summary.cost_per_person,
                "cost_per_day": summary.cost_per_day,
                "costs_by_category": summary.costs_by_category.model_dump(),
            }

            logger.info(f"Completed {leg_name} backfill: ${result['total_cost_usd']:.2f} total")
            return result

        except Exception as e:
            logger.error(f"Error in backfill_leg_costs: {e}")
            return {"error": str(e)}