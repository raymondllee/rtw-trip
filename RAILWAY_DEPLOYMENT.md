# Railway Deployment Guide

This guide walks you through deploying the RTW Trip application to Railway.

## Prerequisites

1. A [Railway](https://railway.app) account
2. Google Cloud Project with the following APIs enabled:
   - Vertex AI API
   - Firestore API
   - Places API
3. Google Cloud service account credentials

## Environment Variables

You'll need to configure the following environment variables in Railway:

### Required Variables

```bash
# Google Cloud Configuration
GOOGLE_GENAI_USE_VERTEXAI=1
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Google Places API
GOOGLE_PLACES_API_KEY=your-places-api-key

# GCS Storage Bucket
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name

# Travel Concierge Configuration
TRAVEL_CONCIERGE_SCENARIO=travel_concierge/profiles/itinerary_empty_default.json

# Port Configuration (Railway sets this automatically)
PORT=5001
```

### Google Cloud Credentials

Railway requires credentials in JSON format. You have two options:

#### Setting Up Service Account Credentials

1. You should already have a service account JSON file (e.g., `pdf-extract-393514-8f5ce6fa33d2.json`)
2. In Railway, add environment variable `GOOGLE_APPLICATION_CREDENTIALS_JSON`
3. Paste the **entire JSON contents** as the value (it will be a multi-line value)
4. Railway will automatically create a file from this and set `GOOGLE_APPLICATION_CREDENTIALS` to point to it

**Important**: The JSON should include `type`, `project_id`, `private_key`, `client_email`, etc.

## Deployment Steps

### 1. Connect Your Repository

1. Log in to [Railway](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### 2. Configure Build Settings

Railway will automatically detect the configuration from `railway.json`. The build process will:

1. Install Node.js dependencies
2. Build the web configuration
3. Install Python dependencies from `requirements.txt`

### 3. Set Environment Variables

1. In your Railway project, go to "Variables"
2. Add all the environment variables listed above
3. **Important**: Add your Google Cloud credentials as `GOOGLE_APPLICATION_CREDENTIALS_JSON`

### 4. Deploy

Railway will automatically deploy your application. The deployment process:

1. Runs the build command
2. Starts both the ADK API server (port 8000) and Flask API server (using Railway's PORT)
3. Makes the Flask API available via Railway's public URL

### 5. Update Frontend Configuration

After deployment, update your frontend configuration:

1. Copy the Railway URL from your deployment
2. Update `web/config.js`:

```javascript
export const API_CONFIG = {
  BASE_URL: 'https://your-railway-app.railway.app',
  TIMEOUT: 300000
};
```

3. Rebuild and redeploy if needed

## Architecture on Railway

```
Railway Container
├── ADK API Server (localhost:8000)
│   └── Handles agent orchestration
└── Flask API Server (0.0.0.0:$PORT)
    ├── Proxies to ADK server
    ├── Handles chat endpoints
    ├── Manages Firestore operations
    └── Serves frontend API
```

## Troubleshooting

### Build Failures

**Issue**: Python dependencies fail to install

**Solution**: Ensure `requirements.txt` is in the root directory and contains all necessary packages.

**Issue**: `adk` command not found

**Solution**: Make sure `google-adk` is in `requirements.txt` and the build completes successfully.

### Runtime Issues

**Issue**: Application starts but crashes immediately

**Solution**: Check logs for ADK server startup. The Flask server waits 5 seconds for ADK to start.

**Issue**: "Could not connect to ADK API server" errors

**Solution**:
- Verify both servers are running in the container
- Check that ADK server is bound to `0.0.0.0:8000` not `127.0.0.1:8000`
- Increase the sleep time in Procfile if needed

**Issue**: Google Cloud authentication errors

**Solution**:
- Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set correctly
- Ensure the service account has the necessary permissions:
  - Vertex AI User
  - Firestore User
  - Storage Object Viewer

**Issue**: Timeout errors during cost research

**Solution**: The Procfile is already configured with `--timeout 300` (5 minutes). If you need longer:

```
gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 600 api_server:app
```

### CORS Issues

If you experience CORS issues:

1. Verify the Flask app has `CORS(app)` enabled (already configured in `api_server.py:28`)
2. Check that your frontend is using the correct Railway URL
3. Ensure you're using HTTPS in production

## Monitoring

Railway provides built-in monitoring:

1. **Logs**: View real-time logs in the Railway dashboard
2. **Metrics**: Monitor CPU, memory, and network usage
3. **Deployments**: Track deployment history and rollback if needed

## Scaling

To handle more traffic:

1. Increase the number of Gunicorn workers in `Procfile`:
   ```
   --workers 4
   ```

2. Upgrade your Railway plan for more resources

3. Consider separating the ADK server and Flask server into different Railway services

## Custom Domain

To use a custom domain:

1. Go to your Railway project settings
2. Click "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. Update `web/config.js` with your custom domain

## Environment-Specific Configuration

For multiple environments (dev, staging, production):

1. Create separate Railway projects for each environment
2. Use different Firebase projects for each environment
3. Configure environment-specific variables in each Railway project

## Security Considerations

1. **Never commit** `.env` files or credentials to Git
2. Use Railway's environment variables for all secrets
3. Rotate API keys and service account credentials regularly
4. Enable Railway's automatic HTTPS
5. Set up Firebase security rules for Firestore

## Cost Optimization

1. Use Railway's sleep mode for development environments
2. Monitor your Google Cloud API usage (Vertex AI can be expensive)
3. Set up billing alerts in Google Cloud Console
4. Consider caching frequently requested data

## Support

- **Railway Documentation**: https://docs.railway.app
- **Google ADK Documentation**: https://cloud.google.com/vertex-ai/docs/agent-builder
- **Issues**: Create an issue in your repository

## Next Steps

After successful deployment:

1. Test all major features (chat, itinerary editing, cost research)
2. Set up monitoring and alerts
3. Configure custom domain (optional)
4. Set up CI/CD for automated deployments
5. Document any environment-specific configurations
