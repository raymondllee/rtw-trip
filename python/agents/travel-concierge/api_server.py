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
        leg_name = context.get('leg_name', 'Unknown')
        sub_leg_name = context.get('sub_leg_name', None)

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

        # Just get the destination names for user-friendly summary
        dest_names = [d.get('name', 'Unknown') if isinstance(d, dict) else d for d in destinations]

        # Add context about filtering to help LLM understand scope
        if sub_leg_name:
            scope_info = f"{sub_leg_name} ({len(destinations)} destinations)"
        elif leg_name and leg_name != 'All':
            scope_info = f"{leg_name} ({len(destinations)} destinations)"
        else:
            scope_info = f"Full itinerary ({len(destinations)} destinations)"

        context_prompt = f"""
I'm planning a trip. Currently viewing: {scope_info}

Destinations: {', '.join(dest_names[:5])}{'...' if len(dest_names) > 5 else ''}

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
                                response_text += part["text"]
                                print(f"💬 AGENT TEXT: {part['text']}")

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
