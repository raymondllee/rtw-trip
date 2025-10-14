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
import re
import time
import uuid
import requests
import os
from datetime import datetime

from travel_concierge.tools.cost_tracker import CostTrackerService
from travel_concierge.tools.cost_manager import _to_float

# Determine web directory path
# In production (Railway), files are at /app/web
# In development, go up from api_server.py to repo root, then to web
if os.path.exists('/app/web'):
    WEB_DIR = '/app/web'
else:
    WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../web'))

app = Flask(__name__, static_folder=WEB_DIR, static_url_path='')
CORS(app)  # Enable CORS for frontend requests

# ADK API Server endpoint (you need to run: adk api_server travel_concierge)
ADK_API_URL = "http://127.0.0.1:8000"
APP_NAME = "travel_concierge"
USER_ID = "web_user"

# Store sessions in memory (use Redis/DB for production)
sessions = {}

# Cost tracker service (one instance per session - in production use DB)
cost_trackers = {}


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

        print(f"\n🔧 ADK STATE DEBUG:")
        print(f"   Session ID being passed: {session_id}")
        print(f"   Scenario ID being passed: {scenario_id}")
        print(f"   Full state payload: {adk_payload['state']}")
        print(f"{'='*50}\n")

        # Track session activity for the default_session fix
        if session_id not in sessions:
            sessions[session_id] = {'changes': []}
        sessions[session_id]['last_activity'] = time.time()

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

                        # Generate stable cost item ID
                        cost_id = f"{actual_destination_id}_{itinerary_cat}"

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
        print(f"Connection error: {error_details}")
        return jsonify({
            'error': 'Could not connect to ADK API server. Please run: adk api_server travel_concierge',
            'status': 'error'
        }), 500
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in chat endpoint: {error_details}")
        return jsonify({
            'error': str(e),
            'error_details': error_details,
            'status': 'error'
        }), 500

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a session"""
    if session_id in sessions:
        del sessions[session_id]
    return jsonify({'status': 'success'})

# Itinerary modification endpoints
# These are called by the agent's tools to modify the user's itinerary

@app.route('/api/itinerary/add', methods=['POST'])
def add_destination_endpoint():
    """Add a destination to the itinerary"""
    data = request.json
    destination = data.get('destination', {})
    insert_after = data.get('insert_after')
    session_id = data.get('session_id')

    # Fix for default_session issue - if tools are sending default_session,
    # try to find a more appropriate session
    if session_id == 'default_session':
        # Look for recently active sessions (with activity in last 10 minutes)
        current_time = time.time()
        for sid, session_data in sessions.items():
            if sid != 'default_session' and 'last_activity' in session_data:
                if current_time - session_data['last_activity'] < 600:  # 10 minutes
                    session_id = sid
                    print(f"🔧 FIXED: Replaced default_session with active session: {session_id}")
                    break

        # If no active session found, use the most recent session
        if session_id == 'default_session' and len(sessions) > 1:
            # Find the most recently created session (excluding default_session)
            recent_sessions = [sid for sid in sessions.keys() if sid != 'default_session']
            if recent_sessions:
                session_id = recent_sessions[-1]  # Use last created session
                print(f"🔧 FIXED: Replaced default_session with most recent session: {session_id}")

    print(f"📍 ADD DESTINATION called:")
    print(f"   Session ID: {session_id}")
    print(f"   Destination: {destination.get('name')}")
    print(f"   Insert after: {insert_after}")

    # Store the change to be picked up by the frontend
    if session_id not in sessions:
        sessions[session_id] = {'changes': []}
        print(f"   Created new session entry for {session_id}")

    change = {
        'type': 'add',
        'destination': destination,
        'insert_after': insert_after,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    sessions[session_id]['changes'].append(change)

    print(f"   ✅ Change stored. Total changes pending: {len(sessions[session_id]['changes'])}")

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
    session_id = data.get('session_id')

    if session_id not in sessions:
        sessions[session_id] = {'changes': []}

    change = {
        'type': 'remove',
        'destination_name': destination_name,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    sessions[session_id]['changes'].append(change)

    print(f"Removed destination: {destination_name}")

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
    session_id = data.get('session_id')

    if session_id not in sessions:
        sessions[session_id] = {'changes': []}

    change = {
        'type': 'update_duration',
        'destination_name': destination_name,
        'new_duration_days': new_duration_days,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    sessions[session_id]['changes'].append(change)

    print(f"Updated duration for {destination_name}: {new_duration_days} days")

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
    session_id = data.get('session_id')

    if session_id not in sessions:
        sessions[session_id] = {'changes': []}

    change = {
        'type': 'update',
        'destination_name': destination_name,
        'updates': updates,
        'timestamp': json.dumps(datetime.now(), default=str)
    }

    sessions[session_id]['changes'].append(change)

    print(f"Updated destination {destination_name}: {updates}")

    return jsonify({
        'status': 'success',
        'message': f"Updated {destination_name}",
        'updates': updates
    })

@app.route('/api/itinerary/changes/<session_id>', methods=['GET'])
def get_changes(session_id):
    """Get pending changes for a session (polled by frontend)"""
    if session_id in sessions and 'changes' in sessions[session_id]:
        changes = sessions[session_id]['changes']
        if changes:  # Only log when there are actual changes
            print(f"🔔 CHANGES ENDPOINT POLLED:")
            print(f"   Session ID: {session_id}")
            print(f"   Changes to send: {len(changes)}")
            print(f"   Changes: {changes}")
        # Clear changes after sending
        sessions[session_id]['changes'] = []
        return jsonify({
            'status': 'success',
            'changes': changes
        })
    return jsonify({
        'status': 'success',
        'changes': []
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

def get_cost_tracker(session_id):
    """Get or create cost tracker for a session."""
    if session_id not in cost_trackers:
        cost_trackers[session_id] = CostTrackerService()
    return cost_trackers[session_id]

@app.route('/api/costs', methods=['POST'])
def add_cost():
    """Add a new cost item."""
    try:
        data = request.json
        session_id = data.get('session_id', 'default')

        tracker = get_cost_tracker(session_id)

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
        db = firestore.Client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get current scenario
        scenario_doc = scenario_ref.get()
        if not scenario_doc.exists:
            # Fallback to in-memory tracker for backward compatibility
            print(f"⚠️ Scenario not found in Firestore, using in-memory tracker")
            tracker = get_cost_tracker(session_id)
            cost_item = tracker.update_cost(cost_id, **updates)
            if cost_item:
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
                # Merge updates into existing cost
                updated_cost = {**cost, **updates}
                updated_costs.append(updated_cost)
                print(f"✓ Updated cost: {cost_id} - {updated_cost.get('category')} ${updated_cost.get('amount_usd', 0)}")
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
    """Delete a cost item."""
    try:
        data = request.json or {}
        session_id = data.get('session_id', 'default')

        tracker = get_cost_tracker(session_id)
        success = tracker.delete_cost(cost_id)

        if success:
            return jsonify({'status': 'success'})
        else:
            return jsonify({'status': 'error', 'error': 'Cost not found'}), 404
    except Exception as e:
        print(f"Error deleting cost: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs', methods=['GET'])
def get_costs():
    """Get all costs or filtered costs from Firestore."""
    try:
        from google.cloud import firestore

        session_id = request.args.get('session_id', 'default')
        destination_id = request.args.get('destination_id')
        category = request.args.get('category')

        print(f"📥 GET /api/costs - session_id: {session_id}, destination_id: {destination_id}, category: {category}")

        # Try to fetch from Firestore first (session_id is actually scenario_id)
        db = firestore.Client()
        scenario_ref = db.collection('scenarios').document(session_id)
        scenario_doc = scenario_ref.get()

        costs = []

        if scenario_doc.exists:
            print(f"✅ Found scenario in Firestore: {session_id}")
            scenario_data = scenario_doc.to_dict()

            # Get latest version
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

                # Filter costs if needed
                if destination_id:
                    costs_data = [c for c in costs_data if str(c.get('destination_id', '')).strip() == str(destination_id).strip()]
                if category:
                    costs_data = [c for c in costs_data if c.get('category') == category]

                costs = costs_data
            else:
                print(f"⚠️ No versions found for scenario: {session_id}")
        else:
            print(f"⚠️ Scenario not found in Firestore, falling back to in-memory tracker")
            # Fall back to in-memory tracker
            tracker = get_cost_tracker(session_id)
            if any([destination_id, category]):
                costs = tracker.filter_costs(destination_id=destination_id, category=category)
            else:
                costs = tracker.costs
            costs = [cost.model_dump() for cost in costs]

        print(f"📤 Returning {len(costs)} costs")
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
        session_id = data.get('session_id', 'default')
        destinations = data.get('destinations')
        traveler_count = data.get('traveler_count')
        total_days = data.get('total_days')

        tracker = get_cost_tracker(session_id)
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
        print(f"Error getting cost summary: {e}")
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/costs/export', methods=['GET'])
def export_costs():
    """Export all costs as JSON."""
    try:
        session_id = request.args.get('session_id', 'default')
        tracker = get_cost_tracker(session_id)

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

        tracker = get_cost_tracker(session_id)
        tracker.load_costs(costs_data)

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

    try:
        from google.cloud import firestore

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

        # Build set of legacy destination identifiers that should map to this UUID
        destination_aliases = set()
        if raw_destination_id:
            destination_aliases.add(str(raw_destination_id).strip().lower())
        if destination_id:
            destination_aliases.add(str(destination_id).strip().lower())
        if destination_name:
            slug_alias = normalize_destination_id(None, destination_name)
            destination_aliases.add(slug_alias.lower())
        destination_aliases.discard("")

        print(f"🔍 Looking for costs to remove with aliases: {sorted(destination_aliases)}")

        # Validate and ensure each cost item has a valid UUID destination_id
        import re
        uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.IGNORECASE)

        for item in cost_items:
            item_dest_id = item.get('destination_id')

            # If no destination_id, use the provided destination_id
            if item_dest_id is None and destination_id is not None:
                item['destination_id'] = destination_id
                print(f"  📝 Set destination_id to {destination_id} for {item.get('category')}")
            elif item_dest_id is not None:
                item['destination_id'] = str(item_dest_id).strip() or destination_id

            # Validate the destination_id is a UUID
            final_dest_id = item.get('destination_id')
            if final_dest_id and not uuid_pattern.match(str(final_dest_id)):
                print(f"  ⚠️ WARNING: Cost has non-UUID destination_id: {final_dest_id} for {item.get('category')}")
                print(f"     This cost may become orphaned! Please use UUIDs only.")

        # Initialize Firestore
        db = firestore.Client()
        scenario_ref = db.collection('scenarios').document(scenario_id)

        # Get current scenario
        scenario_doc = scenario_ref.get()
        if not scenario_doc.exists:
            return jsonify({
                'status': 'error',
                'error': f'Scenario {scenario_id} not found'
            }), 404

        scenario_data = scenario_doc.to_dict()
        # Update the latest version's itineraryData (this is what the UI loads!)
        current_version = scenario_data.get('currentVersion', 0)

        # Get the latest version by highest versionNumber
        versions = list(
            scenario_ref
                .collection('versions')
                .order_by('versionNumber', direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
        )

        if versions:
            latest_version_ref = versions[0].reference
            latest_version_data = versions[0].to_dict() or {}

            # Get itineraryData from the version
            itinerary_data = latest_version_data.get('itineraryData', {}) or {}
            version_costs = itinerary_data.get('costs', []) or []

            print(f"📊 Total costs in database before removal: {len(version_costs)}")
            print(f"📊 Costs with descriptions containing '{destination_name.split(',')[0] if destination_name else ''}': {len([c for c in version_costs if destination_name and destination_name.split(',')[0].lower() in (c.get('description') or '').lower()])}")

            # Remove existing estimates for this destination when new research is saved
            # STRICT UUID MATCHING ONLY - no fallback to name-based matching
            def _belongs_to_destination(cost_item):
                # Only match estimates for removal - keep manual and booked costs
                cost_source = cost_item.get('source')
                booking_status = cost_item.get('booking_status', 'estimated')

                # Keep manual entries and booked items, remove all estimates
                if cost_source == 'manual' or booking_status in ('confirmed', 'booked'):
                    return False

                # Check if this estimate belongs to the destination by UUID
                dest_val = cost_item.get('destination_id')
                if dest_val:
                    dest_val_norm = str(dest_val).strip().lower()
                    if dest_val_norm in destination_aliases:
                        print(f"  ✓ Match by UUID: {dest_val} -> {cost_item.get('category')} ${cost_item.get('amount_usd', 0)}")
                        return True

                # Check by cost ID prefix (for backward compatibility with old cost IDs)
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

            # Normalize destination_id to strings on remaining costs
            normalized_existing_costs = []
            for item in version_filtered_costs:
                item_copy = dict(item)
                if 'destination_id' in item_copy and item_copy['destination_id'] is not None:
                    item_copy['destination_id'] = str(item_copy['destination_id']).strip()
                normalized_existing_costs.append(item_copy)
            version_filtered_costs = normalized_existing_costs

            # Add new costs
            version_filtered_costs.extend(cost_items)

            # If no change in costs, skip creating a new version
            try:
                import json as _json
                def _stable(obj):
                    return _json.dumps(obj, sort_keys=True, separators=(",", ":"))
                if _stable(version_costs) == _stable(version_filtered_costs):
                    scenario_ref.update({
                        'updatedAt': firestore.SERVER_TIMESTAMP,
                    })
                    print(f"ℹ️ No cost changes detected; skipped new version creation")
                    return jsonify({
                        'status': 'success',
                        'message': 'No changes in costs; latest version left unchanged',
                        'costs_saved': 0,
                        'total_costs': len(version_filtered_costs)
                    })
            except Exception as _:
                pass

            # Prepare new version payload (create a new version instead of mutating latest)
            new_version_number = max(int(scenario_data.get('currentVersion', 0) or 0), int(latest_version_data.get('versionNumber', 0) or 0)) + 1
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

            # Update scenario's currentVersion
            scenario_ref.update({
                'currentVersion': new_version_number,
                'updatedAt': firestore.SERVER_TIMESTAMP,
            })

            print(f"✅ Created new version v{new_version_number} with updated itineraryData")
            print(f"   Total costs in new version: {len(version_filtered_costs)}")
        else:
            print(f"⚠️ Warning: No versions found for scenario {scenario_id}")

        # Lightweight snapshot summary on the scenario document (no full costs array)
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
        except Exception as e:
            print(f"Warning: failed to update scenario summary: {e}")

        return jsonify({
            'status': 'success',
            'message': f'Saved {len(cost_items)} costs for {destination_name}',
            'costs_saved': len(cost_items),
            'total_costs': len(version_filtered_costs)
        })

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in bulk-save endpoint: {error_details}")
        return jsonify({
            'status': 'error',
            'error': str(e),
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
        db = firestore.Client()
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
            return jsonify({
                'status': 'error',
                'error': result.get('message'),
                'prompt': result.get('prompt')  # Return prompt for debugging
            }), 500

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
            research_prompt += f"Previous Destination: {previous_destination} (for flight pricing)\n"
        if next_destination:
            research_prompt += f"Next Destination: {next_destination} (for flight pricing)\n"

        research_prompt += """
