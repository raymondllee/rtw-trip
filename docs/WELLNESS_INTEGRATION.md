# Wellness Wheel Integration Documentation

This document provides technical details about how the Wellness Wheel feature is integrated into the RTW Trip Planning application.

## Overview

The Wellness Wheel is a 7-dimension holistic assessment tool that was originally developed as a standalone React application and has been integrated into the RTW Trip app as a git subtree merge.

### Integration History

- **Original Repo**: Standalone wellness-wheel app with React, TypeScript, and Vertex AI
- **Integration Method**: Git subtree merge into `wellness-wheel/` directory
- **Build System**: Migrated from `create-react-app` to Vite (shared with main app)
- **Status**: Phase 1 complete, Phase 2 (AI agent) pending

## Architecture

### Component Structure

```
web/src/wellness/
├── components/
│   ├── WellnessApp.tsx           # Main wellness application container
│   ├── WellnessAssessment.tsx    # Assessment form component
│   ├── WellnessWheel.tsx         # Circular wheel visualization (SVG)
│   └── WellnessGrid.tsx          # Grid/table visualization
├── services/
│   ├── wellnessFirebaseService.ts  # Firebase/Firestore integration
│   ├── analysisStorage.ts          # Analysis results storage (Phase 2)
│   └── wellnessConciergeApi.ts     # API client for AI agent (Phase 2)
├── constants/
│   └── wellness.ts               # Wellness dimensions, colors, config
├── types/
│   └── wellness.ts               # TypeScript type definitions
└── main.tsx                      # Wellness dashboard entry point
```

### Data Flow

```
User Input (Assessment Form)
    ↓
WellnessAssessment Component
    ↓
wellnessFirebaseService.ts
    ↓
Firebase Firestore (Cloud Storage)
    ↓
WellnessWheel / WellnessGrid (Visualization)
```

**Future (Phase 2):**
```
Assessment Data
    ↓
wellnessConciergeApi.ts
    ↓
Flask API Wrapper
    ↓
Wellness Concierge Agent (Python/ADK)
    ↓
AI-Powered Analysis & Recommendations
    ↓
analysisStorage.ts
    ↓
Analysis Dashboard Component
```

## The 7 Dimensions

Each dimension evaluates a different aspect of holistic wellness:

| Dimension | Focus Area | Example Metrics |
|-----------|-----------|-----------------|
| **Spiritual** | Purpose, values, meaning | Meditation frequency, spiritual practices, sense of purpose |
| **Practical** | Organization, daily tasks | Task completion, time management, productivity |
| **Relational** | Social connections | Relationships quality, social time, community involvement |
| **Mental** | Cognitive health, learning | Mental clarity, stress levels, learning activities |
| **Physical** | Body health, fitness | Exercise frequency, nutrition, sleep quality |
| **Behavioral** | Habits, routines | Daily routines, habit consistency, self-discipline |
| **Financial** | Money, security | Income, savings, debt, financial planning |

## The 3 Rings

Each dimension is evaluated across three perspectives:

### Empirical (Inner Ring)
- **Purpose**: Objective, measurable data
- **Color**: Blue tones
- **Example**: "Exercise 3x/week, Income $75K, Meditate 10min daily"
- **Data Type**: Numbers, facts, metrics, evidence

### Situational (Middle Ring)
- **Purpose**: Current circumstances and present state
- **Color**: Green tones
- **Example**: "Recently started yoga, feeling more balanced"
- **Data Type**: Current reality, what's happening now

### Aspirational (Outer Ring)
- **Purpose**: Goals, dreams, future vision
- **Color**: Yellow tones
- **Example**: "Run a marathon, achieve financial independence"
- **Data Type**: Where you want to be, ideal state

## Technical Implementation

### Visualization Technology

#### Wheel View (SVG)
- **Technology**: D3.js for calculations, custom SVG rendering
- **Structure**: Circular segments with curved text
- **Features**:
  - 21 total segments (7 dimensions × 3 rings)
  - Color-coded by dimension and ring
  - Interactive click to view details
  - Responsive scaling
  - Curved text path rendering

#### Grid View (React)
- **Technology**: React components with Tailwind CSS
- **Structure**: Table layout with dimension rows
- **Features**:
  - All 21 cells visible at once
  - Alternating row colors for readability
  - Clean typography and spacing
  - Responsive design

### Data Schema

#### User Document (Firestore)
```typescript
interface UserData {
  userId: string;           // Unique identifier
  userName: string;         // Display name
  responses: {
    [key: string]: string;  // e.g., "spiritual_empirical": "text..."
  };
  timestamp: string;        // ISO 8601 datetime
  createdAt?: string;       // Creation timestamp
  updatedAt?: string;       // Last update timestamp
}
```

