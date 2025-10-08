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

"""Tools for editing the user's itinerary in real-time."""

from __future__ import annotations

import json
import os
import re
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional

import requests
from google.adk.tools import ToolContext

# API endpoint for the Flask server that bridges to the frontend
ITINERARY_API_URL = os.getenv("ITINERARY_API_URL", "http://127.0.0.1:5001/api/itinerary")


def _get_repo_root() -> Path:
    """Locate the repository root relative to this module."""

    return Path(__file__).resolve().parents[5]


@lru_cache(maxsize=1)
def _load_reference_data() -> Dict[str, Any]:
    """Load itinerary and geocache data for enriching destinations."""

    repo_root = _get_repo_root()
    itinerary_path = repo_root / "itinerary_structured.json"
    geocache_path = repo_root / "data" / "geocache.json"

    itinerary_data: Dict[str, Any] = {}
    geocache: Dict[str, Any] = {}

    if itinerary_path.exists():
        with itinerary_path.open("r", encoding="utf-8") as fp:
            itinerary_data = json.load(fp)

    if geocache_path.exists():
        with geocache_path.open("r", encoding="utf-8") as fp:
            geocache = json.load(fp)

    locations = itinerary_data.get("locations", [])
    by_name: Dict[str, Dict[str, Any]] = {}
    by_city: Dict[str, Dict[str, Any]] = {}
    region_by_country: Dict[str, str] = {}

    for loc in locations:
        name = (loc.get("name") or "").lower()
        city = (loc.get("city") or "").lower()
        country = (loc.get("country") or "").lower()

        if name:
            by_name[name] = loc
        if city:
            by_city[city] = loc
        if country and loc.get("region"):
            region_by_country[country] = loc["region"]

    return {
        "locations": locations,
        "by_name": by_name,
        "by_city": by_city,
        "region_by_country": region_by_country,
        "geocache": geocache,
    }


def _extract_itinerary(tool_context: ToolContext) -> Dict[str, Any]:
    """Read the itinerary from state or fall back to chat history."""

    if not tool_context:
        return {}

    state = getattr(tool_context, "state", {}) or {}
    itinerary = state.get("itinerary") or {}

    if itinerary:
        print(
            f"[itinerary] Found itinerary in state with {len(itinerary.get('locations', []))} locations"
        )
        return itinerary

    print("[itinerary] No itinerary cached in state. Scanning history…")
    history = getattr(tool_context, "history", None)
    if not history:
        return {}

    try:
        for message in reversed(history):
            if not hasattr(message, "parts"):
                continue
            for part in getattr(message, "parts", []):
                if not hasattr(part, "text"):
                    continue
                match = re.search(
                    r"CURRENT_ITINERARY_DATA:\s*```json\s*(\{.*?\})\s*```",
                    part.text,
                    re.DOTALL,
                )
                if match:
                    itinerary = json.loads(match.group(1))
                    print(
                        f"[itinerary] Extracted itinerary from history with {len(itinerary.get('locations', []))} locations"
                    )
                    state["itinerary"] = itinerary
                    return itinerary
    except Exception as exc:  # pragma: no cover - defensive guard
        print(f"[itinerary] Failed to parse history: {exc}")

    return {}


def _get_session_id(tool_context: ToolContext) -> str:
    """Determine the appropriate session id for API requests."""

    print(f"\n🔍 _get_session_id CALLED!")

    if not tool_context:
        print("[itinerary] No tool_context provided")
        return "default_session"

    print(f"[itinerary] DEBUG tool_context type: {type(tool_context)}")
    print(f"[itinerary] DEBUG tool_context attrs: {[x for x in dir(tool_context) if not x.startswith('_')]}")

    state = getattr(tool_context, "state", None)
    print(f"[itinerary] DEBUG state: {state}")
    if state and isinstance(state, dict):
        session_id = state.get("web_session_id")
        if session_id:
            print(f"[itinerary] ✅ Found session_id in state: {session_id}")
            return session_id

    session = getattr(tool_context, "session", None)
    print(f"[itinerary] DEBUG session: {session}")
    if session is not None:
        if hasattr(session, "id"):
            print(f"[itinerary] ✅ Found session_id in session.id: {session.id}")
            return session.id
        if hasattr(session, "session_id"):
            print(f"[itinerary] ✅ Found session_id in session.session_id: {session.session_id}")
            return session.session_id

    print("[itinerary] WARNING: No session id found, falling back to default_session")
    return "default_session"


