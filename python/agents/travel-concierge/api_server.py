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

"""Simple Flask API server for the travel concierge agent"""

from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
import json
import logging
import re
import time
import uuid
import requests
import os
from datetime import datetime
from typing import Any, Dict, List

try:
    from google.cloud import firestore
    from google.oauth2 import service_account
except Exception:  # pragma: no cover - Firestore optional
    firestore = None
    service_account = None

from travel_concierge.tools.cost_tracker import CostTrackerService
from travel_concierge.tools.cost_manager import _to_float
from travel_concierge.shared_libraries.types import CostItem
from travel_concierge.tools.destination_id_validator import (
    validate_cost_items,
    is_valid_destination_id,
    build_destination_lookup
)


def get_transport_icon(transport_mode: str) -> str:
    """Return the emoji icon for a given transport mode."""
    icons = {
        'plane': '✈️',
        'train': '🚂',
        'bus': '🚌',
        'car': '🚗',
        'ferry': '🚢',
        'walking': '🚶',
        'other': '🚶'
    }
    return icons.get(transport_mode, '✈️')


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula."""
    import math
    R = 6371  # Earth's radius in km

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c


def get_transport_mode_for_distance(distance_km: float, same_country: bool = True) -> str:
    """Determine appropriate transport mode based on distance."""
    if distance_km > 1000:
        return 'plane'
    elif distance_km > 500:
        return 'plane' if not same_country else 'train'
    elif distance_km > 100:
        return 'train'
    elif distance_km > 20:
        return 'car'
    else:
        return 'walking'


def estimate_transport_cost(distance_km: float, transport_mode: str, num_travelers: int = 3) -> float:
    """Estimate transport cost based on distance and mode. Returns total for all travelers."""
    cost_per_person = 0

    if transport_mode == 'plane':
        # Flight costs based on distance tiers
        if distance_km < 500:
            cost_per_person = 150
        elif distance_km < 1500:
            cost_per_person = 300
        elif distance_km < 4000:
            cost_per_person = 500
        elif distance_km < 8000:
            cost_per_person = 800
        else:
            cost_per_person = 1200
    elif transport_mode == 'train':
        cost_per_person = max(50, distance_km * 0.15)
    elif transport_mode == 'bus':
        cost_per_person = max(20, distance_km * 0.08)
    elif transport_mode == 'car':
        cost_per_person = max(30, distance_km * 0.12)
    elif transport_mode == 'ferry':
        cost_per_person = max(25, distance_km * 0.20)
    elif transport_mode == 'walking':
        cost_per_person = 0
    else:
        cost_per_person = max(50, distance_km * 0.10)

    return round(cost_per_person * num_travelers, 2)


class SessionStore:
    """Session and cost tracker persistence with Firestore fallback."""

    def __init__(self, collection_name: str = 'web_sessions') -> None:
        self._logger = logging.getLogger(__name__)
        self._collection_name = collection_name
        self._use_firestore = firestore is not None
        self._client = None
        self._collection = None
        self._session_cache: Dict[str, Dict[str, Any]] = {}
        self._cost_cache: Dict[str, CostTrackerService] = {}
        self._metadata: Dict[str, Dict[str, float]] = {}
        self._metadata_loaded = False

        # In-memory fallback structures
        self._fallback_sessions: Dict[str, Dict[str, Any]] = {}
        self._fallback_costs: Dict[str, CostTrackerService] = {}

        if self._use_firestore:
            try:
                # Try to get credentials from environment variable
                credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
                if credentials_json:
                    import json
                    credentials_info = json.loads(credentials_json)
                    credentials = service_account.Credentials.from_service_account_info(credentials_info)
                    project_id = credentials_info.get('project_id') or os.getenv('GOOGLE_CLOUD_PROJECT')
                    self._client = firestore.Client(credentials=credentials, project=project_id)
                    self._logger.info('SessionStore using Firestore backend with JSON credentials')
                else:
                    # Fall back to default credentials (ADC)
                    self._client = firestore.Client()
                    self._logger.info('SessionStore using Firestore backend with default credentials')

                self._collection = self._client.collection(self._collection_name)
            except Exception as exc:  # pragma: no cover
                self._logger.warning('Firestore client unavailable (%s); using in-memory store', exc)
                self._use_firestore = False

    @staticmethod
    def _now() -> float:
        return time.time()

    def _load_session_from_firestore(self, session_id: str) -> Dict[str, Any]:
        if not self._collection:
            return {'changes': [], 'last_activity_epoch': self._now(), 'created_at_epoch': self._now()}

        doc = self._collection.document(session_id).get()
        if doc.exists:
            data = doc.to_dict() or {}
            data.setdefault('changes', [])
            data.setdefault('last_activity_epoch', self._now())
            data.setdefault('created_at_epoch', data.get('last_activity_epoch', self._now()))
            return data

        return {'changes': [], 'last_activity_epoch': self._now(), 'created_at_epoch': self._now()}

    def _ensure_session_cache(self, session_id: str) -> Dict[str, Any]:
        if session_id in self._session_cache:
            return self._session_cache[session_id]

        if self._use_firestore:
            data = self._load_session_from_firestore(session_id)
        else:
            data = self._fallback_sessions.setdefault(
                session_id,
                {'changes': [], 'last_activity_epoch': self._now(), 'created_at_epoch': self._now()},
            )

        self._session_cache[session_id] = data
        self._metadata[session_id] = {
            'last_activity_epoch': data.get('last_activity_epoch', self._now()),
            'created_at_epoch': data.get('created_at_epoch', self._now()),
        }
        return data

    def _persist_session(self, session_id: str) -> None:
        data = self._session_cache.get(session_id)
        if not data:
            return

        last_activity = data.get('last_activity_epoch', self._now())
        created_at = data.get('created_at_epoch', last_activity)
        self._metadata[session_id] = {
            'last_activity_epoch': last_activity,
            'created_at_epoch': created_at,
        }

        if self._use_firestore and self._collection:
            payload = {
                'changes': data.get('changes', []),
                'last_activity': firestore.SERVER_TIMESTAMP,
                'last_activity_epoch': last_activity,
                'created_at_epoch': created_at,
            }
            if 'created_at' not in data:
                payload['created_at'] = firestore.SERVER_TIMESTAMP
                data['created_at'] = True
            self._collection.document(session_id).set(payload, merge=True)
        else:
            self._fallback_sessions[session_id] = data

    def append_change(self, session_id: str, change: Dict[str, Any]) -> int:
        data = self._ensure_session_cache(session_id)
        data.setdefault('changes', []).append(change)
        data['last_activity_epoch'] = self._now()
        self._session_cache[session_id] = data
        self._persist_session(session_id)
        return len(data['changes'])

    def touch_session(self, session_id: str) -> None:
        data = self._ensure_session_cache(session_id)
        data['last_activity_epoch'] = self._now()
        self._session_cache[session_id] = data
        if self._use_firestore and self._collection:
            self._collection.document(session_id).set(
                {
                    'last_activity': firestore.SERVER_TIMESTAMP,
                    'last_activity_epoch': data['last_activity_epoch'],
                },
                merge=True,
            )
        else:
            self._fallback_sessions[session_id] = data
        self._metadata[session_id] = {
            'last_activity_epoch': data['last_activity_epoch'],
            'created_at_epoch': data.get('created_at_epoch', data['last_activity_epoch']),
        }

    def pop_changes(self, session_id: str) -> List[Dict[str, Any]]:
        data = self._ensure_session_cache(session_id)
        changes = list(data.get('changes', []))
        data['changes'] = []
        self._session_cache[session_id] = data
        self._persist_session(session_id)
        return changes

    def delete_session(self, session_id: str) -> None:
        self._session_cache.pop(session_id, None)
        self._cost_cache.pop(session_id, None)
        self._metadata.pop(session_id, None)
        if self._use_firestore and self._collection:
            try:
                self._collection.document(session_id).delete()
            except Exception as exc:  # pragma: no cover
                self._logger.warning('Failed to delete session %s from Firestore: %s', session_id, exc)
        else:
            self._fallback_sessions.pop(session_id, None)
            self._fallback_costs.pop(session_id, None)

    def get_cost_tracker(self, session_id: str) -> CostTrackerService:
        if session_id in self._cost_cache:
            return self._cost_cache[session_id]

        if self._use_firestore and self._collection:
            doc = self._collection.document(session_id).get()
            costs_data = []
            if doc.exists:
                doc_data = doc.to_dict() or {}
                costs_data = doc_data.get('costs', [])
        else:
            tracker = self._fallback_costs.get(session_id)
            if tracker:
                self._cost_cache[session_id] = tracker
                return tracker
            costs_data = []

        tracker = CostTrackerService()
        for item in costs_data:
            try:
                tracker.costs.append(CostItem(**item))
            except Exception as exc:
                self._logger.warning('Skipping malformed cost item for session %s: %s', session_id, exc)

        self._cost_cache[session_id] = tracker
        return tracker

    def save_cost_tracker(self, session_id: str, tracker: CostTrackerService) -> None:
        self._cost_cache[session_id] = tracker
        now_epoch = self._now()
        self._metadata.setdefault(session_id, {
            'created_at_epoch': now_epoch,
            'last_activity_epoch': now_epoch,
        })
        self._metadata[session_id]['last_activity_epoch'] = now_epoch

        if self._use_firestore and self._collection:
            payload = {
                'costs': [cost.model_dump() for cost in tracker.costs],
                'costs_updated_at': firestore.SERVER_TIMESTAMP,
                'last_activity': firestore.SERVER_TIMESTAMP,
                'last_activity_epoch': now_epoch,
            }
            self._collection.document(session_id).set(payload, merge=True)
        else:
            self._fallback_costs[session_id] = tracker

    def list_sessions(self) -> Dict[str, Dict[str, float]]:
        if self._use_firestore and self._collection and not self._metadata_loaded:
            for doc in self._collection.stream():
                data = doc.to_dict() or {}
                self._metadata[doc.id] = {
                    'last_activity_epoch': data.get('last_activity_epoch', 0.0),
                    'created_at_epoch': data.get('created_at_epoch', 0.0),
                }
            self._metadata_loaded = True

        if not self._use_firestore:
            for sid, data in self._fallback_sessions.items():
                self._metadata[sid] = {
                    'last_activity_epoch': data.get('last_activity_epoch', 0.0),
                    'created_at_epoch': data.get('created_at_epoch', 0.0),
                }

        return self._metadata

    def get_recent_sessions(self, exclude_default: bool = False) -> List[str]:
        metadata = self.list_sessions()
        sessions = [
            sid for sid in metadata
            if not (exclude_default and sid == 'default_session')
        ]
        sessions.sort(key=lambda sid: metadata[sid].get('last_activity_epoch', 0.0))
        return sessions


def get_firestore_client():
    """Get a configured Firestore client with proper credentials."""
    if not firestore:
        return None

    try:
        # Try to get credentials from environment variable
        credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
        if credentials_json:
            import json
            credentials_info = json.loads(credentials_json)
            credentials = service_account.Credentials.from_service_account_info(credentials_info)
            project_id = credentials_info.get('project_id') or os.getenv('GOOGLE_CLOUD_PROJECT')
            return firestore.Client(credentials=credentials, project=project_id)
        else:
            # Fall back to default credentials (ADC)
            return firestore.Client()
    except Exception as exc:
        logger = logging.getLogger(__name__)
        logger.warning('Failed to create Firestore client: %s', exc)
        return None


session_store = SessionStore()
logger = logging.getLogger('travel_concierge.api')

# Determine web directory path
# In production (Railway), serve from built dist directory
# In development, serve from web directory
if os.path.exists('/app/web/dist'):
    WEB_DIR = '/app/web/dist'
elif os.path.exists('/app/web'):
    WEB_DIR = '/app/web'
else:
    # Development: check for dist first, fallback to web
    dev_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../web/dist'))
    dev_web = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../web'))
    WEB_DIR = dev_dist if os.path.exists(dev_dist) else dev_web

app = Flask(__name__, static_folder=WEB_DIR, static_url_path='')
CORS(app)  # Enable CORS for frontend requests

# ADK API Server endpoint (you need to run: adk api_server travel_concierge)
ADK_API_URL = "http://127.0.0.1:8000"
APP_NAME = "travel_concierge"
USER_ID = "web_user"

def normalize_destination_id(raw_id, name):
    """Return destination identifiers as stable strings."""
    if isinstance(raw_id, str):
        ident = raw_id.strip()
        if ident:
            return ident

    if raw_id is not None:
        return str(raw_id)

    base_name = (name or "").strip() or "unknown destination"
    clean = re.sub(r'[^a-z0-9]+', '_', base_name.lower()).strip('_')
    if clean:
        return clean

    # Fallback unique identifier when no usable name exists
    return str(uuid.uuid4())


def resolve_session_id(requested_session_id: str) -> str:
    """Resolve legacy default_session identifiers to the most recent active session."""
    if requested_session_id != 'default_session':
        return requested_session_id

    metadata = session_store.list_sessions()
    now = time.time()
    recent_sessions = session_store.get_recent_sessions(exclude_default=True)

    for session_id in reversed(recent_sessions):
        last_activity = metadata.get(session_id, {}).get('last_activity_epoch')
        if last_activity and (now - last_activity) < 600:
            return session_id

    if recent_sessions:
        return recent_sessions[-1]

    return requested_session_id


def record_itinerary_change(session_id: str, change: Dict[str, Any]) -> tuple[str, int]:
    """Store an itinerary change and return the resolved session ID and pending count."""
    resolved_session = resolve_session_id(session_id or 'default_session')
    session_store.touch_session(resolved_session)
    pending = session_store.append_change(resolved_session, change)
    return resolved_session, pending

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Handle chat requests with optional context about current trip leg.

    Expected request body:
    {
        "message": "user message",
        "context": {
            "leg_name": "Southeast Asia",
            "destinations": ["Bangkok", "Chiang Mai", "Phuket"],
            "start_date": "2024-01-15",
            "end_date": "2024-02-10"
        },
        "session_id": "optional-session-id"
    }
    """
    print("=" * 100)
    print("🚀 CHAT ENDPOINT CALLED - CODE VERSION 2.0")
    print("=" * 100)

    data = request.json
    message = data.get('message', '')
    context = data.get('context', {})
    session_id = data.get('session_id')
    initialize_itinerary = data.get('initialize_itinerary', False)
    scenario_id = data.get('scenario_id')

    # Generate session ID if not provided
    if not session_id or session_id == 'null':
        session_id = f"session_{uuid.uuid4().hex[:12]}"

    print(f"Received message: {message}")
    print(f"Received context: {json.dumps(context, indent=2)}")
    print(f"Session ID: {session_id}")
    print(f"Scenario ID: {scenario_id}")
    print(f"Initialize itinerary: {initialize_itinerary}")

    # Build context-aware message - keep it concise to avoid timeouts
    if context and context.get('destinations'):
        destinations = context.get('destinations', [])
        leg_name = context.get('leg_name', 'Unknown')
        sub_leg_name = context.get('sub_leg_name', None)

        # Extract destination names for verification
        dest_names = [d.get('name', 'Unknown') if isinstance(d, dict) else d for d in destinations]

        # Create destination verification helper
        dest_verification = f"""
AVAILABLE DESTINATIONS IN CURRENT ITINERARY:
{json.dumps({str(i): name for i, name in enumerate(dest_names)}, indent=2)}

IMPORTANT: Before taking any action on a destination, you MUST:
1. Check if the destination exists in the list above
2. If the destination is NOT in the list, inform the user it's not in the current itinerary
3. Only use tools or perform actions for destinations that exist in the current itinerary
4. Always reference destinations by their exact name as shown above
"""

        # Create compact itinerary JSON for tool parsing
        itinerary_json = json.dumps({
            "locations": destinations,
            "trip": {
                "start_date": context.get('start_date', ''),
                "end_date": context.get('end_date', ''),
                "leg_name": leg_name,
                "sub_leg_name": sub_leg_name
            }
        }, separators=(',', ':'))  # Compact JSON without spaces

        # Add context about filtering to help LLM understand scope
        if sub_leg_name:
            scope_info = f"{sub_leg_name} ({len(destinations)} destinations)"
        elif leg_name and leg_name != 'All':
            scope_info = f"{leg_name} ({len(destinations)} destinations)"
        else:
            scope_info = f"Full itinerary ({len(destinations)} destinations)"

        context_prompt = f"""
I'm planning a trip. Currently viewing: {scope_info}

{dest_verification}

CURRENT_ITINERARY_DATA:
```json
{itinerary_json}
```

User question: {message}

CRITICAL REMINDERS:
1. NEVER claim you've added/removed/modified destinations without calling a tool
2. ALWAYS use the appropriate tool (add_destination, remove_destination, update_destination, etc.) for itinerary changes
3. Let the tool response inform the user - don't describe the change yourself
4. Only work with destinations that exist in the available destinations list above
"""
    else:
        context_prompt = message

    try:
        # Create or verify session exists in ADK and update state
        session_endpoint = f"{ADK_API_URL}/apps/{APP_NAME}/users/{USER_ID}/sessions/{session_id}"
        try:
            # Create/verify session exists
            session_resp = requests.post(session_endpoint)
            print(f"Session creation response: {session_resp.status_code}")

            if session_resp.status_code == 200:
                print(f"✅ Session created: {session_id}")

                # Log what we're about to pass in state
                if initialize_itinerary:
                    destinations = context.get('destinations', [])
                    if destinations:
                        print(f"✅ Will pass itinerary with {len(destinations)} destinations in run payload state")
                        print(f"   First destination: {destinations[0].get('name', 'unknown')}")
                    else:
                        print(f"⚠️ Warning: initialize_itinerary=True but no destinations in context!")
            else:
                print(f"❌ Session creation failed: {session_resp.text}")
        except Exception as e:
            print(f"Session creation warning: {e}")

        # Prepare the message for ADK API
        adk_payload = {
            "session_id": session_id,
            "app_name": APP_NAME,
            "user_id": USER_ID,
            "new_message": {
                "role": "user",
                "parts": [
                    {
                        "text": context_prompt,
                    }
                ],
            },
        }

        # Always pass web_session_id in state so tools can access it
        adk_payload["state"] = {
            "web_session_id": session_id
        }
        if scenario_id:
            adk_payload["state"]["scenario_id"] = scenario_id

        logger.info(
            "Dispatching chat request",
            extra={
                'session_id': session_id,
                'scenario_id': scenario_id,
                'initialize_itinerary': initialize_itinerary,
                'destination_count': len(context.get('destinations', [])) if context else 0,
            }
        )
        print(f"\n🔧 ADK STATE DEBUG:")
        print(f"   Session ID being passed: {session_id}")
        print(f"   Scenario ID being passed: {scenario_id}")
        print(f"   Full state payload: {adk_payload['state']}")
        print(f"{'='*50}\n")

        # Track session activity for the default_session fix
        session_store.touch_session(session_id)

        # ALWAYS pass itinerary data when context has destinations
        # This ensures tools like generate_itinerary_summary can access the itinerary
        if context.get('destinations'):
            itinerary_data = {
                "locations": context.get('destinations', []),
                "trip": {
                    "start_date": context.get('start_date', ''),
                    "end_date": context.get('end_date', ''),
                    "leg_name": context.get('leg_name', 'Current Leg')
                }
            }
            adk_payload["state"]["itinerary"] = itinerary_data
            print(f"✅ Passing itinerary with {len(context.get('destinations', []))} destinations in state")

            # Only set initialized flag on first message
            if initialize_itinerary:
                adk_payload["state"]["itinerary_initialized"] = True

        print(f"Sending to ADK: {context_prompt[:100]}...")

        # Call the ADK API server
        run_endpoint = f"{ADK_API_URL}/run_sse"
        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "Accept": "text/event-stream",
        }

        response_text = ""
        with requests.post(
            run_endpoint,
            data=json.dumps(adk_payload),
            headers=headers,
            stream=True,
            timeout=300  # 5 minutes for large itineraries with many destinations
        ) as r:
            for chunk in r.iter_lines():
                if not chunk:
                    continue
                json_string = chunk.decode("utf-8").removeprefix("data: ").strip()
                try:
                    event = json.loads(json_string)

                    # Log the full event for debugging
                    print(f"\n{'='*80}")
                    print(f"📨 SSE EVENT RECEIVED:")
                    print(f"{'='*80}")
                    print(json.dumps(event, indent=2))
                    print(f"{'='*80}\n")

                    # Extract text from agent response
                    if "content" in event and "parts" in event["content"]:
                        for part in event["content"]["parts"]:
                            if "text" in part:
                                text_content = part["text"]
                                response_text += text_content
                                print(f"💬 AGENT TEXT: {text_content}")

                                # DETECT HALLUCINATED ITINERARY CHANGES
                                hallucinated_patterns = [
                                    r'has been added',
                                    r'has been removed',
                                    r'has been updated',
                                    r'has been modified',
                                    r'has been changed',
                                    r'added to your itinerary',
                                    r'removed from your itinerary',
                                    r'updated your itinerary'
                                ]

                                import re
                                for pattern in hallucinated_patterns:
                                    if re.search(pattern, text_content, re.IGNORECASE):
                                        print(f"\n🚨 DETECTED HALLUCINATED ITINERARY CHANGE: '{text_content}'")
                                        print(f"⚠️ AGENT CLAIMED TO MAKE CHANGES WITHOUT CALLING TOOLS!")
                                        print(f"🔧 FORCING CORRECT BEHAVIOR: Agent must use tools for itinerary changes\n")
                                        # Override the hallucinated response
                                        response_text = "I need to use the proper tools to modify your itinerary. Let me call the appropriate tool to make this change."
                                        break

                            # Log function/tool calls
                            if "function_call" in part:
                                func_call = part["function_call"]
                                print(f"\n🔧 TOOL CALL:")
                                print(f"   Tool: {func_call.get('name', 'unknown')}")
                                print(f"   Args: {json.dumps(func_call.get('args', {}), indent=6)}")

                            # Log function responses
                            if "function_response" in part:
                                func_resp = part["function_response"]
                                print(f"\n✅ TOOL RESPONSE:")
                                print(f"   Tool: {func_resp.get('name', 'unknown')}")
                                resp_data = func_resp.get('response', {})
                                print(f"   Response: {json.dumps(resp_data, indent=6)[:500]}...")

                            # Log thought signatures (reasoning)
                            if "thought_signature" in part:
                                print(f"\n💭 AGENT REASONING:")
                                print(f"   {json.dumps(part['thought_signature'], indent=6)}")

                except json.JSONDecodeError:
                    continue

        # Check if response contains structured cost research data and extract summary
        final_response_text = response_text
        research_data = None
        saved_costs = False

        import sys
        print(f"\n{'='*80}", flush=True)
        print(f"🔍 CHECKING RESPONSE FOR STRUCTURED DATA", flush=True)
        print(f"{'='*80}", flush=True)
        print(f"Response length: {len(response_text)} chars", flush=True)
        print(f"Response preview: {response_text[:500]}...", flush=True)
        print(f"{'='*80}\n", flush=True)
        sys.stdout.flush()

        try:
            def _extract_cost_research_objects(text: str) -> list[dict]:
                """Extract all DestinationCostResearch-like JSON objects from the text."""
                decoder = json.JSONDecoder()
                idx = 0
                length = len(text)
                results = []

                def _collect(obj):
                    if isinstance(obj, dict) and "destination_name" in obj:
                        results.append(obj)
                    elif isinstance(obj, list):
                        for item in obj:
                            _collect(item)

                while idx < length:
                    char = text[idx]
                    if char not in ('{', '['):
                        idx += 1
                        continue

                    try:
                        obj, offset = decoder.raw_decode(text[idx:])
                    except json.JSONDecodeError:
                        idx += 1
                        continue

                    if offset <= 0:
                        idx += 1
                        continue

                    _collect(obj)
                    idx += offset

                    # Skip whitespace between objects
                    while idx < length and text[idx].isspace():
                        idx += 1

                return results

            research_items = _extract_cost_research_objects(response_text)
            print(f"🔎 Extracted {len(research_items)} cost research object(s)")

            summaries = []
            for research_data in research_items:
                destination_name = research_data.get('destination_name', 'Unknown Destination')
                summary = research_data.get('research_summary')
                if summary:
                    summaries.append(f"{destination_name}: {summary}")
                    print(f"✅ Extracted research_summary for chat: {summary[:100]}...")

                # Save the research data to Firestore via bulk-save API
                try:
                    # Try to find the matching destination_id from context
                    actual_destination_id = None

                    # Prefer the destination_id provided in the research payload
                    raw_destination_id = research_data.get('destination_id')
                    if raw_destination_id:
                        normalized_research_id = normalize_destination_id(raw_destination_id, destination_name)
                        matched_by_id = False
                        if context and context.get('destinations'):
                            for dest in context['destinations']:
                                if not isinstance(dest, dict):
                                    continue
                                for key in ('id', 'destination_id'):
                                    candidate_id = dest.get(key)
                                    if not candidate_id:
                                        continue
                                    candidate_norm = normalize_destination_id(candidate_id, dest.get('name', ''))
                                    if candidate_norm == normalized_research_id:
                                        actual_destination_id = normalized_research_id
                                        matched_by_id = True
                                        print(
                                            f"🎯 MATCHED by destination_id -> '{dest.get('name', '')}' "
                                            f"(ID {actual_destination_id})",
                                            flush=True
                                        )
                                        break
                                if matched_by_id:
                                    break
                        if not matched_by_id:
                            actual_destination_id = normalized_research_id
                            print(
                                f"✅ Using destination_id from research JSON: {actual_destination_id}",
                                flush=True
                            )

                    if actual_destination_id is None:
                        print(f"🔎 Looking for destination: '{destination_name}'", flush=True)
                        print(f"   Context has destinations: {context.get('destinations') is not None}", flush=True)

                        if context and context.get('destinations'):
                            for idx, dest in enumerate(context['destinations']):
                                dest_name = dest.get('name', '') if isinstance(dest, dict) else str(dest)
                                # Check if destination has an id field, if not check for timestamp-based ID
                                dest_id = None
                                if isinstance(dest, dict):
                                    # Try multiple possible ID field names
                                    dest_id = dest.get('id') or dest.get('destination_id') or dest.get('arrival_date')

                                print(f"   Checking dest[{idx}]: name='{dest_name}', id={dest_id}", flush=True)

                                # Match by name (case-insensitive, partial match)
                                name_match = (
                                    destination_name.lower() in dest_name.lower() or
                                    dest_name.lower() in destination_name.lower()
                                )

                                if name_match:
                                    # If no ID found, generate from arrival_date timestamp or use index
                                    if dest_id is None:
                                        # Use arrival_date to generate a stable ID if available
                                        if isinstance(dest, dict) and dest.get('arrival_date'):
                                            from datetime import datetime as dt
                                            # Convert date string to timestamp (milliseconds like 1759377102)
                                            try:
                                                date_obj = dt.strptime(dest['arrival_date'], '%Y-%m-%d')
                                                dest_id = int(date_obj.timestamp() * 1000)
                                            except Exception:
                                                dest_id = idx
                                        else:
                                            dest_id = idx

                                    actual_destination_id = normalize_destination_id(dest_id, dest_name)
                                    print(f"🎯 MATCHED '{destination_name}' to '{dest_name}' -> ID {actual_destination_id}", flush=True)
                                    break

                    if actual_destination_id is None:
                        # Fallback: generate a stable ID from the name
                        actual_destination_id = normalize_destination_id(None, destination_name)
                        print(f"⚠️ Could not match '{destination_name}' to any destination in context", flush=True)
                        if context and context.get('destinations'):
                            print(f"   Available: {[(i, d.get('name') if isinstance(d, dict) else d) for i, d in enumerate(context.get('destinations', []))]}", flush=True)
                        print(f"   Generated stable ID: '{actual_destination_id}'", flush=True)

                    print(f"📍 Final destination_id for save: {actual_destination_id}")

                    # Build cost_items similar to save_researched_costs tool
                    categories_map = {
                        'accommodation': 'accommodation',
                        'flights': 'flight',
                        'activities': 'activity',
                        'food_daily': 'food',
                        'transport_daily': 'transport'
                    }

                    cost_items = []
                    for research_cat, itinerary_cat in categories_map.items():
                        if research_cat not in research_data:
                            continue
                        cat_data = research_data.get(research_cat) or {}

                        base_usd = _to_float(cat_data.get('amount_mid', 0))
                        base_local = _to_float(cat_data.get('amount_local', 0))
                        currency_local = cat_data.get('currency_local', 'USD')

                        # Generate UUID for cost item
                        cost_id = str(uuid.uuid4())

                        cost_items.append({
                            'id': cost_id,
                            'category': itinerary_cat,
                            'amount': base_local if base_local else base_usd,
                            'currency': currency_local,
                            'amount_usd': base_usd,
                            'destination_id': actual_destination_id,
                            'booking_status': 'researched',
                            'source': 'cost_research',
                            'confidence': cat_data.get('confidence', 'medium'),
                            'notes': cat_data.get('notes', ''),
                            'researched_at': cat_data.get('researched_at', datetime.now().isoformat())
                        })

                    if not cost_items:
                        print(f"⚠️ No cost items generated for {destination_name}", flush=True)
                        continue

                    # Call bulk save API (using the same Flask server on port 5001)
                    save_url = "http://127.0.0.1:5001/api/costs/bulk-save"
                    save_resp = requests.post(
                        save_url,
                        json={
                            'session_id': session_id,
                            'scenario_id': scenario_id or 'current',  # Use scenario_id from context
                            'destination_id': actual_destination_id,  # Use matched destination ID
                            'destination_name': destination_name,
                            'cost_items': cost_items,
                        },
                        timeout=30,
                    )
                    if save_resp.status_code == 200:
                        print(f"✅ Saved cost research data to Firestore:", flush=True)
                        print(f"   Destination: {destination_name}", flush=True)
                        print(f"   Destination ID: {actual_destination_id}", flush=True)
                        print(f"   Cost items: {len(cost_items)}", flush=True)
                        saved_costs = True
                    else:
                        print(f"⚠️ Failed to save cost data: {save_resp.status_code}", flush=True)
                        print(f"   Response: {save_resp.text[:200]}", flush=True)
                except Exception as save_error:
                    import traceback
                    print(f"⚠️ Error saving cost research to Firestore: {save_error}")
                    print(f"   Traceback: {traceback.format_exc()}")

            if summaries:
                final_response_text = "\n\n".join(summaries)

        except Exception as e:
            import traceback
            print(f"⚠️ Could not extract research_summary from response: {e}")
            print(f"   Traceback: {traceback.format_exc()}")
            final_response_text = response_text

        return jsonify({
            'response': final_response_text or response_text or 'No response generated',
            'session_id': session_id,
            'status': 'success',
            'saved_to_firestore': saved_costs
        })

    except requests.exceptions.ConnectionError:
        import traceback
        error_details = traceback.format_exc()
        logger.error("ADK API connection error", exc_info=True)
        print(f"Connection error: {error_details}")
        return jsonify({
            'error': 'Could not connect to ADK API server. Please run: adk api_server travel_concierge',
            'status': 'error'
        }), 500
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.exception("Chat endpoint failure: %s", e)
        print(f"Error in chat endpoint: {error_details}")
        return jsonify({
            'error': str(e),
            'error_details': error_details,
            'status': 'error'
        }), 500

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a session"""
    session_store.delete_session(session_id)
    return jsonify({'status': 'success'})

# Itinerary modification endpoints
# These are called by the agent's tools to modify the user's itinerary

@app.route('/api/itinerary/add', methods=['POST'])
def add_destination_endpoint():
    """Add a destination to the itinerary"""
    data = request.json
    destination = data.get('destination', {})
    insert_after = data.get('insert_after')
    session_id = resolve_session_id(data.get('session_id') or 'default_session')
    session_store.touch_session(session_id)

    print(f"📍 ADD DESTINATION called:")
    print(f"   Session ID: {session_id}")
    print(f"   Destination: {destination.get('name')}")
    print(f"   Insert after: {insert_after}")

    change = {
        'type': 'add',
        'destination': destination,
        'insert_after': insert_after,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    pending = session_store.append_change(session_id, change)

    print(f"   ✅ Change stored. Total changes pending: {pending}")

    return jsonify({
        'status': 'success',
        'destination': destination,
        'message': f"Added {destination.get('name')} to itinerary"
    })

@app.route('/api/itinerary/remove', methods=['POST'])
def remove_destination_endpoint():
    """Remove a destination from the itinerary"""
    data = request.json
    destination_name = data.get('destination_name')
    change = {
        'type': 'remove',
        'destination_name': destination_name,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    session_id, pending = record_itinerary_change(data.get('session_id'), change)

    print(f"Removed destination: {destination_name}")
    print(f"   Pending changes for {session_id}: {pending}")

    return jsonify({
        'status': 'success',
        'message': f"Removed {destination_name} from itinerary"
    })

@app.route('/api/itinerary/update-duration', methods=['POST'])
def update_duration_endpoint():
    """Update the duration of a destination"""
    data = request.json
    destination_name = data.get('destination_name')
    new_duration_days = data.get('new_duration_days')
    change = {
        'type': 'update_duration',
        'destination_name': destination_name,
        'new_duration_days': new_duration_days,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    session_id, pending = record_itinerary_change(data.get('session_id'), change)

    print(f"Updated duration for {destination_name}: {new_duration_days} days")
    print(f"   Pending changes for {session_id}: {pending}")

    return jsonify({
        'status': 'success',
        'message': f"Updated {destination_name} to {new_duration_days} days"
    })

@app.route('/api/itinerary/update', methods=['POST'])
def update_destination_endpoint():
    """Update various attributes of a destination"""
    data = request.json
    destination_name = data.get('destination_name')
    updates = data.get('updates', {})
    change = {
        'type': 'update',
        'destination_name': destination_name,
        'updates': updates,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    session_id, pending = record_itinerary_change(data.get('session_id'), change)

    print(f"Updated destination {destination_name}: {updates}")
    print(f"   Pending changes for {session_id}: {pending}")

    return jsonify({
        'status': 'success',
        'message': f"Updated {destination_name}",
        'updates': updates
    })

@app.route('/api/itinerary/changes/<session_id>', methods=['GET'])
def get_changes(session_id):
    """Get pending changes for a session (polled by frontend)"""
    resolved_session = resolve_session_id(session_id)
    changes = session_store.pop_changes(resolved_session)

    if changes:
        print(f"🔔 CHANGES ENDPOINT POLLED:")
        print(f"   Session ID: {resolved_session}")
        print(f"   Changes to send: {len(changes)}")
        print(f"   Changes: {changes}")

    return jsonify({
        'status': 'success',
        'changes': changes
    })

@app.route('/api/generate-title', methods=['POST'])
def generate_title():
    """
    Generate an AI title for a chat conversation based on the message history.

    Expected request body:
    {
        "messages": [
            {"text": "user message", "sender": "user"},
            {"text": "bot response", "sender": "bot"}
        ],
        "currentTitle": "Current chat title (optional)"
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        messages = data.get('messages', [])
        current_title = data.get('currentTitle', 'Untitled Chat')

        if not messages:
            return jsonify({'error': 'No messages provided'}), 400

        # Create a summary of the conversation for title generation
        # Focus on user messages to understand the main topics
        user_messages = [msg['text'] for msg in messages if msg['sender'] == 'user']

        if not user_messages:
            # If no user messages, use the first bot message
            user_messages = [messages[0]['text'] if messages else 'General conversation']

        # Create a conversation summary
        conversation_text = "\n".join([f"- {msg}" for msg in user_messages[:5]])  # Limit to first 5 user messages

        # Create a temporary session for title generation
        temp_session_id = f"title_generation_{uuid.uuid4().hex[:8]}"

        # Prepare the prompt for title generation
        title_prompt = f"""Based on the following conversation messages, generate a short, descriptive title (maximum 5 words) that captures the main topic or theme of this travel-related conversation.

Current title: {current_title}

Conversation summary:
{conversation_text}

Requirements:
- Generate a short, catchy title (2-5 words maximum)
- Make it travel-related if applicable
- Focus on the main destination, activity, or travel topic
- Use descriptive and engaging language
- Output ONLY the title, no quotes or extra text

Examples of good titles:
- "Japan Trip Planning"
- "Beach Vacation Ideas"
- "Europe Itinerary Help"
- "Travel Insurance Questions"
- "Flight Booking Advice"

Please generate an appropriate title:"""

        # Create session and generate title
        session_endpoint = f"{ADK_API_URL}/apps/{APP_NAME}/users/{USER_ID}/sessions/{temp_session_id}"

        try:
            # Create session
            session_resp = requests.post(session_endpoint)
            if session_resp.status_code != 200:
                print(f"Failed to create session for title generation: {session_resp.text}")
                # Fallback: return a simple generated title
                fallback_title = generate_fallback_title(user_messages)
                return jsonify({'title': fallback_title})

            # Send message to ADK
            adk_payload = {
                "session_id": temp_session_id,
                "app_name": APP_NAME,
                "user_id": USER_ID,
                "new_message": {
                    "role": "user",
                    "parts": [{"text": title_prompt}],
                },
            }

            adk_response = requests.post(
                f"{ADK_API_URL}/apps/{APP_NAME}/users/{USER_ID}/sessions/{temp_session_id}/run",
                json=adk_payload,
                headers={"Content-Type": "application/json"}
            )

            if adk_response.status_code == 200:
                response_data = adk_response.json()

                # Extract the AI response
                if ('candidates' in response_data and
                    response_data['candidates'] and
                    len(response_data['candidates']) > 0 and
                    'content' in response_data['candidates'][0] and
                    'parts' in response_data['candidates'][0]['content'] and
                    len(response_data['candidates'][0]['content']['parts']) > 0):

                    ai_response = response_data['candidates'][0]['content']['parts'][0].get('text', '').strip()

                    # Clean up the response - remove quotes and extra whitespace
                    generated_title = ai_response.strip('"').strip().strip("'").strip()

                    # Ensure it's not too long
                    if len(generated_title) > 50:
                        generated_title = ' '.join(generated_title.split()[:5])

                    print(f"✅ Generated AI title: {generated_title}")
                    return jsonify({'title': generated_title})
                else:
                    print(f"Unexpected ADK response format: {response_data}")
                    fallback_title = generate_fallback_title(user_messages)
                    return jsonify({'title': fallback_title})
            else:
                print(f"ADK API error: {adk_response.status_code} - {adk_response.text}")
                fallback_title = generate_fallback_title(user_messages)
                return jsonify({'title': fallback_title})

        except Exception as e:
            print(f"Error calling ADK for title generation: {e}")
            fallback_title = generate_fallback_title(user_messages)
            return jsonify({'title': fallback_title})

    except Exception as e:
        print(f"Error in generate_title endpoint: {e}")
        return jsonify({'error': 'Failed to generate title'}), 500

def generate_fallback_title(user_messages):
    """Generate a simple fallback title based on user messages"""
    if not user_messages:
        return "Travel Planning"

    # Simple keyword-based title generation
    first_message = user_messages[0].lower()

    # Look for destination keywords
    destinations = ['japan', 'thailand', 'europe', 'asia', 'america', 'france', 'italy', 'spain',
                   'china', 'india', 'brazil', 'mexico', 'canada', 'australia', 'uk', 'germany']

    for dest in destinations:
        if dest in first_message:
            return f"{dest.title()} Trip Planning"

    # Look for activity keywords
    activities = ['flight', 'hotel', 'booking', 'itinerary', 'visa', 'insurance', 'transport',
                 'accommodation', 'restaurant', 'tour', 'museum', 'beach', 'mountain', 'city']

    for activity in activities:
        if activity in first_message:
            return f"{activity.title()} Questions"

    # Default title
    return "Travel Planning"

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

# ============================================================================
# Cost Tracking API Endpoints
# ============================================================================

def get_cost_tracker(session_id: str) -> tuple[CostTrackerService, str]:
    """Get or create cost tracker for a session and return it with the resolved session ID."""
    resolved_session = resolve_session_id(session_id or 'default_session')
    session_store.touch_session(resolved_session)
    tracker = session_store.get_cost_tracker(resolved_session)
    return tracker, resolved_session


def _build_destination_aliases(raw_destination_id, normalized_destination_id, destination_name):
    """Create a set of lowercase aliases used to match destination-specific costs."""
    aliases = set()
    for value in (raw_destination_id, normalized_destination_id):
        if value is None:
            continue
        alias = str(value).strip().lower()
        if alias:
            aliases.add(alias)

    if destination_name:
        slug_alias = normalize_destination_id(None, destination_name)
        if slug_alias:
            aliases.add(str(slug_alias).strip().lower())

    aliases.discard("")
    return aliases


def _sanitize_cost_for_tracker(cost_dict: dict) -> CostItem:
    """Convert a raw cost dict into a CostItem for the in-memory tracker."""
    amount = _to_float(cost_dict.get('amount', 0))
    amount_usd = _to_float(cost_dict.get('amount_usd', amount))

    if amount == 0 and amount_usd:
        amount = amount_usd

    currency = cost_dict.get('currency') or 'USD'
    if isinstance(currency, str):
        currency = currency.strip().upper() or 'USD'
    else:
        currency = 'USD'

    dest_val = cost_dict.get('destination_id')
    if dest_val is not None:
        dest_str = str(dest_val).strip()
        destination_id = dest_str or None
    else:
        destination_id = None

    notes_parts = []
    base_note = cost_dict.get('notes')
    if base_note:
        notes_parts.append(str(base_note).strip())

    extras = []
    confidence = cost_dict.get('confidence')
    if confidence:
        extras.append(f"confidence={confidence}")
    sources = cost_dict.get('sources')
    if sources:
        extras.append("sources: " + ", ".join(sources))
    researched_at = cost_dict.get('researched_at')
    if researched_at:
        extras.append(f"researched_at={researched_at}")
    if extras:
        notes_parts.append(" | ".join(extras))

    sanitized = {
        'id': str(cost_dict.get('id') or uuid.uuid4()),
        'category': (cost_dict.get('category') or 'other').strip(),
        'description': cost_dict.get('description') or f"{(cost_dict.get('category') or 'Cost').title()} estimate",
        'amount': amount,
        'currency': currency,
        'amount_usd': amount_usd if amount_usd else amount,
        'date': cost_dict.get('date') or datetime.now().strftime("%Y-%m-%d"),
        'destination_id': destination_id,
        'booking_status': cost_dict.get('booking_status') or 'researched',
        'source': cost_dict.get('source') or 'web_research',
        'notes': "\n".join(part for part in notes_parts if part).strip() or None,
    }

    return CostItem(**sanitized)


def _replace_destination_costs_in_tracker(identifier: str, destination_aliases: set[str], cost_items: list[dict]):
    """Replace researched costs for a destination in the session tracker."""
    tracker, resolved_identifier = get_cost_tracker(identifier)
    aliases = {alias for alias in destination_aliases if alias}

    preserved_costs = []
    for cost in tracker.costs:
        # Keep manual or already booked costs intact
        if cost.source == 'manual' or cost.booking_status in ('confirmed', 'booked'):
            preserved_costs.append(cost)
            continue

        dest_lower = (cost.destination_id or '').strip().lower()
        if dest_lower and dest_lower in aliases:
            continue

        cost_id_lower = (cost.id or '').strip().lower()
        if cost_id_lower and any(cost_id_lower.startswith(f"{alias}_") for alias in aliases):
            continue

        preserved_costs.append(cost)

    tracker.costs = preserved_costs

    new_costs = []
    for item in cost_items:
        try:
            cost_model = _sanitize_cost_for_tracker(item)
        except Exception as err:
            print(f"⚠️ Skipping cost item due to validation error: {err}")
            continue
        tracker.costs.append(cost_model)
        new_costs.append(cost_model)

    session_store.save_cost_tracker(resolved_identifier, tracker)

    return tracker.costs, new_costs


def _apply_costs_to_local_store(destination_aliases, cost_items, primary_identifier, secondary_identifiers=None):
    """Persist cost items to the in-memory tracker for the provided identifiers."""
    identifiers = set()
    if primary_identifier:
        identifiers.add(primary_identifier)
    if secondary_identifiers:
        for ident in secondary_identifiers:
            if ident:
                identifiers.add(ident)

    results = {}
    for identifier in identifiers:
        tracker_costs, new_costs = _replace_destination_costs_in_tracker(
            identifier,
            destination_aliases,
            cost_items,
        )
        results[identifier] = {
            'total_costs': len(tracker_costs),
            'new_costs': len(new_costs),
        }
    return results

@app.route('/api/costs', methods=['POST'])
def add_cost():
    """Add a new cost item."""
    try:
        data = request.json
        session_id = data.get('session_id', 'default')

        tracker, resolved_session = get_cost_tracker(session_id)

        cost_item = tracker.add_cost(
            category=data.get('category'),
            description=data.get('description'),
            amount=float(data.get('amount')),
            currency=data.get('currency', 'USD'),
            date=data.get('date'),
            destination_id=data.get('destination_id'),
            booking_status=data.get('booking_status', 'estimated'),
            source=data.get('source', 'manual'),
            notes=data.get('notes')
        )

        session_store.save_cost_tracker(resolved_session, tracker)

        return jsonify({
            'status': 'success',
            'cost': cost_item.model_dump()
        })
    except Exception as e:
        print(f"Error adding cost: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/<cost_id>', methods=['PUT'])
def update_cost(cost_id):
    """Update an existing cost item in Firestore."""
    try:
        from google.cloud import firestore

        data = request.json
        session_id = data.get('session_id', 'default')
        scenario_id = session_id  # Using session_id as scenario_id

        print(f"📝 PUT /api/costs/{cost_id} - session_id: {session_id}")

        # Extract updates (exclude meta fields)
        updates = {k: v for k, v in data.items() if k not in ['session_id', 'cost_id']}

        # Initialize Firestore
        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get current scenario
        scenario_doc = scenario_ref.get()
        if not scenario_doc.exists:
            # Fallback to in-memory tracker for backward compatibility
            print(f"⚠️ Scenario not found in Firestore, using in-memory tracker")
            tracker, resolved_session = get_cost_tracker(session_id)
            cost_item = tracker.update_cost(cost_id, **updates)
            if cost_item:
                session_store.save_cost_tracker(resolved_session, tracker)
                return jsonify({'status': 'success', 'cost': cost_item.model_dump()})
            else:
                return jsonify({'status': 'error', 'error': 'Cost not found'}), 404

        scenario_data = scenario_doc.to_dict()

        # Get the latest version
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if not versions:
            return jsonify({'status': 'error', 'error': f'No versions found for scenario {scenario_id}'}), 404

        latest_version_data = versions[0].to_dict() or {}
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}
        version_costs = itinerary_data.get('costs', []) or []

        # Find and update the cost
        print(f"🔍 Looking for cost_id: {cost_id}")
        print(f"   First 3 costs in Firestore:")
        for i, c in enumerate(version_costs[:3]):
            print(f"      [{i}] id={c.get('id')}, dest={c.get('destination_id')}, cat={c.get('category')}")

        updated_cost = None
        updated_costs = []
        for cost in version_costs:
            if cost.get('id') == cost_id:
                # Record change history (Recommendation F)
                from datetime import datetime

                # Find fields that changed
                fields_changed = []
                previous_value = {}
                new_value = {}

                for key, new_val in updates.items():
                    old_val = cost.get(key)
                    if old_val != new_val:
                        fields_changed.append(key)
                        previous_value[key] = old_val
                        new_value[key] = new_val

                # Create change event
                if fields_changed:
                    change_event = {
                        'timestamp': datetime.utcnow().isoformat() + 'Z',
                        'changed_by': data.get('user_id', 'system'),
                        'previous_value': previous_value,
                        'new_value': new_value,
                        'change_reason': data.get('change_reason', 'user_edit'),
                        'fields_changed': fields_changed
                    }

                    # Add to history
                    history = cost.get('history', [])
                    if not isinstance(history, list):
                        history = []
                    history.append(change_event)

                    # Merge updates with history tracking
                    updated_cost = {**cost, **updates}
                    updated_cost['history'] = history
                    updated_cost['updated_at'] = change_event['timestamp']
                    updated_cost['last_modified_by'] = change_event['changed_by']
                else:
                    # No changes, just return existing cost
                    updated_cost = cost

                updated_costs.append(updated_cost)
                print(f"✓ Updated cost: {cost_id} - {updated_cost.get('category')} ${updated_cost.get('amount_usd', 0)}")
                if fields_changed:
                    print(f"  Changed fields: {', '.join(fields_changed)}")
            else:
                updated_costs.append(cost)

        if not updated_cost:
            print(f"❌ Cost not found with id={cost_id}")
            return jsonify({'status': 'error', 'error': 'Cost not found'}), 404

        # Create a new version with updated cost
        new_version_number = max(int(scenario_data.get('currentVersion', 0) or 0), int(latest_version_data.get('versionNumber', 0) or 0)) + 1
        new_version_ref = scenario_ref.collection('versions').document()
        new_itinerary_data = dict(itinerary_data)
        new_itinerary_data['costs'] = updated_costs

        new_version_ref.set({
            'versionNumber': new_version_number,
            'versionName': '',
            'isNamed': False,
            'itineraryData': new_itinerary_data,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'itineraryDataHash': None,
            'isAutosave': True,
        })

        # Update scenario's currentVersion
        scenario_ref.update({
            'currentVersion': new_version_number,
            'updatedAt': firestore.SERVER_TIMESTAMP,
        })

        print(f"✅ Created new version v{new_version_number} with updated cost")

        tracker, resolved_session = get_cost_tracker(session_id)
        tracker.update_cost(cost_id, **updates)
        session_store.save_cost_tracker(resolved_session, tracker)

        return jsonify({
            'status': 'success',
            'cost': updated_cost
        })

    except Exception as e:
        import traceback
        print(f"Error updating cost: {e}")
        print(traceback.format_exc())
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/<cost_id>', methods=['DELETE'])
def delete_cost(cost_id):
    """Delete a cost item from Firestore or in-memory tracker."""
    try:
        from google.cloud import firestore

        data = request.json or {}
        # Accept session_id from query params or JSON body
        session_id = request.args.get('session_id') or data.get('session_id', 'default')
        scenario_id = session_id  # Using session_id as scenario_id

        print(f"🗑️ DELETE /api/costs/{cost_id} - session_id: {session_id}")

        # Try Firestore first
        try:
            db = get_firestore_client()
            scenario_ref = db.collection('scenarios').document(scenario_id)
            scenario_doc = scenario_ref.get()

            if scenario_doc.exists:
                print(f"✅ Found scenario in Firestore: {scenario_id}")
                scenario_data = scenario_doc.to_dict()

                # Get the latest version
                versions = list(
                    scenario_ref
                        .collection('versions')
                        .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                        .limit(1)
                        .stream()
                )

                if not versions:
                    print(f"⚠️ No versions found for scenario: {scenario_id}")
                    raise Exception("No versions found")

                latest_version_data = versions[0].to_dict() or {}
                itinerary_data = latest_version_data.get('itineraryData', {}) or {}
                version_costs = itinerary_data.get('costs', []) or []

                # Find and remove the cost
                print(f"🔍 Looking for cost_id: {cost_id} in {len(version_costs)} costs")
                cost_found = False
                updated_costs = []

                for cost in version_costs:
                    if cost.get('id') == cost_id:
                        cost_found = True
                        print(f"✓ Found cost to delete: {cost.get('category')} ${cost.get('amount', 0)}")
                    else:
                        updated_costs.append(cost)

                if not cost_found:
                    print(f"❌ Cost not found with id={cost_id}")
                    return jsonify({'status': 'error', 'error': 'Cost not found'}), 404

                # Create a new version with the cost removed
                new_version_number = max(int(scenario_data.get('currentVersion', 0) or 0), int(latest_version_data.get('versionNumber', 0) or 0)) + 1
                new_version_ref = scenario_ref.collection('versions').document()
                new_itinerary_data = dict(itinerary_data)
                new_itinerary_data['costs'] = updated_costs

                new_version_ref.set({
                    'versionNumber': new_version_number,
                    'versionName': '',
                    'isNamed': False,
                    'itineraryData': new_itinerary_data,
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'itineraryDataHash': None,
                    'isAutosave': True,
                })

                # Update scenario's currentVersion
                scenario_ref.update({
                    'currentVersion': new_version_number,
                    'updatedAt': firestore.SERVER_TIMESTAMP,
                })

                print(f"✅ Created new version v{new_version_number} with cost deleted")
                print(f"   Costs before: {len(version_costs)}, after: {len(updated_costs)}")

                tracker, resolved_session = get_cost_tracker(session_id)
                tracker.delete_cost(cost_id)
                session_store.save_cost_tracker(resolved_session, tracker)

                return jsonify({'status': 'success'})

        except Exception as firestore_error:
            print(f"⚠️ Firestore error, falling back to in-memory tracker: {firestore_error}")

        # Fallback to in-memory tracker
        print(f"🔁 Using in-memory cost tracker for session: {session_id}")
        tracker, resolved_session = get_cost_tracker(session_id)
        success = tracker.delete_cost(cost_id)
        if success:
            session_store.save_cost_tracker(resolved_session, tracker)

        if success:
            return jsonify({'status': 'success'})
        else:
            return jsonify({'status': 'error', 'error': 'Cost not found'}), 404

    except Exception as e:
        print(f"❌ Error deleting cost: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs', methods=['GET'])
def get_costs():
    """Get all costs or filtered costs from Firestore."""
    try:
        session_id = request.args.get('session_id', 'default')
        destination_id = request.args.get('destination_id')
        category = request.args.get('category')

        print(f"📥 GET /api/costs - session_id: {session_id}, destination_id: {destination_id}, category: {category}")

        costs = []
        fetched_from_firestore = False

        try:
            from google.cloud import firestore

            # Try to fetch from Firestore first (session_id is actually scenario_id)
            db = get_firestore_client()
            scenario_ref = db.collection('scenarios').document(session_id)
            scenario_doc = scenario_ref.get()

            if scenario_doc.exists:
                print(f"✅ Found scenario in Firestore: {session_id}")

                versions = list(
                    scenario_ref
                        .collection('versions')
                        .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                        .limit(1)
                        .stream()
                )

                if versions:
                    latest_version_data = versions[0].to_dict() or {}
                    itinerary_data = latest_version_data.get('itineraryData', {}) or {}
                    costs_data = itinerary_data.get('costs', [])

                    print(f"📦 Found {len(costs_data)} costs in Firestore")

                    if destination_id:
                        costs_data = [
                            c for c in costs_data
                            if str(c.get('destination_id', '')).strip() == str(destination_id).strip()
                        ]
                    if category:
                        costs_data = [c for c in costs_data if c.get('category') == category]

                    costs = costs_data
                    fetched_from_firestore = True
                else:
                    print(f"⚠️ No versions found for scenario: {session_id}")
            else:
                print(f"⚠️ Scenario not found in Firestore (id: {session_id})")
        except Exception as firestore_error:
            print(f"⚠️ Firestore unavailable for session {session_id}: {firestore_error}")

        if fetched_from_firestore:
            print(f"📤 Returning {len(costs)} costs from Firestore")
            return jsonify({
                'status': 'success',
                'costs': costs
            })

        print(f"🔁 Falling back to in-memory cost tracker for session: {session_id}")
        tracker, _ = get_cost_tracker(session_id)
        if any([destination_id, category]):
            tracker_costs = tracker.filter_costs(destination_id=destination_id, category=category)
        else:
            tracker_costs = tracker.costs
        costs = [cost.model_dump() for cost in tracker_costs]

        print(f"📤 Returning {len(costs)} costs from in-memory tracker")
        return jsonify({
            'status': 'success',
            'costs': costs
        })
    except Exception as e:
        import traceback
        print(f"❌ Error getting costs: {e}")
        print(traceback.format_exc())
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/summary', methods=['POST'])
def get_cost_summary():
    """Get comprehensive cost summary."""
    try:
        data = request.json or {}
        print(f"[DEBUG] Received cost summary request with data: {data}")
        session_id = data.get('session_id', 'default')
        destinations = data.get('destinations')
        traveler_count = data.get('traveler_count')
        total_days = data.get('total_days')

        tracker, _ = get_cost_tracker(session_id)
        summary = tracker.get_cost_summary(
            destinations=destinations,
            traveler_count=traveler_count,
            total_days=total_days
        )

        return jsonify({
            'status': 'success',
            'summary': summary.model_dump()
        })
    except Exception as e:
        import traceback
        print(f"Error getting cost summary: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/export', methods=['GET'])
def export_costs():
    """Export all costs as JSON."""
    try:
        session_id = request.args.get('session_id', 'default')
        tracker, _ = get_cost_tracker(session_id)

        return jsonify({
            'status': 'success',
            'costs': tracker.export_costs()
        })
    except Exception as e:
        print(f"Error exporting costs: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/import', methods=['POST'])
def import_costs():
    """Import costs from JSON."""
    try:
        data = request.json
        session_id = data.get('session_id', 'default')
        costs_data = data.get('costs', [])

        tracker, resolved_session = get_cost_tracker(session_id)
        tracker.load_costs(costs_data)
        session_store.save_cost_tracker(resolved_session, tracker)

        return jsonify({
            'status': 'success',
            'message': f'Imported {len(costs_data)} cost items'
        })
    except Exception as e:
        print(f"Error importing costs: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/bulk-save', methods=['POST'])
def bulk_save_costs():
    """
    Bulk save cost items to Firestore.
    This endpoint is called by the cost_research_agent after researching costs.

    Expected request body:
    {
        "session_id": "session_abc123",
        "scenario_id": "scenario_xyz789",
        "destination_id": "tokyo_japan",
        "destination_name": "Tokyo, Japan",
        "cost_items": [
            {
                "id": "10_tokyo_accommodation",
                "category": "accommodation",
                "description": "Hotel in Tokyo",
                "amount": 1750.0,
                "currency": "USD",
                "amount_usd": 1750.0,
                "destination_id": "tokyo_japan",
                "booking_status": "estimated",
                "source": "web_research",
                "notes": "7 nights for 3 people"
            },
            ...
        ]
    }
    """
    print("\n" + "="*100)
    print("💾 BULK-SAVE ENDPOINT CALLED")
    print("="*100)

    data = request.json
    session_id = data.get('session_id')
    scenario_id = data.get('scenario_id')
    destination_name = data.get('destination_name')
    raw_destination_id = data.get('destination_id')
    destination_id = None
    if raw_destination_id is not None or destination_name:
        destination_id = normalize_destination_id(raw_destination_id, destination_name)
    cost_items = data.get('cost_items', [])

    print(f"📦 Received request:")
    print(f"   Session ID: {session_id}")
    print(f"   Scenario ID: {scenario_id}")
    print(f"   Destination ID: {destination_id}")
    print(f"   Destination Name: {destination_name}")
    print(f"   Cost Items Count: {len(cost_items)}")
    print(f"   Cost Items: {[item.get('category') for item in cost_items]}")

    # Validate required fields
    if not all([scenario_id, destination_id, cost_items]):
        return jsonify({
            'status': 'error',
            'error': 'Missing required fields: scenario_id, destination_id, cost_items'
        }), 400

    print(f"💾 Bulk saving {len(cost_items)} costs for {destination_name} (ID: {destination_id})")

    # Build alias set for matching (UUID, legacy IDs, slug)
    destination_aliases = _build_destination_aliases(
        raw_destination_id,
        destination_id,
        destination_name,
    )

    print(f"🔍 Looking for costs to remove with aliases: {sorted(destination_aliases)}")

    try:
        from google.cloud import firestore

        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        scenario_doc = scenario_ref.get()
        if not scenario_doc.exists:
            return jsonify({
                'status': 'error',
                'error': f'Scenario {scenario_id} not found'
            }), 404

        scenario_data = scenario_doc.to_dict()
        current_version = scenario_data.get('currentVersion', 0)

        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        version_filtered_costs = cost_items[:]

        if versions:
            latest_version_ref = versions[0].reference
            latest_version_data = versions[0].to_dict() or {}

            itinerary_data = latest_version_data.get('itineraryData', {}) or {}
            version_costs = itinerary_data.get('costs', []) or []
            locations = itinerary_data.get('locations', []) or []

            # Validate and resolve destination IDs for incoming cost items
            print(f"\n🔍 Validating destination IDs for {len(cost_items)} cost items...")

            # Set destination_id if missing
            for item in cost_items:
                if not item.get('destination_id') and destination_id:
                    item['destination_id'] = destination_id
                    print(f"  📝 Set destination_id to {destination_id} for {item.get('category')}")

            # Validate and auto-resolve destination IDs
            try:
                validated_costs, validation_warnings = validate_cost_items(
                    cost_items,
                    locations,
                    auto_resolve=True,
                    strict=False  # Don't fail hard, but log warnings
                )

                # Replace cost_items with validated version
                cost_items = validated_costs

                # Log validation results
                if validation_warnings:
                    print(f"  ⚠️ Validation warnings:")
                    for warning in validation_warnings:
                        print(f"    - {warning}")
                else:
                    print(f"  ✓ All cost items have valid destination IDs")

            except Exception as e:
                print(f"  ❌ Validation error: {e}")
                # Continue anyway, but log the error

            print(f"📊 Total costs in database before removal: {len(version_costs)}")
            print(f"📊 Costs with descriptions containing '{destination_name.split(',')[0] if destination_name else ''}': {len([c for c in version_costs if destination_name and destination_name.split(',')[0].lower() in (c.get('description') or '').lower()])}")

            def _belongs_to_destination(cost_item):
                cost_source = cost_item.get('source')
                booking_status = cost_item.get('booking_status', 'estimated')

                if cost_source == 'manual' or booking_status in ('confirmed', 'booked'):
                    return False

                dest_val = cost_item.get('destination_id')
                if dest_val:
                    dest_val_norm = str(dest_val).strip().lower()
                    if dest_val_norm in destination_aliases:
                        print(f"  ✓ Match by UUID: {dest_val} -> {cost_item.get('category')} ${cost_item.get('amount_usd', 0)}")
                        return True

                item_id = cost_item.get('id')
                if item_id:
                    lowered = str(item_id).strip().lower()
                    for alias in destination_aliases:
                        if alias and lowered.startswith(alias + "_"):
                            print(f"  ✓ Match by ID prefix: {item_id} starts with {alias}_")
                            return True

                return False

            version_filtered_costs = [
                c for c in version_costs
                if not _belongs_to_destination(c)
            ]
            removed_count = len(version_costs) - len(version_filtered_costs)
            if removed_count:
                print(f"🧹 Removed {removed_count} existing cost(s) for aliases {sorted(destination_aliases)}")

            normalized_existing_costs = []
            for item in version_filtered_costs:
                item_copy = dict(item)
                if 'destination_id' in item_copy and item_copy['destination_id'] is not None:
                    item_copy['destination_id'] = str(item_copy['destination_id']).strip()
                normalized_existing_costs.append(item_copy)
            version_filtered_costs = normalized_existing_costs

            version_filtered_costs.extend(cost_items)

            try:
                import json as _json

                def _stable(obj):
                    return _json.dumps(obj, sort_keys=True, separators=(",", ":"))

                if _stable(version_costs) == _stable(version_filtered_costs):
                    scenario_ref.update({
                        'updatedAt': firestore.SERVER_TIMESTAMP,
                    })
                    print(f"ℹ️ No cost changes detected; skipped new version creation")
                    # Sync local cache even when no change detected
                    _apply_costs_to_local_store(destination_aliases, cost_items, scenario_id, secondary_identifiers=[session_id])
                    return jsonify({
                        'status': 'success',
                        'message': 'No changes in costs; latest version left unchanged',
                        'costs_saved': 0,
                        'total_costs': len(version_filtered_costs),
                        'storage': 'firestore'
                    })
            except Exception as _:
                pass

            new_version_number = max(int(current_version or 0), int(latest_version_data.get('versionNumber', 0) or 0)) + 1
            new_version_ref = scenario_ref.collection('versions').document()
            new_itinerary_data = dict(itinerary_data)
            new_itinerary_data['costs'] = version_filtered_costs

            new_version_ref.set({
                'versionNumber': new_version_number,
                'versionName': '',
                'isNamed': False,
                'itineraryData': new_itinerary_data,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'itineraryDataHash': None,
                'isAutosave': True,
            })

            scenario_ref.update({
                'currentVersion': new_version_number,
                'updatedAt': firestore.SERVER_TIMESTAMP,
            })

            print(f"✅ Created new version v{new_version_number} with updated itineraryData")
            print(f"   Total costs in new version: {len(version_filtered_costs)}")
        else:
            print(f"⚠️ Warning: No versions found for scenario {scenario_id}; storing costs locally only.")
            local_results = _apply_costs_to_local_store(
                destination_aliases,
                cost_items,
                scenario_id,
                secondary_identifiers=[session_id],
            )
            primary_stats = local_results.get(
                scenario_id,
                {'total_costs': len(cost_items), 'new_costs': len(cost_items)}
            )
            print(f"💽 Saved costs locally for scenario {scenario_id} (no Firestore version available)")
            return jsonify({
                'status': 'success',
                'message': f'Saved {primary_stats["new_costs"]} costs locally for {destination_name}',
                'costs_saved': primary_stats['new_costs'],
                'total_costs': primary_stats['total_costs'],
                'storage': 'local'
            })

        try:
            totals_by_category = {}
            for item in version_filtered_costs:
                cat = item.get('category', 'other')
                totals_by_category[cat] = totals_by_category.get(cat, 0.0) + _to_float(item.get('amount_usd', 0))
            scenario_ref.update({
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'costsCount': len(version_filtered_costs),
                'totalsByCategory': totals_by_category,
            })
            print(f"🧮 Updated scenario summary: {len(version_filtered_costs)} items")
        except Exception as summary_error:
            print(f"Warning: failed to update scenario summary: {summary_error}")

        # Keep in-memory cache aligned with Firestore (best effort)
        try:
            local_results = _apply_costs_to_local_store(
                destination_aliases,
                cost_items,
                scenario_id,
                secondary_identifiers=[session_id],
            )
            primary_stats = local_results.get(scenario_id, {'total_costs': len(version_filtered_costs), 'new_costs': len(cost_items)})
            print(f"💾 Synced in-memory tracker for scenario {scenario_id}: {primary_stats}")
        except Exception as sync_error:
            print(f"⚠️ Failed to sync in-memory tracker after Firestore save: {sync_error}")

        return jsonify({
            'status': 'success',
            'message': f'Saved {len(cost_items)} costs for {destination_name}',
            'costs_saved': len(cost_items),
            'total_costs': len(version_filtered_costs),
            'storage': 'firestore'
        })

    except Exception as firestore_error:
        import traceback
        error_details = traceback.format_exc()
        print(f"⚠️ Firestore save failed, switching to local storage: {firestore_error}")
        print(error_details)

        try:
            local_results = _apply_costs_to_local_store(
                destination_aliases,
                cost_items,
                scenario_id,
                secondary_identifiers=[session_id],
            )
            primary_stats = local_results.get(
                scenario_id,
                {'total_costs': len(cost_items), 'new_costs': len(cost_items)}
            )

            message = f"Saved {primary_stats['new_costs']} costs locally for {destination_name} (offline mode)"
            print(f"💽 {message}")

            return jsonify({
                'status': 'success',
                'message': message,
                'costs_saved': primary_stats['new_costs'],
                'total_costs': primary_stats['total_costs'],
                'storage': 'local'
            })
        except Exception as local_error:
            error_details = traceback.format_exc()
            print(f"Error in bulk-save endpoint (local fallback failed): {error_details}")
            return jsonify({
                'status': 'error',
                'error': str(local_error),
                'error_details': error_details
            }), 500

@app.route('/api/costs/bulk-update', methods=['PUT'])
def bulk_update_costs():
    """
    Bulk update multiple cost items in Firestore.
    This endpoint is called by the bulk edit UI when saving changes.

    Expected request body:
    {
        "session_id": "session_abc123",
        "costs": [
            {
                "id": "cost_123",
                "category": "accommodation",
                "description": "Hotel in Tokyo",
                "amount": 1750.0,
                "currency": "USD",
                "amount_usd": 1750.0,
                "destination_id": "tokyo_japan",
                "booking_status": "estimated",
                "date": "2024-01-15",
                "notes": "Updated via bulk edit"
            },
            ...
        ]
    }
    """
    print("\n" + "="*100)
    print("📝 BULK-UPDATE ENDPOINT CALLED")
    print("="*100)
    import sys
    sys.stdout.flush()

    try:
        from google.cloud import firestore

        data = request.json
        session_id = data.get('session_id')
        scenario_id = session_id  # Using session_id as scenario_id for consistency
        costs_to_update = data.get('costs', [])

        print(f"📦 Received request:")
        print(f"   Session ID: {session_id}")
        print(f"   Costs to update: {len(costs_to_update)}")
        print(f"   Cost being updated: {costs_to_update[0] if costs_to_update else 'none'}")
        sys.stdout.flush()

        # Validate required fields
        if not session_id or not costs_to_update:
            return jsonify({
                'status': 'error',
                'error': 'Missing required fields: session_id, costs'
            }), 400

        # Initialize Firestore
        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get current scenario
        scenario_doc = scenario_ref.get()
        if not scenario_doc.exists:
            return jsonify({
                'status': 'error',
                'error': f'Scenario {scenario_id} not found'
            }), 404

        scenario_data = scenario_doc.to_dict()

        # Get the latest version
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if not versions:
            return jsonify({
                'status': 'error',
                'error': f'No versions found for scenario {scenario_id}'
            }), 404

        latest_version_ref = versions[0].reference
        latest_version_data = versions[0].to_dict() or {}

        # Get itineraryData from the version
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}
        version_costs = itinerary_data.get('costs', []) or []

        print(f"📊 Total costs in database: {len(version_costs)}")
        print(f"   First 3 costs from Firestore:")
        for i, c in enumerate(version_costs[:3]):
            print(f"      [{i}] id={c.get('id')}, dest={c.get('destination_id')}, cat={c.get('category')}")

        # Create a map of updated costs by ID for quick lookup
        updates_by_id = {cost['id']: cost for cost in costs_to_update}
        print(f"🔧 Updates to apply (by ID):")
        for cost_id in list(updates_by_id.keys())[:3]:
            print(f"      {cost_id}")

        # Also create a fallback map by destination_id + category for costs without IDs
        updates_by_dest_cat = {}
        for cost in costs_to_update:
            key = f"{cost.get('destination_id')}_{cost.get('category')}"
            updates_by_dest_cat[key] = cost

        # Update costs in place
        updated_count = 0
        updated_costs = []
        for cost in version_costs:
            cost_id = cost.get('id')

            # Try to find update by ID first
            if cost_id and cost_id in updates_by_id:
                # Merge updates into existing cost, preserving the ID
                updated_cost = {**cost, **updates_by_id[cost_id]}
                updated_costs.append(updated_cost)
                updated_count += 1
                print(f"  ✓ Updated cost by ID: {cost_id} - {updated_cost.get('category')} ${updated_cost.get('amount_usd', 0)}")
            else:
                # Fallback: try to match by destination_id + category
                fallback_key = f"{cost.get('destination_id')}_{cost.get('category')}"
                if fallback_key in updates_by_dest_cat:
                    updated_cost = {**cost, **updates_by_dest_cat[fallback_key]}
                    updated_costs.append(updated_cost)
                    updated_count += 1
                    print(f"  ✓ Updated cost by dest+cat: {fallback_key} - {updated_cost.get('category')} ${updated_cost.get('amount_usd', 0)}")
                else:
                    updated_costs.append(cost)

        if updated_count == 0:
            print(f"⚠️ Warning: No costs were updated")
            return jsonify({
                'status': 'success',
                'message': 'No costs were updated',
                'updated_count': 0
            })

        # Create a new version with updated costs
        new_version_number = max(int(scenario_data.get('currentVersion', 0) or 0), int(latest_version_data.get('versionNumber', 0) or 0)) + 1
        new_version_ref = scenario_ref.collection('versions').document()
        new_itinerary_data = dict(itinerary_data)
        new_itinerary_data['costs'] = updated_costs

        new_version_ref.set({
            'versionNumber': new_version_number,
            'versionName': '',
            'isNamed': False,
            'itineraryData': new_itinerary_data,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'itineraryDataHash': None,
            'isAutosave': True,
        })

        # Update scenario's currentVersion
        scenario_ref.update({
            'currentVersion': new_version_number,
            'updatedAt': firestore.SERVER_TIMESTAMP,
        })

        print(f"✅ Created new version v{new_version_number} with {updated_count} updated costs")
        print(f"   Total costs in new version: {len(updated_costs)}")

        # Update lightweight snapshot summary on the scenario document
        try:
            totals_by_category = {}
            for item in updated_costs:
                cat = item.get('category', 'other')
                totals_by_category[cat] = totals_by_category.get(cat, 0.0) + _to_float(item.get('amount_usd', 0))
            scenario_ref.update({
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'costsCount': len(updated_costs),
                'totalsByCategory': totals_by_category,
            })
            print(f"🧮 Updated scenario summary: {len(updated_costs)} items")
        except Exception as e:
            print(f"Warning: failed to update scenario summary: {e}")

        return jsonify({
            'status': 'success',
            'message': f'Updated {updated_count} cost(s)',
            'updated_count': updated_count,
            'total_costs': len(updated_costs)
        })

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in bulk-update endpoint: {error_details}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'error_details': error_details
        }), 500

@app.route('/api/working-data', methods=['GET'])
def get_working_data():
    """Get working data including locations for a scenario.

    Query params: session_id (or scenario_id for compatibility)
    Returns: {'locations': [...], 'itineraryData': {...}}
    """
    try:
        from google.cloud import firestore

        session_id = request.args.get('session_id') or request.args.get('scenario_id')

        if not session_id:
            return jsonify({'error': 'session_id or scenario_id required'}), 400

        print(f"📊 GET /api/working-data - session_id: {session_id}")

        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(session_id)

        # Get latest version
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if not versions:
            return jsonify({'locations': [], 'itineraryData': {}}), 200

        latest_version_data = versions[0].to_dict() or {}
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}
        locations = itinerary_data.get('locations', [])

        return jsonify({
            'locations': locations,
            'itineraryData': itinerary_data
        })

    except Exception as e:
        print(f"Error fetching working data: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return empty data instead of error to allow graceful degradation
        return jsonify({'locations': [], 'itineraryData': {}}), 200

@app.route('/api/itinerary/summary', methods=['POST'])
def generate_summary():
    """
    Generate a formatted itinerary summary using the generate_itinerary_summary tool.

    Expected request body:
    {
        "itinerary": {
            "locations": [...],
            "trip": {...},
            "legs": [...],
            "costs": [...]
        },
        "session_id": "optional-session-id"
    }
    """
    try:
        from travel_concierge.tools.itinerary_summary_generator import generate_itinerary_summary as gen_summary_tool

        data = request.json
        itinerary_data = data.get('itinerary', {})
        session_id = data.get('session_id')

        if not itinerary_data or not itinerary_data.get('locations'):
            return jsonify({
                'status': 'error',
                'error': 'No itinerary data provided'
            }), 400

        print(f"📄 Generating summary for itinerary with {len(itinerary_data.get('locations', []))} locations")

        # Call the summary generator tool directly
        result = gen_summary_tool(
            itinerary_json=json.dumps(itinerary_data),
            tool_context=None  # We're passing data directly as JSON
        )

        if result.get('status') == 'success':
            print(f"✅ Summary generated successfully ({len(result.get('summary', ''))} characters)")
            return jsonify({
                'status': 'success',
                'summary': result.get('summary'),
                'itinerary_data': result.get('itinerary_data'),
                'message': result.get('message')
            })
        else:
            print(f"❌ Summary generation failed: {result.get('message')}")

            # Determine appropriate HTTP status code based on error type
            error_code = result.get('error_code', 'unknown')
            if error_code == 'rate_limit':
                status_code = 429
            elif error_code == 'quota_exceeded':
                status_code = 429
            else:
                status_code = 500

            response = {
                'status': 'error',
                'error': result.get('message'),
                'error_code': error_code
            }

            # Add retry_after if present (for rate limiting)
            if 'retry_after' in result:
                response['retry_after'] = result['retry_after']

            # Add prompt for debugging non-rate-limit errors
            if error_code not in ['rate_limit', 'quota_exceeded'] and 'prompt' in result:
                response['prompt'] = result['prompt']

            return jsonify(response), status_code

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in summary generation endpoint: {error_details}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'error_details': error_details
        }), 500

