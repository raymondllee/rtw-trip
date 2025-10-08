// Production configuration fallback
// This file should only load if config.js fails to load
// Railway deployment uses build-web-config.js to generate config.js

if (!window.RTW_CONFIG) {
  console.warn('config.js did not load - using production fallback');

  // Minimal fallback config
  window.RTW_CONFIG = {
    googleMapsApiKey: window.GOOGLE_MAPS_API_KEY || '',
    googleOAuthClientId: window.GOOGLE_OAUTH_CLIENT_ID || ''
  };

  if (!window.RTW_CONFIG.googleMapsApiKey) {
    console.error('Missing Google Maps API key. Please check Railway environment variables.');
  }
}

if (!window.API_CONFIG) {
  window.API_CONFIG = {
    BASE_URL: window.location.origin,
    TIMEOUT: 300000
  };
}
