// Production configuration fallback
// This file should only load if config.js fails to load
// Railway deployment uses build-web-config.js to generate config.js

if (!window.RTW_CONFIG) {
  console.warn('config.js did not load - using production fallback');

  // Minimal fallback config
  window.RTW_CONFIG = {
    googleMapsApiKey: window.GOOGLE_MAPS_API_KEY || '',
    googleOAuthClientId: window.GOOGLE_OAUTH_CLIENT_ID || '',
    googleCloudProjectId: window.GOOGLE_CLOUD_PROJECT || window.GOOGLE_CLOUD_PROJECT_ID || '',
    googleCloudLocation: window.GOOGLE_CLOUD_LOCATION || 'us-central1',
    firebase: {
      apiKey: window.FIREBASE_API_KEY || '',
      authDomain: window.FIREBASE_AUTH_DOMAIN || '',
      projectId: window.FIREBASE_PROJECT_ID || '',
      storageBucket: window.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: window.FIREBASE_APP_ID || '',
      measurementId: window.FIREBASE_MEASUREMENT_ID || ''
    }
  };

  if (!window.RTW_CONFIG.googleMapsApiKey) {
    console.error('Missing Google Maps API key. Please check Railway environment variables.');
  }
}

if (!window.API_CONFIG) {
  window.API_CONFIG = {
    BASE_URL: window.location.origin,
    TIMEOUT: 300000,
    CHAT_ENDPOINT: '',
    ITINERARY_CHANGES_ENDPOINT: ''
  };
}
