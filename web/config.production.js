// Production configuration using environment variables
// This file is used when deploying to production environments
// that support environment variables (like Vercel, Netlify, etc.)

window.RTW_CONFIG = {
  // Use environment variables for production
  googleMapsApiKey: process?.env?.GOOGLE_MAPS_API_KEY || window.GOOGLE_MAPS_API_KEY || '',
  googleOAuthClientId: process?.env?.GOOGLE_OAUTH_CLIENT_ID || window.GOOGLE_OAUTH_CLIENT_ID || ''
};

// Fallback for static hosting (GitHub Pages)
if (!window.RTW_CONFIG.googleMapsApiKey) {
  // Try to load from a separate config file
  const script = document.createElement('script');
  script.src = './config.js';
  script.onerror = () => {
    console.error('Missing Google Maps API key. Please configure config.js or set environment variables.');
  };
  document.head.appendChild(script);
}