def _next_location_id(itinerary: Dict[str, Any]) -> int:
    """Produce a unique numeric id for a new location."""

    max_id = 0
    for loc in itinerary.get("locations", []):
        try:
            current = int(loc.get("id", 0))
        except (TypeError, ValueError):
            continue
        max_id = max(max_id, current)

    if max_id > 0:
        return max_id + 1

    # Fallback when no numeric ids exist yet
    return int(time.time())


def _lookup_reference(name: str, city: Optional[str]) -> Optional[Dict[str, Any]]:
    """Return a known itinerary location that matches by name or city."""

    reference = _load_reference_data()
    if name:
        match = reference["by_name"].get(name.lower())
        if match:
            return match
    if city:
        match = reference["by_city"].get(city.lower())
        if match:
            return match
    return None


def _lookup_geocache(name: str, city: Optional[str], country: Optional[str]) -> Optional[Dict[str, float]]:
    """Return coordinates from the cached dataset if available."""

    geocache = _load_reference_data()["geocache"]
    candidates = []
    if city and country:
        candidates.append(f"{city}, {country}")
    if name and country:
        candidates.append(f"{name}, {country}")
    if name:
        candidates.append(name)
    if city:
        candidates.append(city)

    for key in candidates:
        entry = geocache.get(key)
        if entry and "lat" in entry and "lng" in entry:
            return {"lat": entry["lat"], "lng": entry["lng"], "source": "geocache"}
    return None


def _geocode_with_google_places(name: str, city: Optional[str], country: Optional[str]) -> Optional[Dict[str, float]]:
    """Geocode using Google Places API (primary method)."""

    query_parts = [part for part in [name, city, country] if part]
    if not query_parts:
        return None

    query = ", ".join(dict.fromkeys(query_parts))
    places_api_key = os.getenv("GOOGLE_PLACES_API_KEY")

    if not places_api_key:
        print("[geocode] No Google Places API key found, skipping Places geocoding")
        return None

    try:
        places_url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
        params = {
            "input": query,
            "inputtype": "textquery",
            "fields": "geometry,formatted_address,name",
            "key": places_api_key,
        }

        response = requests.get(places_url, params=params, timeout=10)
        if response.status_code != 200:
            print(f"[geocode] Google Places API error: {response.status_code}")
            return None

        data = response.json()
        if data.get("candidates") and len(data["candidates"]) > 0:
            candidate = data["candidates"][0]
            location = candidate.get("geometry", {}).get("location", {})
            if "lat" in location and "lng" in location:
                print(f"[geocode] ✅ Geocoded '{query}' via Google Places: {location['lat']}, {location['lng']}")
                return {
                    "lat": float(location["lat"]),
                    "lng": float(location["lng"]),
                    "source": "google_places",
                    "formatted_address": candidate.get("formatted_address", ""),
                }
    except Exception as exc:
        print(f"[geocode] Google Places error for '{query}': {exc}")

    return None


def _geocode_with_nominatim(name: str, city: Optional[str], country: Optional[str]) -> Optional[Dict[str, float]]:
    """Geocode using OpenStreetMap Nominatim (fallback method)."""

    query_parts = [part for part in [name, city, country] if part]
    if not query_parts:
        return None

    query = ", ".join(dict.fromkeys(query_parts))
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": "rtw-trip-itinerary-agent/1.0"},
            timeout=10,
        )
        if response.status_code != 200:
            return None
        payload = response.json()
        if isinstance(payload, list) and payload:
            top = payload[0]
            print(f"[geocode] ✅ Geocoded '{query}' via Nominatim: {top['lat']}, {top['lon']}")
            return {
                "lat": float(top["lat"]),
                "lng": float(top["lon"]),
                "source": "nominatim",
            }
    except Exception as exc:  # pragma: no cover - network failures are tolerated
        print(f"[geocode] Nominatim error for '{query}': {exc}")
    return None


