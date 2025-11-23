// Vertex AI configuration for Gemini model
export const VERTEX_AI_CONFIG = {
  // You'll need to set these environment variables
  projectId: process.env.REACT_APP_GOOGLE_CLOUD_PROJECT_ID || '',
  location: process.env.REACT_APP_GOOGLE_CLOUD_LOCATION || 'us-central1',
  model: 'gemini-2.5-flash', // Using the latest available Gemini model
  
  // OAuth client configuration
  oauthClientId: process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID || '',
  oauthClientSecret: process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET || '',
  
  // Model parameters for optimal summarization
  generationConfig: {
    temperature: 0.3, // Lower temperature for more consistent, focused summaries
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 150, // Limit output to fit in wheel segments
  }
};