// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// Firebase configuration template
// INSTRUCTIONS:
// Prefer using the build script: `node scripts/build-web-config.js`
// It will generate web/firebase-config.js from environment variables.
// If you must do it manually, copy this file to firebase-config.js and
// replace placeholders, but do not commit firebase-config.js.
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY_HERE",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID",
  measurementId: "YOUR_FIREBASE_MEASUREMENT_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { db };
