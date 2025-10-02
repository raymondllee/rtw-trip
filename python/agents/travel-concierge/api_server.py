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

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import json
import uuid
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# ADK API Server endpoint (you need to run: adk api_server travel_concierge)
ADK_API_URL = "http://127.0.0.1:8000"
APP_NAME = "travel_concierge"
USER_ID = "web_user"

# Store sessions in memory (use Redis/DB for production)
sessions = {}

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
    data = request.json
    message = data.get('message', '')
    context = data.get('context', {})
    session_id = data.get('session_id')
    initialize_itinerary = data.get('initialize_itinerary', False)

    # Generate session ID if not provided
    if not session_id or session_id == 'null':
        session_id = f"session_{uuid.uuid4().hex[:12]}"

    print(f"Received message: {message}")
    print(f"Received context: {json.dumps(context, indent=2)}")
    print(f"Session ID: {session_id}")
    print(f"Initialize itinerary: {initialize_itinerary}")

    # Build context-aware message - keep it concise to avoid timeouts
    if context and context.get('destinations'):
        destinations = context.get('destinations', [])

        # Create compact itinerary JSON for tool parsing
        itinerary_json = json.dumps({
            "locations": destinations,
            "trip": {
                "start_date": context.get('start_date', ''),
                "end_date": context.get('end_date', ''),
                "leg_name": context.get('leg_name', 'Current Leg')
            }
        }, separators=(',', ':'))  # Compact JSON without spaces

        # Just get the destination names for user-friendly summary
        dest_names = [d.get('name', 'Unknown') if isinstance(d, dict) else d for d in destinations]

        context_prompt = f"""
I'm planning a trip: {context.get('leg_name', 'Unknown')} leg ({len(destinations)} destinations: {', '.join(dest_names[:3])}{'...' if len(dest_names) > 3 else ''})

CURRENT_ITINERARY_DATA:
```json
{itinerary_json}
```

User question: {message}
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

        # Additionally pass itinerary data if we're initializing
        if initialize_itinerary and context.get('destinations'):
            itinerary_data = {
                "locations": context.get('destinations', []),
                "trip": {
                    "start_date": context.get('start_date', ''),
                    "end_date": context.get('end_date', ''),
                    "leg_name": context.get('leg_name', 'Current Leg')
                }
            }
            adk_payload["state"]["itinerary"] = itinerary_data
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
            timeout=120  # Increased timeout for complex requests
        ) as r:
            for chunk in r.iter_lines():
                if not chunk:
                    continue
                json_string = chunk.decode("utf-8").removeprefix("data: ").strip()
                try:
                    event = json.loads(json_string)

                    # Extract text from agent response
                    if "content" in event and "parts" in event["content"]:
                        for part in event["content"]["parts"]:
                            if "text" in part:
                                response_text += part["text"]
                except json.JSONDecodeError:
                    continue

        return jsonify({
            'response': response_text or 'No response generated',
            'session_id': session_id,
            'status': 'success'
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
        if changes:
            print(f"📤 Sending {len(changes)} changes to frontend for session {session_id}")
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

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