@app.route('/api/costs/research', methods=['POST'])
def research_costs():
    """
    Research costs for a destination using the cost_research_agent.

    Expected request body:
    {
        "session_id": "session_abc123",
        "scenario_id": "scenario_xyz789",  # REQUIRED for saving to Firestore
        "destination_name": "Bangkok, Thailand",
        "destination_id": "bangkok_thailand",
        "duration_days": 7,
        "arrival_date": "2026-07-15",
        "departure_date": "2026-07-22",
        "num_travelers": 2,
        "travel_style": "mid-range",
        "previous_destination": "Singapore",  # optional
        "next_destination": "Chiang Mai"  # optional
    }
    """
    try:
        data = request.json
        session_id = data.get('session_id', 'default')
        scenario_id = data.get('scenario_id')

        # Build the research request message
        destination_name = data.get('destination_name')
        destination_id = data.get('destination_id')
        duration_days = data.get('duration_days')
        arrival_date = data.get('arrival_date')
        departure_date = data.get('departure_date')
        num_travelers = data.get('num_travelers', 1)
        travel_style = data.get('travel_style', 'mid-range')
        previous_destination = data.get('previous_destination')
        next_destination = data.get('next_destination')

        # Validate required fields
        if not all([scenario_id, destination_name, destination_id, duration_days, arrival_date, departure_date]):
            return jsonify({
                'status': 'error',
                'error': 'Missing required fields: scenario_id, destination_name, destination_id, duration_days, arrival_date, departure_date'
            }), 400

        # Create context for the agent
        research_prompt = f"""Please research accurate, real-world costs for the following destination:

Destination: {destination_name}
Destination ID: {destination_id}
Duration: {duration_days} days
Arrival Date: {arrival_date}
Departure Date: {departure_date}
Number of Travelers: {num_travelers}
Travel Style: {travel_style}
"""

        if previous_destination:
            research_prompt += f"Previous Destination: {previous_destination}\n"
        if next_destination:
            research_prompt += f"Next Destination: {next_destination}\n"

        research_prompt += """
Please provide comprehensive cost research including:
1. Accommodation costs (total for stay)
2. Daily food costs per person
3. Daily local transport costs per person (taxis, buses, subway, etc. within the destination)
4. Activity and attraction costs

NOTE: Do NOT research flight costs - inter-destination flights are tracked separately via TransportSegment objects.

For each category, provide low/mid/high estimates with sources.
"""

        # Create or get session
        session_endpoint = f"{ADK_API_URL}/apps/{APP_NAME}/users/{USER_ID}/sessions/{session_id}"
        try:
            session_resp = requests.post(session_endpoint)
            if session_resp.status_code != 200:
                print(f"Warning: Session creation response: {session_resp.status_code}")
        except Exception as e:
            print(f"Session creation warning: {e}")

        # Prepare ADK payload to invoke cost_research_agent
        adk_payload = {
            "session_id": session_id,
            "app_name": APP_NAME,
            "user_id": USER_ID,
            # Call the cost research agent directly to improve reliability
            "agent_name": "cost_research_agent",
            "new_message": {
                "role": "user",
                "parts": [{"text": research_prompt}],
            },
            "state": {
                "web_session_id": session_id,
                "scenario_id": scenario_id,  # Pass scenario_id so agent can save to Firestore
                "destination_id": destination_id,
                "duration_days": duration_days,
                "num_travelers": num_travelers,
            }
        }

        print(f"🔍 Triggering cost research for: {destination_name}")

        # Call ADK API
        run_endpoint = f"{ADK_API_URL}/run_sse"
        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "Accept": "text/event-stream",
        }

        research_result = None
        response_text = ""
        save_tool_called = False
        cost_items_created = []  # Track cost items for response

        def _coerce_json(value):
            """Convert ADK tool payloads that may arrive as JSON strings into dicts."""
            if isinstance(value, dict):
                return value
            if isinstance(value, str):
                candidate = value.strip()
                if not candidate:
                    return {}
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    # Some tool payloads arrive double-encoded (e.g. {"json": "{...}"})
                    try:
                        return json.loads(candidate.replace("'", '"'))
                    except Exception:
                        return {"__raw__": value}
            return value or {}

        def _extract_research_from_args(raw_args):
            args = _coerce_json(raw_args)
            if not isinstance(args, dict):
                return args
            research_payload = (
                args.get("research_data")
                or args.get("researchData")
                or args.get("research")
            )
            if isinstance(research_payload, dict):
                return research_payload
            return args

        def _handle_tool_call(tool_call):
            nonlocal research_result, save_tool_called
            if not tool_call:
                return
            tool_name = tool_call.get("name")
            raw_args = (
                tool_call.get("args")
                or tool_call.get("arguments")
                or tool_call.get("input")
            )
            print(f"[DEBUG] _handle_tool_call: tool_name={tool_name}, raw_args type={type(raw_args)}")
            if tool_name == "save_researched_costs":
                save_tool_called = True
                candidate = _extract_research_from_args(raw_args)
                if isinstance(candidate, dict):
                    research_result = candidate or research_result
                    print(f"[DEBUG] Set research_result from save_researched_costs, keys: {research_result.keys()}")
            elif tool_name == "DestinationCostResearch":
                candidate = _extract_research_from_args(raw_args)
                print(f"[DEBUG] DestinationCostResearch candidate type: {type(candidate)}, is_dict: {isinstance(candidate, dict)}")
                if isinstance(candidate, dict):
                    print(f"[DEBUG] Candidate keys: {candidate.keys()}")
                    research_result = candidate or research_result
                    print(f"[DEBUG] Set research_result from DestinationCostResearch tool call")

        def _handle_tool_response(tool_resp):
            nonlocal research_result, save_tool_called
            if not tool_resp:
                return
            tool_name = tool_resp.get("name")
            payload = (
                tool_resp.get("response")
                or tool_resp.get("responseData")
                or tool_resp.get("result")
                or tool_resp.get("data")
            )
            print(f"[DEBUG] _handle_tool_response: tool_name={tool_name}, payload type before coerce={type(payload)}")
            payload = _coerce_json(payload)
            print(f"[DEBUG] _handle_tool_response: payload type after coerce={type(payload)}, is_dict={isinstance(payload, dict)}")
            if isinstance(payload, dict):
                print(f"[DEBUG] Payload keys: {payload.keys()}")
            if not isinstance(payload, dict):
                print(f"[DEBUG] Payload is not a dict, returning")
                return

            if tool_name == "save_researched_costs":
                save_tool_called = True
                candidate = (
                    payload.get("research_data")
                    or payload.get("researchData")
                    or payload.get("saved_costs")
                )
                if isinstance(candidate, dict):
                    research_result = candidate or research_result
                    print(f"[DEBUG] Set research_result from save_researched_costs response")
            elif tool_name == "DestinationCostResearch":
                candidate = (
                    payload.get("research_data")
                    or payload.get("researchData")
                    or payload
                )
                print(f"[DEBUG] DestinationCostResearch response candidate type: {type(candidate)}, is_dict: {isinstance(candidate, dict)}")
                if isinstance(candidate, dict):
                    print(f"[DEBUG] Candidate keys: {candidate.keys()}")
                    research_result = candidate or research_result
                    print(f"[DEBUG] Set research_result from DestinationCostResearch tool response")

        with requests.post(
            run_endpoint,
            data=json.dumps(adk_payload),
            headers=headers,
            stream=True,
            timeout=180  # Cost research may take longer due to multiple searches
        ) as r:
            for chunk in r.iter_lines():
                if not chunk:
                    continue
                json_string = chunk.decode("utf-8").removeprefix("data: ").strip()
                try:
                    event = json.loads(json_string)

                    # DEBUG: Print all events to understand structure
                    print(f"[DEBUG] Received event keys: {event.keys()}")

                    # Extract text responses
                    if "content" in event and "parts" in event["content"]:
                        for part in event["content"]["parts"]:
                            if "text" in part:
                                response_text += part["text"]

                            # Check if save_researched_costs tool was called
                            func_call = part.get("function_call") or part.get("functionCall")
                            if func_call:
                                print(f"[DEBUG] Found function_call in part: {func_call.get('name')}")
                                _handle_tool_call(func_call)

                            # Also check function responses for save confirmation
                            func_resp = part.get("function_response") or part.get("functionResponse")
                            if func_resp:
                                print(f"[DEBUG] Found function_response in part: {func_resp.get('name')}")
                                print(f"[DEBUG] Response payload keys: {func_resp.get('response', {}).keys() if isinstance(func_resp.get('response'), dict) else 'not a dict'}")
                                _handle_tool_response(func_resp)

                    # Some ADK responses surface tool calls at the top level rather than within content.
                    top_level_call = event.get("function_call") or event.get("functionCall")
                    if top_level_call:
                        print(f"[DEBUG] Found top_level function_call: {top_level_call.get('name')}")
                        _handle_tool_call(top_level_call)

                    top_level_response = event.get("function_response") or event.get("functionResponse")
                    if top_level_response:
                        print(f"[DEBUG] Found top_level function_response: {top_level_response.get('name')}")
                        _handle_tool_response(top_level_response)

                except json.JSONDecodeError:
                    continue

        # Try to extract JSON from response_text if we don't have structured data
        print(f"[DEBUG] After streaming: research_result is {'SET' if research_result else 'NOT SET'}")
        print(f"[DEBUG] After streaming: save_tool_called={save_tool_called}")
        if not research_result and response_text:
            print(f"[DEBUG] Attempting to extract JSON from response_text (length={len(response_text)})")
            # Look for JSON in the response text
            import re
            json_match = re.search(r'\{[\s\S]*"destination_name"[\s\S]*\}', response_text)
            if json_match:
                try:
                    research_result = json.loads(json_match.group())
                    print(f"✅ Extracted JSON from response text")
                except:
                    print(f"[DEBUG] Failed to parse JSON from response_text")
                    pass
            else:
                print(f"[DEBUG] No JSON pattern found in response_text")

        # Alternative C: If we have structured research JSON but no save tool call,
        # save the data server-side via /api/costs/bulk-save and also generate a
        # concise human summary using the root agent.
        saved_via_server = False
        summary_text = None

        if research_result and not save_tool_called:
            try:
                # Build cost_items similar to save_researched_costs tool
                # NOTE: 'flights' removed - inter-destination flights tracked via TransportSegment
                categories_map = {
                    'accommodation': 'accommodation',
                    'activities': 'activity',
                    'food_daily': 'food',
                    'transport_daily': 'transport'  # Local transport only
                }

                cost_items = []
                for research_cat, itinerary_cat in categories_map.items():
                    if research_cat not in research_result:
                        continue
                    cat_data = research_result.get(research_cat) or {}

                    base_usd = _to_float(cat_data.get('amount_mid', 0))
                    base_local = _to_float(cat_data.get('amount_local', 0))
                    currency_local = cat_data.get('currency_local', 'USD')

                    # Scale per category semantics:
                    # - food_daily, transport_daily: per-day per-person → scale by duration_days * num_travelers
                    # - accommodation, activities: totals for stay → no scaling
                    multiplier = 1
                    if research_cat in ('food_daily', 'transport_daily'):
                        multiplier = max(1, int(duration_days)) * max(1, int(num_travelers))

                    amount_usd = base_usd * multiplier
                    amount_local = base_local * multiplier if base_local else amount_usd

                    stable_dest = (
                        destination_name.lower()
                        .replace(' ', '_')
                        .replace(',', '')
                        .replace('/', '-')
                        .replace(':', '-')
                    )

                    cost_items.append({
                        'id': f"{destination_id}_{stable_dest}_{itinerary_cat}",
                        'category': itinerary_cat,
                        'description': f"{cat_data.get('category', research_cat).title()} in {destination_name}",
                        'amount': amount_local,
                        'currency': currency_local,
                        'amount_usd': amount_usd,
                        'date': datetime.now().strftime("%Y-%m-%d"),
                        'destination_id': destination_id,
                        'booking_status': 'researched',
                        'source': 'web_research',
                        'notes': cat_data.get('notes', ''),
                        'confidence': cat_data.get('confidence', 'medium'),
                        'sources': cat_data.get('sources', []),
                        'researched_at': cat_data.get('researched_at', datetime.now().isoformat()),
                    })

                # Store cost_items for response
                cost_items_created = cost_items

                # Save to Firestore via our own endpoint (Flask runs on port 5001)
                try:
                    save_resp = requests.post(
                        "http://127.0.0.1:5001/api/costs/bulk-save",
                        json={
                            'session_id': session_id,
                            'scenario_id': scenario_id,
                            'destination_id': destination_id,
                            'destination_name': destination_name,
                            'cost_items': cost_items,
                        },
                        timeout=30,
                    )
                    saved_via_server = save_resp.status_code == 200
                    if saved_via_server:
                        print(f"✅ Server-side save successful via bulk-save API")
                    else:
                        print(f"⚠️ Server-side save failed: {save_resp.status_code} {save_resp.text[:200]}")
                except Exception as e:
                    print(f"⚠️ Exception during server-side save: {e}")
                    saved_via_server = False

                # Ask root agent to summarize for the chat response
                try:
                    summary_prompt = (
                        f"Summarize these researched costs for {destination_name} in 3-5 sentences "
                        f"for a family of {num_travelers} traveling {duration_days} days. "
                        f"Focus on total, per-day, and major categories.\n\n" 
                        f"JSON:\n{json.dumps(research_result)}"
                    )
                    run_payload = {
                        'session_id': session_id,
                        'app_name': APP_NAME,
                        'user_id': USER_ID,
                        'agent_name': 'root_agent',
                        'new_message': {
                            'role': 'user',
                            'parts': [{'text': summary_prompt}],
                        },
                    }
                    with requests.post(
                        run_endpoint,
                        data=json.dumps(run_payload),
                        headers=headers,
                        stream=True,
                        timeout=60,
                    ) as r2:
                        for chunk in r2.iter_lines():
                            if not chunk:
                                continue
                            s = chunk.decode('utf-8').removeprefix('data: ').strip()
                            try:
                                ev = json.loads(s)
                                if 'content' in ev and 'parts' in ev['content']:
                                    for p in ev['content']['parts']:
                                        if 'text' in p:
                                            summary_text = (summary_text or '') + p['text']
                            except json.JSONDecodeError:
                                continue
                except Exception:
                    summary_text = None

            except Exception as e:
                print(f"Error during server-side save of research JSON: {e}")

        if research_result or save_tool_called or saved_via_server or cost_items_created:
            print(f"✅ Cost research completed for {destination_name}")
            return jsonify({
                'status': 'success',
                'research': cost_items_created,  # Return cost items array for frontend
                'research_data': research_result,  # Original research JSON for reference
                'response_text': summary_text or response_text,
                'saved_to_firestore': save_tool_called or saved_via_server,
                'costs_saved': len(cost_items_created)
            })
        else:
            print(f"⚠️ Cost research returned no structured data")
            return jsonify({
                'status': 'partial',
                'response_text': response_text,
                'message': 'Research completed but no structured data returned'
            })

    except requests.exceptions.Timeout:
        return jsonify({
            'status': 'error',
            'error': 'Cost research timed out. This process can take 2-3 minutes due to extensive web searches.'
        }), 504
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in cost research endpoint: {error_details}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'error_details': error_details
        }), 500

