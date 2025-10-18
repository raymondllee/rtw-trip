import type { ApiConfig, FirebaseConfig, RuntimeConfig } from './types/config';

const DEFAULT_API_BASE = 'http://localhost:5001';

function resolveApiConfig(): ApiConfig {
  const apiConfig = window.API_CONFIG ?? {};
  const baseUrl = apiConfig.BASE_URL ?? DEFAULT_API_BASE;
  const timeout = apiConfig.TIMEOUT ?? 300000;

  const normalizeEndpoint = (value: unknown, fallback: string) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return fallback;
  };

  return {
    baseUrl,
    timeout,
    chatEndpoint: normalizeEndpoint(apiConfig.CHAT_ENDPOINT, `${baseUrl}/api/chat`),
    itineraryChangesEndpoint: normalizeEndpoint(apiConfig.ITINERARY_CHANGES_ENDPOINT, `${baseUrl}/api/itinerary/changes`)
  };
}

function resolveFirebaseConfig(): FirebaseConfig {
  const cfg = window.RTW_CONFIG;

  if (cfg?.firebase) {
    return cfg.firebase;
  }

  if (cfg?.firebaseApiKey && cfg.firebaseProjectId && cfg.firebaseAuthDomain) {
    return {
      apiKey: cfg.firebaseApiKey,
      authDomain: cfg.firebaseAuthDomain,
      projectId: cfg.firebaseProjectId,
      storageBucket: cfg.firebaseStorageBucket,
      messagingSenderId: cfg.firebaseMessagingSenderId,
      appId: cfg.firebaseAppId,
      measurementId: cfg.firebaseMeasurementId
    };
  }

  throw new Error('Firebase configuration is missing. Please update web/config.js.');
}

export function getRuntimeConfig(): RuntimeConfig {
  const apiConfig = resolveApiConfig();
  const cfg = window.RTW_CONFIG ?? {};

  const googleMapsApiKey = cfg.googleMapsApiKey;
  if (!googleMapsApiKey) {
    throw new Error('Google Maps API key missing from window.RTW_CONFIG');
  }

  const firebase = resolveFirebaseConfig();

  return {
    apiBaseUrl: apiConfig.baseUrl,
    googleMapsApiKey,
    googleOAuthClientId: cfg.googleOAuthClientId,
    googleCloudProjectId: cfg.googleCloudProjectId,
    googleCloudLocation: cfg.googleCloudLocation,
    firebase,
    endpoints: {
      chat: apiConfig.chatEndpoint ?? `${apiConfig.baseUrl}/api/chat`,
      itineraryChanges: apiConfig.itineraryChangesEndpoint ?? `${apiConfig.baseUrl}/api/itinerary/changes`
    }
  };
}
