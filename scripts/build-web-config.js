#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables from .env file or process.env
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};

  // First, try to read from .env file
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

  // Override with process.env (for Railway/production deployments)
  Object.keys(process.env).forEach(key => {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  });

  return env;
}

// Build the config file
function buildConfig() {
  const env = loadEnv();

  // Debug: Log environment variables being used
  console.log('🔍 Environment variables loaded:');
  console.log('  FIREBASE_PROJECT_ID:', env.FIREBASE_PROJECT_ID || 'NOT SET');
  console.log('  FIREBASE_API_KEY:', env.FIREBASE_API_KEY ? '***' + env.FIREBASE_API_KEY.slice(-4) : 'NOT SET');
  console.log('  GOOGLE_MAPS_API_KEY:', env.GOOGLE_MAPS_API_KEY ? '***' + env.GOOGLE_MAPS_API_KEY.slice(-4) : 'NOT SET');
  console.log('  FIREBASE_AUTH_DOMAIN:', env.FIREBASE_AUTH_DOMAIN || 'NOT SET');
  console.log('  FIREBASE_PROJECT_ID:', env.FIREBASE_PROJECT_ID || 'NOT SET');
  console.log('  RAILWAY_PUBLIC_DOMAIN:', env.RAILWAY_PUBLIC_DOMAIN || 'NOT SET');

  // Determine API base URL (use RAILWAY_PUBLIC_DOMAIN if available, otherwise localhost)
  const apiBaseUrl = env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${env.RAILWAY_PUBLIC_DOMAIN}`
    : (env.API_BASE_URL || 'http://localhost:5001');

  const configTemplate = `// Configuration generated during build from environment variables
// This file is loaded as a regular script (not a module)

// API configuration
window.API_CONFIG = {
  BASE_URL: '${apiBaseUrl}',
  TIMEOUT: ${Number(env.API_TIMEOUT || 300000)},
  CHAT_ENDPOINT: '${env.CHAT_API_ENDPOINT || ''}',
  ITINERARY_CHANGES_ENDPOINT: '${env.ITINERARY_CHANGES_ENDPOINT || ''}'
};

// Application configuration
window.RTW_CONFIG = {
  googleCloudProjectId: "${env.GOOGLE_CLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT_ID || 'YOUR_GOOGLE_CLOUD_PROJECT_ID'}",
  googleCloudLocation: "${env.GOOGLE_CLOUD_LOCATION || 'us-central1'}",
  googleOAuthClientId: "${env.GOOGLE_OAUTH_CLIENT_ID || 'YOUR_GOOGLE_OAUTH_CLIENT_ID'}",
  googleMapsApiKey: "${env.GOOGLE_MAPS_API_KEY || 'YOUR_MAPS_API_KEY_HERE'}",
  firebase: {
    apiKey: "${env.FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY_HERE'}",
    authDomain: "${env.FIREBASE_AUTH_DOMAIN || 'YOUR_FIREBASE_AUTH_DOMAIN'}",
    projectId: "${env.FIREBASE_PROJECT_ID || 'YOUR_FIREBASE_PROJECT_ID'}",
    storageBucket: "${env.FIREBASE_STORAGE_BUCKET || ''}",
    messagingSenderId: "${env.FIREBASE_MESSAGING_SENDER_ID || ''}",
    appId: "${env.FIREBASE_APP_ID || ''}",
    measurementId: "${env.FIREBASE_MEASUREMENT_ID || ''}"
  }
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

// Run the build
buildConfig();