# ============================================================================
# Static File Serving (must be last to not override API routes)
# ============================================================================

@app.route('/')
def index():
    """Serve the main web application"""
    try:
        return send_from_directory(WEB_DIR, 'index.html')
    except Exception as e:
        return jsonify({
            'error': 'Web files not found',
            'details': str(e),
            'web_dir': WEB_DIR
        }), 404

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files from web directory"""
    try:
        # Only serve files that actually exist
        file_path = os.path.join(WEB_DIR, path)
        if os.path.isfile(file_path):
            return send_from_directory(WEB_DIR, path)
        # If path doesn't exist and doesn't start with /api, return 404
        if not path.startswith('api/'):
            return jsonify({'error': 'File not found', 'path': path}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/api/places/resolve', methods=['POST'])
def resolve_place():
    """
    Resolve a location query to a Google Place ID.

    Request body:
    {
        "query": "Tokyo, Japan",
        "location_type": "city"  // optional
    }

    Response:
    {
        "status": "success",
        "place_id": "ChIJ...",
        "name": "Tokyo",
        "coordinates": {"lat": 35.6762, "lng": 139.6503},
        ...
    }
    """
    try:
        from travel_concierge.tools.place_resolver import get_place_resolver

        data = request.get_json() or {}
        query = data.get('query')
        location_type = data.get('location_type')

        if not query:
            return jsonify({'error': 'query parameter required'}), 400

        resolver = get_place_resolver()
        place_info = resolver.resolve_place(query, location_type=location_type)

        if place_info:
            return jsonify({
                'status': 'success',
                **place_info
            })
        else:
            return jsonify({
                'status': 'not_found',
                'error': f'Could not resolve location: {query}'
            }), 404

    except Exception as e:
        print(f"❌ Place resolution error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/places/batch-resolve', methods=['POST'])
def batch_resolve_places():
    """
    Resolve multiple location queries in batch.

    Request body:
    {
        "queries": ["Tokyo, Japan", "Paris, France", "New York, USA"]
    }

    Response:
    {
        "status": "success",
        "results": {
            "Tokyo, Japan": {place_info},
            "Paris, France": {place_info},
            ...
        }
    }
    """
    try:
        from travel_concierge.tools.place_resolver import get_place_resolver

        data = request.get_json() or {}
        queries = data.get('queries', [])

        if not queries or not isinstance(queries, list):
            return jsonify({'error': 'queries array required'}), 400

        resolver = get_place_resolver()
        results = resolver.batch_resolve(queries)

        return jsonify({
            'status': 'success',
            'results': results
        })

    except Exception as e:
        print(f"❌ Batch resolution error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/places/details/<place_id>', methods=['GET'])
def get_place_details(place_id):
    """
    Get full details for a known Place ID.

    Usage: GET /api/places/details/ChIJ...
    """
    try:
        from travel_concierge.tools.place_resolver import get_place_resolver

        resolver = get_place_resolver()
        details = resolver.get_place_details(place_id)

        if details:
            return jsonify({
                'status': 'success',
                **details
            })
        else:
            return jsonify({
                'status': 'not_found',
                'error': f'Could not find details for Place ID: {place_id}'
            }), 404

    except Exception as e:
        print(f"❌ Place details error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/costs/cleanup-ai-estimates', methods=['POST'])
def cleanup_ai_estimates():
    """
    One-time cleanup: Remove all ai_estimate costs from Firestore.
    This helps clean up legacy costs that weren't properly removed.
    """
    try:
        from google.cloud import firestore

        data = request.get_json() or {}
        scenario_id = data.get('scenario_id')

        if not scenario_id:
            return jsonify({'error': 'scenario_id required'}), 400

        print("="*100)
        print("🧹 CLEANUP AI ESTIMATES")
        print("="*100)
        print(f"   Scenario ID: {scenario_id}")

        # Initialize Firestore
        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get latest version
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if not versions:
            return jsonify({'error': 'No versions found'}), 404

        latest_version_ref = versions[0].reference
        latest_version_data = versions[0].to_dict() or {}

        # Get costs
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}
        version_costs = itinerary_data.get('costs', []) or []

        print(f"📊 Total costs before cleanup: {len(version_costs)}")

        # Filter out ai_estimate costs
        cleaned_costs = []
        removed_costs = []

        for cost in version_costs:
            source = cost.get('source')
            booking_status = cost.get('booking_status', 'estimated')

            # Remove if ai_estimate source
            if source == 'ai_estimate':
                removed_costs.append(cost)
                print(f"  🗑️  Removing ai_estimate: {cost.get('category')} - {cost.get('description', 'N/A')[:50]} (${cost.get('amount_usd', 0)})")
            else:
                cleaned_costs.append(cost)

        print(f"🧹 Removed {len(removed_costs)} ai_estimate costs")
        print(f"✅ Kept {len(cleaned_costs)} costs")

        # Update Firestore
        itinerary_data['costs'] = cleaned_costs
        latest_version_ref.update({
            'itineraryData': itinerary_data,
            'lastModified': datetime.utcnow().isoformat()
        })

        print(f"✅ Cleanup complete!")

        return jsonify({
            'status': 'success',
            'removed': len(removed_costs),
            'remaining': len(cleaned_costs)
        })

    except Exception as e:
        print(f"❌ Cleanup error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Transport Segment API Endpoints
# ============================================================================

@app.route('/api/transport-segments', methods=['GET'])
def get_transport_segments():
    """
    Get all transport segments for a scenario.
    Query params: scenario_id
    """
    try:
        from google.cloud import firestore

        scenario_id = request.args.get('scenario_id')
        print(f"🚗 GET /api/transport-segments - scenario_id: {scenario_id}")

        if not scenario_id:
            return jsonify({'error': 'scenario_id required'}), 400

        print("🔧 Creating Firestore client...")
        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        print(f"📡 Querying Firestore for scenario: {scenario_id}")
        # Get latest version
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )
        print(f"✅ Query completed, found {len(versions)} versions")

        if not versions:
            print("⚠️ No versions found, returning empty array")
            return jsonify({'transport_segments': []})

        latest_version_data = versions[0].to_dict() or {}
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}
        transport_segments = itinerary_data.get('transport_segments', [])

        print(f"✅ Returning {len(transport_segments)} transport segments")
        return jsonify({'transport_segments': transport_segments})

    except Exception as e:
        print(f"❌ Error fetching transport segments: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/transport-segments', methods=['POST'])
def create_transport_segment():
    """
    Create a new transport segment.
    Body: segment data + scenario_id
    """
    try:
        from google.cloud import firestore

        data = request.get_json() or {}
        scenario_id = data.get('scenario_id')

        if not scenario_id:
            return jsonify({'error': 'scenario_id required'}), 400

        # Extract segment data
        segment = {
            'id': data.get('id') or str(uuid.uuid4()),
            'from_destination_id': data.get('from_destination_id'),
            'from_destination_name': data.get('from_destination_name'),
            'to_destination_id': data.get('to_destination_id'),
            'to_destination_name': data.get('to_destination_name'),
            'transport_mode': data.get('transport_mode', 'plane'),
            'transport_mode_icon': data.get('transport_mode_icon', '✈️'),
            'distance_km': data.get('distance_km', 0),
            'duration_hours': data.get('duration_hours'),
            'estimated_cost_usd': data.get('estimated_cost_usd', 0),
            'researched_cost_low': data.get('researched_cost_low'),
            'researched_cost_mid': data.get('researched_cost_mid'),
            'researched_cost_high': data.get('researched_cost_high'),
            'actual_cost_usd': data.get('actual_cost_usd'),
            'currency_local': data.get('currency_local'),
            'amount_local': data.get('amount_local'),
            'booking_status': data.get('booking_status', 'estimated'),
            'confidence_level': data.get('confidence_level', 'low'),
            'research_sources': data.get('research_sources', []),
            'research_notes': data.get('research_notes'),
            'researched_at': data.get('researched_at'),
            'alternatives': data.get('alternatives', []),
            'booking_link': data.get('booking_link'),
            'booking_reference': data.get('booking_reference'),
            'notes': data.get('notes'),
            'num_travelers': data.get('num_travelers', 3),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        # Save to Firestore
        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get latest version
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if not versions:
            return jsonify({'error': 'No versions found'}), 404

        latest_version_ref = versions[0].reference
        latest_version_data = versions[0].to_dict() or {}
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}

        # Add segment to transport_segments array
        transport_segments = itinerary_data.get('transport_segments', [])
        transport_segments.append(segment)
        itinerary_data['transport_segments'] = transport_segments

        # Update Firestore
        latest_version_ref.update({
            'itineraryData': itinerary_data,
            'lastModified': datetime.utcnow().isoformat()
        })

        return jsonify({'status': 'success', 'segment': segment})

    except Exception as e:
        print(f"Error creating transport segment: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/transport-segments/<segment_id>', methods=['PUT'])
def update_transport_segment(segment_id):
    """
    Update an existing transport segment.
    Body: updated segment data + scenario_id
    """
    try:
        from google.cloud import firestore

        data = request.get_json() or {}
        scenario_id = data.get('scenario_id')

        if not scenario_id:
            return jsonify({'error': 'scenario_id required'}), 400

        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get latest version
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if not versions:
            return jsonify({'error': 'No versions found'}), 404

        latest_version_ref = versions[0].reference
        latest_version_data = versions[0].to_dict() or {}
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}
        transport_segments = itinerary_data.get('transport_segments', [])

        # Find and update the segment
        segment_found = False
        for i, segment in enumerate(transport_segments):
            if segment.get('id') == segment_id:
                # Update segment fields
                segment.update({
                    'transport_mode': data.get('transport_mode', segment.get('transport_mode')),
                    'transport_mode_icon': data.get('transport_mode_icon', segment.get('transport_mode_icon')),
                    'estimated_cost_usd': data.get('estimated_cost_usd', segment.get('estimated_cost_usd')),
                    'researched_cost_low': data.get('researched_cost_low', segment.get('researched_cost_low')),
                    'researched_cost_mid': data.get('researched_cost_mid', segment.get('researched_cost_mid')),
                    'researched_cost_high': data.get('researched_cost_high', segment.get('researched_cost_high')),
                    'actual_cost_usd': data.get('actual_cost_usd', segment.get('actual_cost_usd')),
                    'currency_local': data.get('currency_local', segment.get('currency_local')),
                    'amount_local': data.get('amount_local', segment.get('amount_local')),
                    'booking_status': data.get('booking_status', segment.get('booking_status')),
                    'confidence_level': data.get('confidence_level', segment.get('confidence_level')),
                    'research_sources': data.get('research_sources', segment.get('research_sources', [])),
                    'research_notes': data.get('research_notes', segment.get('research_notes')),
                    'researched_at': data.get('researched_at', segment.get('researched_at')),
                    'alternatives': data.get('alternatives', segment.get('alternatives', [])),
                    'booking_link': data.get('booking_link', segment.get('booking_link')),
                    'booking_reference': data.get('booking_reference', segment.get('booking_reference')),
                    'notes': data.get('notes', segment.get('notes')),
                    'duration_hours': data.get('duration_hours', segment.get('duration_hours')),
                    'updated_at': datetime.utcnow().isoformat()
                })
                transport_segments[i] = segment
                segment_found = True
                break

        if not segment_found:
            return jsonify({'error': 'Segment not found'}), 404

        # Update Firestore
        itinerary_data['transport_segments'] = transport_segments
        latest_version_ref.update({
            'itineraryData': itinerary_data,
            'lastModified': datetime.utcnow().isoformat()
        })

        return jsonify({'status': 'success', 'segment': segment})

    except Exception as e:
        print(f"Error updating transport segment: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/transport-segments/<segment_id>', methods=['DELETE'])
def delete_transport_segment(segment_id):
    """
    Delete a transport segment.
    Query params: scenario_id
    """
    try:
        from google.cloud import firestore

        scenario_id = request.args.get('scenario_id')
        if not scenario_id:
            return jsonify({'error': 'scenario_id required'}), 400

        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get latest version
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if not versions:
            return jsonify({'error': 'No versions found'}), 404

        latest_version_ref = versions[0].reference
        latest_version_data = versions[0].to_dict() or {}
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}
        transport_segments = itinerary_data.get('transport_segments', [])

        # Filter out the segment to delete
        updated_segments = [s for s in transport_segments if s.get('id') != segment_id]

        if len(updated_segments) == len(transport_segments):
            return jsonify({'error': 'Segment not found'}), 404

        # Update Firestore
        itinerary_data['transport_segments'] = updated_segments
        latest_version_ref.update({
            'itineraryData': itinerary_data,
            'lastModified': datetime.utcnow().isoformat()
        })

        return jsonify({'status': 'success'})

    except Exception as e:
        print(f"Error deleting transport segment: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/transport-segments/sync', methods=['POST'])
def sync_transport_segments():
    """
    Synchronize transport segments based on current destination order.
    Creates/updates/deletes segments to match the locations array.
    Body: scenario_id
    """
    try:
        from google.cloud import firestore

        data = request.get_json() or {}
        scenario_id = data.get('scenario_id')

        if not scenario_id:
            return jsonify({'error': 'scenario_id required'}), 400

        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get latest version
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if not versions:
            return jsonify({'error': 'No versions found'}), 404

        latest_version_ref = versions[0].reference
        latest_version_data = versions[0].to_dict() or {}
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}

        locations = itinerary_data.get('locations', [])
        existing_segments = itinerary_data.get('transport_segments', [])

        # Build segment map for quick lookup
        segment_map = {}
        for segment in existing_segments:
            key = f"{segment.get('from_destination_id')}_{segment.get('to_destination_id')}"
            segment_map[key] = segment

        # Create new segments list based on current location order
        new_segments = []
        for i in range(len(locations) - 1):
            from_loc = locations[i]
            to_loc = locations[i + 1]

            key = f"{from_loc.get('id')}_{to_loc.get('id')}"

            # Use existing segment if found, otherwise create new
            if key in segment_map:
                existing_seg = segment_map[key]
                # Update estimates if segment has no researched cost and (no estimate or force_recalculate)
                force_recalculate = data.get('force_recalculate', False)
                needs_estimate = (
                    not existing_seg.get('researched_cost_mid') and
                    (force_recalculate or not existing_seg.get('estimated_cost_usd') or existing_seg.get('estimated_cost_usd') == 0)
                )
                if needs_estimate:
                    from_coords = from_loc.get('coordinates', {})
                    to_coords = to_loc.get('coordinates', {})
                    if from_coords and to_coords:
                        distance = calculate_distance_km(
                            from_coords.get('lat', 0), from_coords.get('lng', 0),
                            to_coords.get('lat', 0), to_coords.get('lng', 0)
                        )
                        same_country = from_loc.get('country') == to_loc.get('country')
                        mode = get_transport_mode_for_distance(distance, same_country)
                        existing_seg['distance_km'] = round(distance, 1)
                        existing_seg['transport_mode'] = mode
                        existing_seg['transport_mode_icon'] = get_transport_icon(mode)
                        existing_seg['estimated_cost_usd'] = estimate_transport_cost(distance, mode, 3)
                new_segments.append(existing_seg)
            else:
                # Calculate distance and estimate cost for new segment
                from_coords = from_loc.get('coordinates', {})
                to_coords = to_loc.get('coordinates', {})
                distance_km = 0
                transport_mode = 'plane'
                estimated_cost = 0

                if from_coords and to_coords:
                    from_lat = from_coords.get('lat', 0)
                    from_lng = from_coords.get('lng', 0)
                    to_lat = to_coords.get('lat', 0)
                    to_lng = to_coords.get('lng', 0)

                    if from_lat and from_lng and to_lat and to_lng:
                        distance_km = round(calculate_distance_km(from_lat, from_lng, to_lat, to_lng), 1)
                        same_country = from_loc.get('country') == to_loc.get('country')
                        transport_mode = get_transport_mode_for_distance(distance_km, same_country)
                        estimated_cost = estimate_transport_cost(distance_km, transport_mode, 3)

                # Create new segment with calculated estimates
                new_segment = {
                    'id': str(uuid.uuid4()),
                    'from_destination_id': from_loc.get('id'),
                    'from_destination_name': from_loc.get('name', ''),
                    'to_destination_id': to_loc.get('id'),
                    'to_destination_name': to_loc.get('name', ''),
                    'transport_mode': transport_mode,
                    'transport_mode_icon': get_transport_icon(transport_mode),
                    'distance_km': distance_km,
                    'duration_hours': None,
                    'estimated_cost_usd': estimated_cost,
                    'booking_status': 'estimated',
                    'confidence_level': 'low',
                    'research_sources': [],
                    'alternatives': [],
                    'num_travelers': 3,
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }
                new_segments.append(new_segment)

        # Update Firestore
        itinerary_data['transport_segments'] = new_segments
        latest_version_ref.update({
            'itineraryData': itinerary_data,
            'lastModified': datetime.utcnow().isoformat()
        })

        return jsonify({
            'status': 'success',
            'transport_segments': new_segments,
            'created': len([s for s in new_segments if s.get('id') not in [es.get('id') for es in existing_segments]]),
            'kept': len([s for s in new_segments if s.get('id') in [es.get('id') for es in existing_segments]]),
            'removed': len(existing_segments) - len([s for s in new_segments if s.get('id') in [es.get('id') for es in existing_segments]])
        })

    except Exception as e:
        print(f"Error syncing transport segments: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/transport/research', methods=['POST'])
def research_transport():
    """
    Research transport costs for a segment using the transport_research_agent.

    Expected request body:
    {
        "session_id": "session_abc123",
        "segment_id": "segment_uuid",
        "from_destination_name": "San Francisco",
        "to_destination_name": "Sydney",
        "from_country": "USA",
        "to_country": "Australia",
        "departure_date": "2026-06-15"
    }
    """
    try:
        data = request.json
        session_id = data.get('session_id', 'default')
        segment_id = data.get('segment_id')

        # Build the research request message
        from_destination_name = data.get('from_destination_name')
        to_destination_name = data.get('to_destination_name')
        from_country = data.get('from_country', '')
        to_country = data.get('to_country', '')
        departure_date = data.get('departure_date')

        # Validate required fields
        if not all([segment_id, from_destination_name, to_destination_name]):
            return jsonify({
                'status': 'error',
                'error': 'Missing required fields: segment_id, from_destination_name, to_destination_name'
            }), 400

        # Create context for the agent
        research_prompt = f"""Please research accurate, real-world flight and transport costs for the following route:

From: {from_destination_name}{', ' + from_country if from_country else ''}
To: {to_destination_name}{', ' + to_country if to_country else ''}
Departure Date: {departure_date or 'flexible'}
Segment ID: {segment_id}

Please provide comprehensive transport research including:
1. Primary route costs (low/mid/high estimates)
2. Airlines that serve this route
3. Flight duration and typical number of stops
4. Alternative airports in the same metro area
5. Alternative routing options (different cities, multi-leg) that could save significant money
6. Booking tips and recommendations

Search for 2 adults + 1 child (13 years old).
Check ±3 days around the departure date for better pricing.
"""

        # Create or get session
        session_endpoint = f"{ADK_API_URL}/apps/{APP_NAME}/users/{USER_ID}/sessions/{session_id}"
        try:
            session_resp = requests.post(session_endpoint)
            if session_resp.status_code != 200:
                print(f"Warning: Session creation response: {session_resp.status_code}")
        except Exception as e:
            print(f"Session creation warning: {e}")

        # Prepare ADK payload to invoke transport_research_agent
        adk_payload = {
            "session_id": session_id,
            "app_name": APP_NAME,
            "user_id": USER_ID,
            "agent_name": "transport_research_agent",
            "new_message": {
                "role": "user",
                "parts": [{"text": research_prompt}],
            },
            "state": {
                "web_session_id": session_id,
                "segment_id": segment_id,
            }
        }

        print(f"🔍 Triggering transport research for: {from_destination_name} → {to_destination_name}")

        # Call ADK API
        run_endpoint = f"{ADK_API_URL}/run_sse"
        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "Accept": "text/event-stream",
        }

        research_result = None
        response_text = ""

        def _coerce_json(value):
            """Convert ADK tool payloads that may arrive as JSON strings into dicts."""
            if isinstance(value, dict):
                return value
            if isinstance(value, str):
                candidate = value.strip()
                if not candidate:
                    return {}
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    try:
                        return json.loads(candidate.replace("'", '"'))
                    except Exception:
                        return {"__raw__": value}
            return value or {}

        def _extract_research_from_args(raw_args):
            args = _coerce_json(raw_args)
            if not isinstance(args, dict):
                return args
            research_payload = args.get("research_data") or args
            if isinstance(research_payload, dict):
                return research_payload
            return args

        def _handle_tool_call(tool_call):
            nonlocal research_result
            if not tool_call:
                return
            tool_name = tool_call.get("name")
            raw_args = tool_call.get("args") or tool_call.get("arguments") or tool_call.get("input")

            if tool_name == "TransportResearchResult":
                candidate = _extract_research_from_args(raw_args)
                if isinstance(candidate, dict):
                    research_result = candidate or research_result
                    print(f"[DEBUG] Set research_result from TransportResearchResult tool call")

        def _handle_tool_response(tool_resp):
            nonlocal research_result
            if not tool_resp:
                return
            tool_name = tool_resp.get("name")
            payload = tool_resp.get("response") or tool_resp.get("result") or tool_resp.get("data")
            payload = _coerce_json(payload)

            if not isinstance(payload, dict):
                return

            if tool_name == "TransportResearchResult":
                candidate = payload.get("research_data") or payload
                if isinstance(candidate, dict):
                    research_result = candidate or research_result
                    print(f"[DEBUG] Set research_result from TransportResearchResult tool response")

        with requests.post(
            run_endpoint,
            data=json.dumps(adk_payload),
            headers=headers,
            stream=True,
            timeout=180  # Transport research may take time due to multiple searches
        ) as r:
            event_count = 0
            for chunk in r.iter_lines():
                if not chunk:
                    continue
                json_string = chunk.decode("utf-8").removeprefix("data: ").strip()
                try:
                    event = json.loads(json_string)
                    event_count += 1

                    # Log every 10th event and any that contain function calls/responses
                    if event_count % 10 == 0 or any(key in str(event) for key in ['function_call', 'functionCall', 'function_response', 'functionResponse', 'TransportResearchResult']):
                        print(f"[SSE Event {event_count}] Keys: {list(event.keys())}")

                    # Extract text responses
                    if "content" in event and "parts" in event["content"]:
                        for part in event["content"]["parts"]:
                            if "text" in part:
                                response_text += part["text"]

                            func_call = part.get("function_call") or part.get("functionCall")
                            if func_call:
                                _handle_tool_call(func_call)

                            func_resp = part.get("function_response") or part.get("functionResponse")
                            if func_resp:
                                _handle_tool_response(func_resp)

                    # Check top level
                    top_level_call = event.get("function_call") or event.get("functionCall")
                    if top_level_call:
                        _handle_tool_call(top_level_call)

                    top_level_response = event.get("function_response") or event.get("functionResponse")
                    if top_level_response:
                        _handle_tool_response(top_level_response)

                except json.JSONDecodeError:
                    continue

        if research_result:
            return jsonify({
                'status': 'success',
                'research_result': research_result,
                'response_text': response_text
            })
        else:
            return jsonify({
                'status': 'partial',
                'message': 'Research completed but no structured data returned',
                'response_text': response_text
            }), 200

    except Exception as e:
        print(f"Error researching transport: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/transport/update-research', methods=['POST'])
def update_transport_research():
    """
    Update a transport segment with research results.

    Expected request body:
    {
        "session_id": "session_abc123",
        "segment_id": "segment_uuid",
        "research_data": { TransportResearchResult object }
    }
    """
    try:
        from google.cloud import firestore

        data = request.get_json() or {}
        session_id = data.get('session_id')
        segment_id = data.get('segment_id')
        research_data = data.get('research_data', {})
        scenario_id = data.get('scenario_id')  # Allow direct scenario_id in request

        print(f"\n[UPDATE-RESEARCH] Received request:")
        print(f"  session_id: {session_id}")
        print(f"  segment_id: {segment_id}")
        print(f"  scenario_id: {scenario_id}")
        print(f"  research_data keys: {list(research_data.keys()) if research_data else 'None'}")

        if not segment_id or not research_data:
            return jsonify({'error': 'segment_id and research_data required'}), 400

        # Get scenario_id from session cache if not provided directly
        if not scenario_id and session_id:
            session_data = session_store._session_cache.get(session_id, {})
            scenario_id = session_data.get('scenario_id')
            print(f"  Retrieved scenario_id from session cache: {scenario_id}")

        if not scenario_id:
            return jsonify({'error': 'No active scenario found. Please provide scenario_id or valid session_id.'}), 400

        db = get_firestore_client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get latest version
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if not versions:
            return jsonify({'error': 'No versions found'}), 404

        latest_version_ref = versions[0].reference
        latest_version_data = versions[0].to_dict() or {}
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}

        transport_segments = itinerary_data.get('transport_segments', [])

        # Find and update the segment
        segment_found = False
        for segment in transport_segments:
            if segment.get('id') == segment_id:
                segment_found = True
                print(f"  Found segment: {segment.get('type')} from {segment.get('from_name')} to {segment.get('to_name')}")
                # Update with research data
                transport_mode = research_data.get('transport_mode', 'plane')
                segment['transport_mode'] = transport_mode
                segment['transport_mode_icon'] = get_transport_icon(transport_mode)
                segment['researched_cost_low'] = research_data.get('cost_low')
                segment['researched_cost_mid'] = research_data.get('cost_mid')
                segment['researched_cost_high'] = research_data.get('cost_high')
                segment['researched_duration_hours'] = research_data.get('typical_duration_hours')
                segment['researched_stops'] = research_data.get('typical_stops', 0)
                segment['researched_airlines'] = research_data.get('airlines', [])
                segment['researched_alternatives'] = research_data.get('alternatives', [])
                segment['research_sources'] = research_data.get('sources', [])
                segment['research_notes'] = research_data.get('booking_tips', '')
                segment['researched_at'] = datetime.utcnow().isoformat()  # Always use current time, not AI's date
                segment['booking_status'] = 'researched'
                segment['confidence_level'] = research_data.get('confidence', 'medium')
                segment['auto_updated'] = True
                segment['updated_at'] = datetime.utcnow().isoformat()
                print(f"  Updated segment with:")
                print(f"    cost_mid: {segment['researched_cost_mid']}")
                print(f"    airlines: {len(segment['researched_airlines'])} airlines")
                print(f"    alternatives: {len(segment['researched_alternatives'])} alternatives")
                print(f"    booking_status: {segment['booking_status']}")
                break

        if not segment_found:
            print(f"  ERROR: Segment {segment_id} not found in {len(transport_segments)} transport segments")
            return jsonify({'error': f'Segment {segment_id} not found'}), 404

        # Update Firestore
        itinerary_data['transport_segments'] = transport_segments
        latest_version_ref.update({
            'itineraryData': itinerary_data,
            'lastModified': datetime.utcnow().isoformat()
        })
        print(f"  ✅ Firestore updated successfully")

        # Queue change for frontend polling
        if session_id in session_store._session_cache:
            if 'pending_changes' not in session_store._session_cache[session_id]:
                session_store._session_cache[session_id]['pending_changes'] = []

            session_store._session_cache[session_id]['pending_changes'].append({
                'type': 'transport_segment_updated',
                'segment_id': segment_id,
                'timestamp': datetime.utcnow().isoformat()
            })
            print(f"  ✅ Queued change notification for session {session_id}")
        else:
            print(f"  ⚠️ Session {session_id} not found in cache - polling may not detect change")

        return jsonify({
            'status': 'success',
            'message': 'Transport segment updated with research data',
            'segment_id': segment_id
        })

    except Exception as e:
        print(f"Error updating transport research: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



# ============================================
# EDUCATION SYSTEM - TEST ENDPOINTS
# ============================================

def _save_curriculum_to_firestore(student_profile: Dict, location: Dict, curriculum_data: Dict, metadata: Dict) -> Dict[str, str]:
    """
    Save generated curriculum to Firestore collections.

    Args:
        student_profile: Student profile data
        location: Location data
        curriculum_data: Generated curriculum JSON
        metadata: Generation metadata (model, timestamp, etc.)

    Returns:
        Dict with saved document IDs: {
            'student_profile_id': str,
            'curriculum_plan_id': str,
            'activity_ids': List[str]
        }
    """
    db = get_firestore_client()
    if not db:
        raise Exception("Firestore not available")

    now = datetime.now()

    # 1. Save or retrieve student profile
    student_id = student_profile.get('id') or f"student_{uuid.uuid4().hex[:12]}"
    student_ref = db.collection('student_profiles').document(student_id)

    # Check if student already exists
    student_doc = student_ref.get()
    if not student_doc.exists:
        # Create new student profile
        student_data = {
            'id': student_id,
            'name': student_profile.get('name', 'Student'),
            'age': student_profile.get('age', 14),
            'grade': student_profile.get('grade', 8),
            'state': student_profile.get('state', 'California'),
            'country': student_profile.get('country', 'USA'),
            'subjects_parent_covers': student_profile.get('subjects_parent_covers', []),
            'subjects_to_cover': metadata.get('subjects', []),
            'learning_style': student_profile.get('learning_style', 'experiential'),
            'reading_level': student_profile.get('reading_level', 10),
            'time_budget_minutes_per_day': student_profile.get('time_budget_minutes_per_day', 60),
            'interests': student_profile.get('interests', []),
            'educational_standards': [f"{student_profile.get('state', 'California')}-{student_profile.get('grade', 8)}"],
            'required_subjects': metadata.get('subjects', []),
            'created_at': now,
            'updated_at': now
        }
        student_ref.set(student_data)
        print(f"✓ Created student profile: {student_id}")
    else:
        # Update timestamp
        student_ref.update({'updated_at': now})
        print(f"✓ Using existing student profile: {student_id}")

    # 2. Save curriculum plan
    plan_id = f"plan_{uuid.uuid4().hex[:12]}"
    location_id = location.get('id', 'unknown')

    # Build location_lessons structure
    location_lessons = {
        str(location_id): {
            'location_id': str(location_id),
            'location_name': location.get('name', 'Unknown'),
            'arrival_date': location.get('arrival_date', ''),
            'departure_date': location.get('departure_date', ''),
            'duration_days': location.get('duration_days', 7),
            'pre_trip': curriculum_data.get('pre_trip', {}),
            'on_location': {
                'experiential_activities': curriculum_data.get('on_location', {}).get('experiential_activities', []),
                'structured_lessons': curriculum_data.get('on_location', {}).get('structured_lessons', []),
                'daily_menus': [],
                'field_trip_guides': []
            },
            'post_trip': curriculum_data.get('post_trip', {}),
            'subject_coverage': {}
        }
    }

    curriculum_plan = {
        'id': plan_id,
        'student_profile_id': student_id,
        'trip_scenario_id': location.get('trip_scenario_id', 'test_scenario'),
        'trip_version_id': location.get('trip_version_id'),
        'status': 'draft',
        'created_at': now,
        'updated_at': now,
        'generated_at': now,
        'ai_model_used': metadata.get('model_used', 'gemini-2.0-flash-exp'),
        'generation_metadata': metadata,

        # Top-level fields for querying and relationships
        'location_id': str(location_id),  # Primary location ID for easy querying
        'location_name': location.get('name', 'Unknown'),
        'country': location.get('country', ''),  # For country-level queries
        'region': location.get('region', ''),  # For region-level queries

        'semester': {
            'title': f"Learning Journey: {location.get('name', 'Unknown')}",
            'start_date': location.get('arrival_date', ''),
            'end_date': location.get('departure_date', ''),
            'total_weeks': (location.get('duration_days', 7) // 7) or 1,
            'total_destinations': 1,
            'subjects': {}
        },
        'location_lessons': location_lessons,
        'thematic_threads': [],
        'standards_coverage': {}
    }

    plan_ref = db.collection('curriculum_plans').document(plan_id)
    plan_ref.set(curriculum_plan)
    print(f"✓ Created curriculum plan: {plan_id}")

    # 3. Save individual learning activities
    activity_ids = []

    # Extract experiential activities
    exp_activities = curriculum_data.get('on_location', {}).get('experiential_activities', [])
    for idx, activity in enumerate(exp_activities):
        activity_id = f"activity_{uuid.uuid4().hex[:12]}"
        activity_data = {
            'id': activity_id,
            'curriculum_plan_id': plan_id,
            'location_id': str(location_id),
            'type': 'experiential',
            'subject': activity.get('subject', 'general'),
            'timing': 'on_location',
            'title': activity.get('title', f'Activity {idx + 1}'),
            'description': activity.get('description', ''),
            'learning_objectives': activity.get('learning_objectives', []),
            'estimated_duration_minutes': activity.get('estimated_duration_minutes', 60),
            'difficulty': 'medium',
            'instructions': activity.get('instructions', {}),
            'resources': [],
            'created_at': now,
            'ai_generated': True,
            'customized': False,
            'source': 'curriculum_generator'
        }

        # Add site details if available
        if 'site_details' in activity:
            activity_data['site_details'] = activity['site_details']

        activity_ref = db.collection('learning_activities').document(activity_id)
        activity_ref.set(activity_data)
        activity_ids.append(activity_id)

    # Extract structured lessons
    structured_lessons = curriculum_data.get('on_location', {}).get('structured_lessons', [])
    for idx, lesson in enumerate(structured_lessons):
        activity_id = f"activity_{uuid.uuid4().hex[:12]}"
        activity_data = {
            'id': activity_id,
            'curriculum_plan_id': plan_id,
            'location_id': str(location_id),
            'type': 'structured',
            'subject': lesson.get('subject', 'general'),
            'timing': 'on_location',
            'title': lesson.get('title', f'Lesson {idx + 1}'),
            'description': lesson.get('description', ''),
            'learning_objectives': lesson.get('learning_objectives', []),
            'estimated_duration_minutes': lesson.get('estimated_duration_minutes', 45),
            'difficulty': 'medium',
            'instructions': {},
            'resources': [],
            'created_at': now,
            'ai_generated': True,
            'customized': False,
            'source': 'curriculum_generator'
        }

        activity_ref = db.collection('learning_activities').document(activity_id)
        activity_ref.set(activity_data)
        activity_ids.append(activity_id)

    print(f"✓ Created {len(activity_ids)} learning activities")

    # 4. Optionally update trip location with curriculum reference
    # This creates a two-way relationship between locations and curricula
    if location.get('trip_scenario_id') and location.get('trip_version_id'):
        try:
            scenario_id = location['trip_scenario_id']
            version_id = location['trip_version_id']

            # Get the version document
            version_ref = db.collection('scenarios').document(scenario_id).collection('versions').document(version_id)
            version_doc = version_ref.get()

            if version_doc.exists:
                version_data = version_doc.to_dict()
                itinerary_data = version_data.get('itineraryData', {})
                locations = itinerary_data.get('locations', [])

                # Find the location and add curriculum reference
                updated = False
                for loc in locations:
                    if str(loc.get('id')) == str(location_id):
                        # Add curriculum_plan_ids array if doesn't exist
                        if 'curriculum_plan_ids' not in loc:
                            loc['curriculum_plan_ids'] = []
                        # Add this plan if not already there
                        if plan_id not in loc['curriculum_plan_ids']:
                            loc['curriculum_plan_ids'].append(plan_id)
                        updated = True
                        break

                if updated:
                    # Save updated itinerary back
                    version_ref.update({
                        'itineraryData': itinerary_data,
                        'updatedAt': now
                    })
                    print(f"✓ Added curriculum reference to location {location_id}")
        except Exception as e:
            print(f"⚠ Could not update location with curriculum reference: {e}")
            # Don't fail the whole operation if this step fails

    return {
        'student_profile_id': student_id,
        'curriculum_plan_id': plan_id,
        'activity_ids': activity_ids,
        'total_activities': len(activity_ids),
        'location_id': str(location_id)
    }


@app.route('/api/education/test/generate-curriculum', methods=['POST'])
def test_generate_curriculum():
    """
    Test endpoint for curriculum generation using Vertex AI.
    Uses existing Google Cloud credentials (ADC).
    """
    try:
        from google import genai

        data = request.json
        location = data.get('location', {})
        student = data.get('student', {})
        subjects = data.get('subjects', [])

        if not location or not student or not subjects:
            return jsonify({'error': 'Missing required fields: location, student, subjects'}), 400

        # Build the curriculum generation prompt
        prompt = f"""You are an expert curriculum designer specializing in location-based, experiential learning for middle school students.