Please provide comprehensive cost research including:
1. Accommodation costs (total for stay)
2. Flight costs (if applicable)
3. Daily food costs per person
4. Daily local transport costs per person
5. Activity and attraction costs

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

                    # Extract text responses
                    if "content" in event and "parts" in event["content"]:
                        for part in event["content"]["parts"]:
                            if "text" in part:
                                response_text += part["text"]

                            # Check if save_researched_costs tool was called
                            if "function_call" in part:
                                func_call = part["function_call"]
                                if func_call.get("name") == "save_researched_costs":
                                    save_tool_called = True
                                    # Extract research data from the tool call args
                                    research_result = func_call.get("args", {}).get("research_data")

                            # Also check function responses for save confirmation
                            if "function_response" in part:
                                func_resp = part["function_response"]
                                if func_resp.get("name") == "save_researched_costs":
                                    # Tool was successfully called
                                    save_tool_called = True

                except json.JSONDecodeError:
                    continue

        # Try to extract JSON from response_text if we don't have structured data
        if not research_result and response_text:
            # Look for JSON in the response text
            import re
            json_match = re.search(r'\{[\s\S]*"destination_name"[\s\S]*\}', response_text)
            if json_match:
                try:
                    research_result = json.loads(json_match.group())
                    print(f"✅ Extracted JSON from response text")
                except:
                    pass

        # Alternative C: If we have structured research JSON but no save tool call,
        # save the data server-side via /api/costs/bulk-save and also generate a
        # concise human summary using the root agent.
        saved_via_server = False
        summary_text = None

        if research_result and not save_tool_called:
            try:
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
                    if research_cat not in research_result:
                        continue
                    cat_data = research_result.get(research_cat) or {}

                    base_usd = _to_float(cat_data.get('amount_mid', 0))
                    base_local = _to_float(cat_data.get('amount_local', 0))
                    currency_local = cat_data.get('currency_local', 'USD')

                    multiplier = 1
                    if research_cat in ('food_daily', 'transport_daily'):
                        multiplier = max(1, int(duration_days)) * max(1, int(num_travelers))
                    elif research_cat == 'flights':
                        multiplier = max(1, int(num_travelers))

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

        if research_result or save_tool_called or saved_via_server:
            print(f"✅ Cost research completed for {destination_name}")
            return jsonify({
                'status': 'success',
                'research': research_result,
                'response_text': summary_text or response_text,
                'saved_to_firestore': save_tool_called or saved_via_server
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
        db = firestore.Client()
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
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
