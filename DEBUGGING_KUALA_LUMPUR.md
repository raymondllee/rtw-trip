# Debugging the Kuala Lumpur Cost Research Failure

## Your Specific Error
```javascript
{
  status: 'partial',
  message: 'Research completed but no structured data returned',
  response_text: '',  // ← EMPTY (0 characters)
  debug_info: {
    has_research_result: false,
    save_tool_called: false,
    saved_via_server: false,
    cost_items_count: 0,
    response_text_length: 0,  // ← EMPTY RESPONSE
    session_id_used: 'cost_research_633e3318242b449f'
  }
}
```

## What This Means

The `response_text_length: 0` indicates that **the ADK API either didn't respond or the agent failed to execute**.

## Step-by-Step Debugging in Railway Logs

### 1. Access Railway Logs
1. Go to https://railway.app/
2. Open your project
3. Click on your service
4. Click "Deployments" → Active deployment → "View Logs"
5. Enable "Auto-scroll" to see logs in real-time

### 2. Search for the Specific Request

Search for: `cost_research_633e3318242b449f`

This is the session_id from your error. You should find logs like this:

#### ✅ What You SHOULD See (Success Path)

```
🔍 Triggering cost research for: Kuala Lumpur
[DEBUG] ADK API Response Status: 200
[DEBUG] Event #1: keys=['content', 'role', 'parts']
[DEBUG] Event #2: keys=['content', 'role', 'parts']
[DEBUG] Found function_call in part: google_search_grounding
[DEBUG] Found function_call in part: google_search_grounding
[DEBUG] Found function_call in part: google_search_grounding
[DEBUG] Found function_response in part: google_search_grounding
[DEBUG] Found function_call in part: DestinationCostResearch
[DEBUG] Set research_result from DestinationCostResearch tool call
[DEBUG] Processed 15 events from ADK API
[DEBUG] After streaming: research_result is SET
✅ Cost research completed for Kuala Lumpur
```

#### ❌ What You're PROBABLY Seeing (Error Path)

**Scenario A: ADK API Not Responding**
```
🔍 Triggering cost research for: Kuala Lumpur
[ERROR] ADK API returned non-200 status: 500, body: ...
```
**OR**
```
🔍 Triggering cost research for: Kuala Lumpur
[DEBUG] ADK API Response Status: 200
[DEBUG] Processed 0 events from ADK API  ← NO EVENTS!
[DEBUG] After streaming: research_result is NOT SET
[DEBUG] After streaming: response_text length=0
⚠️ Cost research returned no structured data for Kuala Lumpur
```

**Scenario B: Agent Failing to Start**
```
🔍 Triggering cost research for: Kuala Lumpur
[DEBUG] ADK API Response Status: 200
[WARNING] Failed to decode JSON from chunk: ...
[DEBUG] Processed 1 events from ADK API
[DEBUG] After streaming: response_text length=0
```

**Scenario C: Vertex AI Permission Error**
```
📡 Starting ADK API server on port 8000...
ERROR: Could not authenticate with Vertex AI
ERROR: Permission denied for project 'your-project-id'
❌ ADK server failed to start
```

### 3. Check ADK Server Startup

Scroll to the **top of your deployment logs** and look for:

```
📡 Starting ADK API server on port 8000...
⏳ Waiting for ADK server to initialize...
✅ ADK server started successfully (PID: 123)
```

#### If ADK Failed to Start:
```
📡 Starting ADK API server on port 8000...
ERROR: [some error message]
❌ ADK server failed to start
```

### 4. Common Error Patterns

#### Error: "Could not load agent 'cost_research_agent'"
**Cause**: Agent module not found or import error
**Log pattern**:
```
ModuleNotFoundError: No module named 'travel_concierge.sub_agents.cost_research'
```
**Solution**: Check PYTHONPATH in start.sh

#### Error: "Vertex AI authentication failed"
**Cause**: Missing or invalid GOOGLE_APPLICATION_CREDENTIALS_JSON
**Log pattern**:
```
google.auth.exceptions.DefaultCredentialsError
```
**Solution**: Verify environment variable in Railway dashboard

#### Error: "Rate limit exceeded" or "Quota exceeded"
**Cause**: Too many Vertex AI API calls
**Log pattern**:
```
google.api_core.exceptions.ResourceExhausted: 429 Quota exceeded
```
**Solution**: Wait or increase quota in Google Cloud Console

#### Error: Agent times out during search
**Cause**: Google Search tool is slow or failing
**Log pattern**:
```
[DEBUG] Found function_call in part: google_search_grounding
[timeout or no response after this]
```
**Solution**: Check google_search_grounding tool logs

### 5. Full Diagnostic Search Queries

Run these searches in Railway logs:

1. **Find the request**: `cost_research_633e3318242b449f`
2. **Check errors**: `ERROR` (filter last 1 hour)
3. **Check ADK status**: `ADK server`
4. **Check agent calls**: `cost_research_agent`
5. **Check tool calls**: `google_search_grounding`
6. **Check Vertex AI**: `Vertex` or `vertexai`

## What to Do Next

### Option 1: Share Logs with Me

Copy the relevant section of logs starting from:
```
🔍 Triggering cost research for: Kuala Lumpur
```
and ending with:
```
⚠️ Cost research returned no structured data for Kuala Lumpur
```

This will show exactly where the process failed.

### Option 2: Quick Fixes to Try

1. **Restart the Railway deployment** (sometimes the ADK server gets stuck)
   - Railway Dashboard → Deployments → Click "⋮" → "Redeploy"

2. **Check environment variables** in Railway:
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` should be set
   - `GOOGLE_CLOUD_PROJECT` should be your GCP project ID
   - `GOOGLE_GENAI_USE_VERTEXAI=1` should be set

3. **Try a different destination** to see if it's specific to Kuala Lumpur:
   - Try Bangkok or Singapore
   - If those work but Kuala Lumpur doesn't, it's a destination-specific issue

4. **Check Google Cloud quotas**:
   - Go to Google Cloud Console
   - Navigate to "APIs & Services" → "Quotas"
   - Check Vertex AI API quotas
   - Look for "429" errors in Railway logs

### Option 3: Enable More Verbose Logging

I can add even more logging if needed. Let me know what the Railway logs show and I can add targeted debugging for the specific failure point.

## Expected Timeline

The enhanced logging I added should make the issue immediately visible in the Railway logs. The diagnostic output will show exactly which of these scenarios is happening:

1. ❌ ADK API not responding → Check ADK server startup
2. ❌ Agent not found → Check PYTHONPATH and imports
3. ❌ Vertex AI auth failed → Check credentials
4. ❌ Tools not executing → Check google_search_grounding
5. ❌ Response not parsed → Check JSON structure

## Quick Test Script (Optional)

If you want to test the ADK API directly, I can create a test script that bypasses Flask and calls ADK directly to isolate the issue.

Would you like me to create that script, or can you share what the Railway logs show for the session ID `cost_research_633e3318242b449f`?