# Student Context
- Name: {student.get('name', 'Student')}
- Age: {student.get('age', 14)}
- Grade: {student.get('grade', 8)}
- Learning Style: {student.get('learning_style', 'experiential')}
- Time Budget: {student.get('time_budget_minutes_per_day', 60)} minutes per day
- Reading Level: Grade {student.get('reading_level', 10)}
- Interests: {', '.join(student.get('interests', []))}
- State Standards: {student.get('state', 'California')} Grade {student.get('grade', 8)}

# Location Details
- Name: {location.get('name')}, {location.get('country')}
- Duration: {location.get('duration_days')} days
- Dates: {location.get('arrival_date', 'TBD')} to {location.get('departure_date', 'TBD')}
- Activity Type: {location.get('activity_type', 'exploration')}
- Highlights: {', '.join(location.get('highlights', []))}

# Subjects to Cover
{', '.join(subjects)}

# Task
Generate comprehensive educational content for this location that aligns with California 8th grade standards.

Create a detailed learning plan with the following structure:

## 1. Pre-Trip Preparation (2 weeks before arrival)

### Readings
Provide 3-5 readings (articles, book chapters). For each:
- Title
- Source (specific publication or website)
- Estimated reading time
- Brief description
- Why it's relevant

### Videos
Provide 2-3 educational videos. For each:
- Title
- Source (YouTube channel, PBS, National Geographic, etc.)
- Duration
- Description
- Key concepts covered

