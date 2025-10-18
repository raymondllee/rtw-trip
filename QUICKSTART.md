# Quick Start: Firestore Versioning System

Get your trip planning app running with cloud-based versioning in 5 minutes.

## Prerequisites
✅ Google Cloud Project (you already have one)
✅ Node.js and npm installed
✅ Firebase SDK installed (`npm install` already ran)
✅ Environment file prepared (`.env` based on `.env.example`)

## Step-by-Step Setup

### 1. Enable Firestore (2 minutes)

1. Go to https://console.firebase.google.com/
2. Select your Google Cloud project
3. Click **"Firestore Database"** → **"Create database"**
4. Choose **"Production mode"** → Select location → **"Enable"**

### 2. Register Web App (1 minute)

1. In Firebase Console, click ⚙️ → **"Project settings"**
2. Scroll to **"Your apps"** → Click **Web icon** `</>`
3. Enter nickname: `RTW Trip Planner`
4. Click **"Register app"**
5. **Copy the config object** (you'll need it next)

### 3. Configure environment and build configs (1–2 minutes)

1. Copy the example env file and fill in values from Firebase Console and Google Cloud:

```bash
cp .env.example .env
# Edit .env with your real values (Firebase + Google OAuth/Maps)
```

2. Generate client-side config files (gitignored):

```bash
node scripts/build-web-config.js
```

This creates/updates:
- `web/config.js` (uses values from `.env`)
- `web/firebase-config.js` (uses values from `.env`)

Note: Do not commit secrets. Both files are already ignored by `.gitignore`.

### 4. Set Security Rules (1 minute)

1. In Firebase Console → **"Firestore Database"** → **"Rules"** tab
2. Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scenarios/{scenarioId} {
      allow read, write: if true;
      match /versions/{versionId} {
        allow read, write: if true;
      }
    }
  }
}
```

3. Click **"Publish"**

### 5. Test It! (30 seconds)

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

**Test auto-save:**
1. Make any change (add destination, edit duration, etc.)
2. Wait 2 seconds
3. Open browser console (F12)
4. Look for: `✅ "Auto-saved to Firestore"`
5. **Refresh the page** - your changes persist!

**Test version history:**
1. Click "Manage Scenarios"
2. Click "History" on any scenario
3. See all your versions
4. Click one to revert

## That's It! 🎉

Your app now has:
- ✅ Automatic versioning
- ✅ Cloud storage
- ✅ Version history
- ✅ One-click revert
- ✅ Auto-resume on reload
- ✅ Cross-device sync

## What Just Happened?

1. **Firebase SDK installed** → Your app can now talk to Google Cloud
2. **Firestore enabled** → You have a cloud database
3. **Config added** → Your app knows which Firebase project to use
4. **Security rules set** → Your database is accessible
5. **Auto-save active** → Every change creates a new version

## Next Steps

### Migrate Existing Data (Optional)

If you have scenarios in localStorage:

```javascript
// Run in browser console:
const manager = new FirestoreScenarioManager();
await manager.migrateFromLocalStorage();
```

### View Your Data

1. Firebase Console → **"Firestore Database"**
2. See `scenarios` collection
3. Expand to see versions

### How to Use

**Normal workflow:**
- Just use the app as usual
- Changes auto-save every 2 seconds
- Always loads your latest state

**Create named snapshot:**
- Click "Save Scenario" button
- Enter a meaningful name
- This version won't be auto-deleted

**Revert to old version:**
- "Manage Scenarios" → "History"
- Click any version
- Confirm revert

**View version info:**
- Each scenario shows version number (e.g., `v42`)
- See when it was created
- See how many destinations

## Troubleshooting

### "Firebase: Error (auth/api-key-not-valid)"
→ Double-check `FIREBASE_API_KEY` in `.env`, then rerun `node scripts/build-web-config.js`

### "Missing or insufficient permissions"
→ Check Firestore security rules (Step 4)

### "Module not found: firebase"
→ Run `npm install` again

### CORS errors
→ Use `npm run dev`, don't open HTML directly

### Nothing happens after changes
→ Open console, look for errors
→ Verify `.env` values and rerun `node scripts/build-web-config.js`
→ Verify Firestore is enabled in console

## Get Help

- 📚 Full docs: [VERSIONING_SYSTEM.md](VERSIONING_SYSTEM.md)
- 🔧 Detailed setup: [FIRESTORE_SETUP.md](FIRESTORE_SETUP.md)
- 🐛 Issues: Check browser console for error messages

## Summary

```bash
1. Enable Firestore      → console.firebase.google.com
2. Register app          → Get config object
3. Configure env (.env)  → Then run `node scripts/build-web-config.js`
4. Set security rules    → Copy/paste rules
5. npm run dev           → Test it!
```

**Total time: ~5 minutes**

Enjoy your new cloud-based versioning system! 🚀
