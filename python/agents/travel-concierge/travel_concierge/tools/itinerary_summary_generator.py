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

"""Tools for generating beautiful itinerary descriptions from structured data."""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional

from google.adk.tools import ToolContext
from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)


def _get_repo_root() -> Path:
    """Locate the repository root relative to this module."""
    return Path(__file__).resolve().parents[5]


def _load_example_itinerary() -> str:
    """Load the example itinerary markdown for style reference."""
    repo_root = _get_repo_root()
    example_path = repo_root / "itineary.md"

    if example_path.exists():
        with example_path.open("r", encoding="utf-8") as fp:
            return fp.read()

    return ""


def _extract_itinerary(tool_context: ToolContext) -> Dict[str, Any]:
    """Extract the current itinerary from tool context state OR message history."""
    if not tool_context:
        return {}

    # Try to get from state first
    state = getattr(tool_context, "state", {}) or {}
    itinerary = state.get("itinerary") or {}

    if itinerary and itinerary.get('locations'):
        logger.info(f"[itinerary_summary] Found itinerary in state with {len(itinerary.get('locations', []))} locations")
        return itinerary

    # If not in state, try to extract from message history (sent by API in the user message)
    logger.info("[itinerary_summary] No itinerary in state, checking message history...")

    # Get the message history from context
    messages = getattr(tool_context, "messages", []) or []
    logger.info(f"[itinerary_summary] Checking {len(messages)} messages in history")

    # Look for the most recent user message containing CURRENT_ITINERARY_DATA
    for i, msg in enumerate(reversed(messages)):
        if hasattr(msg, 'parts'):
            for part in msg.parts:
                if hasattr(part, 'text') and part.text:
                    text = part.text
                    logger.info(f"[itinerary_summary] Message {i} has {len(text)} chars, first 200: {text[:200]}")
                    # Look for JSON in the message between ```json and ```
                    json_match = re.search(r'CURRENT_ITINERARY_DATA:.*?```json\s*(\{.*?\})\s*```', text, re.DOTALL)
                    if json_match:
                        try:
                            itinerary_data = json.loads(json_match.group(1))
                            logger.info(f"[itinerary_summary] Extracted itinerary from message with {len(itinerary_data.get('locations', []))} locations")
                            return itinerary_data
                        except json.JSONDecodeError as e:
                            logger.error(f"[itinerary_summary] Failed to parse itinerary JSON: {e}")

    logger.warning("[itinerary_summary] No itinerary found in state or messages")
    return {}