### Preparation Tasks
List 3-4 specific tasks to complete before the trip.

## 2. On-Location Activities

Create {min(location.get('duration_days', 7), 7)} days worth of learning activities.

### Experiential Activities (prioritize these - 70%)
Provide specific, location-based activities with:
- Exact sites to visit (with addresses)
- What to observe and document
- Questions to investigate
- Photo/video assignments
- Local interviews
- Hands-on challenges

### Structured Lessons (30%)
Provide 2-3 shorter activities for rest days, bad weather, evening time.

## 3. Post-Trip Reflections

### Reflection Prompts (5-7 prompts)
Journal prompts that encourage comparative thinking and synthesis.

### Synthesis Activities (2-3 activities)
Longer-form assignments: essays, reports, creative projects.

# Important Guidelines

1. **Be SPECIFIC**: Don't say "visit a museum" - say "Visit the Miraikan Science Museum, 3rd floor robotics exhibit"
2. **Include PRACTICAL DETAILS**: Best times to visit, estimated costs, what to bring
3. **AGE-APPROPRIATE**: Content for 8th grade, reading level appropriate
4. **EXPERIENTIAL FOCUS**: 70% experiential, 30% structured
5. **SUBJECT INTEGRATION**: Naturally weave together all subjects
6. **STANDARDS ALIGNMENT**: Reference California 8th grade standards

