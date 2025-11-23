# Vertex AI Integration Setup Guide (OAuth Client)

This guide will help you set up Vertex AI calls to Gemini for summarizing wellness responses using your existing OAuth client.

## What We've Built

1. **OAuth Vertex AI Service** (`src/services/oauth-vertex-ai.ts`)
   - Direct browser integration using Google OAuth 2.0
   - Automatic token management and refresh
   - Intelligent fallback to rule-based summarization if AI fails

2. **Updated Wellness Wheel Component**
   - Integrated with the OAuth Vertex AI service
   - Automatic summary generation when responses change
   - Cached summaries for better performance

## OAuth Client Setup

### 1. Configure Your OAuth Client

In your Google Cloud Console OAuth client, ensure you have:

**Authorized JavaScript origins:**
```
http://localhost:3000
https://yourdomain.com
```

**Authorized redirect URIs:**
```
http://localhost:3000
https://yourdomain.com
```

### 2. Environment Variables

Create a `.env` file in your project root:

```bash
# Google Cloud Configuration
REACT_APP_GOOGLE_CLOUD_PROJECT_ID=your-project-id
REACT_APP_GOOGLE_CLOUD_LOCATION=us-central1

# OAuth Client Credentials
REACT_APP_GOOGLE_OAUTH_CLIENT_ID=your-oauth-client-id
REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET=your-oauth-client-secret
```

### 3. Enable Required APIs

In your Google Cloud Console, enable these APIs:

```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Enable OAuth 2.0 API (if not already enabled)
gcloud services enable oauth2.googleapis.com
```

## How It Works

1. **First Visit:** User is redirected to Google OAuth consent screen
2. **Authorization:** User grants permission to access Vertex AI
3. **Token Exchange:** App exchanges authorization code for access token
4. **API Calls:** Direct calls to Vertex AI using the access token
5. **Token Refresh:** Automatic token refresh when needed
6. **Fallback:** Rule-based summarization if AI fails

## OAuth Flow Details

### Initial Authentication
- User visits the wellness wheel
- If no valid token exists, redirects to Google OAuth
- User consents to `https://www.googleapis.com/auth/cloud-platform` scope
- Returns to app with authorization code

### Token Management
- Authorization code is exchanged for access token
- Token is stored in localStorage with expiration
- Token is automatically refreshed when expired
- No need for backend proxy or service account keys

### API Calls
- Direct calls to Vertex AI REST API
- Uses Bearer token authentication
- Handles various response formats from Gemini
- Graceful fallback on errors

## Security Benefits

✅ **No service account keys in frontend**  
✅ **User-specific permissions**  
✅ **Automatic token expiration**  
✅ **Secure token storage**  
✅ **No backend required**  

## Testing

1. **Set environment variables** in your `.env` file
2. **Start the app:** `npm start`
3. **First visit:** You'll be redirected to Google OAuth
4. **Grant permissions:** Allow access to Vertex AI
5. **Return to app:** Summaries should generate automatically
6. **Check console:** Look for OAuth and API call logs

## Troubleshooting

### OAuth Issues
- **"Invalid client"**: Check OAuth client ID and secret
- **"Redirect URI mismatch"**: Verify authorized redirect URIs
- **"Scope not allowed"**: Ensure cloud-platform scope is enabled

### Vertex AI Issues
- **"API not enabled"**: Enable aiplatform.googleapis.com
- **"Permission denied"**: Check OAuth client has proper scopes
- **"Quota exceeded"**: Check Vertex AI quotas in Google Cloud

### Development Issues
- **CORS errors**: OAuth handles this automatically
- **Token storage**: Check localStorage in browser dev tools
- **Network errors**: Verify project ID and location

## Customization

### Modifying OAuth Scopes
In `src/services/oauth-vertex-ai.ts`, change the scope:
```typescript
const scope = 'https://www.googleapis.com/auth/cloud-platform';
```

### Adjusting Token Storage
Modify the localStorage key and structure in the service:
```typescript
localStorage.setItem('google_oauth_token', JSON.stringify(tokenInfo));
```

### Custom Prompts
Update the `createSummarizationPrompt` method for different AI behaviors.

## Next Steps

1. **Configure OAuth client** with proper redirect URIs
2. **Set environment variables** in your `.env` file
3. **Enable Vertex AI API** in Google Cloud Console
4. **Test the integration** with your wellness wheel
5. **Customize prompts** and summarization logic as needed

The OAuth approach provides a secure, user-friendly way to integrate Vertex AI directly in your frontend application without needing a backend proxy or managing service account keys.
