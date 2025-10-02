# Travel Concierge Agent - Technical Design Document

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Agent Hierarchy](#agent-hierarchy)
4. [Data Flow](#data-flow)
5. [Root Agent](#root-agent)
6. [Sub-Agents](#sub-agents)
7. [Tools](#tools)
8. [API Integration](#api-integration)
9. [State Management](#state-management)
10. [Frontend Integration](#frontend-integration)

---

## Overview

The Travel Concierge is a multi-agent AI system built on Google's Agent Development Kit (ADK) that helps users plan, book, and manage their travel experiences. The system uses a hierarchical agent architecture where a root agent coordinates specialized sub-agents, each handling different phases and aspects of the travel journey.

### Key Features
- **Multi-phase journey support**: Inspiration → Planning → Booking → Pre-trip → In-trip → Post-trip
- **Real-time itinerary editing**: Live updates synchronized between AI and web UI
- **Hierarchical delegation**: Root agent delegates to specialized sub-agents
- **Stateful conversations**: Maintains context across multiple interactions
- **Tool-based integrations**: Geocoding, search, memory persistence

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  - Interactive map with 43 destinations                      │
│  - Chat interface with AI Travel Concierge                   │
│  - Real-time itinerary updates                               │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP/REST
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Flask API Server (Port 5001)              │
│  - /api/chat - Main chat endpoint                            │
│  - /api/itinerary/* - Itinerary modification endpoints       │
│  - Session management                                        │
│  - Change polling for frontend updates                       │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP/SSE
                ▼
┌─────────────────────────────────────────────────────────────┐
│                   ADK API Server (Port 8000)                 │
│  - /run_sse - Server-sent events streaming                   │
│  - /apps/{app}/users/{user}/sessions/{session}               │
│  - Agent execution and state management                      │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                     Root Agent (Gemini 2.5)                  │
│  - Request routing and delegation                            │
│  - Trip phase detection                                      │
│  - Itinerary editing tools                                   │
└─────────────┬───┬───┬───┬───┬──────────────────────────────┘
              │   │   │   │   │
      ┌───────┘   │   │   │   └───────┐
      ▼           ▼   ▼   ▼           ▼
┌──────────┐ ┌────────────┐ ┌──────────────┐
│Inspiration│ │  Planning  │ │   Booking    │
│  Agent    │ │   Agent    │ │    Agent     │
└──────────┘ └────────────┘ └──────────────┘
      ▼           ▼                  ▼
┌──────────┐ ┌────────────┐ ┌──────────────┐
│ Pre-trip │ │  In-trip   │ │  Post-trip   │
│  Agent   │ │   Agent    │ │    Agent     │
└──────────┘ └────────────┘ └──────────────┘
```

---

## Agent Hierarchy

### Root Agent
**Purpose**: Central coordinator that routes requests to specialized sub-agents

**Model**: `gemini-2.5-flash`

**Key Responsibilities**:
- Classify user intent (inspiration, planning, booking, itinerary editing)
- Detect trip phase (pre-trip, in-trip, post-trip)
- Delegate to appropriate sub-agents
- Direct itinerary editing via tools

**Direct Tools** (attached to root, not delegated):
- `add_destination` - Add new stop to itinerary
- `remove_destination` - Remove stop from itinerary
- `update_destination_duration` - Change stay duration
- `update_destination` - Modify destination attributes
- `get_current_itinerary` - Retrieve current trip data

### Sub-Agent Tree

```
Root Agent
├── Inspiration Agent (Discovery & Ideation)
│   ├── Place Agent (Destination suggestions)
│   └── POI Agent (Points of Interest)
│
├── Planning Agent (Trip Construction)
│   ├── Flight Search Agent
│   ├── Flight Seat Selection Agent
│   ├── Hotel Search Agent
│   ├── Hotel Room Selection Agent
│   └── Itinerary Agent (JSON generation)
│
├── Booking Agent (Reservations & Payment)
│   ├── Create Reservation Agent
│   ├── Payment Choice Agent
│   └── Process Payment Agent
│
├── Pre-Trip Agent (Preparation)
│   └── (Future: Packing, documents, etc.)
│
├── In-Trip Agent (Active Travel)
│   └── (Future: Real-time updates, changes)
│
└── Post-Trip Agent (Review & Follow-up)
    └── (Future: Sharing, reviews, memories)
```

---

## Data Flow

### 1. User Message Flow

```
User types message in chat
    ↓
Frontend sends POST to /api/chat
    {
        message: "Add a stop in Philippines",
        context: {
            destinations: [...43 destinations...],
            leg_name: "all"
        },
        session_id: "session_xyz"
    }
    ↓
Flask API wraps context into prompt
    ↓
POST to ADK /run_sse with SSE streaming
    ↓
Root Agent analyzes request
    ↓
Root Agent calls add_destination tool
    ↓
Tool POSTs to Flask /api/itinerary/add
    {
        destination: {...geocoded location...},
        insert_after: "Palau",
        session_id: "session_xyz"
    }
    ↓
Flask stores change in session memory
    ↓
Frontend polls /api/itinerary/changes/{session_id}
    ↓
Frontend receives changes and updates UI
    ↓
Root Agent returns response to user
```

### 2. Itinerary Modification Flow

```
AI decides to add destination
    ↓
add_destination(
    name="El Nido",
    city="El Nido",
    country="Philippines",
    duration_days=4,
    activity_type="diving",
    description="High-end diving resort",
    notes="Safe, great food"
)
    ↓
Tool enriches with geocoding:
    - Google Places API (primary)
    - Nominatim/OSM (fallback)
    - Reference data lookup
    - Coordinates: {lat: 11.1950, lng: 119.3985}
    ↓
POST to Flask API
    ↓
Store in session.changes[]
    ↓
Frontend polls every 2s
    ↓
Apply change to map + sidebar
```

---

## Root Agent

### Prompt Structure

```python
ROOT_AGENT_INSTR = """
- You are an exclusive travel concierge agent
- You help users discover vacations, plan trips, book flights and hotels
- You want to gather minimal information to help the user
- After every tool call, keep response limited to a phrase

Delegation Rules:
- General knowledge/inspiration → transfer to inspiration_agent
- Flight deals/hotels/lodging → transfer to planning_agent
- Ready to book/payment → transfer to booking_agent
- Add/remove/modify destinations → use itinerary editing tools directly

IMPORTANT: When modifying itinerary, MUST call the tool. Do not just describe.

Trip Phases (based on dates):
- Before start_date → pre_trip_agent
- Between start/end → in_trip_agent
- After end_date → post_trip_agent

Context:
<user_profile>{user_profile}</user_profile>
<itinerary>{itinerary}</itinerary>

Current time: {_time}
"""
```

### Tools Attached to Root

1. **`add_destination`**
   - **Parameters**: `name`, `city`, `country`, `duration_days`, `activity_type`, `description`, `notes`, `insert_after`
   - **Function**: Geocodes location, enriches with reference data, sends to Flask API
   - **Returns**: Success status + destination object

2. **`remove_destination`**
   - **Parameters**: `destination_name`
   - **Function**: Removes from itinerary by name match
   - **Returns**: Success/error status

3. **`update_destination_duration`**
   - **Parameters**: `destination_name`, `new_duration_days`
   - **Function**: Updates stay duration
   - **Returns**: Success/error status

4. **`update_destination`**
   - **Parameters**: `destination_name`, `name`, `city`, `country`, `duration_days`, `activity_type`, `description`, `notes`
   - **Function**: Patches multiple fields at once
   - **Returns**: Success/error with updated fields

5. **`get_current_itinerary`**
   - **Parameters**: None
   - **Function**: Returns full itinerary from state
   - **Returns**: Itinerary JSON with all locations

### Before Agent Callback

```python
before_agent_callback=_load_precreated_itinerary
```

This callback runs before each agent invocation to load the itinerary from the web context into agent state.

---

## Sub-Agents

### 1. Inspiration Agent

**Purpose**: Help users discover destinations and activities

**Model**: `gemini-2.5-flash`

**Tools**:
- `place_agent` (AgentTool) - Suggests 3-5 destinations based on preferences
- `poi_agent` (AgentTool) - Suggests activities/attractions for chosen destination
- `map_tool` - Interactive map integration

**Output Schema**: `DestinationIdeas`, `POISuggestions` (JSON)

**Example Interaction**:
```
User: "I want a tropical beach vacation with great diving"
  ↓
Inspiration Agent → place_agent
  ↓
Returns: ["El Nido, Philippines", "Raja Ampat, Indonesia", "Palau"]
  ↓
User: "Tell me about El Nido"
  ↓
Inspiration Agent → poi_agent
  ↓
Returns: Activities + diving spots + restaurants
```

---

### 2. Planning Agent

**Purpose**: Complete flight/hotel search and itinerary construction

**Model**: `gemini-2.5-flash`

**Temperature**: 0.1, Top-p: 0.5 (more deterministic)

**Sub-agents**:
1. **Flight Search Agent**
   - Output: `FlightsSelection` schema
   - Generates 4 mock flight options with prices, times, airlines
   - Uses future dates within 3 months

2. **Flight Seat Selection Agent**
   - Output: `SeatsSelection` schema
   - Shows 6 seats × 3 rows with availability + pricing
   - Adjusts price by seat location (aisle, window, etc.)

3. **Hotel Search Agent**
   - Output: `HotelsSelection` schema
   - Returns 4 hotels with pricing, address, check-in/out times
   - Uses destination context for relevant results

4. **Hotel Room Selection Agent**
   - Output: `RoomsSelection` schema
   - Shows available room types with pricing
   - Marks unavailable rooms

5. **Itinerary Agent**
   - Output: `Itinerary` schema (structured JSON)
   - Creates multi-day itinerary with:
     - Flight events (departure/arrival times, seat numbers)
     - Hotel events (check-in/out times, room selection)
     - Visit events (activities with start/end times)
   - Includes buffer time for airports, check-ins

**Tools**:
- `memorize` - Persists user selections (flights, seats, hotels) to state

**User Journey Support**:
- Find flights only
- Find hotels only
- Flights + hotels (no itinerary)
- Full itinerary with flights + hotels
- Autonomous selection (AI chooses based on preferences)

**Example Prompt Flow**:
```
Planning Agent receives: "Book a 3-day trip to Seattle"
  ↓
1. Check state for: origin, destination, start_date, end_date
2. Ask user for missing info
3. Call memorize for each field
4. Call flight_search_agent → user selects flight
5. Call flight_seat_selection_agent → user selects seat
6. Call memorize to store selections
7. Call hotel_search_agent → user selects hotel
8. Call hotel_room_selection_agent → user selects room
9. Call memorize to store selections
10. Call itinerary_agent to generate full JSON
11. Transfer to booking_agent when ready
```

---

### 3. Booking Agent

**Purpose**: Handle reservations and payment processing

**Model**: `gemini-2.5-flash`

**Temperature**: 0.0 (fully deterministic for financial transactions)

**Sub-agents**:
1. **Create Reservation Agent** - Generates booking confirmation
2. **Payment Choice Agent** - Shows payment methods
3. **Process Payment Agent** - Simulates payment processing

**Note**: Currently mock implementation; would integrate with real booking APIs in production

---

### 4. Pre-Trip Agent

**Purpose**: Help with pre-departure preparations

**Status**: Placeholder for future features
- Document checklists (passport, visas)
- Packing lists
- Pre-trip reminders
- Travel insurance

---

### 5. In-Trip Agent

**Purpose**: Support travelers during their journey

**Status**: Placeholder for future features
- Real-time flight updates
- Weather alerts
- Emergency assistance
- Day-of itinerary adjustments

---

### 6. Post-Trip Agent

**Purpose**: Post-travel engagement

**Status**: Placeholder for future features
- Photo sharing
- Review collection
- Trip memories summary
- Next trip suggestions

---

## Tools

### Itinerary Editor Tools

Located in: `travel_concierge/tools/itinerary_editor.py`

#### Key Functions

**`_extract_itinerary(tool_context)`**
- Reads itinerary from state or scans chat history
- Falls back to parsing `CURRENT_ITINERARY_DATA` JSON blocks from history
- Updates state when found

**`_get_session_id(tool_context)`**
- Extracts session ID from state or tool context
- Falls back to `"default_session"` if not found
- Used for routing changes to correct frontend session

**`_build_destination_payload()`**
- Enriches destination with:
  1. Reference data lookup (from existing itinerary)
  2. Geocache lookup (pre-computed coordinates)
  3. Google Places API geocoding (primary)
  4. Nominatim/OSM geocoding (fallback)
  5. Default (0,0) if all fail

**Geocoding Priority**:
```
1. Reference data (from itinerary_structured.json)
2. Geocache (from data/geocache.json)
3. Google Places API (GOOGLE_PLACES_API_KEY)
4. Nominatim/OpenStreetMap
5. Fallback (0, 0)
```

**`_insert_into_state()`**
- Adds destination at specified index (after `insert_after` location)
- Appends to end if no insertion point specified

**State Mutation**:
All tools update both:
1. Flask API (via HTTP POST)
2. Local agent state (for continuity within conversation)

---

### Memory Tools

Located in: `travel_concierge/tools/memory.py`

**`memorize(key, value, tool_context)`**
- Stores arbitrary key-value pairs in agent state
- Used by planning_agent to persist:
  - `origin`, `destination`
  - `start_date`, `end_date`
  - `outbound_flight_selection`, `outbound_seat_number`
  - `return_flight_selection`, `return_seat_number`
  - `hotel_selection`, `room_selection`

**`_load_precreated_itinerary(tool_context)`**
- Callback that runs before each agent invocation
- Loads itinerary from web context into state
- Ensures agent always has latest trip data

---

### Search Tools

Located in: `travel_concierge/tools/search.py`

**`search_web(query, tool_context)`**
- General web search capability
- Used for researching destinations, activities

**`search_grounding(query, tool_context)`**
- Grounded search with factual verification
- Uses Gemini's grounding feature

---

### Places Tools

Located in: `travel_concierge/tools/places.py`

**`map_tool(location, tool_context)`**
- Interactive map visualization
- Shows location on map for user reference

---

## API Integration

### Flask API Server

**File**: `api_server.py`

**Port**: 5001

**Endpoints**:

1. **POST `/api/chat`**
   ```json
   Request:
   {
     "message": "Add El Nido to Philippines trip",
     "context": {
       "leg_name": "all",
       "destinations": [...43 locations...],
       "start_date": "2026-06-12",
       "end_date": "2027-06-11"
     },
     "session_id": "session_xyz",
     "initialize_itinerary": true/false
   }

   Response:
   {
     "response": "I've added El Nido to your itinerary...",
     "session_id": "session_xyz",
     "status": "success"
   }
   ```

2. **POST `/api/itinerary/add`**
   ```json
   {
     "destination": {
       "name": "El Nido",
       "city": "El Nido",
       "country": "Philippines",
       "coordinates": {"lat": 11.195, "lng": 119.398},
       "duration_days": 4,
       "activity_type": "diving"
     },
     "insert_after": "Palau",
     "session_id": "session_xyz"
   }
   ```

3. **POST `/api/itinerary/remove`**
4. **POST `/api/itinerary/update-duration`**
5. **POST `/api/itinerary/update`**

6. **GET `/api/itinerary/changes/{session_id}`**
   - Frontend polls every 2 seconds
   - Returns pending changes
   - Clears changes after delivery

**Context Building**:
```python
# Flask wraps large context into compact JSON
itinerary_json = json.dumps({
    "locations": destinations,  # All 43 destinations
    "trip": {
        "start_date": "2026-06-12",
        "end_date": "2027-06-11",
        "leg_name": "all"
    }
}, separators=(',', ':'))  # Compact to reduce token usage

context_prompt = f"""
I'm planning a trip: {leg_name} ({len(destinations)} destinations)

CURRENT_ITINERARY_DATA:
```json
{itinerary_json}
```

User question: {message}
"""
```

**Session Management**:
- In-memory dictionary: `sessions[session_id] = {'changes': [...]}`
- Changes queued until frontend polls
- Cleared after delivery to prevent duplicates

**ADK Communication**:
- Streams via Server-Sent Events (SSE)
- Endpoint: `http://127.0.0.1:8000/run_sse`
- Timeout: 120 seconds for complex requests

---

### ADK API Server

**Port**: 8000

**Endpoints**:
- `POST /apps/{app_name}/users/{user_id}/sessions/{session_id}` - Create session
- `POST /run_sse` - Execute agent with streaming response

**State Injection**:
```python
adk_payload = {
    "session_id": "session_xyz",
    "app_name": "travel_concierge",
    "user_id": "web_user",
    "new_message": {...},
    "state": {
        "web_session_id": "session_xyz",  # For tool routing
        "itinerary": {...},  # Full itinerary on first message
        "itinerary_initialized": true
    }
}
```

---

## State Management

### Agent State Structure

```python
{
    "user_profile": {
        "passport_nationality": "US Citizen",
        "seat_preference": "window",
        "food_preference": "vegan",
        "allergies": [],
        "home": {
            "address": "...",
            "local_prefer_mode": "drive"
        }
    },
    "itinerary": {
        "locations": [
            {
                "id": 1234567890,
                "name": "El Nido",
                "city": "El Nido",
                "country": "Philippines",
                "region": "Southeast Asia",
                "coordinates": {"lat": 11.195, "lng": 119.398},
                "duration_days": 4,
                "activity_type": "diving",
                "description": "...",
                "highlights": ["..."],
                "notes": "Safe, high-end diving resort",
                "arrival_date": "2026-07-04",
                "departure_date": "2026-07-08"
            }
        ],
        "trip": {
            "start_date": "2026-06-12",
            "end_date": "2027-06-11",
            "leg_name": "all"
        }
    },
    "web_session_id": "session_xyz",
    "origin": "San Francisco",
    "destination": "El Nido",
    "start_date": "2026-07-04",
    "end_date": "2026-07-08",
    "outbound_flight_selection": {...},
    "outbound_seat_number": "14A",
    "return_flight_selection": {...},
    "return_seat_number": "22F",
    "hotel_selection": {...},
    "room_selection": "Ocean View Suite"
}
```

### State Lifecycle

```
1. Frontend sends itinerary in first message
   ↓
2. Flask sets state.itinerary = {...}
   ↓
3. ADK creates session with state
   ↓
4. _load_precreated_itinerary callback refreshes state
   ↓
5. Tools read from state.itinerary
   ↓
6. Tools mutate state.itinerary after API calls
   ↓
7. State persists for session duration
```

---

## Frontend Integration

### Chat Component

**File**: `web/chat.js`

**Class**: `TravelConciergeChat`

**Key Methods**:
- `handleSubmit(e, isFloating)` - Send message to Flask API
- `updateContext(legName, destinations, startDate, endDate)` - Update trip context
- `startPollingForChanges()` - Poll for itinerary updates every 2s
- `syncMessages(source, target)` - Sync between sidebar/floating chat

**Message Flow**:
```javascript
1. User types message
2. addMessage(text, 'user')
3. setLoading(true)
4. POST to /api/chat with context
5. Parse JSON response
6. addMessage(response, 'bot')
7. syncMessages to other view
8. setLoading(false)
```

**Polling Loop**:
```javascript
setInterval(async () => {
    const response = await fetch(
        `/api/itinerary/changes/${session_id}`
    );
    const data = await response.json();

    if (data.changes && data.changes.length > 0) {
        onItineraryChange(data.changes);  // Callback to app
    }
}, 2000);
```

### Change Application

**File**: `web/app-final.js`

**Function**: `applyItineraryChanges(changes)`

```javascript
for (const change of changes) {
    switch (change.type) {
        case 'add':
            destinations.insert(
                change.destination,
                change.insert_after
            );
            map.addMarker(change.destination);
            break;

        case 'remove':
            destinations.remove(change.destination_name);
            map.removeMarker(change.destination_name);
            break;

        case 'update_duration':
            destination.duration_days = change.new_duration_days;
            recalculateDates();
            break;

        case 'update':
            Object.assign(destination, change.updates);
            map.updateMarker(destination);
            break;
    }
}
```

---

## Performance Considerations

### Token Usage Optimization

**Problem**: 43 destinations = ~1500 lines of JSON context

**Solutions Implemented**:
1. **Compact JSON**: Use `separators=(',', ':')` to minimize whitespace
2. **Summarize in prompt**: Only show first 3 destination names to user
3. **State persistence**: Load once, reuse from state instead of re-parsing
4. **Incremental updates**: Only send changes, not full itinerary

**Example Context Size**:
```
Full itinerary JSON: ~8,000 tokens
Compact JSON: ~6,000 tokens (25% reduction)
With state: ~200 tokens (97% reduction after first message)
```

### Response Time

**Typical Processing**:
- Simple query (no tools): 3-6 seconds
- With tool calls: 10-25 seconds
- Complex multi-destination: 20-40 seconds

**Bottlenecks**:
1. LLM inference time (Gemini 2.5 Flash)
2. Tool execution (geocoding, API calls)
3. Multiple LLM rounds (thought → tool call → response)

**Optimizations**:
- Use `gemini-2.5-flash` (faster than Pro)
- Cache geocoding results
- Timeout: 120s to prevent indefinite waits
- Show progress: "Thinking... (23s)"

---

## Error Handling

### Frontend
- Timeout after 120 seconds
- Retry on network failure
- Show detailed error messages
- Fallback to error state

### Backend
- Try/catch around all tool calls
- Graceful degradation (geocoding fallbacks)
- Log all errors with context
- Return structured error responses

### Agent
- Tool failure handling
- Partial results on timeout
- User-friendly error messages
- Retry logic for transient failures

---

## Security Considerations

1. **API Keys**: Environment variables only, never committed
2. **Session Isolation**: Each session has separate change queue
3. **Input Validation**: Validate all user inputs before processing
4. **Rate Limiting**: Frontend throttles requests
5. **CORS**: Enabled only for localhost development

---

## Future Enhancements

### Planned Features
1. **Real booking integrations** (Amadeus, Skyscanner APIs)
2. **User authentication** and persistent storage
3. **Multi-user collaboration** on shared itineraries
4. **Mobile app** with offline support
5. **Voice interface** for hands-free interaction
6. **Photo integration** with Google Photos
7. **Budget tracking** and expense management
8. **Weather integration** with alerts
9. **Translation** for international travel

### Technical Improvements
1. **Redis** for session storage (replace in-memory)
2. **PostgreSQL** for itinerary persistence
3. **WebSockets** instead of polling
4. **Caching layer** for geocoding/search results
5. **Load balancing** for multiple ADK instances
6. **Monitoring** with Prometheus/Grafana
7. **A/B testing** framework for prompt optimization
8. **Automated testing** for agent behaviors

---

## Debugging Guide

### Common Issues

**"Thinking..." never completes**
- Check browser console for errors
- Verify Flask/ADK servers running
- Check timeout settings (120s)
- Review logs: `logs/flask-api.log`, `logs/adk-api.log`

**Changes not appearing in UI**
- Verify polling is active
- Check session ID matches
- Review `/api/itinerary/changes` response
- Check `sessions` dictionary in Flask

**Incorrect geocoding**
- Check API key: `GOOGLE_PLACES_API_KEY`
- Review fallback chain (Places → Nominatim → default)
- Add to geocache.json for known locations

**Tool not called**
- Review agent prompt instructions
- Check tool is attached to correct agent
- Verify function signature matches
- Check ADK logs for tool invocation

### Logging

**Enable debug logging**:
```python
# In tools/itinerary_editor.py
print(f"[itinerary] Debug info: {variable}")
```

**View logs**:
```bash
tail -f logs/flask-api.log
tail -f logs/adk-api.log
```

---

## Conclusion

The Travel Concierge demonstrates a sophisticated multi-agent architecture that handles the full travel journey lifecycle. The hierarchical delegation pattern keeps agents focused and specialized, while the real-time itinerary editing tools provide immediate value to users. The system is designed for extensibility, with clear separation between phases (inspiration, planning, booking) and clean interfaces for adding new capabilities.

**Key Success Factors**:
- ✅ Gemini 2.5 Flash for fast, high-quality responses
- ✅ Hierarchical agents for clear responsibility boundaries
- ✅ Real-time tool integration for immediate user feedback
- ✅ State management for conversational continuity
- ✅ Comprehensive error handling and logging

**Architecture Highlights**:
- 6 specialized sub-agents
- 5 itinerary editing tools
- 2-tier API architecture (Flask → ADK)
- Sub-2-second polling for UI updates
- Multi-source geocoding for global coverage
