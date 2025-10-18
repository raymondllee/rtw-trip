# AI Travel Concierge Chat Integration

This document describes how to run the AI Travel Concierge chat feature integrated with your RTW trip planning app.

## Overview

The chat integration allows you to:
- Ask the AI for recommendations based on your current itinerary leg
- Get suggestions for places to visit, activities, and more
- Have context-aware conversations about your trip

## Architecture

- **Frontend**: Chat UI in the web app (chat.js, styles.css)
- **Backend**: Flask API server wrapping the Google ADK travel concierge agent
- **Agent**: Google ADK-based travel concierge with multiple sub-agents

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd python/agents/travel-concierge
pip install -r requirements-api.txt

# Also ensure you have the Google ADK and travel_concierge package installed
# (Follow the setup instructions from the original travel-concierge README)
```

### 2. Start the ADK API Server

The agent runs via Google's ADK API server. Start it in one terminal:

```bash
cd python/agents/travel-concierge
adk api_server travel_concierge
```

This will start on `http://localhost:8000`

### 3. Start the Flask Proxy Server

In another terminal, start the Flask proxy that bridges your web app to the ADK server:

```bash
cd python/agents/travel-concierge
poetry run python api_server.py
```

The proxy server will start on `http://localhost:5001`

### 4. Start the Web App

```bash
# In the project root directory
npm run dev
```

The web app will be available at `http://localhost:5173`

## Usage

1. Open the web app in your browser
2. Click the blue chat button in the bottom-right corner
3. Select a leg from the dropdown filter to give the AI context
4. Ask questions like:
   - "What are some must-see attractions in these destinations?"
   - "Recommend some activities for adventure travelers"
   - "What's the best time to visit these places?"
   - "Suggest some local restaurants in Bangkok"

## How It Works

### Context Passing

When you select a leg (e.g., "Southeast Asia"), the chat automatically gets context including:
- Leg name
- List of destinations in that leg
- Start and end dates

This context is passed to the agent with every message, allowing it to provide relevant recommendations.

### API Endpoint

**POST** `/api/chat`

Request body:
```json
{
  "message": "What are some things to do in Bangkok?",
  "context": {
    "leg_name": "Southeast Asia",
    "destinations": ["Bangkok, Thailand", "Chiang Mai, Thailand"],
    "start_date": "2026-06-12",
    "end_date": "2026-07-15"
  },
  "session_id": "optional-session-id"
}
```

Response:
```json
{
  "response": "Here are some great things to do in Bangkok...",
  "session_id": "session-12345",
  "status": "success"
}
```

## Files Modified/Created

### New Files:
- `python/agents/travel-concierge/api_server.py` - Flask API wrapper
- `web/chat.js` - Chat UI JavaScript module
- `python/agents/travel-concierge/requirements-api.txt` - Python dependencies

### Modified Files:
- `web/index.html` - Added chat UI HTML
- `web/styles.css` - Added chat styling
- `web/src/app/initMapApp.ts` - Integrated chat with leg filter

## Future Enhancements

- [ ] Stream responses from the agent for better UX
- [ ] Add typing indicators
- [ ] Support for rich media responses (images, maps)
- [ ] Persist chat history
- [ ] Add suggested prompts/quick actions
- [ ] Integration with booking sub-agents
- [ ] Deploy backend to cloud (currently localhost only)

## Troubleshooting

**Chat shows "error connecting" message:**
- Make sure the Flask API server is running on port 5001
- Check browser console for CORS errors
- Verify the Google ADK agent is properly configured

**Agent returns generic responses:**
- Ensure you've selected a specific leg (not "All")
- The agent needs proper API keys for Places/Search tools
- Check the agent configuration in `travel_concierge/agent.py`

**Session not persisting:**
- Currently sessions are stored in memory
- Restart the Flask server will clear all sessions
- For production, use Redis or a database