# Output Format

CRITICAL: Provide response as valid JSON matching this EXACT structure:

{{
  "location_id": "{location.get('id', 'location')}",
  "location_name": "{location.get('name')}, {location.get('country')}",
  "duration_days": {location.get('duration_days', 7)},

  "pre_trip": {{
    "timeline": "2 weeks before arrival",
    "readings": [
      {{
        "title": "Exact article title",
        "source": "Publication name or website",
        "reading_time_minutes": 20,
        "description": "What the student will learn",
        "relevance": "Why this matters for the trip",
        "url": "https://example.com/article" or null
      }}
    ],
    "videos": [
      {{
        "title": "Exact video title",
        "source": "YouTube channel or platform name",
        "duration_minutes": 15,
        "description": "What the video covers",
        "key_concepts": ["concept1", "concept2"],
        "url": "https://youtube.com/..." or null
      }}
    ],
    "preparation_tasks": [
      {{
        "title": "Task name",
        "description": "Detailed instructions",
        "estimated_duration_minutes": 30
      }}
    ]
  }},

  "on_location": {{
    "experiential_activities": [
      {{
        "title": "Activity name",
        "type": "experiential",
        "subject": "science" or "social_studies" or "language_arts",
        "estimated_duration_minutes": 120,
        "learning_objectives": ["objective1", "objective2"],
        "description": "Detailed activity description",
        "instructions": {{
          "before": "What to prepare",
          "during": "Step-by-step what to do",
          "after": "Follow-up tasks"
        }},
        "site_details": {{
          "name": "Exact museum/site name",
          "address": "Full street address",
          "best_time": "Morning on weekdays",
          "cost_usd": 15,
          "what_to_bring": ["camera", "notebook", "water"]
        }}
      }}
    ],
    "structured_lessons": [
      {{
        "title": "Lesson name",
        "type": "structured",
        "subject": "science",
        "estimated_duration_minutes": 60,
        "learning_objectives": ["objective1"],
        "description": "What the lesson covers",
        "activities": ["Read chapter 3", "Watch video", "Answer questions"]
      }}
    ]
  }},

  "post_trip": {{
    "reflection_prompts": [
      {{
        "text": "The actual prompt question or writing prompt",
        "type": "journal" or "essay" or "discussion",
        "word_count_target": 300
      }}
    ],
    "synthesis_activities": [
      {{
        "title": "Activity name",
        "type": "essay" or "presentation" or "project",
        "subject": "social_studies",
        "description": "Detailed assignment description",
        "estimated_duration_minutes": 120,
        "learning_objectives": ["objective1", "objective2"]
      }}
    ]
  }},

  "subject_coverage": {{
    "science": {{
      "topics": ["Marine ecosystems", "Geology"],
      "standards": ["CA-NGSS-MS-LS2-1"],
      "estimated_hours": 8.0
    }},
    "social_studies": {{
      "topics": ["Cultural studies", "Economics"],
      "standards": ["CA-HSS-8.1"],
      "estimated_hours": 5.0
    }},
    "language_arts": {{
      "topics": ["Descriptive writing", "Research"],
      "standards": ["CA-CCSS-ELA-W.8.1"],
      "estimated_hours": 3.0
    }}
  }}
}}

