# RTW Trip Planning App

An interactive around-the-world trip planning application with Google Maps visualization and AI-powered travel concierge assistance. Features an itinerary for a 6.5-month global expedition across Asia, Europe, Africa, South America, and Antarctica.

![RTW Trip Map](https://img.shields.io/badge/Status-Live-brightgreen) ![Google Maps](https://img.shields.io/badge/Google%20Maps-API-blue) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow) ![AI](https://img.shields.io/badge/AI-Travel%20Concierge-purple)

## 🌍 Features

- **Interactive Google Maps** with numbered markers and connecting routes
- **Sidebar destination list** with filtering and search
- **Info windows** with detailed trip information
- **Activity-based color coding** for different trip types (diving, cultural, trekking, etc.)
- **Leg-based filtering** (Asia, Europe, Africa, South America, Antarctica)
- **Routing visualization** with Google Directions API
- **Responsive design** for desktop and mobile
- **🤖 AI Travel Concierge** - Chat-based travel assistance with specialized agents
- **📍 Real-time Itinerary Updates** - Modify your trip with AI assistance
- **🔍 Smart Trip Planning** - Get personalized recommendations and booking help

## 🧘 Wellness Wheel Features

Integrated 7-dimension wellness assessment tool for holistic life design and personal development:

- **7-Dimension Assessment** - Evaluate across Spiritual, Practical, Relational, Mental, Physical, Behavioral, and Financial dimensions
- **3-Ring Visualization** - Track Empirical (data-driven), Situational (current state), and Aspirational (goals) perspectives
- **Interactive Dashboard** - Beautiful wheel and grid visualizations with color-coded segments
- **Multi-User Support** - Manage multiple users with individual wellness profiles
- **Import/Export** - Backup and restore wellness data in JSON format
- **Firebase Integration** - Reliable data persistence and synchronization
- **AI-Powered Analysis** - Comprehensive wellness insights _(Phase 2 - Coming Soon)_

Access the Wellness Wheel at: `http://localhost:5173/wellness-dashboard.html`


## 🚀 Live Demo

Visit the live application: [RTW Trip Map](https://raymondllee.github.io/rtw-trip/)

## 📋 Trip Overview

- **Duration**: 6.5 months (June 12 - December 24, 2026)
- **Travelers**: Ray, Sally, Ivy
- **Total Cost**: $244,332.50 ($81,444 per person)
- **Destinations**: 29 stops across 5 continents
- **Highlights**: Diving in Raja Ampat, Kilimanjaro climb, Northern Lights, Antarctica expedition

## 🛠️ Setup Instructions

### Prerequisites

- **Node.js 18+**
- **Python 3.11+**
- **Poetry** (Python package manager)
- **Google Cloud Platform account**
- **Google Maps JavaScript API key**
- **Google OAuth 2.0 Client ID** (optional, for authentication)
- **Google Agent Development Kit (ADK)**

### Quick Start with Scripts ⚡

**For the full application with AI features:**

```bash
# Clone the repository
git clone https://github.com/raymondllee/rtw-trip.git
cd rtw-trip

# Start everything with one command
./start-travel-concierge.sh
```

**To stop all services:**
```bash
./stop-travel-concierge.sh
```

### Manual Setup 🔧

#### 1. Install Frontend Dependencies

```bash
npm install
```

#### 2. Set Up AI Travel Concierge

```bash
cd python/agents/travel-concierge

# Install Python dependencies with Poetry
poetry install

# Activate the virtual environment
eval $(poetry env activate)
```

#### 3. Configure API Keys

**Frontend Configuration** - Create `web/config.js`:

```javascript
window.RTW_CONFIG = {
  // Your Google Maps JavaScript API key
  googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY_HERE",

  // Your Google OAuth 2.0 Client ID (optional)
  googleOAuthClientId: "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com"
};
```

**AI Concierge Configuration** - Copy `python/agents/travel-concierge/.env.example` to `.env`:

```bash
# Choose Model Backend: 0 -> ML Dev, 1 -> Vertex
GOOGLE_GENAI_USE_VERTEXAI=1

# Vertex backend config
GOOGLE_CLOUD_PROJECT=YOUR_CLOUD_PROJECT_ID
GOOGLE_CLOUD_LOCATION=us-central1

# Places API
GOOGLE_PLACES_API_KEY=YOUR_PLACES_API_KEY

# Sample Scenario Path (optional)
TRAVEL_CONCIERGE_SCENARIO=travel_concierge/profiles/itinerary_empty_default.json
```

#### 4. Set up Google Cloud APIs

1. **Enable required APIs** in Google Cloud Console:
   - **For Frontend:** Maps JavaScript API, Directions API, Geocoding API
   - **For AI Features:** Vertex AI API, Places API

2. **Create API keys** with appropriate restrictions

3. **Authenticate Google Cloud**:
   ```bash
   gcloud auth application-default login
   ```

#### 5. Start the Application

**Option 1: Use the startup script (recommended):**
```bash
./start-travel-concierge.sh
```

**Option 2: Start manually:**
```bash
# Terminal 1: Frontend server (Vite dev server)
npm run dev

# Terminal 2: Flask API server
cd python/agents/travel-concierge
source venv/bin/activate
python api_server.py

# Terminal 3: ADK AI server
cd python/agents/travel-concierge
eval $(poetry env activate)
adk api_server travel_concierge
```

Open http://localhost:5173/ in your browser.

### What's Running?

- **Frontend** (Port 5173): Interactive map and UI
- **Wellness Dashboard** (Port 5173): 7-dimension wellness assessment at `/wellness-dashboard.html`
- **Flask API** (Port 5001): Backend API and itinerary management
- **ADK API** (Port 8000): AI travel concierge agents

## 📁 Project Structure

```
rtw-trip/
├── web/                           # Frontend application (Vite project root)
│   ├── index.html                 # HTML entry point loaded by Vite
│   ├── config.js                  # Runtime configuration (generated at build)
│   ├── src/                       # TypeScript/ES module source
│   │   ├── main.ts                # Frontend bootstrap (loads map + chat)
│   │   ├── app/                   # Map + itinerary application logic
│   │   ├── chat/                  # AI chat experience
│   │   ├── wellness/              # Wellness wheel components
│   │   │   ├── components/        # Wellness React components
│   │   │   ├── services/          # Wellness data services
│   │   │   └── constants/         # Wellness configuration
│   │   ├── firebase/              # Firebase initialization helpers
│   │   ├── firestore/             # Scenario/version management API
│   │   └── types/                 # Shared TypeScript definitions
│   ├── wellness-dashboard.html    # Wellness dashboard entry point
│   ├── styles.css                 # Global styling
│   └── cost-styles.css            # Cost UI styling
├── python/agents/travel-concierge # AI Travel Concierge
│   ├── travel_concierge/          # Agent modules
│   │   ├── sub_agents/            # Specialized travel agents
│   │   │   ├── inspiration/       # Destination inspiration
│   │   │   ├── planning/          # Trip planning
│   │   │   ├── booking/           # Booking assistance
│   │   │   ├── pre_trip/          # Pre-trip preparation
│   │   │   ├── in_trip/           # In-trip assistance
│   │   │   └── post_trip/         # Post-trip feedback
│   │   ├── tools/                 # Agent tools
│   │   └── shared_libraries/      # Common utilities
│   ├── api_server.py              # Flask API server
│   ├── requirements-api.txt       # Python dependencies
│   ├── pyproject.toml            # Poetry configuration
│   └── .env.example              # Environment variables template
├── scripts/                       # Build tools
│   ├── parse-itinerary.js         # Markdown parser
│   ├── geocode.js                 # Location geocoding
│   └── build-data.js              # Build orchestrator
├── data/                          # Generated data files
│   ├── overrides.json             # Location overrides
│   └── geocache.json              # Geocoding cache
├── logs/                          # Application logs
├── itineary.md                    # Source itinerary
├── start-travel-concierge.sh      # Startup script
├── stop-travel-concierge.sh       # Stop script
└── package.json                   # Dependencies and scripts
```

## 🔧 Available Scripts

### Frontend Scripts
- `npm run dev` - Start Vite development server (port 5173)
- `npm run build:data` - Parse and geocode itinerary data
- `npm run parse` - Parse itinerary markdown only
- `npm run geocode` - Geocode locations only
- `npm run build` - Generate production bundle in `web/dist`

### Application Scripts
- `./start-travel-concierge.sh` - Start all services (frontend + backend + AI)
- `./stop-travel-concierge.sh` - Stop all running services

### AI Concierge Scripts (in python/agents/travel-concierge/)
- `poetry install` - Install Python dependencies
- `eval $(poetry env activate)` - Activate virtual environment
- `adk run travel_concierge` - Run AI concierge in CLI mode
- `adk web` - Start ADK web interface
- `adk api_server travel_concierge` - Start ADK API server (port 8000)
- `python api_server.py` - Start Flask API server (port 5001)

## 🤖 AI Travel Concierge Features

The AI Travel Concierge is powered by Google's Agent Development Kit and consists of specialized agents for different travel needs:

### Available Agents

- **🎨 Inspiration Agent** - Get destination ideas and travel inspiration
- **📋 Planning Agent** - Detailed trip planning with flights, hotels, and activities
- **💳 Booking Agent** - Assistance with booking payments and confirmations
- **🎒 Pre-Trip Agent** - Visa requirements, travel advisories, packing lists
- **🗺️ In-Trip Agent** - Real-time assistance during your journey
- **📝 Post-Trip Agent** - Feedback collection and preference learning

### AI Tools & Capabilities

- **Google Places API** - Location discovery and recommendations
- **Google Search** - Real-time travel information and research
- **MCP Integration** - Airbnb search and booking tools
- **Memory System** - Remembers your preferences and trip details
- **Itinerary Management** - Add, remove, and modify destinations in real-time

### Using the AI Concierge

1. **Chat Interface** - Click the chat button in the web app
2. **Context-Aware** - Agents know your current trip plans
3. **Real-Time Updates** - Changes appear instantly on your map
4. **Multi-Agent Collaboration** - Agents work together for complex tasks

### Example Conversations

```
"Need some destination ideas for Southeast Asia"
"Find flights to Tokyo from JFK on April 20th for 4 days"
"What should I pack for my trip to Peru?"
"Help me find an Airbnb in San Diego for next weekend"
"Add 2 more days to my Bangkok stop"
```

## 🌐 Deployment

### Production Deployment (Railway) ✅ Recommended

The complete application with all features is deployed to Railway:

**URL**: https://rtw-trip-production.up.railway.app

This deployment includes:
- ✅ Interactive map with Google Maps integration
- ✅ Firebase/Firestore data persistence
- ✅ AI Travel Concierge with chat interface
- ✅ Real-time itinerary editing
- ✅ Cost tracking and scenario management

**See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for complete deployment guide.**

### Frontend Only (GitHub Pages)

A static version of the map interface is also available:

**URL**: https://raymondllee.github.io/rtw-trip/

To publish updates, run `npm run build` and deploy the contents of `web/dist/` alongside a generated `web/config.js` file (copy both into the `/web` directory on the `gh-pages` branch). The static build includes the full map + itinerary UI but omits backend-dependent features.

*Note: AI features and Firestore integration are not available in the GitHub Pages deployment.*

## 🗺️ Data Sources

- **Primary**: Firebase Firestore - All itinerary and cost data
- **Source**: `itineary.md` - Original markdown itinerary (for reference)
- **Cache**: `data/geocache.json` - Geocoding cache for destinations

## 🎨 Customization

### Adding New Destinations

1. Use the web interface to add destinations via the AI chat or map interface
2. Or edit directly in Firestore console
3. Destination data structure:
   ```json
   {
     "id": 30,
     "name": "New Destination",
     "city": "City Name",
     "country": "Country",
     "region": "Continent",
     "arrival_date": "2026-MM-DD",
     "departure_date": "2026-MM-DD",
     "duration_days": 7,
     "activity_type": "exploration",
     "highlights": ["highlight1", "highlight2"],
     "coordinates": {
       "lat": 0.0000,
       "lng": 0.0000
     },
     "airport_code": "XXX"
   }
   ```

### Styling Customization

Edit `web/styles.css` to customize:
- Marker colors and sizes
- Info window appearance
- Sidebar styling
- Responsive breakpoints

## 🐛 Troubleshooting

### Common Issues

#### Frontend Issues
1. **Map not loading**: Check API key in `web/config.js`
2. **Geocoding fails**: Verify Geocoding API is enabled in Google Cloud
3. **Routing not working**: Ensure Directions API is enabled
4. **CORS errors**: Check API key restrictions

#### AI Concierge Issues
1. **AI not responding**: Check that all three servers are running
2. **Connection refused**: Run `./start-travel-concierge.sh` to restart services
3. **ADK server errors**: Check `logs/adk-api.log` for error details
4. **Flask server errors**: Check `logs/flask-api.log` for error details
5. **Google Cloud errors**: Verify Vertex AI API is enabled and credentials are set

#### Debugging Steps

1. **Check server status**:
   ```bash
   curl http://localhost:5173/  # Frontend
   curl http://localhost:5001/health  # Flask API
   curl http://localhost:8000/docs    # ADK API
   ```

2. **View logs**:
   ```bash
   tail -f logs/frontend.log    # Frontend server
   tail -f logs/flask-api.log   # Flask API server
   tail -f logs/adk-api.log     # ADK API server
   ```

3. **Restart services**:
   ```bash
   ./stop-travel-concierge.sh
   ./start-travel-concierge.sh
   ```

4. **Debug mode in browser**:
   ```
   http://localhost:5173/?debug=true
   ```

### Port Conflicts

If you experience port conflicts, the startup script will automatically kill processes on ports 5173, 5001, and 8000. You can also manually clear them:

```bash
lsof -ti:5173 | xargs kill -9  # Frontend
lsof -ti:5001 | xargs kill -9  # Flask API
lsof -ti:8000 | xargs kill -9  # ADK API
```

## 🤝 Contributing

We welcome contributions! Here are some areas where you can help:

### Areas for Contribution

- **🤖 AI Agent Improvements**: Enhance travel concierge agents
- **🗺️ Map Features**: Add new visualization capabilities
- **📱 UI/UX**: Improve the interface and user experience
- **🔧 Integration**: Connect to additional travel APIs
- **📚 Documentation**: Improve guides and add examples

### Development Setup

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/new-feature`
3. **Set up your environment**: Run `./start-travel-concierge.sh`
4. **Make your changes**: Test with all features working
5. **Commit changes**: `git commit -am 'Add new feature'`
6. **Push to branch**: `git push origin feature/new-feature`
7. **Submit a pull request**

### Code Style

- **Frontend**: Use modern ES6+ JavaScript
- **Python**: Follow PEP 8 standards
- **Documentation**: Update README for new features
- **Testing**: Ensure all services start correctly

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Maps Platform** for mapping services and APIs
- **Google Agent Development Kit** for AI agent framework
- **OpenStreetMap/Nominatim** for geocoding services
- **Poetry** for Python dependency management
- The incredible destinations and cultures featured in this itinerary

## 📞 Support

For questions or issues:

- **🐛 Bug Reports**: Create an issue on GitHub with detailed description
- **💡 Feature Requests**: Submit an issue with "enhancement" label
- **📧 General Questions**: Create a discussion on GitHub
- **📧 Direct Contact**: [raymondllee@users.noreply.github.com](mailto:raymondllee@users.noreply.github.com)

### Quick Help Commands

```bash
# Start the application
./start-travel-concierge.sh

# Check if everything is working
curl http://localhost:5173/ && echo "Frontend ✅"
curl http://localhost:5001/health && echo "Flask API ✅"
curl http://localhost:8000/docs && echo "ADK API ✅"

# Stop everything
./stop-travel-concierge.sh
```

---

**Happy Travels!** ✈️🌍🗺️🤖