def _geocode_location(name: str, city: Optional[str], country: Optional[str]) -> Optional[Dict[str, float]]:
    """Best-effort geocode for destinations that are not yet cached.

    Tries Google Places API first, then falls back to Nominatim.
    """

    # Try Google Places API first (more accurate and reliable)
    result = _geocode_with_google_places(name, city, country)
    if result:
        return result

    # Fall back to Nominatim
    result = _geocode_with_nominatim(name, city, country)
    if result:
        return result

    print(f"[geocode] ❌ Failed to geocode: {name}, {city}, {country}")
    return None


def _guess_region(country: Optional[str]) -> str:
    reference = _load_reference_data()["region_by_country"]
    if country:
        return reference.get(country.lower(), "Custom")
    return "Custom"


def _build_destination_payload(
    *,
    name: str,
    city: Optional[str],
    country: Optional[str],
    duration_days: int,
    activity_type: Optional[str],
    description: Optional[str],
    notes: Optional[str] = None,
    itinerary: Dict[str, Any],
) -> Dict[str, Any]:
    """Compose a destination dict that mirrors the frontend expectations."""

    reference = _lookup_reference(name, city)

    coordinates = None
    source = None

    # Priority 1: Use reference data from existing itinerary
    if reference and reference.get("coordinates"):
        coordinates = {
            "lat": reference["coordinates"].get("lat"),
            "lng": reference["coordinates"].get("lng"),
            "source": "reference",
        }
        source = "reference"
        print(f"[geocode] Using reference coordinates for '{name}': {coordinates['lat']}, {coordinates['lng']}")

    # Priority 2: Check geocache
    if not coordinates:
        coordinates = _lookup_geocache(name, city, country)
        if coordinates:
            source = coordinates.get("source", "geocache")
            print(f"[geocode] Using cached coordinates for '{name}': {coordinates['lat']}, {coordinates['lng']}")

    # Priority 3: Geocode with Google Places or Nominatim
    if not coordinates:
        print(f"[geocode] Geocoding new destination: {name}, {city}, {country}")
        coordinates = _geocode_location(name, city, country)
        if coordinates:
            source = coordinates.get("source", "geocoded")

    # Fallback: Default to 0,0
    if not coordinates:
        coordinates = {"lat": 0.0, "lng": 0.0, "source": "fallback"}
        source = "fallback"
        print(f"[geocode] ⚠️ Warning: No coordinates found for '{name}', using fallback (0,0)")

    region = reference.get("region") if reference else None
    if not region:
        region = _guess_region(country)

    new_destination = {
        "id": _next_location_id(itinerary),
        "name": name,
        "city": city,
        "country": country,
        "region": region,
        "coordinates": {
            "lat": coordinates.get("lat"),
            "lng": coordinates.get("lng"),
        },
        "duration_days": max(1, duration_days),
        "activity_type": (
            activity_type
            or (reference.get("activity_type") if reference else None)
            or "custom exploration"
        ),
        "description": description
        or (reference.get("description") if reference else None)
        or f"Visit {name}",
        "highlights": list(reference.get("highlights", [])) if reference else [],
        "notes": notes or (reference.get("notes") if reference else ""),
        "arrival_date": None,
        "departure_date": None,
    }

    if reference and reference.get("airport_code"):
        new_destination["airport_code"] = reference["airport_code"]

    return new_destination


def _insert_into_state(itinerary: Dict[str, Any], destination: Dict[str, Any], insert_after: Optional[str]):
    if not itinerary:
        return

    locations = itinerary.setdefault("locations", [])
    insert_index = len(locations)
    if insert_after:
        for idx, existing in enumerate(locations):
            if existing.get("name") == insert_after or existing.get("city") == insert_after:
                insert_index = idx + 1
                break
    locations.insert(insert_index, destination)


def _remove_from_state(itinerary: Dict[str, Any], destination_name: str):
    if not itinerary:
        return
    locations = itinerary.get("locations") or []
    itinerary["locations"] = [
        loc
        for loc in locations
        if not (
            loc.get("name") == destination_name or loc.get("city") == destination_name
        )
    ]