IMPORTANT:
1. Every field shown above is REQUIRED. Use exact field names.
2. Return ONLY valid JSON - no markdown, no explanation text before or after.
3. Ensure all JSON is properly formatted with correct commas, brackets, and quotes.
4. Make it specific, engaging, and educationally sound!
"""

        # Initialize Gemini client with credentials
        credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
        if credentials_json:
            credentials_info = json.loads(credentials_json)
            credentials = service_account.Credentials.from_service_account_info(
                credentials_info,
                scopes=['https://www.googleapis.com/auth/cloud-platform',
                       'https://www.googleapis.com/auth/generative-language']
            )
            client = genai.Client(credentials=credentials)
        else:
            # Fall back to default credentials (ADC)
            client = genai.Client()

        model_id = 'gemini-2.0-flash-exp'

        print(f"Generating curriculum for {location.get('name')}...")
        print(f"Using model: {model_id}")
        print(f"Prompt length: {len(prompt)} characters")

        # Generate content
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config={
                'temperature': 0.7,
                'max_output_tokens': 8000,
            }
        )

        # Extract text from response
        result_text = response.text

        # Try to parse as JSON
        try:
            # Remove markdown code blocks if present
            cleaned_text = result_text.strip()
            if cleaned_text.startswith('```'):
                parts = cleaned_text.split('```')
                if len(parts) >= 2:
                    cleaned_text = parts[1]
                    # Remove language identifier if present
                    if cleaned_text.strip().startswith('json'):
                        cleaned_text = cleaned_text.strip()[4:]

            # Clean up common JSON formatting issues
            cleaned_text = cleaned_text.strip()

            # Try to find JSON object boundaries if there's extra text
            if not cleaned_text.startswith('{'):
                start_idx = cleaned_text.find('{')
                if start_idx >= 0:
                    cleaned_text = cleaned_text[start_idx:]

            if not cleaned_text.endswith('}'):
                end_idx = cleaned_text.rfind('}')
                if end_idx >= 0:
                    cleaned_text = cleaned_text[:end_idx + 1]

            # Fix common JSON errors from AI output
            # Fix numbers followed by unquoted text in parentheses (e.g., "10 (village entrance fee)" -> "10")
            import re
            cleaned_text = re.sub(r'(\d+)\s*\([^)]*\)', r'\1', cleaned_text)

            # Fix missing commas before closing braces/brackets in some edge cases
            # This is a more conservative fix that only targets obvious issues
            cleaned_text = re.sub(r'"\s*\n\s*}', '"\n}', cleaned_text)
            cleaned_text = re.sub(r'"\s*\n\s*]', '"\n]', cleaned_text)

            result_json = json.loads(cleaned_text)

            print(f"✓ Successfully generated curriculum for {location.get('name')}")

            # Save to Firestore if available
            saved_ids = {}
            if firestore:
                try:
                    saved_ids = _save_curriculum_to_firestore(
                        student_profile=student,
                        location=location,
                        curriculum_data=result_json,
                        metadata={
                            'model_used': model_id,
                            'generation_time': datetime.now().isoformat(),
                            'subjects': subjects
                        }
                    )
                    print(f"✓ Saved to Firestore: {saved_ids}")
                except Exception as e:
                    print(f"⚠ Failed to save to Firestore: {e}")
                    import traceback
                    traceback.print_exc()

            return jsonify({
                'status': 'success',
                'curriculum': result_json,
                'metadata': {
                    'model_used': model_id,
                    'prompt_length': len(prompt),
                    'generation_time': datetime.now().isoformat()
                },
                'saved_ids': saved_ids  # Include Firestore document IDs
            })

        except json.JSONDecodeError as e:
            print(f"⚠ JSON parsing error: {e}")
            # Return raw text if JSON parsing fails
            return jsonify({
                'status': 'partial_success',
                'raw_text': result_text,
                'error': f'JSON parsing failed: {str(e)}',
                'metadata': {
                    'model_used': model_id,
                    'prompt_length': len(prompt)
                }
            }), 206  # 206 Partial Content

    except ImportError as e:
        return jsonify({
            'error': 'google-genai package not installed',
            'details': str(e)
        }), 500
    except Exception as e:
        print(f"Error generating curriculum: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@app.route('/api/education/curricula', methods=['GET'])
def list_curricula():
    """
    List all curriculum plans with optional filters.

    Query params:
    - student_id: Filter by student profile
    - location_id: Filter by location
    - country: Filter by country
    - status: Filter by status (draft, active, completed, archived)
    - limit: Max results (default 50)
    """
    db = get_firestore_client()
    if not db:
        return jsonify({'status': 'success', 'curricula': [], 'count': 0}), 200

    try:
        query = db.collection('curriculum_plans')

        # Apply filters
        student_id = request.args.get('student_id')
        location_id = request.args.get('location_id')
        country = request.args.get('country')
        status = request.args.get('status')
        limit = int(request.args.get('limit', 50))

        has_filters = bool(student_id or status or country)

        if student_id:
            query = query.where('student_profile_id', '==', student_id)
        if status:
            query = query.where('status', '==', status)
        if country:
            query = query.where('country', '==', country)

        # Only use ORDER BY if no filters (to avoid needing composite indexes)
        # Otherwise, sort in Python after fetching
        if not has_filters:
            query = query.order_by('created_at', direction=firestore.Query.DESCENDING).limit(limit)

        docs = query.stream()
        curricula = []

        for doc in docs:
            data = doc.to_dict()

            # Filter by location_id if specified (need to check location_lessons keys)
            if location_id and str(location_id) not in data.get('location_lessons', {}):
                continue

            # Convert timestamps to ISO strings
            if 'created_at' in data:
                data['created_at'] = data['created_at'].isoformat() if hasattr(data['created_at'], 'isoformat') else str(data['created_at'])
            if 'updated_at' in data:
                data['updated_at'] = data['updated_at'].isoformat() if hasattr(data['updated_at'], 'isoformat') else str(data['updated_at'])
            if 'generated_at' in data:
                data['generated_at'] = data['generated_at'].isoformat() if hasattr(data['generated_at'], 'isoformat') else str(data['generated_at'])

            curricula.append(data)

        # Sort by created_at in Python if we had filters
        if has_filters:
            curricula.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            curricula = curricula[:limit]  # Apply limit after sorting

        return jsonify({
            'status': 'success',
            'count': len(curricula),
            'curricula': curricula
        })

    except Exception as e:
        print(f"Error listing curricula: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/curricula/<plan_id>', methods=['GET'])
def get_curriculum(plan_id):
    """Get a specific curriculum plan by ID."""
    db = get_firestore_client()
    if not db:
        return jsonify({'error': 'Firestore not available'}), 404

    try:
        doc = db.collection('curriculum_plans').document(plan_id).get()

        if not doc.exists:
            return jsonify({'error': 'Curriculum plan not found'}), 404

        data = doc.to_dict()

        # Convert timestamps
        if 'created_at' in data:
            data['created_at'] = data['created_at'].isoformat() if hasattr(data['created_at'], 'isoformat') else str(data['created_at'])
        if 'updated_at' in data:
            data['updated_at'] = data['updated_at'].isoformat() if hasattr(data['updated_at'], 'isoformat') else str(data['updated_at'])
        if 'generated_at' in data:
            data['generated_at'] = data['generated_at'].isoformat() if hasattr(data['generated_at'], 'isoformat') else str(data['generated_at'])

        return jsonify({
            'status': 'success',
            'curriculum': data
        })

    except Exception as e:
        print(f"Error getting curriculum: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/curricula/by-location/<location_id>', methods=['GET'])
def get_curricula_by_location(location_id):
    """Get all curricula for a specific location."""
    db = get_firestore_client()
    if not db:
        return jsonify({'status': 'success', 'curricula': [], 'count': 0}), 200

    try:

        # Get all curricula and filter by location_id in location_lessons
        docs = db.collection('curriculum_plans').stream()
        curricula = []

        for doc in docs:
            data = doc.to_dict()

            # Check if this curriculum includes the requested location
            if str(location_id) in data.get('location_lessons', {}):
                # Convert timestamps
                if 'created_at' in data:
                    data['created_at'] = data['created_at'].isoformat() if hasattr(data['created_at'], 'isoformat') else str(data['created_at'])
                if 'updated_at' in data:
                    data['updated_at'] = data['updated_at'].isoformat() if hasattr(data['updated_at'], 'isoformat') else str(data['updated_at'])
                if 'generated_at' in data:
                    data['generated_at'] = data['generated_at'].isoformat() if hasattr(data['generated_at'], 'isoformat') else str(data['generated_at'])

                curricula.append(data)

        return jsonify({
            'status': 'success',
            'location_id': location_id,
            'count': len(curricula),
            'curricula': curricula
        })

    except Exception as e:
        print(f"Error getting curricula by location: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/destinations', methods=['GET'])
def get_destinations():
    """Get destinations from the current (most recent) scenario."""
    if not firestore:
        return jsonify({'error': 'Firestore not available'}), 500

    try:
        db = get_firestore_client()

        # Get the most recent scenario for the default user
        user_id = 'default-user'  # TODO: Replace with actual user ID from auth
        scenarios_query = (
            db.collection('scenarios')
            .where('userId', '==', user_id)
            .order_by('updatedAt', direction=firestore.Query.DESCENDING)
            .limit(1)
        )

        scenarios = list(scenarios_query.stream())

        if not scenarios:
            return jsonify({
                'status': 'success',
                'destinations': []
            })

        scenario_ref = scenarios[0].reference

        # Get the latest version
        versions = list(
            scenario_ref
            .collection('versions')
            .order_by('versionNumber', direction=firestore.Query.DESCENDING)
            .limit(1)
            .stream()
        )

        if not versions:
            return jsonify({
                'status': 'success',
                'destinations': []
            })

        latest_version_data = versions[0].to_dict() or {}
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}
        locations = itinerary_data.get('locations', []) or []

        # Transform locations to a simpler format
        destinations = []
        for loc in locations:
            if isinstance(loc, dict):
                # Try duration_days first, fall back to days
                duration = loc.get('duration_days', loc.get('days', 0))
                destinations.append({
                    'id': loc.get('id', ''),
                    'name': loc.get('name', ''),
                    'country': loc.get('country', ''),
                    'days': duration,
                    'arrival_date': loc.get('arrival_date', ''),
                    'departure_date': loc.get('departure_date', '')
                })

        return jsonify({
            'status': 'success',
            'destinations': destinations
        })

    except Exception as e:
        print(f"Error getting destinations: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/students', methods=['GET'])
def list_students():
    """List all student profiles."""
    if not firestore:
        return jsonify({'error': 'Firestore not available'}), 500

    try:
        db = get_firestore_client()
        students_ref = db.collection('student_profiles')
        docs = students_ref.stream()

        students = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id

            # Convert timestamps
            if 'created_at' in data:
                data['created_at'] = data['created_at'].isoformat() if hasattr(data['created_at'], 'isoformat') else str(data['created_at'])
            if 'updated_at' in data:
                data['updated_at'] = data['updated_at'].isoformat() if hasattr(data['updated_at'], 'isoformat') else str(data['updated_at'])

            students.append(data)

        return jsonify(students)

    except Exception as e:
        print(f"Error listing students: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/students', methods=['POST'])
def create_student():
    """Create a new student profile."""
    if not firestore:
        return jsonify({'error': 'Firestore not available'}), 500

    try:
        data = request.json

        # Validate required fields
        required_fields = ['name', 'age', 'grade', 'state', 'learning_style']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        db = get_firestore_client()

        # Create student profile
        student_data = {
            'name': data['name'],
            'age': data['age'],
            'grade': data['grade'],
            'state': data['state'],
            'learning_style': data['learning_style'],
            'interests': data.get('interests', []),
            'time_budget_minutes_per_day': data.get('time_budget_minutes_per_day', 60),
            'reading_level': data.get('reading_level', data['grade']),
            'subjects_to_cover': data.get('subjects_to_cover', []),
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
        }

        # Add to Firestore
        doc_ref = db.collection('student_profiles').document()
        doc_ref.set(student_data)

        student_data['id'] = doc_ref.id
        student_data['created_at'] = student_data['created_at'].isoformat()
        student_data['updated_at'] = student_data['updated_at'].isoformat()

        return jsonify({
            'status': 'success',
            'student': student_data
        }), 201

    except Exception as e:
        print(f"Error creating student: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/students/<student_id>', methods=['PUT'])
def update_student(student_id):
    """Update an existing student profile."""
    if not firestore:
        return jsonify({'error': 'Firestore not available'}), 500

    try:
        data = request.json
        db = get_firestore_client()

        # Check if student exists
        doc_ref = db.collection('student_profiles').document(student_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({'error': 'Student not found'}), 404

        # Update student profile
        student_data = {
            'name': data['name'],
            'age': data['age'],
            'grade': data['grade'],
            'state': data['state'],
            'learning_style': data['learning_style'],
            'interests': data.get('interests', []),
            'time_budget_minutes_per_day': data.get('time_budget_minutes_per_day', 60),
            'reading_level': data.get('reading_level', data['grade']),
            'subjects_to_cover': data.get('subjects_to_cover', []),
            'updated_at': datetime.now(),
        }

        # Update in Firestore
        doc_ref.update(student_data)

        # Get updated student
        updated_doc = doc_ref.get()
        updated_data = updated_doc.to_dict()
        updated_data['id'] = student_id

        # Convert timestamps
        if 'created_at' in updated_data:
            updated_data['created_at'] = updated_data['created_at'].isoformat() if hasattr(updated_data['created_at'], 'isoformat') else str(updated_data['created_at'])
        if 'updated_at' in updated_data:
            updated_data['updated_at'] = updated_data['updated_at'].isoformat() if hasattr(updated_data['updated_at'], 'isoformat') else str(updated_data['updated_at'])

        return jsonify({
            'status': 'success',
            'student': updated_data
        })

    except Exception as e:
        print(f"Error updating student: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/students/<student_id>', methods=['DELETE'])
def delete_student(student_id):
    """Delete a student profile and all associated curricula."""
    if not firestore:
        return jsonify({'error': 'Firestore not available'}), 500

    try:
        db = get_firestore_client()

        # Check if student exists
        doc_ref = db.collection('student_profiles').document(student_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({'error': 'Student not found'}), 404

        # Delete all curricula for this student
        curricula_query = db.collection('curriculum_plans').where('student_profile_id', '==', student_id)
        curricula_docs = curricula_query.stream()

        deleted_curricula = 0
        for curriculum_doc in curricula_docs:
            curriculum_doc.reference.delete()
            deleted_curricula += 1

        # Delete the student profile
        doc_ref.delete()

        return jsonify({
            'status': 'success',
            'message': f'Student deleted successfully. {deleted_curricula} curricula also deleted.',
            'deleted_curricula_count': deleted_curricula
        })

    except Exception as e:
        print(f"Error deleting student: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/students/<student_id>/curricula', methods=['GET'])
def get_student_curricula(student_id):
    """Get all curricula for a specific student."""
    if not firestore:
        return jsonify({'error': 'Firestore not available'}), 500

    try:
        db = get_firestore_client()
        # Query without ORDER BY to avoid needing composite index
        # We'll sort in Python instead
        query = db.collection('curriculum_plans').where('student_profile_id', '==', student_id)

        docs = query.stream()
        curricula = []

        for doc in docs:
            data = doc.to_dict()

            # Convert timestamps
            if 'created_at' in data:
                data['created_at'] = data['created_at'].isoformat() if hasattr(data['created_at'], 'isoformat') else str(data['created_at'])
            if 'updated_at' in data:
                data['updated_at'] = data['updated_at'].isoformat() if hasattr(data['updated_at'], 'isoformat') else str(data['updated_at'])
            if 'generated_at' in data:
                data['generated_at'] = data['generated_at'].isoformat() if hasattr(data['generated_at'], 'isoformat') else str(data['generated_at'])

            curricula.append(data)

        # Sort by created_at in Python (most recent first)
        curricula.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        return jsonify({
            'status': 'success',
            'count': len(curricula),
            'curricula': curricula
        })

    except Exception as e:
        print(f"Error getting student curricula: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/students/<student_id>/dashboard', methods=['GET'])
def get_student_dashboard(student_id):
    """Get comprehensive dashboard stats for a student."""
    """Get comprehensive dashboard stats for a student."""
    # Fallback for when Firestore is not available
    if not firestore or not get_firestore_client():
        print("⚠️ Firestore not available, returning mock dashboard data")
        return jsonify({
            'status': 'success',
            'dashboard': {
                'student_profile': {
                    'id': student_id,
                    'name': 'Alex Explorer (Mock)',
                    'grade': '7th',
                    'state': 'CA',
                    'learning_style': 'Visual'
                },
                'statistics': {
                    'total_curricula': 0,
                    'total_activities': 0,
                    'completed_activities': 0,
                    'completion_rate': 0,
                    'countries_covered': 0,
                    'countries': []
                },
                'curricula': []
            }
        })

    try:
        db = get_firestore_client()

        # 1. Get Student Profile
        student_ref = db.collection('student_profiles').document(student_id)
        student_doc = student_ref.get()
        if not student_doc.exists:
            return jsonify({'error': 'Student not found'}), 404

        student_profile = student_doc.to_dict()
        student_profile['id'] = student_id

        # 2. Get All Curricula
        curricula_query = db.collection('curriculum_plans').where('student_profile_id', '==', student_id)
        curricula_docs = curricula_query.stream()
        
        curricula = []
        countries_covered = set()
        
        # Stats counters
        total_activities = 0
        completed_activities = 0
        
        for doc in curricula_docs:
            data = doc.to_dict()
            data['id'] = doc.id
            
            # Convert timestamps
            if 'created_at' in data:
                data['created_at'] = data['created_at'].isoformat() if hasattr(data['created_at'], 'isoformat') else str(data['created_at'])
            if 'updated_at' in data:
                data['updated_at'] = data['updated_at'].isoformat() if hasattr(data['updated_at'], 'isoformat') else str(data['updated_at'])
            if 'generated_at' in data:
                data['generated_at'] = data['generated_at'].isoformat() if hasattr(data['generated_at'], 'isoformat') else str(data['generated_at'])

            curricula.append(data)
            
            # Track countries
            if 'country' in data:
                countries_covered.add(data['country'])
            
            # Count activities
            # Structure: location_lessons -> {location_id} -> on_location -> experiential_activities / structured_lessons
            loc_lessons = data.get('location_lessons', {})
            for loc_id, lesson in loc_lessons.items():
                on_loc = lesson.get('on_location', {})
                exp = on_loc.get('experiential_activities', [])
                struct = on_loc.get('structured_lessons', [])
                total_activities += len(exp) + len(struct)

        # 3. Get Completion Stats from progress_tracking
        # We'll assume a 'progress_tracking' collection exists or we just use a placeholder for now if it's empty
        progress_query = db.collection('progress_tracking').where('student_id', '==', student_id)
        progress_docs = progress_query.stream()
        completed_ids = set()
        for p in progress_docs:
            p_data = p.to_dict()
            if p_data.get('status') == 'completed':
                completed_ids.add(p_data.get('activity_id'))
        
        completed_activities = len(completed_ids)
        
        # Calculate completion rate
        completion_rate = 0.0
        if total_activities > 0:
            completion_rate = round((completed_activities / total_activities) * 100, 1)

        stats = {
            "total_curricula": len(curricula),
            "total_activities": total_activities,
            "completed_activities": completed_activities,
            "completion_rate": completion_rate,
            "countries_covered": len(countries_covered),
            "countries": list(countries_covered)
        }

        return jsonify({
            "status": "success",
            "dashboard": {
                "student_profile": student_profile,
                "curricula": curricula,
                "statistics": stats
            }
        })

    except Exception as e:
        print(f"Error getting student dashboard: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/curricula/<plan_id>', methods=['PATCH'])
def update_curriculum(plan_id):
    """Update an existing curriculum plan."""
    if not firestore:
        return jsonify({'error': 'Firestore not available'}), 500

    try:
        data = request.json
        db = get_firestore_client()
        
        doc_ref = db.collection('curriculum_plans').document(plan_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({'error': 'Curriculum not found'}), 404
            
        # Allowed fields to update
        allowed_fields = ['status', 'location_lessons', 'thematic_threads', 'standards_coverage']
        update_data = {}
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
                
        update_data['updated_at'] = datetime.now()
        
        doc_ref.update(update_data)
        
        # Get updated doc
        updated_doc = doc_ref.get()
        updated_data = updated_doc.to_dict()
        updated_data['id'] = plan_id
        
        # Convert timestamps
        if 'created_at' in updated_data:
            updated_data['created_at'] = updated_data['created_at'].isoformat() if hasattr(updated_data['created_at'], 'isoformat') else str(updated_data['created_at'])
        if 'updated_at' in updated_data:
            updated_data['updated_at'] = updated_data['updated_at'].isoformat() if hasattr(updated_data['updated_at'], 'isoformat') else str(updated_data['updated_at'])
            
        return jsonify({
            'status': 'success',
            'curriculum': updated_data
        })

    except Exception as e:
        print(f"Error updating curriculum: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/curricula/<plan_id>/activities', methods=['POST'])
def add_custom_activity(plan_id):
    """Add a custom activity to a curriculum."""
    if not firestore:
        return jsonify({'error': 'Firestore not available'}), 500

    try:
        data = request.json
        db = get_firestore_client()
        
        # Validate required fields
        if 'title' not in data or 'location_id' not in data:
            return jsonify({'error': 'Missing title or location_id'}), 400
            
        doc_ref = db.collection('curriculum_plans').document(plan_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({'error': 'Curriculum not found'}), 404
            
        curr_data = doc.to_dict()
        location_id = data['location_id']
        
        # Check if location exists in curriculum
        if 'location_lessons' not in curr_data or location_id not in curr_data['location_lessons']:
             return jsonify({'error': f'Location {location_id} not found in this curriculum'}), 404
             
        # Create activity object
        new_activity = {
            'id': str(uuid.uuid4()),
            'title': data['title'],
            'type': data.get('type', 'custom'),
            'subject': data.get('subject', 'general'),
            'description': data.get('description', ''),
            'learning_objectives': data.get('learning_objectives', []),
            'estimated_duration_minutes': data.get('estimated_duration_minutes', 60),
            'external_links': data.get('external_links', []),
            'is_custom': True,
            'ai_generated': False,
            'created_at': datetime.now().isoformat()
        }
        
        # Add to curriculum structure
        loc_lesson = curr_data['location_lessons'][location_id]
        if 'on_location' not in loc_lesson:
            loc_lesson['on_location'] = {'experiential_activities': [], 'structured_lessons': []}
            
        if 'experiential_activities' not in loc_lesson['on_location']:
            loc_lesson['on_location']['experiential_activities'] = []
            
        loc_lesson['on_location']['experiential_activities'].append(new_activity)
        
        # Update Firestore
        doc_ref.update({
            f'location_lessons.{location_id}': loc_lesson,
            'updated_at': datetime.now()
        })
        
        # Also save to learning_activities collection
        activity_ref = db.collection('learning_activities').document(new_activity['id'])
        activity_record = new_activity.copy()
        activity_record['curriculum_plan_id'] = plan_id
        activity_record['student_id'] = curr_data.get('student_profile_id')
        activity_record['location_id'] = location_id
        activity_ref.set(activity_record)
        
        return jsonify({
            'status': 'success',
            'activity': new_activity
        })

    except Exception as e:
        print(f"Error adding custom activity: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/education/bulk-generate', methods=['POST'])
def bulk_generate_curricula():
    """
    Bulk generate curricula for multiple locations.
    Iterates through locations and generates concise curriculum for each.
    """
    if not firestore:
        return jsonify({'error': 'Firestore not available'}), 500

    try:
        from google import genai
        
        data = request.json
        student = data.get('student')
        locations = data.get('locations', [])
        subjects = data.get('subjects', [])
        
        if not student or not locations:
            return jsonify({'error': 'Missing student or locations'}), 400
            
        print(f"🚀 Starting bulk generation for {len(locations)} locations...")
        
        # Initialize Gemini client
        credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
        if credentials_json:
            credentials_info = json.loads(credentials_json)
            credentials = service_account.Credentials.from_service_account_info(
                credentials_info,
                scopes=['https://www.googleapis.com/auth/cloud-platform',
                       'https://www.googleapis.com/auth/generative-language']
            )
            client = genai.Client(credentials=credentials)
        else:
            client = genai.Client()
            
        model_id = 'gemini-2.0-flash-exp'
        results = []
        successful_count = 0
        failed_count = 0
        
        for location in locations:
            try:
                print(f"  Generating for {location.get('name')}...")
                
                # Concise Prompt
                prompt = f"""
Role: Expert Educational Travel Planner
Student: {student.get('name')} (Age {student.get('age')}, Grade {student.get('grade')})
Interests: {', '.join(student.get('interests', []))}
Location: {location.get('name')}, {location.get('country')} ({location.get('duration_days', 3)} days)
Subjects: {', '.join(subjects)}

Task: Create a CONCISE educational plan for this location.
Requirements:
1. 2-3 Experiential Activities (specific sites, hands-on)
2. 1-2 Readings (articles/books)
3. 1 Educational Video
4. 2-3 Reflection Prompts

Output JSON format:
{{
  "location_id": "{location.get('id')}",
  "location_name": "{location.get('name')}",
  "pre_trip": {{
    "readings": [ {{"title": "...", "source": "...", "description": "..."}} ],
    "videos": [ {{"title": "...", "source": "...", "description": "..."}} ]
  }},
  "on_location": {{
    "experiential_activities": [
      {{
        "title": "...",
        "type": "experiential",
        "subject": "...",
        "description": "...",
        "learning_objectives": ["..."],
        "site_details": {{"name": "...", "address": "..."}}
      }}
    ],
    "structured_lessons": []
  }},
  "post_trip": {{
    "reflection_prompts": [ {{"text": "...", "type": "journal"}} ]
  }}
}}
"""
                # Generate
                response = client.models.generate_content(
                    model=model_id,
                    contents=prompt,
                    config={'temperature': 0.7, 'max_output_tokens': 4000}
                )
                
                # Parse JSON
                text = response.text
                # (Simplified cleaning logic)
                if '```json' in text:
                    text = text.split('```json')[1].split('```')[0]
                elif '```' in text:
                    text = text.split('```')[1]
                
                curriculum_json = json.loads(text.strip())
                
                # Save to Firestore
                # We need to call _save_curriculum_to_firestore but it's not easily importable if it's not in scope
                # Wait, we are in the same file, so we can call it directly!
                # Assuming _save_curriculum_to_firestore is defined in this file (which it is).
                
                saved_ids = _save_curriculum_to_firestore(
                    student_profile=student,
                    location=location,
                    curriculum_data=curriculum_json,
                    metadata={
                        'model_used': model_id,
                        'generation_type': 'bulk_concise',
                        'generation_time': datetime.now().isoformat()
                    }
                )
                
                results.append({
                    'location_id': location.get('id'),
                    'status': 'success',
                    'curriculum_plan_id': saved_ids.get('curriculum_plan_id')
                })
                successful_count += 1
                
            except Exception as loc_e:
                print(f"  ❌ Failed for {location.get('name')}: {str(loc_e)}")
                results.append({
                    'location_id': location.get('id'),
                    'status': 'failed',
                    'error': str(loc_e)
                })
                failed_count += 1

        return jsonify({
            'status': 'success',
            'total': len(locations),
            'successful': successful_count,
            'failed': failed_count,
            'results': results
        })

    except Exception as e:
        print(f"Error in bulk generation: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def get_destinations():
    """Get destinations from the current (most recent) scenario."""
    if not firestore:
        return jsonify({'error': 'Firestore not available'}), 500

    try:
        db = get_firestore_client()

        # Get the most recent scenario for the default user
        user_id = 'default-user'  # TODO: Replace with actual user ID from auth
        scenarios_query = (
            db.collection('scenarios')
            .where('userId', '==', user_id)
            .order_by('updatedAt', direction=firestore.Query.DESCENDING)
            .limit(1)
        )

        scenarios = list(scenarios_query.stream())

        if not scenarios:
            return jsonify({
                'status': 'success',
                'destinations': []
            })

        scenario_ref = scenarios[0].reference

        # Get the latest version
        versions = list(
            scenario_ref
            .collection('versions')
            .order_by('versionNumber', direction=firestore.Query.DESCENDING)
            .limit(1)
            .stream()
        )

        if not versions:
            return jsonify({
                'status': 'success',
                'destinations': []
            })

        latest_version_data = versions[0].to_dict() or {}
        itinerary_data = latest_version_data.get('itineraryData', {}) or {}
        locations = itinerary_data.get('locations', []) or []

        # Transform locations to a simpler format
        destinations = []
        for loc in locations:
            if isinstance(loc, dict):
                # Try duration_days first, fall back to days
                duration = loc.get('duration_days', loc.get('days', 0))
                destinations.append({
                    'id': loc.get('id', ''),
                    'name': loc.get('name', ''),
                    'country': loc.get('country', ''),
                    'days': duration,
                    'arrival_date': loc.get('arrival_date', ''),
                    'departure_date': loc.get('departure_date', '')
                })

        return jsonify({
            'status': 'success',
            'destinations': destinations
        })

    except Exception as e:
        print(f"Error getting destinations: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
def _to_float(value) -> float:
    """Best-effort conversion of mixed values to floats."""
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
