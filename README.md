# RTW Trip Planning App

An interactive around-the-world trip planning application with Google Maps visualization, featuring an itinerary for a 6.5-month global expedition across Asia, Europe, Africa, South America, and Antarctica.

![RTW Trip Map](https://img.shields.io/badge/Status-Live-brightgreen) ![Google Maps](https://img.shields.io/badge/Google%20Maps-API-blue) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)

## 🌍 Features

- **Interactive Google Maps** with numbered markers and connecting routes
- **Sidebar destination list** with filtering and search
- **Info windows** with detailed trip information
- **Activity-based color coding** for different trip types (diving, cultural, trekking, etc.)
- **Leg-based filtering** (Asia, Europe, Africa, South America, Antarctica)
- **Routing visualization** with Google Directions API
- **Responsive design** for desktop and mobile

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

- Node.js 18+ 
- Google Cloud Platform account
- Google Maps JavaScript API key
- Google OAuth 2.0 Client ID (optional, for authentication)

### 1. Clone the Repository

```bash
git clone https://github.com/raymondllee/rtw-trip.git
cd rtw-trip
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure API Keys

Create `web/config.js` with your Google Cloud credentials:

```javascript
window.RTW_CONFIG = {
  // Your Google Maps JavaScript API key
  googleMapsApiKey: "YOUR_GOOGLE_MAPS_API_KEY_HERE",
  
  // Your Google OAuth 2.0 Client ID (optional)
  googleOAuthClientId: "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com"
};
```

### 4. Set up Google Cloud APIs

1. **Enable required APIs** in Google Cloud Console:
   - Maps JavaScript API
   - Directions API (for routing)
   - Geocoding API (for location lookup)

2. **Create API key** with restrictions:
   - Application restrictions: HTTP referrers
   - Add your domain: `localhost:5173`, `raymondllee.github.io`
   - API restrictions: Maps JavaScript API, Directions API, Geocoding API

3. **OAuth 2.0 setup** (optional):
   - Create OAuth 2.0 Client ID
   - Add authorized origins: `http://localhost:5173`, `https://raymondllee.github.io`

### 5. Run Development Server

```bash
npm run serve
```

Open http://localhost:5173/web/ in your browser.

## 📁 Project Structure

```
rtw-trip/
├── web/                    # Frontend application
│   ├── index.html         # Main HTML file
│   ├── app.js             # Map application logic
│   ├── styles.css         # Styling
│   └── config.js          # API configuration (not in repo)
├── scripts/               # Build tools
│   ├── parse-itinerary.js # Markdown parser
│   ├── geocode.js         # Location geocoding
│   └── build-data.js      # Build orchestrator
├── data/                  # Generated data files
│   ├── overrides.json     # Location overrides
│   └── geocache.json      # Geocoding cache
├── itineary.md           # Source itinerary
├── itinerary_structured.json # Structured trip data
└── package.json          # Dependencies and scripts
```

## 🔧 Available Scripts

- `npm run serve` - Start development server
- `npm run build:data` - Parse and geocode itinerary data
- `npm run parse` - Parse itinerary markdown only
- `npm run geocode` - Geocode locations only

## 🌐 Deployment

### GitHub Pages (Automatic)

The app is automatically deployed to GitHub Pages when you push to the `main` branch.

**URL**: https://raymondllee.github.io/rtw-trip/

### Manual Deployment

1. **Build the data**:
   ```bash
   npm run build:data
   ```

2. **Deploy to any static host**:
   - Copy the `web/` directory contents
   - Ensure `config.js` has production API keys
   - Upload to your hosting provider

### Environment Variables (Production)

For production deployments, you can use environment variables instead of `config.js`:

```javascript
// In your deployment environment
window.RTW_CONFIG = {
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID
};
```

## 🗺️ Data Sources

- **Primary**: `itinerary_structured.json` - Structured trip data with coordinates
- **Source**: `itineary.md` - Original markdown itinerary
- **Generated**: `data/trip.json` - Parsed and geocoded data

## 🎨 Customization

### Adding New Destinations

1. Edit `itinerary_structured.json`
2. Add new location objects with required fields:
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

1. **Map not loading**: Check API key in `config.js`
2. **Geocoding fails**: Verify Geocoding API is enabled
3. **Routing not working**: Ensure Directions API is enabled
4. **CORS errors**: Check API key restrictions

### Debug Mode

Add `?debug=true` to the URL to see console logs:
```
http://localhost:5173/web/?debug=true
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Maps Platform for mapping services
- OpenStreetMap/Nominatim for geocoding
- The incredible destinations featured in this itinerary

## 📞 Support

For questions or issues:
- Create an issue on GitHub
- Contact: [raymondllee@users.noreply.github.com](mailto:raymondllee@users.noreply.github.com)

---

**Happy Travels!** ✈️🌍🗺️
