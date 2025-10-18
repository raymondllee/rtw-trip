# Trip Planning Versioning System

## Overview

Your trip planning app now has a **cloud-based automatic versioning system** powered by Google Cloud Firestore. This replaces the old localStorage-based scenario system with a robust, cloud-synced solution.

## What Changed

### Before (localStorage-based)
- ❌ Manual export/import workflow
- ❌ No version history
- ❌ No automatic backups
- ❌ Lost data on browser clear
- ❌ No cross-device sync
- ❌ Cumbersome to manage

### After (Firestore-based)
- ✅ **Automatic versioning** - Every change creates a version (like Git commits)
- ✅ **Cloud storage** - Data persists in Google Cloud Firestore
- ✅ **Version history** - View and revert to any previous version
- ✅ **Named versions** - Tag important milestones
- ✅ **Auto-save** - Changes saved automatically after 2 seconds
- ✅ **Always resume** - Picks up where you left off automatically
- ✅ **Cross-device** - Access from any device with same Google account
- ✅ **One-click revert** - Go back to any version instantly

## How It Works

### Architecture

```
Firestore Database
├── scenarios (collection)
│   ├── {scenario-id} (document)
│   │   ├── name: "My Trip"
│   │   ├── description: "Summer 2026 RTW"
│   │   ├── userId: "default-user"
│   │   ├── currentVersion: 42
│   │   ├── createdAt: timestamp
│   │   ├── updatedAt: timestamp
│   │   │
│   │   └── versions (subcollection)
│   │       ├── {version-id-1}
│   │       │   ├── versionNumber: 1
│   │       │   ├── versionName: "Initial version"
│   │       │   ├── isNamed: true
│   │       │   ├── itineraryData: {...}
│   │       │   └── createdAt: timestamp
│   │       │
│   │       ├── {version-id-2}
│   │       │   ├── versionNumber: 2
│   │       │   ├── versionName: ""
│   │       │   ├── isNamed: false
│   │       │   ├── itineraryData: {...}
│   │       │   └── createdAt: timestamp
│   │       ...
```

### Auto-Versioning Flow

1. **User makes a change** (edit destination, change duration, drag to reorder, etc.)
2. **Auto-save triggered** (debounced 2 seconds)
3. **New version created** in Firestore with incremented version number
4. **Old versions retained** (last 50 auto-versions, unlimited named versions)
5. **Data synced** across all devices

### Version Types

**Auto-versions** (unnamed)
- Created automatically on every change
- Retention: Last 50 versions
- Older auto-versions are automatically pruned
- Version name: `""` (empty)
- `isNamed: false`

**Named versions** (tagged)
- Created manually via "Save Scenario" button
- Never automatically deleted
- Used for important milestones
- Version name: User-specified (e.g., "Final itinerary", "Before adding Japan")
- `isNamed: true`

## New Features

### 1. Version History Browser

**Access:** Click "History" button next to any scenario in the Manage Scenarios modal

**Features:**
- View all versions in chronological order
- See version number, name, and timestamp
- See number of destinations in each version
- Named versions marked with 📌 pin icon
- Click any version to revert to it

### 2. One-Click Revert

**How to revert:**
1. Open scenario's version history
2. Click the version you want to revert to
3. Confirm the action
4. New version created with old data (preserves history)

**Important:** Reverting doesn't delete history - it creates a new version with the old data

### 3. Auto-Resume

**On app load:**
- Automatically loads your most recently modified scenario
- No need to manually load or import
- Just open the app and continue where you left off

### 4. Migration from localStorage

**First-time setup:**
Your existing localStorage scenarios can be migrated to Firestore:

```javascript
// Run in browser console
await scenarioManager.migrateFromLocalStorage();
```

This copies all localStorage scenarios to Firestore without deleting the originals.

## Files Changed

### New Files
- `web/firebase-config.js` - Firebase initialization and configuration
- `web/firestore-scenario-manager.js` - Firestore scenario management class
- `FIRESTORE_SETUP.md` - Setup instructions
- `VERSIONING_SYSTEM.md` - This file

### Modified Files
- `web/src/app/initMapApp.ts` - Updated to use Firestore instead of localStorage
  - Auto-save now creates Firestore versions
  - Scenario loading/saving uses Firestore
  - Added version history UI
  - Added revert functionality
- `package.json` - Added Firebase SDK dependency

## API Reference

### FirestoreScenarioManager Methods