#### Response Keys
Format: `{dimension}_{ring}`

Examples:
- `spiritual_empirical`
- `spiritual_situational`
- `spiritual_aspirational`
- `practical_empirical`
- ... (21 total)

### Firebase Integration

#### Configuration
```typescript
// web/config.js (generated at build time)
window.RTW_CONFIG = {
  googleMapsApiKey: "...",
  googleOAuthClientId: "...",
  firebase: {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  }
};
```

#### Firestore Collections
```
wellness_users/
  └── {userId}/
      ├── userId: string
      ├── userName: string
      ├── responses: object
      └── timestamp: string
```

### Startup Integration

The wellness dashboard is included in the main application startup:

```bash
./start-travel-concierge.sh
# Starts:
# - Frontend (Vite) on port 5173
#   - Main app: http://localhost:5173/
#   - Wellness: http://localhost:5173/wellness-dashboard.html
# - Flask API on port 5001
# - ADK API on port 8000
```

## Phase 1 Features (✅ Complete)

### User Management
- ✅ Create new users
- ✅ Switch between users
- ✅ Delete users
- ✅ Import/export user data (JSON)

### Assessment
- ✅ 7 dimensions × 3 rings = 21 input fields
- ✅ Auto-save to Firestore
- ✅ Data persistence across sessions
- ✅ Real-time updates

### Visualization
- ✅ Interactive wheel view (SVG circular visualization)
- ✅ Grid view (table layout)
- ✅ Color-coded dimensions
- ✅ Click segments for details
- ✅ Responsive design

### Data Management
- ✅ Cloud storage via Firebase
- ✅ Export to JSON
- ✅ Import from JSON
- ✅ Data validation

## Phase 2 Features (🔄 Pending Integration)

### AI-Powered Analysis

**Backend**: Wellness Concierge Agent (Python/ADK) ✅ Built, ❌ Not integrated

The wellness concierge agent provides:
- Comprehensive wellness analysis across all dimensions
- Identification of strengths and priority areas  
- Personalized recommendations with actionable steps
- Effort-level assessment for each recommendation
- Resource suggestions and learning materials

**Integration Points** (To Be Implemented):
1. Flask API wrapper for agent (`/api/wellness/analyze`)
2. Frontend API client (`wellnessConciergeApi.ts`)
3. Analysis display component (`AnalysisDashboard.tsx`)
4. Analysis storage service (`analysisStorage.ts`)

**Architecture** (Future):
```
Frontend                  Backend                    Agent
────────                  ───────                    ─────
WellnessGrid
    │
    ├─ "Get Analysis" button
    │
    ↓
wellnessConciergeApi.ts
    │
    ├─ POST /api/wellness/analyze
    │   {userId, responses, timestamp}
    │
    ↓
Flask API Wrapper
    │
    ├─ Format data for agent
    │
    ↓
Wellness Concierge Agent (Python/ADK)
    │
    ├─ Google Gemini LLM
    ├─ Structured analysis
    ├─ Recommendations generation
    │
    ↓
Analysis Response (JSON)
    │
    ├─ Overall analysis
    ├─ Strengths []
    ├─ Priority areas []
    ├─ Recommendations []
    │
    ↓
AnalysisDashboard.tsx
    │
    └─ Display comprehensive insights
```

See [wellness-wheel/INTEGRATION_PLAN.md](../wellness-wheel/INTEGRATION_PLAN.md) for detailed Phase 2 roadmap.

## Configuration

### Environment Variables

Wellness features use the same Firebase configuration as the main app:

```bash
# .env or web/config.js
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Build Configuration

Wellness components are built with Vite alongside the main app:

```javascript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'web/index.html'),
        wellness: resolve(__dirname, 'web/wellness-dashboard.html')
      }
    }
  }
});
```

## Deployment

### Local Development
```bash
./start-travel-concierge.sh
# Access at: http://localhost:5173/wellness-dashboard.html
```

### Production Build
```bash
npm run build:web
# Outputs to: web/dist/
# Includes: index.html, wellness-dashboard.html, assets/
```

### Railway Deployment

Wellness dashboard is included in Railway deployment:
- **URL**: `https://rtw-trip-production.up.railway.app/wellness-dashboard.html`
- **Config**: Same Firebase project as main app
- **Build**: Vite builds both main and wellness apps
- **Serve**: Express serves both HTML entry points

See [RAILWAY_DEPLOYMENT.md](../RAILWAY_DEPLOYMENT.md) for details.

## Testing

### Manual Testing Checklist

