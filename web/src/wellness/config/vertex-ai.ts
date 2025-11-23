// Get config from window (loaded from config.js)
declare global {
  interface Window {
    RTW_CONFIG?: {
      googleCloudProjectId?: string;
      googleCloudLocation?: string;
      googleOAuthClientId?: string;
      [key: string]: any;
    };
  }
}

// Vertex AI configuration for Gemini model
export const VERTEX_AI_CONFIG = {
  // Use existing app credentials from window.RTW_CONFIG
  projectId: (typeof window !== 'undefined' && window.RTW_CONFIG?.googleCloudProjectId) ||
             import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID ||
             'pdf-extract-393514',
  location: (typeof window !== 'undefined' && window.RTW_CONFIG?.googleCloudLocation) ||
            import.meta.env.VITE_GOOGLE_CLOUD_LOCATION ||
            'us-central1',
  model: 'gemini-2.0-flash-exp', // Using the latest available Gemini model

  // OAuth client configuration - using existing app OAuth credentials
  oauthClientId: (typeof window !== 'undefined' && window.RTW_CONFIG?.googleOAuthClientId) ||
                 import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ||
                 '',
  oauthClientSecret: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET || '',

  // Model parameters for optimal summarization
  generationConfig: {
    temperature: 0.3, // Lower temperature for more consistent, focused summaries
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 150, // Limit output to fit in wheel segments
  }
};