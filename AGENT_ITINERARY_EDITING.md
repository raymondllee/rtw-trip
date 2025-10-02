# AI Agent Itinerary Editing

This feature allows the AI Travel Concierge to modify your itinerary in real-time through natural conversation.

## How It Works

The system consists of several components working together:

1. **Itinerary Editor Agent** - A sub-agent with tools to modify the itinerary
2. **Custom Tools** - Python functions that the agent can call to add/remove/update destinations
3. **Flask API Endpoints** - Receives tool calls and stores changes
4. **Frontend Polling** - Checks for changes every 2 seconds and applies them to the UI

## Architecture Flow

```
User: "Add 3 days in Bali"
  ↓
Chat → ADK Root Agent → Itinerary Editor Sub-Agent
  ↓
Agent calls tool: add_destination(...)
  ↓
Tool → Flask API (/api/itinerary/add)
  ↓
Flask stores change in session
  ↓
Frontend polls (/api/itinerary/changes/<session_id>)
  ↓
Frontend applies change → Map updates
```

## Setup

### 1. Install Dependencies

The itinerary editor agent is already integrated. Just ensure you have the travel-concierge environment set up:

```bash
cd python/agents/travel-concierge
poetry install
```

### 2. Start the ADK API Server

```bash
cd python/agents/travel-concierge
poetry run adk api_server travel_concierge
```

This starts on port 8000.

### 3. Start the Flask Proxy

```bash
cd python/agents/travel-concierge
poetry run python api_server.py
```

This starts on port 5001.

### 4. Start the Web App

```bash
# From project root
npm run serve
```

This starts on port 5173.

## Usage Examples

Once everything is running, open the chat and try these commands:

### Add a Destination

```
"Add Osaka to my Japan itinerary for 3 days"
"Add a stop in Kuala Lumpur between Singapore and Borneo"
```

The agent will:
- Find the right insertion point
- Add the destination
- Recalculate dates
- Update the map

### Remove a Destination

```
"Remove Manila from my itinerary"
"Delete the stop in Philippines"
```

The agent will:
- Find and remove the destination
- Recalculate subsequent dates
- Update the map

### Extend/Shorten Stays

```
"Add 2 more days in Bali"
"Reduce Tokyo to 4 days"
"Extend my stay in Chiang Mai by 3 days"
```

The agent will:
- Update the duration
- Recalculate dates for all subsequent destinations
- Update the map

### Update Details

```
"Change the activity type in Bali to 'Beach & Diving'"
"Update the description for Tokyo to include visit to TeamLab"
```

## Available Tools

The Itinerary Editor Agent has access to these tools:

### `get_current_itinerary()`
Returns the full current itinerary from the session state.

### `add_destination(name, city, country, duration_days, activity_type, description, insert_after)`
Adds a new destination to the itinerary.

**Parameters:**
- `name`: Location name (e.g., "Mount Fuji")
- `city`: City name (e.g., "Fujinomiya")
- `country`: Country name (e.g., "Japan")
- `duration_days`: Number of days to stay
- `activity_type`: Type of activities (optional)
- `description`: Notes about the destination (optional)
- `insert_after`: Name of destination to insert after (optional, defaults to end)

### `remove_destination(destination_name)`
Removes a destination from the itinerary.

**Parameters:**
- `destination_name`: Name or city of the destination to remove

### `update_destination_duration(destination_name, new_duration_days)`
Updates how long to stay at a destination.

**Parameters:**
- `destination_name`: Name or city of the destination
- `new_duration_days`: New number of days

### `update_destination(destination_name, **updates)`
Updates various attributes of a destination.

**Parameters:**
- `destination_name`: Name or city of the destination
- Plus any of: `name`, `city`, `country`, `duration_days`, `activity_type`, `description`

## Technical Details

### Tool Implementation

Tools are defined in `/python/agents/travel-concierge/travel_concierge/tools/itinerary_editor.py`

Each tool:
1. Receives parameters from the agent
2. Calls the Flask API endpoint
3. Returns success/error status to the agent

### API Endpoints

Defined in `/python/agents/travel-concierge/api_server.py`:

- `POST /api/itinerary/add` - Add destination
- `POST /api/itinerary/remove` - Remove destination
- `POST /api/itinerary/update-duration` - Update duration
- `POST /api/itinerary/update` - Update details
- `GET /api/itinerary/changes/<session_id>` - Poll for changes

### Frontend Integration

In `/web/chat.js` and `/web/app-final.js`:

- Chat polls for changes every 2 seconds when open
- Changes are applied to `workingData.locations`
- Dates are recalculated
- Map and sidebar re-render
- Changes are auto-saved to scenarios

## Debugging

### Check if tools are being called

Watch the Flask server terminal - it will print when tools are called:

```
Added destination: Osaka
Updated duration for Bali: 5 days
Removed destination: Manila
```

### Check if changes are being polled

Open browser console and watch for:

```
Received itinerary changes: [{type: 'add', destination: {...}}]
Applying itinerary changes: [...]
Added Osaka at position 12
```

### Check agent behavior

Watch the ADK server terminal to see which sub-agents are being called and which tools they're using.

## Limitations & Future Enhancements

**Current Limitations:**
- Changes are in-memory only (lost on server restart)
- Polling every 2 seconds (could use WebSockets for real-time)
- Basic conflict resolution if multiple users edit same itinerary

**Future Enhancements:**
- [ ] Persist changes to database
- [ ] WebSocket connection for instant updates
- [ ] Undo/redo functionality
- [ ] Show visual notification when agent makes changes
- [ ] Optimistic UI updates (show change immediately, confirm later)
- [ ] Integration with booking agents (update bookings when dates change)
- [ ] Smarter insertion logic (geographic awareness, visa requirements)
- [ ] Budget recalculation when destinations change

## Troubleshooting

**Agent doesn't modify itinerary:**
- Check that all 3 servers are running (ADK, Flask, Web)
- Verify the agent selected the itinerary_editor_agent (check ADK logs)
- Ensure session ID is being passed correctly

**Changes not appearing in UI:**
- Check browser console for polling errors
- Verify Flask server is receiving tool calls
- Check that chat is open (polling only happens when open)

**Dates get messed up:**
- The system recalculates all dates after each change
- Check that `duration_days` is set correctly on all destinations
- Verify your start date is valid

## Example Session

```
User: Select "Asia Leg" from dropdown
User: "Hey, I want to add a few more days in Bali and also add Osaka to my Japan stops"

Agent: "Great! I'll help you with that. Let me:
1. Extend your Bali stay
2. Add Osaka between your Tokyo and other Japan destinations

How many additional days would you like in Bali?"

User: "3 more days"

Agent: "Perfect! I'm updating your itinerary:
✓ Extended Bali from 3 to 6 days
✓ Added Osaka for 3 days after Tokyo

Your dates have been recalculated. The changes are now visible on your map!"
```

[Map updates in real-time showing the new destinations and adjusted dates]