def _calculate_costs(itinerary: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate cost summaries for the itinerary."""
    costs = itinerary.get("costs", [])
    transport_segments = itinerary.get("transport_segments", [])

    if not costs and not transport_segments:
        return {"total_cost": 0, "by_category": {}, "by_destination": {}, "transport_total": 0}

    total_cost = 0
    by_category: Dict[str, float] = {}
    by_destination: Dict[str, float] = {}
    transport_total = 0

    # Sum destination costs (accommodation, food, local transport, activities)
    for cost_item in costs:
        amount = float(cost_item.get("amount_usd", cost_item.get("amount", 0)))
        total_cost += amount

        category = cost_item.get("category", "unknown")
        by_category[category] = by_category.get(category, 0) + amount

        dest_id = cost_item.get("destination_id")
        if dest_id:
            by_destination[str(dest_id)] = by_destination.get(str(dest_id), 0) + amount

    # Add inter-destination transport costs (flights, trains, etc. between destinations)
    for segment in transport_segments:
        # Use the most accurate cost available: actual > researched_mid > estimated
        amount = 0
        if segment.get("actual_cost_usd"):
            amount = float(segment.get("actual_cost_usd", 0))
        elif segment.get("researched_cost_mid"):
            amount = float(segment.get("researched_cost_mid", 0))
        elif segment.get("estimated_cost_usd"):
            amount = float(segment.get("estimated_cost_usd", 0))

        if amount > 0:
            transport_total += amount
            total_cost += amount
            # Add to inter-destination transport category
            by_category["inter_destination_transport"] = by_category.get("inter_destination_transport", 0) + amount

    return {
        "total_cost": total_cost,
        "by_category": by_category,
        "by_destination": by_destination,
        "transport_total": transport_total,
        "count": len(costs),
        "transport_segment_count": len(transport_segments)
    }


def _format_duration_days(start_date: Optional[str], end_date: Optional[str]) -> str:
    """Format duration from dates or return empty string."""
    if not start_date or not end_date:
        return ""

    try:
        from datetime import datetime
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        days = (end - start).days + 1  # Inclusive
        return f"{days} Days"
    except:
        return ""


def _build_llm_prompt(itinerary: Dict[str, Any]) -> str:
    """Build the LLM prompt with itinerary data and example style."""

    # Load example for style reference
    example_itinerary = _load_example_itinerary()

    # Calculate cost information
    cost_summary = _calculate_costs(itinerary)

    # Extract key information
    trip_info = itinerary.get("trip", {})
    locations = itinerary.get("locations", [])
    legs = itinerary.get("legs", [])

    # Build comprehensive prompt
    prompt = f"""You are a professional travel writer creating a detailed, beautifully formatted itinerary document.

I need you to generate an itinerary description in the exact style and format as the example provided below. The document should be comprehensive, engaging, and include detailed cost breakdowns.

## EXAMPLE STYLE REFERENCE:
```markdown
{example_itinerary[:3000]}  # Truncate if too long
```

## CURRENT TRIP DATA:
**Trip Information:**
- Title: {trip_info.get('title', 'Untitled Trip')}
- Travelers: {', '.join(trip_info.get('travelers', []))}
- Duration: {trip_info.get('duration', 'Unknown')}
- Start Date: {trip_info.get('start_date', 'Unknown')}
- End Date: {trip_info.get('end_date', 'Unknown')}
- Origin: {trip_info.get('origin', 'Unknown')}
- Return: {trip_info.get('return', 'Unknown')}

**Cost Summary:**
- Total Estimated Cost: ${cost_summary.get('total_cost', 0):,.2f}
- Cost Items: {cost_summary.get('count', 0)}
- By Category: {json.dumps(cost_summary.get('by_category', {}), indent=2)}

**Locations ({len(locations)} total):**
"""

    # Add location details
    for i, location in enumerate(locations[:10], 1):  # Limit to first 10 for prompt length
        duration = _format_duration_days(location.get('arrival_date'), location.get('departure_date'))
        prompt += f"""
{i}. **{location.get('name', 'Unknown')}**, {location.get('country', '')}
   - Duration: {duration}
   - Activity Type: {location.get('activity_type', 'Unknown')}
   - Highlights: {', '.join(location.get('highlights', []))}
   - Arrival: {location.get('arrival_date', 'Unknown')}
   - Departure: {location.get('departure_date', 'Unknown')}"""

    # Add legs information
    if legs:
        prompt += f"\n\n**Trip Legs ({len(legs)} total):**\n"
        for leg in legs:
            prompt += f"""
- **{leg.get('name', 'Unknown Leg')}** ({leg.get('subtitle', '')})
  - Duration: {leg.get('duration_days', 'Unknown')} days
  - Period: {leg.get('start_date', 'Unknown')} to {leg.get('end_date', 'Unknown')}
  - Total Cost: {leg.get('total_cost', 'Unknown')}
  - Cost Per Day: {leg.get('cost_per_day', 'Unknown')}"""

    prompt += """

## INSTRUCTIONS:
1. Create a comprehensive itinerary document that matches the style, tone, and formatting of the example
2. Include detailed sections for each major leg/region of the trip
3. Add vivid descriptions of destinations and activities
4. Provide detailed cost breakdowns with per-day calculations
5. Use the same hierarchical structure with clear sections and subsections
6. Include practical details like flights, accommodation, activities, and transport
7. Make the descriptions engaging and aspirational while remaining informative
8. Format everything in clean markdown with proper headers, bullet points, and emphasis

Please generate the complete itinerary document now:"""

    return prompt


def generate_itinerary_summary(
    itinerary_json: str = "",
    tool_context: ToolContext = None,
) -> Dict[str, Any]:
    """Generate a beautiful, comprehensive itinerary description from the current scenario data.

    This tool prepares all the itinerary data and context for the LLM to generate
    a detailed, professionally formatted travel document in the style of the example itinerary.

    The tool returns a comprehensive prompt that the agent can use to generate the final document.

    Args:
        itinerary_json: Optional JSON string containing the itinerary data. If not provided,
                       will attempt to extract from tool context state.
        tool_context: The ADK tool context containing state and other information.

    Returns:
        A dictionary containing the prepared prompt and itinerary data for LLM generation.
    """

    try:
        # First try to parse the itinerary_json parameter if provided
        itinerary = {}
        if itinerary_json:
            try:
                itinerary = json.loads(itinerary_json)
                logger.info(f"[itinerary_summary] Parsed itinerary from parameter with {len(itinerary.get('locations', []))} locations")
            except json.JSONDecodeError as e:
                logger.error(f"[itinerary_summary] Failed to parse itinerary_json parameter: {e}")

        # If not in parameter, extract from tool context
        if not itinerary or not itinerary.get('locations'):
            itinerary = _extract_itinerary(tool_context)

        if not itinerary:
            return {
                "status": "error",
                "message": "No itinerary data found. Please ensure you have an active trip scenario loaded."
            }

        # Build comprehensive LLM prompt
        prompt = _build_llm_prompt(itinerary)
        cost_summary = _calculate_costs(itinerary)

        logger.info(f"[itinerary_summary] Prepared itinerary generation prompt with {len(itinerary.get('locations', []))} locations")

        # Generate the actual summary using Gemini
        logger.info("[itinerary_summary] Calling Gemini to generate the itinerary summary...")
        try:
            client = genai.Client()
            response = client.models.generate_content(
                model="gemini-2.0-flash-exp",
                contents=prompt,
            )

            summary_text = response.text
            logger.info(f"[itinerary_summary] Generated summary with {len(summary_text)} characters")

            return {
                "status": "success",
                "message": "Successfully generated your itinerary summary!",
                "summary": summary_text,
                "itinerary_data": {
                    "trip": itinerary.get("trip", {}),
                    "locations_count": len(itinerary.get("locations", [])),
                    "legs_count": len(itinerary.get("legs", [])),
                    "cost_summary": cost_summary,
                    "has_costs": len(itinerary.get("costs", [])) > 0
                }
            }
        except Exception as llm_error:
            error_str = str(llm_error)
            logger.error(f"[itinerary_summary] Failed to generate summary with LLM: {llm_error}")

            # Check for specific error types and provide user-friendly messages
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                return {
                    "status": "error",
                    "error_code": "rate_limit",
                    "message": "The AI service is currently experiencing high demand. Please wait a moment and try again. This is a temporary limitation from Google's Vertex AI service.",
                    "retry_after": 60,  # Suggest retry after 60 seconds
                }
            elif "quota" in error_str.lower():
                return {
                    "status": "error",
                    "error_code": "quota_exceeded",
                    "message": "Daily API quota has been exceeded. Please try again later or contact support if this persists.",
                }
            else:
                # Generic error fallback
                return {
                    "status": "error",
                    "error_code": "generation_failed",
                    "message": f"Failed to generate summary: {error_str}. Please try again in a few moments.",
                    "prompt": prompt,
                }

    except Exception as exc:
        logger.error(f"[itinerary_summary] Error preparing summary: {exc}")
        return {
            "status": "error",
            "message": f"Failed to prepare itinerary summary: {str(exc)}"
        }