def _update_duration_in_state(itinerary: Dict[str, Any], destination_name: str, new_duration: int):
    if not itinerary:
        return
    for loc in itinerary.get("locations", []):
        if loc.get("name") == destination_name or loc.get("city") == destination_name:
            loc["duration_days"] = new_duration
            break


def _update_details_in_state(itinerary: Dict[str, Any], destination_name: str, updates: Dict[str, Any]):
    if not itinerary:
        return
    for loc in itinerary.get("locations", []):
        if loc.get("name") == destination_name or loc.get("city") == destination_name:
            loc.update(updates)
            break


def get_current_itinerary(tool_context: ToolContext):
    """Return the current itinerary for the active web session."""

    itinerary = _extract_itinerary(tool_context)

    if not itinerary:
        print("[get_current_itinerary] ❌ No itinerary found!")
        return {
            "status": "no_itinerary",
            "message": "No itinerary found. Please ensure you're viewing your trip in the app.",
        }

    print(
        f"[get_current_itinerary] ✅ Returning itinerary with {len(itinerary.get('locations', []))} locations"
    )
    return {"status": "success", "itinerary": itinerary}


def add_destination(
    name: str,
    city: str,
    country: str,
    duration_days: int,
    activity_type: Optional[str] = None,
    description: Optional[str] = None,
    notes: Optional[str] = None,
    insert_after: Optional[str] = None,
    tool_context: ToolContext = None,
):
    """Add a new destination to the user's itinerary.

    Args:
        name: Name of the destination
        city: City name
        country: Country name
        duration_days: Number of days to stay
        activity_type: Type of activities (e.g., 'diving', 'cultural', 'trekking')
        description: Brief description of the destination
        notes: Additional notes, tips, or important information about the destination
        insert_after: Name of destination to insert after (optional)
        tool_context: ADK tool context
    """

    try:
        print(f"\n📍 ADD DESTINATION called:")
        print(f"   Name: {name}")
        print(f"   City: {city}")
        print(f"   Country: {country}")

        itinerary = _extract_itinerary(tool_context)
        new_destination = _build_destination_payload(
            name=name,
            city=city,
            country=country,
            duration_days=duration_days,
            activity_type=activity_type,
            description=description,
            notes=notes,
            itinerary=itinerary,
        )

        session_id = _get_session_id(tool_context)
        print(f"   Session ID determined: {session_id}")
        print(f"   Insert after: {insert_after}")

        response = requests.post(
            f"{ITINERARY_API_URL}/add",
            json={
                "destination": new_destination,
                "insert_after": insert_after,
                "session_id": session_id,
            },
            timeout=10,
        )

        if response.status_code == 200:
            result = response.json()
            destination_payload = result.get("destination", new_destination)
            _insert_into_state(itinerary, destination_payload, insert_after)
            if tool_context and hasattr(tool_context, "state"):
                tool_context.state["itinerary"] = itinerary
            return {
                "status": "success",
                "message": f"Added {name} to the itinerary for {duration_days} days",
                "destination": destination_payload,
            }

        return {
            "status": "error",
            "message": f"Failed to add destination: {response.text}",
        }

    except Exception as exc:
        return {"status": "error", "message": f"Error adding destination: {exc}"}


def remove_destination(
    destination_name: str,
    tool_context: ToolContext = None,
):
    """Remove a destination from the user's itinerary."""

    try:
        itinerary = _extract_itinerary(tool_context)
        session_id = _get_session_id(tool_context)

        response = requests.post(
            f"{ITINERARY_API_URL}/remove",
            json={
                "destination_name": destination_name,
                "session_id": session_id,
            },
            timeout=10,
        )

        if response.status_code == 200:
            _remove_from_state(itinerary, destination_name)
            if tool_context and hasattr(tool_context, "state"):
                tool_context.state["itinerary"] = itinerary
            return {
                "status": "success",
                "message": f"Removed {destination_name} from the itinerary",
            }

        return {
            "status": "error",
            "message": f"Failed to remove destination: {response.text}",
        }

    except Exception as exc:
        return {"status": "error", "message": f"Error removing destination: {exc}"}


