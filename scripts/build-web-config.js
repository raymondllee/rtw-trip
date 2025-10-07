#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};

  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  } catch (error) {
    console.warn('Warning: .env file not found or could not be read:', error.message);
  }

  return env;
}

// Build the config file
function buildConfig() {
  const env = loadEnv();

  const configTemplate = `window.RTW_CONFIG = {
  googleCloudProjectId: "${env.GOOGLE_CLOUD_PROJECT_ID || 'YOUR_GOOGLE_CLOUD_PROJECT_ID'}",
  googleCloudLocation: "${env.GOOGLE_CLOUD_LOCATION || 'us-central1'}",
  googleOAuthClientId: "${env.GOOGLE_OAUTH_CLIENT_ID || 'YOUR_GOOGLE_OAUTH_CLIENT_ID'}",
  googleOAuthClientSecret: "${env.GOOGLE_OAUTH_CLIENT_SECRET || 'YOUR_GOOGLE_OAUTH_CLIENT_SECRET'}",
  googleMapsApiKey: "${env.GOOGLE_MAPS_API_KEY || 'YOUR_MAPS_API_KEY_HERE'}",
  firebaseApiKey: "${env.FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY_HERE'}"
};
`;

  const configPath = path.join(__dirname, '..', 'web', 'config.js');

  // Create backup of existing config
  if (fs.existsSync(configPath)) {
    const backupPath = configPath + '.backup';
    fs.copyFileSync(configPath, backupPath);
    console.log('✓ Backup created:', backupPath);
  }

  // Write new config
  fs.writeFileSync(configPath, configTemplate);
  console.log('✓ Web config built successfully');
  console.log('✓ Config file written to:', configPath);
}

// Build the Firebase config file
function buildFirebaseConfig() {
  const env = loadEnv();

  const firebaseTemplate = `// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "${env.FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY_HERE'}",
  authDomain: "${env.FIREBASE_AUTH_DOMAIN || 'YOUR_FIREBASE_AUTH_DOMAIN'}",
  projectId: "${env.FIREBASE_PROJECT_ID || 'YOUR_FIREBASE_PROJECT_ID'}",
  storageBucket: "${env.FIREBASE_STORAGE_BUCKET || 'YOUR_FIREBASE_STORAGE_BUCKET'}",
  messagingSenderId: "${env.FIREBASE_MESSAGING_SENDER_ID || 'YOUR_FIREBASE_MESSAGING_SENDER_ID'}",
  appId: "${env.FIREBASE_APP_ID || 'YOUR_FIREBASE_APP_ID'}",
  measurementId: "${env.FIREBASE_MEASUREMENT_ID || 'YOUR_FIREBASE_MEASUREMENT_ID'}"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
`;

  const firebaseConfigPath = path.join(__dirname, '..', 'web', 'firebase-config.js');

  // Create/overwrite firebase-config.js
  fs.writeFileSync(firebaseConfigPath, firebaseTemplate);
  console.log('✓ Firebase config built successfully');
  console.log('✓ Firebase config file written to:', firebaseConfigPath);
}

// Run the build
buildConfig();
buildFirebaseConfig();
