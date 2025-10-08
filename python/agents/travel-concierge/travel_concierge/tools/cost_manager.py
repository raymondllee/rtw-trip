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

"""Tools for managing costs in the itinerary - saves directly to Firestore."""

import os
import re
import requests
from datetime import datetime
from google.genai.types import Tool, FunctionDeclaration
from google.adk.tools import ToolContext


FLASK_API_URL = os.getenv("FLASK_API_URL", "http://127.0.0.1:5001")


def _to_float(value) -> float:
    """Best-effort conversion of mixed inputs to float."""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        stripped = value.strip().replace(',', '')
        try:
            return float(stripped)
        except ValueError:
            return 0.0
    if isinstance(value, dict):
        for key in ("amount_mid", "amount", "value"):
            if key in value:
                return _to_float(value[key])
    return 0.0


def _coerce_destination_id(destination_id, destination_name: str) -> str:
    """
    Ensure destination identifiers are consistently represented as strings.
    """
    if isinstance(destination_id, str):
        ident = destination_id.strip()
        if ident:
            return ident

    if destination_id is not None:
        return str(destination_id)

    clean_name = (destination_name or "").strip().lower()
    clean_name = re.sub(r'[^a-z0-9]+', '_', clean_name).strip('_')
    if clean_name:
        return clean_name

    # Fallback identifier when destination name is missing
    return "destination"


def save_researched_costs(
    tool_context: ToolContext,
    destination_name: str,
    destination_id: str,
    duration_days: int,
    num_travelers: int,
    research_data: dict
) -> dict:
    """
    Save researched costs to Firestore for a destination.

    This tool saves the cost research results directly to the user's active
    scenario in Firestore, so the frontend immediately shows updated costs.

    Args:
        destination_name: Name of the destination (e.g., "Tokyo, Japan")
        destination_id: ID of the destination in the itinerary
        duration_days: Number of days for this destination
        num_travelers: Number of travelers
        research_data: The cost research JSON data with all categories

    Returns:
        Status message indicating success/failure
    """

    # Extract session ID and scenario ID from context
    state = getattr(tool_context, "state", {}) or {}
    session_id = state.get("web_session_id", "default")
    scenario_id = state.get("scenario_id")

    if not scenario_id:
        return {
            "status": "error",
            "message": f"No scenario_id in context. Cannot save costs without knowing which scenario to update."
        }

    # Keep destination identifiers as strings for downstream systems
    destination_id = _coerce_destination_id(destination_id, destination_name)

    # Convert research data to cost items
    cost_items = []

    categories_map = {
        'accommodation': 'accommodation',
        'flights': 'flight',
        'activities': 'activity',
        'food_daily': 'food',
        'transport_daily': 'transport'
    }

    for research_cat, itinerary_cat in categories_map.items():
        if research_cat not in research_data:
            continue

        cat_data = research_data[research_cat] or {}

        # Base values from research output (mid is the primary estimate)
        base_usd = _to_float(cat_data.get('amount_mid', 0))
        base_local = _to_float(cat_data.get('amount_local', 0))
        currency_local = cat_data.get('currency_local', 'USD')

        # Scale per category semantics:
        # - food_daily, transport_daily: per-day per-person → scale by duration_days * num_travelers
        # - flights: typically per-person → scale by num_travelers
        # - accommodation, activities: totals for stay → no scaling
        multiplier = 1
        if research_cat in ('food_daily', 'transport_daily'):
            multiplier = max(1, int(duration_days)) * max(1, int(num_travelers))
        elif research_cat == 'flights':
            multiplier = max(1, int(num_travelers))

        amount_usd = base_usd * multiplier
        amount_local = base_local * multiplier if base_local else amount_usd  # fallback if local not provided

        # Build deterministic id for upsert behavior per destination/category
        stable_dest = (
            destination_name.lower()
            .replace(' ', '_')
            .replace(',', '')
            .replace('/', '-')
            .replace(':', '-')
        )

        cost_item = {
            "id": f"{destination_id}_{stable_dest}_{itinerary_cat}",
            "category": itinerary_cat,
            "description": f"{cat_data.get('category', research_cat).title()} in {destination_name}",
            "amount": amount_local,
            "currency": currency_local,
            "amount_usd": amount_usd,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "destination_id": destination_id,
            "booking_status": "researched",
            "source": "web_research",
            "notes": cat_data.get('notes', ''),
            "confidence": cat_data.get('confidence', 'medium'),
            "sources": cat_data.get('sources', []),
            "researched_at": cat_data.get('researched_at', datetime.now().isoformat())
        }

        cost_items.append(cost_item)

    # Call Flask API to save costs to Firestore
    try:
        response = requests.post(
            f"{FLASK_API_URL}/api/costs/bulk-save",
            json={
                "session_id": session_id,
                "scenario_id": scenario_id,
                "destination_id": destination_id,
                "destination_name": destination_name,
                "cost_items": cost_items
            },
            timeout=30
        )

        if response.status_code == 200:
            total = sum(item['amount_usd'] for item in cost_items)
            return {
                "status": "success",
                "message": f"Saved {len(cost_items)} cost items for {destination_name} (${total:.2f} total)",
                "total_usd": total,
                "items_saved": len(cost_items)
            }
        else:
            return {
                "status": "error",
                "message": f"Failed to save costs: {response.text}"
            }

    except Exception as e:
        return {
            "status": "error",
            "message": f"Error saving costs: {str(e)}"
        }


