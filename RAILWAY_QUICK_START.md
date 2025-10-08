# Railway Quick Start Guide

## Files Added for Railway Deployment

✅ **nixpacks.toml** - Tells Railway to use both Python 3.11 and Node.js 20
✅ **railway.json** - Railway-specific configuration
✅ **Procfile** - Process definition for Railway
✅ **start.sh** - Startup script that runs both servers
✅ **requirements.txt** - Python dependencies
✅ **.env.railway** - Environment variables template

## Quick Deploy Steps

### 1. Push to GitHub

```bash
git add .
git commit -m "Add Railway deployment configuration"
git push
```

### 2. Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `rtw-trip` repository
5. Click "Deploy Now"

### 3. Set Environment Variables

In Railway dashboard, go to your project → Variables tab, then add these:

```bash
GOOGLE_GENAI_USE_VERTEXAI=1
GOOGLE_CLOUD_PROJECT=pdf-extract-393514
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_PLACES_API_KEY=AIzaSyCmRj2pl0vqSSwN7RObq44FjIghD2LtuJM
GOOGLE_CLOUD_STORAGE_BUCKET=755108588357_us_import_content
TRAVEL_CONCIERGE_SCENARIO=travel_concierge/profiles/itinerary_empty_default.json
```

**MOST IMPORTANT**: Add `GOOGLE_APPLICATION_CREDENTIALS_JSON`

1. Click "New Variable"
2. Name: `GOOGLE_APPLICATION_CREDENTIALS_JSON`
3. Value: Open `/Users/ray/Downloads/pdf-extract-393514-8f5ce6fa33d2.json` and paste the **entire contents**
4. Click "Add"

### 4. Deploy

Railway will automatically deploy after you add the variables. Watch the logs to see:

```
🚀 Starting RTW Trip Application...
📡 Starting ADK API server on port 8000...
⏳ Waiting for ADK server to initialize...
✅ ADK server started successfully
🌐 Starting Flask API server on port 5001...
```

### 5. Get Your Railway URL

1. Go to Settings tab
2. Under "Domains", click "Generate Domain"
3. Copy the URL (e.g., `https://your-app.railway.app`)

### 6. Update Frontend Config

Update `web/config.js` with your Railway URL:

```javascript
export const API_CONFIG = {
  BASE_URL: 'https://your-app.railway.app',
  TIMEOUT: 300000
};
```

Then commit and push:

```bash
git add web/config.js
git commit -m "Update API URL for Railway deployment"
git push
```

Railway will automatically redeploy.

## Verify Deployment

Test your deployment:

```bash
# Health check
curl https://your-app.railway.app/health

# Should return: {"status":"healthy"}
```

## Troubleshooting

### Build fails with "pip: command not found"
- Make sure `nixpacks.toml` is committed and pushed
- Railway should auto-detect it

### ADK server fails to start
- Check logs in Railway dashboard
- Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set correctly
- Ensure all environment variables are present

### "Could not connect to ADK API server"
- ADK server might need more time to start
- Edit `start.sh` and increase the sleep time from 10 to 15 seconds

### Timeout errors
- This is normal for cost research (takes 2-3 minutes)
- The timeout is already set to 300 seconds in `start.sh`

## What Happens During Deployment

1. **Build Phase** (nixpacks.toml):
   - Installs Python 3.11 and Node.js 20
   - Runs `npm install`
   - Runs `pip install -r requirements.txt`
   - Runs `npm run build:config` (creates web/config.js and web/firebase-config.js)

2. **Deploy Phase** (start.sh):
   - Starts ADK API server on port 8000 (internal)
   - Waits 10 seconds for ADK to initialize
   - Starts Flask API server on Railway's PORT (public-facing)

3. **Runtime**:
   - Railway assigns a public URL to your Flask server
   - Flask server proxies requests to ADK server internally
   - Both servers run in the same container

## Architecture

```
Internet
    ↓
Railway Load Balancer
    ↓
Flask API (port $PORT) ←→ ADK API (port 8000)
    ↓                           ↓
Firestore ←──────────────────┘
```

## Cost Optimization

- **Free Tier**: Railway provides $5/month free credit
- **Usage**: This app uses ~1GB RAM and minimal CPU
- **Estimated Cost**: Should stay within free tier for development/testing
- **Production**: Upgrade to Hobby plan ($5/month) for better reliability

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Test health endpoint
3. ✅ Test chat functionality
4. ✅ Test itinerary editing
5. ✅ Test cost research
6. 🔄 Set up custom domain (optional)
7. 🔄 Enable automatic deployments from GitHub
8. 🔄 Set up monitoring/alerts

## Support

See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for detailed documentation and troubleshooting.