def update_destination_duration(
    destination_name: str,
    new_duration_days: int,
    tool_context: ToolContext = None,
):
    """Update the stay duration for a destination."""

    try:
        itinerary = _extract_itinerary(tool_context)
        session_id = _get_session_id(tool_context)

        response = requests.post(
            f"{ITINERARY_API_URL}/update-duration",
            json={
                "destination_name": destination_name,
                "new_duration_days": new_duration_days,
                "session_id": session_id,
            },
            timeout=10,
        )

        if response.status_code == 200:
            _update_duration_in_state(itinerary, destination_name, new_duration_days)
            if tool_context and hasattr(tool_context, "state"):
                tool_context.state["itinerary"] = itinerary
            return {
                "status": "success",
                "message": f"Updated {destination_name} to {new_duration_days} days",
            }

        return {
            "status": "error",
            "message": f"Failed to update duration: {response.text}",
        }

    except Exception as exc:
        return {"status": "error", "message": f"Error updating duration: {exc}"}


def update_destination(
    destination_name: str,
    name: Optional[str] = None,
    city: Optional[str] = None,
    country: Optional[str] = None,
    duration_days: Optional[int] = None,
    activity_type: Optional[str] = None,
    description: Optional[str] = None,
    notes: Optional[str] = None,
    tool_context: ToolContext = None,
):
    """Patch mutable fields on a destination.

    Args:
        destination_name: Current name of the destination to update
        name: New name (optional)
        city: New city (optional)
        country: New country (optional)
        duration_days: New duration in days (optional)
        activity_type: New activity type (optional)
        description: New description (optional)
        notes: New or additional notes (optional)
        tool_context: ADK tool context
    """

    try:
        itinerary = _extract_itinerary(tool_context)
        session_id = _get_session_id(tool_context)

        updates: Dict[str, Any] = {}
        if name is not None:
            updates["name"] = name
        if city is not None:
            updates["city"] = city
        if country is not None:
            updates["country"] = country
        if duration_days is not None:
            updates["duration_days"] = duration_days
        if activity_type is not None:
            updates["activity_type"] = activity_type
        if description is not None:
            updates["description"] = description
        if notes is not None:
            updates["notes"] = notes

        response = requests.post(
            f"{ITINERARY_API_URL}/update",
            json={
                "destination_name": destination_name,
                "updates": updates,
                "session_id": session_id,
            },
            timeout=10,
        )

        if response.status_code == 200:
            _update_details_in_state(itinerary, destination_name, updates)
            if tool_context and hasattr(tool_context, "state"):
                tool_context.state["itinerary"] = itinerary
            return {
                "status": "success",
                "message": f"Updated {destination_name}",
                "updates": updates,
            }

        return {
            "status": "error",
            "message": f"Failed to update destination: {response.text}",
        }

    except Exception as exc:
        return {"status": "error", "message": f"Error updating destination: {exc}"}


def append_destination_notes(
    destination_name: str,
    additional_notes: str,
    tool_context: ToolContext = None,
):
    """Append additional notes to a destination's existing notes.

    This is useful for adding context without overwriting existing information.

    Args:
        destination_name: Name of the destination
        additional_notes: Notes to append to existing notes
        tool_context: ADK tool context
    """

    try:
        itinerary = _extract_itinerary(tool_context)

        # Find the destination and get existing notes
        existing_notes = ""
        for loc in itinerary.get("locations", []):
            if loc.get("name") == destination_name or loc.get("city") == destination_name:
                existing_notes = loc.get("notes", "")
                break

        # Combine existing and new notes
        if existing_notes:
            combined_notes = f"{existing_notes}\n\n{additional_notes}"
        else:
            combined_notes = additional_notes

        # Use the update function to save the combined notes
        return update_destination(
            destination_name=destination_name,
            notes=combined_notes,
            tool_context=tool_context,
        )

    except Exception as exc:
        return {"status": "error", "message": f"Error appending notes: {exc}"}