```javascript
// Create or get scenario
await scenarioManager.getOrCreateScenario(name, description)

// Save a new version
await scenarioManager.saveVersion(scenarioId, itineraryData, isNamed, versionName)

// Get latest version
await scenarioManager.getLatestVersion(scenarioId)

// Get version history
await scenarioManager.getVersionHistory(scenarioId, limitCount)

// Get specific version
await scenarioManager.getVersion(scenarioId, versionNumber)

// Revert to version
await scenarioManager.revertToVersion(scenarioId, versionNumber)

// Name a version
await scenarioManager.nameVersion(scenarioId, versionNumber, versionName)

// List all scenarios
await scenarioManager.listScenarios()

// Get scenario details
await scenarioManager.getScenario(scenarioId)

// Delete scenario
await scenarioManager.deleteScenario(scenarioId)

// Migrate from localStorage
await scenarioManager.migrateFromLocalStorage()

// Real-time subscriptions
const unsubscribe = scenarioManager.subscribeToScenario(scenarioId, callback)
const unsubscribe = scenarioManager.subscribeToVersions(scenarioId, callback)
```

## Configuration

### Client Config Generation
- Run `node scripts/build-web-config.js` to generate client config files from `.env`.
- Generated files (gitignored):
  - `web/config.js` — app runtime config (OAuth/Maps/etc.).
  - `web/firebase-config.js` — Firebase initialization config.

Use `.env.example` as a template for required variables. Do not commit real secrets.

### Firebase Config Location
`web/firebase-config.js` (generated)

**Required environment variables (or direct values):**
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

See [FIRESTORE_SETUP.md](FIRESTORE_SETUP.md) for detailed setup instructions.

## Usage Examples

### Creating a Named Version

```javascript
// Make some changes to your trip
// Click "Save Scenario" button
// Enter a name like "Final itinerary before booking"
// This creates a named version that won't be auto-deleted
```

### Viewing Version History

```javascript
// Open "Manage Scenarios" modal
// Find your scenario
// Click "History" button
// Browser shows all versions with timestamps
```

### Reverting to a Previous Version

```javascript
// Open version history
// Find the version you want to restore
// Click on it
// Confirm revert
// App reloads with that version's data
// A new version is created (preserves full history)
```

### Checking Auto-Save Status

```javascript
// Open browser console
// Make a change to your trip
// Wait 2 seconds
// Look for: "Auto-saved to Firestore"
// Check version number in Firestore console
```

## Benefits

### For You
- ✅ Never lose work again
- ✅ Experiment freely, knowing you can always revert
- ✅ No more juggling JSON export files
- ✅ Access your trip from phone, tablet, or any browser
- ✅ Automatic backups every time you make changes

### Technical Benefits
- ✅ Real-time sync across devices
- ✅ Offline support (Firebase SDK handles this)
- ✅ Scalable cloud storage
- ✅ Built-in security with Firestore rules
- ✅ Free tier: 1GB storage, 50K reads/20K writes per day
- ✅ Integrates with existing Google Cloud setup

## Future Enhancements

### Planned
- [ ] Add user authentication (Google Sign-In)
- [ ] Python backend integration for AI agent
- [ ] Version comparison/diff view
- [ ] Collaborative editing (multiple users)
- [ ] Version branching (like Git branches)
- [ ] Export/import still available for backups

### Python Backend Integration
The Python travel agent can also use Firestore:

```python
import firebase_admin
from firebase_admin import firestore

# Initialize Firebase Admin SDK
cred = firebase_admin.credentials.ApplicationDefault()
firebase_admin.initialize_app(cred)

db = firestore.client()

# Load scenario
scenario_ref = db.collection('scenarios').document(scenario_id)
scenario = scenario_ref.get().to_dict()

# Save new version
version_ref = scenario_ref.collection('versions').document()
version_ref.set({
    'versionNumber': next_version,
    'itineraryData': itinerary_data,
    'isNamed': True,
    'versionName': 'Generated by AI',
    'createdAt': firestore.SERVER_TIMESTAMP
})
```

## Troubleshooting

See [FIRESTORE_SETUP.md](FIRESTORE_SETUP.md) for common issues and solutions.

## Summary

You now have a **production-grade versioning system** for your trip planning app:
- **Automatic** - No manual work required
- **Persistent** - Cloud-based storage
- **Reversible** - Full version history
- **Fast** - <100ms reads typically
- **Free** - Generous Google Cloud free tier
- **Integrated** - Works with your existing Google Cloud setup

Just configure your Firebase credentials and start using it!