- [ ] Start application with `./start-travel-concierge.sh`
- [ ] Navigate to http://localhost:5173/wellness-dashboard.html
- [ ] Create a new user
- [ ] Complete all 21 assessment fields
- [ ] Verify wheel visualization renders correctly
- [ ] Verify grid view displays all responses
- [ ] Click wheel segment, verify detail modal appears
- [ ] Switch to different user, verify data isolation
- [ ] Export user data, verify JSON format
- [ ] Delete a user, verify removal
- [ ] Import user data, verify restoration
- [ ] Refresh page, verify data persists
- [ ] Check browser console for errors

### Automated Testing (Future)

```bash
# Unit tests for components
npm test

# E2E tests for user workflows
npm run test:e2e
```

## Troubleshooting

### Common Issues

#### Wheel Not Rendering
- **Symptom**: Blank space where wheel should be
- **Causes**: Missing data, SVG rendering error, incomplete assessment
- **Solution**: 
  1. Check browser console for errors
  2. Verify all 21 fields are filled
  3. Refresh the page
  4. Try a different browser

#### Data Not Persisting
- **Symptom**: Data lost after page refresh
- **Causes**: Firebase configuration error, network issues
- **Solution**:
  1. Check Firebase config in `web/config.js`
  2. Verify Firebase console shows data
  3. Check browser network tab for failed requests
  4. Ensure internet connection is stable

#### Import Fails
- **Symptom**: Import button doesn't work or shows error
- **Causes**: Invalid JSON format, missing fields
- **Solution**:
  1. Validate JSON format with a validator
  2. Compare with exported file structure
  3. Check console for specific error message
  4. Ensure all required fields are present

#### Export Button Disabled
- **Symptom**: Cannot click Export button
- **Causes**: No user selected
- **Solution**: Select a user from the dropdown first

## Migration Notes

### From Standalone App to Integrated

The wellness wheel was originally a standalone app with its own:
- `package.json` (create-react-app)
- `node_modules/` (~580MB)
- Build system (react-scripts)
- Entry point (public/index.html)

**Integration Changes:**
1. ✅ Components moved to `web/src/wellness/`
2. ✅ Build migrated to Vite (shared with main app)
3. ✅ Entry point: `web/wellness-dashboard.html`
4. ✅ Dependencies consolidated to root `package.json`
5. ⚠️ Old standalone files remain in `wellness-wheel/` for reference

**Cleanup Recommendations:**
- Remove `wellness-wheel/node_modules/` (~580MB savings)
- Archive old `wellness-wheel/package.json`
- Keep `wellness-wheel/README.md` and docs for reference
- Add `wellness-wheel/node_modules/` to `.gitignore`

## Future Enhancements

### Short-term (Next 1-2 months)
- [ ] Integrate AI analysis agent (Phase 2)
- [ ] Add trend tracking over time
- [ ] Create analysis dashboard component
- [ ] Add goal setting and tracking
- [ ] Implement progress notifications

### Medium-term (3-6 months)
- [ ] Multi-language support
- [ ] Custom dimension configuration
- [ ] Collaborative wellness (team assessments)
- [ ] PDF report generation
- [ ] Mobile app version

### Long-term (6+ months)
- [ ] Wellness coach matching
- [ ] Integration with health devices
- [ ] Community features and sharing
- [ ] Advanced analytics and insights
- [ ] Gamification and achievements

## Resources

### Documentation
- [Main README](../README.md) - Overall project documentation
- [QUICKSTART_WELLNESS.md](../QUICKSTART_WELLNESS.md) - User-facing quickstart guide
- [wellness-wheel/README.md](../wellness-wheel/README.md) - Original standalone app docs
- [wellness-wheel/INTEGRATION_PLAN.md](../wellness-wheel/INTEGRATION_PLAN.md) - Detailed integration phases

### Code References
- [WellnessApp.tsx](../web/src/wellness/components/WellnessApp.tsx) - Main component
- [wellnessFirebaseService.ts](../web/src/wellness/services/wellnessFirebaseService.ts) - Data layer
- [wellness.ts](../web/src/wellness/constants/wellness.ts) - Configuration

### External Resources
- [Firebase Documentation](https://firebase.google.com/docs)
- [D3.js Documentation](https://d3js.org/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)

## Contributing

When making changes to wellness features:

1. **Test thoroughly** - Both wheel and grid views
2. **Update documentation** - Keep this file and QUICKSTART_WELLNESS.md in sync
3. **Verify Firebase** - Ensure data persistence works
4. **Check responsiveness** - Test on different screen sizes
5. **Maintain accessibility** - Keep semantic HTML and ARIA labels

---

**Integration Status**: Phase 1 Complete ✅ | Phase 2 Pending 🔄

For questions or issues, see the [main README troubleshooting section](../README.md#-troubleshooting).
