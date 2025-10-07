# Firebase/Firestore Setup Guide

This guide will help you set up Google Cloud Firestore for the RTW Trip versioning system.

## Prerequisites

- Google Cloud Project (you already have one for the Travel Concierge agent)
- Firebase enabled on your project

## Step 1: Enable Firestore in Your Google Cloud Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your existing Google Cloud project (or create a new one)
3. Click "Firestore Database" in the left sidebar
4. Click "Create database"
5. Choose "Start in production mode" (we'll add security rules later)
6. Select a location (choose one close to you, e.g., `us-central`)
7. Click "Enable"

## Step 2: Register Your Web App

1. In the Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the Web icon `</>`
5. Register your app with a nickname like "RTW Trip Planner"
6. **Don't** check "Also set up Firebase Hosting" (unless you want to)
7. Click "Register app"

## Step 3: Get Your Firebase Configuration

After registering, you'll see your Firebase configuration object. It looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123..."
};
```

## Step 4: Configure environment and generate client config

1. Create your environment file from the example and fill in values from Firebase Console (Step 3) and Google Cloud as needed:

```bash
cp .env.example .env
# Edit .env and set Firebase and Google values
```

2. Generate client-side configuration files (these are gitignored):

```bash
node scripts/build-web-config.js
```

This creates/updates:
- `web/config.js` (uses values from `.env`)
- `web/firebase-config.js` (uses values from `.env`)

Note: Do not commit secrets. Both generated files are ignored by `.gitignore`.

## Step 5: Set Up Firestore Security Rules

In the Firebase Console:

1. Go to "Firestore Database"
2. Click the "Rules" tab
3. Replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write to scenarios for now (TODO: add authentication)
    match /scenarios/{scenarioId} {
      allow read, write: if true;

      // Allow read/write to versions subcollection
      match /versions/{versionId} {
        allow read, write: if true;
      }
    }
  }
}
```

4. Click "Publish"

⚠️ **Note**: These rules allow anyone to read/write. For production, you should add authentication.

## Step 6: Test Your Setup

1. Start your development server:
   ```bash
   npm run serve
   ```

2. Open http://localhost:5173 in your browser
3. Open the browser console (F12)
4. Look for any Firebase errors
5. Make a change to your trip and wait 2 seconds
6. Check the console for "Auto-saved to Firestore"
7. Refresh the page - your changes should persist!

## Step 7: View Your Data in Firestore

1. Go to the Firebase Console
2. Click "Firestore Database"
3. You should see a "scenarios" collection
4. Expand it to see your scenarios and their versions

## Troubleshooting

### "Firebase: Error (auth/api-key-not-valid)"
- Double-check `FIREBASE_API_KEY` in `.env`
- Rerun `node scripts/build-web-config.js`

### "Missing or insufficient permissions"
- Check your Firestore security rules (Step 5)
- Make sure you published the rules

### "Module not found: firebase"
- Run `npm install` again
- Make sure `firebase` is in `package.json` dependencies

### CORS errors
- Make sure you're accessing via the development server (`npm run serve`)
- Don't open the HTML file directly (`file://`)

## Optional: Add Authentication

To secure your data with user authentication:

1. Enable Google Authentication in Firebase Console:
   - Go to "Authentication" → "Sign-in method"
   - Enable "Google"

2. Update `firestore-scenario-manager.js`:
   - Import `getAuth, signInWithPopup, GoogleAuthProvider` from `firebase/auth`
   - Add sign-in functionality
   - Replace `this.userId = 'default-user'` with actual user ID

3. Update Firestore rules to check authentication:
   ```
   allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
   ```

## Migration

To migrate your existing localStorage scenarios to Firestore:

1. Open the browser console
2. Run:
   ```javascript
   await scenarioManager.migrateFromLocalStorage();
   ```
3. Check Firestore console to verify migration

Your localStorage data will remain untouched.

## What You Get

✅ **Automatic versioning**: Every change creates a new version (debounced 2s)
✅ **Version history**: View all past versions of any scenario
✅ **One-click revert**: Go back to any previous version
✅ **Named versions**: Tag important milestones
✅ **Auto-retention**: Keeps last 50 auto-versions, unlimited named versions
✅ **Persistence**: Always loads your last state automatically
✅ **Cross-device sync**: Access your trip from any device
✅ **No manual export/import**: Everything saved automatically to cloud

## Next Steps

- Set up authentication for multi-user support
- Add Python backend Firestore integration
- Add version comparison/diff view
- Add collaborative editing features