def update_destination_cost(
    tool_context: ToolContext,
    destination_name: str,
    destination_id: str,
    duration_days: int,
    num_travelers: int,
    research_data: dict
) -> dict:
    """
    Backwards-compatible alias that forwards to save_researched_costs.
    Some legacy prompts still reference update_destination_cost.
    """
    return save_researched_costs(
        tool_context=tool_context,
        destination_name=destination_name,
        destination_id=destination_id,
        duration_days=duration_days,
        num_travelers=num_travelers,
        research_data=research_data,
    )


# Tool declaration for the agent
save_researched_costs_tool = Tool(
    function_declarations=[
        FunctionDeclaration(
            name="save_researched_costs",
            description=(
                "Save researched costs to Firestore for a destination. "
                "Use this AFTER completing cost research to save the results "
                "so they appear in the user's itinerary immediately."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "destination_name": {
                        "type": "string",
                        "description": "Name of the destination (e.g., 'Tokyo, Japan')"
                    },
                    "destination_id": {
                        "type": "string",
                        "description": "ID of the destination in the itinerary"
                    },
                    "duration_days": {
                        "type": "integer",
                        "description": "Number of days for this destination"
                    },
                    "num_travelers": {
                        "type": "integer",
                        "description": "Number of travelers"
                    },
                    "research_data": {
                        "type": "object",
                        "description": "The complete cost research data with all categories (accommodation, flights, food_daily, transport_daily, activities)"
                    }
                },
                "required": ["destination_name", "destination_id", "duration_days", "num_travelers", "research_data"]
            }
        ),
        FunctionDeclaration(
            name="update_destination_cost",
            description=(
                "Deprecated alias for save_researched_costs. Saves researched costs to Firestore "
                "for backwards compatibility."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "destination_name": {
                        "type": "string",
                        "description": "Name of the destination (e.g., 'Tokyo, Japan')"
                    },
                    "destination_id": {
                        "type": "string",
                        "description": "ID of the destination in the itinerary"
                    },
                    "duration_days": {
                        "type": "integer",
                        "description": "Number of days for this destination"
                    },
                    "num_travelers": {
                        "type": "integer",
                        "description": "Number of travelers"
                    },
                    "research_data": {
                        "type": "object",
                        "description": "The complete cost research data with all categories (accommodation, flights, food_daily, transport_daily, activities)"
                    }
                },
                "required": ["destination_name", "destination_id", "duration_days", "num_travelers", "research_data"]
            }
        )
    ]
)
