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

"""Cost tracking and budgeting tools for trip planning."""

import json
import uuid
from datetime import datetime, timedelta
from typing import Optional

import requests
from google.genai.types import Tool, FunctionDeclaration

from travel_concierge.shared_libraries.types import (
    CostItem,
    CostsByCategory,
    DestinationCost,
    CostSummary,
)


# ============================================================================
# Currency Conversion Service
# ============================================================================

class CurrencyConverter:
    """Handles currency conversion with caching."""

    def __init__(self):
        self.exchange_rates = {}
        self.cache_time = None
        self.cache_duration = timedelta(hours=1)

    def _fetch_exchange_rates(self) -> dict:
        """Fetch current exchange rates from API."""
        try:
            # Using exchangerate-api.com free tier
            response = requests.get(
                "https://api.exchangerate-api.com/v4/latest/USD",
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            return data.get("rates", {})
        except Exception as e:
            print(f"Failed to fetch exchange rates: {e}")
            # Fallback to hardcoded rates
            return self._get_fallback_rates()

    def _get_fallback_rates(self) -> dict:
        """Fallback exchange rates if API is unavailable."""
        return {
            "USD": 1.00,
            "EUR": 0.92,
            "GBP": 0.79,
            "JPY": 149.50,
            "CNY": 7.24,
            "INR": 83.12,
            "BRL": 4.97,
            "ARS": 350.00,
            "IDR": 15625.00,
            "PHP": 56.25,
            "SGD": 1.35,
            "MYR": 4.72,
            "TWD": 31.50,
            "KRW": 1320.00,
            "NPR": 133.00,
            "BTN": 83.12,
            "DKK": 6.89,
            "SEK": 10.87,
            "NOK": 10.95,
            "ISK": 138.50,
            "TZS": 2500.00,
            "RWF": 1305.00,
            "NZD": 1.68,
            "AUD": 1.54,
            "ECD": 2.70,  # Eastern Caribbean Dollar (Ecuador uses USD)
        }

    def get_exchange_rates(self) -> dict:
        """Get exchange rates with caching."""
        now = datetime.now()

        # Return cached rates if valid
        if (self.exchange_rates and self.cache_time and
                now - self.cache_time < self.cache_duration):
            return self.exchange_rates

        # Fetch new rates
        self.exchange_rates = self._fetch_exchange_rates()
        self.cache_time = now
        return self.exchange_rates

    def convert_to_usd(self, amount: float, from_currency: str) -> float:
        """Convert amount from currency to USD."""
        if from_currency == "USD":
            return amount

        rates = self.get_exchange_rates()
        rate = rates.get(from_currency)

        if not rate:
            print(f"Warning: Exchange rate not found for {from_currency}, using 1:1")
            return amount

        return amount / rate


# ============================================================================
# Cost Tracker Service
# ============================================================================

class CostTrackerService:
    """Manages cost items and calculations."""

    def __init__(self):
        self.costs: list[CostItem] = []
        self.converter = CurrencyConverter()

    def add_cost(
        self,
        category: str,
        description: str,
        amount: float,
        currency: str,
        date: str,
        destination_id: Optional[str] = None,
        booking_status: str = "estimated",
        source: str = "manual",
        notes: Optional[str] = None,
    ) -> CostItem:
        """Add a new cost item."""
        # Convert to USD
        amount_usd = self.converter.convert_to_usd(amount, currency)

        dest_id_str = None
        if destination_id is not None:
            dest_id_candidate = str(destination_id).strip()
            dest_id_str = dest_id_candidate if dest_id_candidate else None

        # Create cost item
        cost = CostItem(
            id=str(uuid.uuid4()),
            category=category,
            description=description,
            amount=amount,
            currency=currency,
            amount_usd=amount_usd,
            date=date,
            destination_id=dest_id_str,
            booking_status=booking_status,
            source=source,
            notes=notes,
        )

        self.costs.append(cost)
        return cost

    def update_cost(self, cost_id: str, **updates) -> Optional[CostItem]:
        """Update an existing cost item."""
        for i, cost in enumerate(self.costs):
            if cost.id == cost_id:
                # Recalculate USD if amount or currency changed
                if "amount" in updates or "currency" in updates:
                    new_amount = updates.get("amount", cost.amount)
                    new_currency = updates.get("currency", cost.currency)
                    updates["amount_usd"] = self.converter.convert_to_usd(
                        new_amount, new_currency
                    )

                # Update fields
                updated_cost = cost.model_copy(update=updates)
                self.costs[i] = updated_cost
                return updated_cost

        return None

    def delete_cost(self, cost_id: str) -> bool:
        """Delete a cost item."""
        for i, cost in enumerate(self.costs):
            if cost.id == cost_id:
                self.costs.pop(i)
                return True
        return False

    def get_cost(self, cost_id: str) -> Optional[CostItem]:
        """Get a cost item by ID."""
        for cost in self.costs:
            if cost.id == cost_id:
                return cost
        return None

    def filter_costs(
        self,
        destination_id: Optional[str] = None,
        category: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> list[CostItem]:
        """Filter costs by various criteria."""
        filtered = self.costs

        if destination_id is not None:
            dest_id_norm = str(destination_id).strip()
            filtered = [
                c for c in filtered
                if (str(c.destination_id).strip() if c.destination_id is not None else None) == dest_id_norm
            ]
        if category:
            filtered = [c for c in filtered if c.category == category]
        if start_date:
            filtered = [c for c in filtered if c.date >= start_date]
        if end_date:
            filtered = [c for c in filtered if c.date <= end_date]

        return filtered

    def calculate_costs_by_category(
        self, costs: Optional[list[CostItem]] = None
    ) -> CostsByCategory:
        """Calculate total costs by category."""
        if costs is None:
            costs = self.costs

        totals = {
            "flight": 0.0,
            "accommodation": 0.0,
            "activity": 0.0,
            "food": 0.0,
            "transport": 0.0,
            "other": 0.0,
        }

        for cost in costs:
            if cost.category in totals:
                totals[cost.category] += cost.amount_usd
            else:
                totals["other"] += cost.amount_usd

        return CostsByCategory(**totals)

    def calculate_costs_by_destination(
        self, destinations: list[dict]
    ) -> list[DestinationCost]:
        """Calculate costs for each destination."""
        result = []

        for dest in destinations:
            dest_id = dest.get("id")
            dest_id_str = str(dest_id).strip() if dest_id is not None else None
            dest_name = dest.get("name", "Unknown")
            duration_days = dest.get("duration_days", 0)

            # Get costs for this destination
            dest_costs = self.filter_costs(destination_id=dest_id_str)
            total_usd = sum(c.amount_usd for c in dest_costs)
            costs_by_category = self.calculate_costs_by_category(dest_costs)

            # Calculate currency breakdown
            currency_breakdown = {}
            for cost in dest_costs:
                currency_breakdown[cost.currency] = (
                    currency_breakdown.get(cost.currency, 0) + cost.amount
                )

            # Calculate cost per day
            cost_per_day = total_usd / duration_days if duration_days > 0 else 0

            result.append(
                DestinationCost(
                    destination_id=dest_id_str or "unknown_destination",
                    destination_name=dest_name,
                    costs_by_category=costs_by_category,
                    total_usd=total_usd,
                    cost_per_day=cost_per_day,
                    currency_breakdown=currency_breakdown,
                )
            )

        return result

    def get_cost_summary(
        self,
        destinations: Optional[list[dict]] = None,
        traveler_count: Optional[int] = None,
        total_days: Optional[int] = None,
    ) -> CostSummary:
        """Get comprehensive cost summary."""
        total_usd = sum(c.amount_usd for c in self.costs)
        costs_by_category = self.calculate_costs_by_category()

        costs_by_destination = []
        if destinations:
            costs_by_destination = self.calculate_costs_by_destination(destinations)

        cost_per_person = None
        if traveler_count and traveler_count > 0:
            cost_per_person = total_usd / traveler_count

        cost_per_day = 0.0
        if total_days and total_days > 0:
            cost_per_day = total_usd / total_days

        # Calculate currency totals
        currency_totals = {}
        for cost in self.costs:
            currency_totals[cost.currency] = (
                currency_totals.get(cost.currency, 0) + cost.amount
            )

        return CostSummary(
            total_usd=total_usd,
            costs_by_category=costs_by_category,
            costs_by_destination=costs_by_destination,
            cost_per_person=cost_per_person,
            cost_per_day=cost_per_day,
            currency_totals=currency_totals,
        )

    def load_costs(self, costs_data: list[dict]):
        """Load costs from JSON data."""
        self.costs = [CostItem(**cost) for cost in costs_data]

    def export_costs(self) -> list[dict]:
        """Export costs as JSON-serializable list."""
        return [cost.model_dump() for cost in self.costs]


# ============================================================================
# Tool Declarations for Agent
# ============================================================================

def create_cost_tracking_tools() -> list[Tool]:
    """Create tool declarations for cost tracking."""
    return [
        Tool(
            function_declarations=[
                FunctionDeclaration(
                    name="add_trip_cost",
                    description="Add a cost item to the trip budget. Use this to track expenses for flights, accommodations, activities, food, transport, and other costs.",
                    parameters={
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "description": "Cost category: 'flight', 'accommodation', 'activity', 'food', 'transport', or 'other'",
                                "enum": ["flight", "accommodation", "activity", "food", "transport", "other"],
                            },
                            "description": {
                                "type": "string",
                                "description": "Description of the cost item (e.g., 'Flight from NYC to Tokyo', 'Hotel Marriott 5 nights')",
                            },
                            "amount": {
                                "type": "number",
                                "description": "Cost amount in the specified currency",
                            },
                            "currency": {
                                "type": "string",
                                "description": "ISO 4217 currency code (e.g., USD, EUR, JPY, GBP)",
                            },
                            "date": {
                                "type": "string",
                                "description": "Date of expense in YYYY-MM-DD format",
                            },
                            "destination_id": {
                                "type": "integer",
                                "description": "ID of the associated destination (optional)",
                            },
                            "booking_status": {
                                "type": "string",
                                "description": "Booking status: 'estimated', 'researched', 'booked', or 'paid'",
                                "enum": ["estimated", "researched", "booked", "paid"],
                            },
                            "source": {
                                "type": "string",
                                "description": "Source of cost data: 'manual', 'ai_estimate', 'web_research', or 'booking_api'",
                                "enum": ["manual", "ai_estimate", "web_research", "booking_api"],
                            },
                            "notes": {
                                "type": "string",
                                "description": "Additional notes about the cost (optional)",
                            },
                        },
                        "required": ["category", "description", "amount", "currency", "date"],
                    },
                ),
                FunctionDeclaration(
                    name="get_cost_summary",
                    description="Get a comprehensive summary of trip costs including totals by category, destination, and other breakdowns.",
                    parameters={
                        "type": "object",
                        "properties": {
                            "include_destination_breakdown": {
                                "type": "boolean",
                                "description": "Whether to include per-destination cost breakdown",
                            },
                        },
                        "required": [],
                    },
                ),
                FunctionDeclaration(
                    name="filter_costs",
                    description="Filter and retrieve cost items by various criteria (destination, category, date range).",
                    parameters={
                        "type": "object",
                        "properties": {
                            "destination_id": {
                                "type": "integer",
                                "description": "Filter by destination ID",
                            },
                            "category": {
                                "type": "string",
                                "description": "Filter by category",
                                "enum": ["flight", "accommodation", "activity", "food", "transport", "other"],
                            },
                            "start_date": {
                                "type": "string",
                                "description": "Start date in YYYY-MM-DD format",
                            },
                            "end_date": {
                                "type": "string",
                                "description": "End date in YYYY-MM-DD format",
                            },
                        },
                        "required": [],
                    },
                ),
            ]
        )
    ]
