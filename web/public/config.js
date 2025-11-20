const DEFAULT_API_BASE = 'http://localhost:5001';
function resolveApiConfig() {
    var _a, _b, _c;
    const apiConfig = (_a = window.API_CONFIG) !== null && _a !== void 0 ? _a : {};
    const baseUrl = (_b = apiConfig.BASE_URL) !== null && _b !== void 0 ? _b : DEFAULT_API_BASE;
    const timeout = (_c = apiConfig.TIMEOUT) !== null && _c !== void 0 ? _c : 300000;
    const normalizeEndpoint = (value, fallback) => {
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
function resolveFirebaseConfig() {
    const cfg = window.RTW_CONFIG;
    if (cfg === null || cfg === void 0 ? void 0 : cfg.firebase) {
        return cfg.firebase;
    }
    if ((cfg === null || cfg === void 0 ? void 0 : cfg.firebaseApiKey) && cfg.firebaseProjectId && cfg.firebaseAuthDomain) {
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
export function getRuntimeConfig() {
    var _a, _b, _c;
    const apiConfig = resolveApiConfig();
    const cfg = (_a = window.RTW_CONFIG) !== null && _a !== void 0 ? _a : {};
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
            chat: (_b = apiConfig.chatEndpoint) !== null && _b !== void 0 ? _b : `${apiConfig.baseUrl}/api/chat`,
            itineraryChanges: (_c = apiConfig.itineraryChangesEndpoint) !== null && _c !== void 0 ? _c : `${apiConfig.baseUrl}/api/itinerary/changes`
        }
    };
}
