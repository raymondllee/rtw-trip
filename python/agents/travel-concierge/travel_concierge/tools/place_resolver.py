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

"""
Google Places API integration for resolving locations to stable Place IDs.

This service provides:
- Place ID lookup from location names
- Caching to minimize API costs
- Fallback to UUID for custom locations
- Rich place metadata (coordinates, address, timezone, etc.)
"""

import os
import googlemaps
from functools import lru_cache
from typing import Optional, Dict, Tuple
from datetime import datetime, timezone
import hashlib


class PlaceResolver:
    """
    Resolves location queries to Google Place IDs with caching.

    Usage:
        resolver = PlaceResolver()
        place_info = resolver.resolve_place("Tokyo, Japan")
        # Returns: {'place_id': 'ChIJ...', 'name': 'Tokyo', ...}
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize PlaceResolver with Google Maps API key.

        Args:
            api_key: Google Maps API key. If not provided, reads from
                    GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY environment variable.
        """
        self.api_key = api_key or os.getenv('GOOGLE_PLACES_API_KEY') or os.getenv('GOOGLE_MAPS_API_KEY')
        if not self.api_key:
            raise ValueError(
                "Google Maps API key required. Set GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY "
                "environment variable or pass api_key parameter."
            )

        self.gmaps = googlemaps.Client(key=self.api_key)
        self._cache = {}  # In-memory cache (will be upgraded to Firestore)

    def _cache_key(self, query: str, location_type: Optional[str] = None) -> str:
        """Generate cache key for a query."""
        key_str = f"{query.lower().strip()}|{location_type or 'any'}"
        return hashlib.md5(key_str.encode()).hexdigest()

    def resolve_place(
        self,
        query: str,
        location_type: Optional[str] = None,
        use_cache: bool = True
    ) -> Optional[Dict]:
        """
        Resolve a location query to a Google Place ID with full details.

        Args:
            query: Location query like "Tokyo, Japan" or "Eiffel Tower"
            location_type: Optional hint like "city", "airport", "landmark"
            use_cache: Whether to use cached results

        Returns:
            Dict with place information or None if not found:
            {
                'place_id': 'ChIJ...',
                'name': 'Tokyo',
                'coordinates': {'lat': 35.6762, 'lng': 139.6503},
                'formatted_address': 'Tokyo, Japan',
                'types': ['locality', 'political'],
                'country': 'Japan',
                'city': 'Tokyo',
                'administrative_area': 'Tokyo',
                'timezone': 'Asia/Tokyo'
            }
        """
        # Check cache first
        cache_key = self._cache_key(query, location_type)
        if use_cache and cache_key in self._cache:
            print(f"🗄️  Cache hit for '{query}'")
            return self._cache[cache_key]

        try:
            print(f"🔍 Looking up Place ID for: {query}")

            # Use Find Place API for initial lookup
            find_result = self.gmaps.find_place(
                input=query,
                input_type='textquery',
                fields=['place_id', 'name', 'geometry', 'formatted_address', 'types']
            )

            if not find_result.get('candidates'):
                print(f"❌ No results found for '{query}'")
                return None

            # Get the best candidate
            place = find_result['candidates'][0]
            place_id = place['place_id']

            # Get detailed information
            # Note: field names must match Google Places API v1 spec
            details_result = self.gmaps.place(
                place_id=place_id,
                fields=[
                    'place_id', 'name', 'formatted_address', 'geometry',
                    'address_component', 'type', 'utc_offset'  # Fixed field names
                ]
            )

            if details_result['status'] != 'OK':
                print(f"❌ Failed to get place details for {place_id}")
                return None

            details = details_result['result']

            # Extract structured information
            place_info = {
                'place_id': place_id,
                'name': details.get('name', query),
                'coordinates': {
                    'lat': details['geometry']['location']['lat'],
                    'lng': details['geometry']['location']['lng']
                },
                'formatted_address': details.get('formatted_address', ''),
                'types': details.get('types', details.get('type', [])),  # Try both field names
                'raw_data': details  # Keep full response for reference
            }

            # Parse address components (field name is 'address_component' not 'address_components')
            address_components = details.get('address_component', details.get('address_components', []))
            place_info.update(self._parse_address_components(address_components))

            # Get timezone
            lat = place_info['coordinates']['lat']
            lng = place_info['coordinates']['lng']
            timestamp = int(datetime.now(timezone.utc).timestamp())

            try:
                tz_result = self.gmaps.timezone((lat, lng), timestamp=timestamp)
                if tz_result['status'] == 'OK':
                    place_info['timezone'] = tz_result['timeZoneId']
                    place_info['timezone_name'] = tz_result['timeZoneName']
            except Exception as e:
                print(f"⚠️ Could not get timezone: {e}")
                place_info['timezone'] = None

            # Cache the result
            self._cache[cache_key] = place_info

            print(f"✅ Found Place ID: {place_id} for '{query}'")
            return place_info

        except googlemaps.exceptions.ApiError as e:
            print(f"❌ Google Maps API error for '{query}': {e}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error resolving '{query}': {e}")
            import traceback
            traceback.print_exc()
            return None

    def _parse_address_components(self, components: list) -> Dict:
        """
        Parse Google address components into structured data.

        Extracts: country, country_code, city, administrative_area, postal_code
        """
        parsed = {
            'country': None,
            'country_code': None,
            'city': None,
            'administrative_area': None,
            'postal_code': None
        }

        for component in components:
            types = component.get('types', [])

            if 'country' in types:
                parsed['country'] = component.get('long_name')
                parsed['country_code'] = component.get('short_name')  # ISO 3166-1 alpha-2
            elif 'locality' in types:
                parsed['city'] = component.get('long_name')
            elif 'administrative_area_level_1' in types:
                parsed['administrative_area'] = component.get('long_name')
            elif 'postal_code' in types:
                parsed['postal_code'] = component.get('long_name')

        return parsed

    def batch_resolve(self, queries: list[str]) -> Dict[str, Optional[Dict]]:
        """
        Resolve multiple location queries in batch.

        Args:
            queries: List of location query strings

        Returns:
            Dict mapping query -> place_info
        """
        results = {}
        for query in queries:
            results[query] = self.resolve_place(query)
        return results

    def is_place_id(self, identifier: str) -> bool:
        """
        Check if a string is a valid Google Place ID.

        Place IDs start with specific prefixes:
        - ChIJ: Most places
        - GhIJ: Synthetic geocodes
        - EhIJ: Encoded addresses
        """
        if not isinstance(identifier, str):
            return False

        return any(identifier.startswith(prefix) for prefix in ['ChIJ', 'GhIJ', 'EhIJ'])

    def get_place_details(self, place_id: str) -> Optional[Dict]:
        """
        Get full details for a known Place ID.

        Useful for resolving Place IDs back to location information.
        Includes: country, country_code, city, administrative_area, coordinates, timezone
        """
        if not self.is_place_id(place_id):
            print(f"❌ Invalid Place ID: {place_id}")
            return None

        try:
            result = self.gmaps.place(
                place_id=place_id,
                fields=[
                    'place_id', 'name', 'formatted_address', 'geometry',
                    'address_component', 'type', 'utc_offset'
                ]
            )

            if result['status'] == 'OK':
                details = result['result']
                parsed_address = self._parse_address_components(
                    details.get('address_component', details.get('address_components', []))
                )

                place_info = {
                    'place_id': place_id,
                    'name': details.get('name'),
                    'coordinates': {
                        'lat': details['geometry']['location']['lat'],
                        'lng': details['geometry']['location']['lng']
                    },
                    'formatted_address': details.get('formatted_address'),
                    'types': details.get('types', details.get('type', [])),
                    **parsed_address
                }

                # Get timezone for this location
                try:
                    from datetime import datetime, timezone as tz
                    lat = place_info['coordinates']['lat']
                    lng = place_info['coordinates']['lng']
                    timestamp = int(datetime.now(tz.utc).timestamp())
                    tz_result = self.gmaps.timezone((lat, lng), timestamp=timestamp)
                    if tz_result['status'] == 'OK':
                        place_info['timezone'] = tz_result['timeZoneId']
                        place_info['timezone_name'] = tz_result['timeZoneName']
                except Exception as e:
                    print(f"⚠️ Could not get timezone for {place_id}: {e}")

                return place_info

            return None

        except Exception as e:
            print(f"❌ Error getting details for Place ID {place_id}: {e}")
            return None


# Global instance (will be initialized with API key from environment)
_resolver_instance = None


def get_place_resolver() -> PlaceResolver:
    """Get or create the global PlaceResolver instance."""
    global _resolver_instance
    if _resolver_instance is None:
        _resolver_instance = PlaceResolver()
    return _resolver_instance
