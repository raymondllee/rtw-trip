# How to Access Railway Deployment Logs

## Problem
When debugging issues with the deployed application (like the Kuala Lumpur cost research error), you need to view the server logs from Railway to see diagnostic output.

## Methods to Access Railway Logs

### Option 1: Railway Dashboard (Recommended)

1. **Go to Railway Dashboard**: https://railway.app/
2. **Select your project**: "rtw-trip" or your project name
3. **Click on the service**: Usually "travel-concierge" or "api-server"
4. **Click on "Deployments"** tab
5. **Select the active deployment** (usually the most recent one)
6. **Click "View Logs"** or the logs tab
7. **Search for relevant keywords**:
   - Search for "Kuala Lumpur" or the destination name
   - Search for "[ERROR]" to find errors
   - Search for "⚠️" to find warnings
   - Search for "[DEBUG]" to see detailed diagnostic info

### Option 2: Railway CLI

If you have the Railway CLI installed:

```bash
# Install Railway CLI (if not installed)
npm i -g @railway/cli

# Login to Railway
railway login

# Link your project
railway link

# View logs in real-time
railway logs

# Or tail logs for a specific service
railway logs --service <service-name>
```

### Option 3: API (for programmatic access)

You can use Railway's API to fetch logs:

```bash
curl -H "Authorization: Bearer $RAILWAY_TOKEN" \
  https://backboard.railway.app/graphql/v2 \
  -d '{"query": "{ deploymentLogs(deploymentId: \"your-deployment-id\") { message timestamp } }"}'
```

## What to Look For

### For the Kuala Lumpur Error

When you access the logs, look for these patterns:

1. **Request initiated**:
   ```
   🔍 Triggering cost research for: Kuala Lumpur
   ```

2. **ADK API response status**:
   ```
   [DEBUG] ADK API Response Status: 200
   ```
   If this is not 200, there's an API error.

3. **Event processing**:
   ```
   [DEBUG] Event #1: keys=[...]
   [DEBUG] Event #2: keys=[...]
   ...
   ```
   This shows how many events were received from the ADK API.

4. **Tool calls detection**:
   ```
   [DEBUG] Found function_call in part: google_search_grounding
   [DEBUG] Found function_call in part: DestinationCostResearch
   ```
   If you don't see `DestinationCostResearch`, the agent didn't return structured data.

5. **Final diagnostic**:
   ```
   [DEBUG] After streaming: research_result is NOT SET
   [DEBUG] After streaming: save_tool_called=False
   [DEBUG] After streaming: response_text length=0
   ```
   This tells you exactly what failed.

6. **Error messages**:
   ```
   ⚠️ Cost research returned no structured data for Kuala Lumpur
   [ERROR] Diagnostic info:
     - research_result: False
     - save_tool_called: False
     - saved_via_server: False
     - cost_items_created: 0
     - response_text length: 0
     - response_text content: EMPTY
   ```

## Common Issues and Solutions

### Issue 1: Empty response_text
**Symptoms**: `response_text length: 0`, no events processed
**Possible causes**:
- ADK API timeout
- Network issue
- Agent failed to start
**Solution**: Check ADK API status, verify network connectivity

### Issue 2: No DestinationCostResearch tool call
**Symptoms**: Agent returns text but no structured data
**Possible causes**:
- Agent confused by prompt
- Tool validation failed
- Agent hallucinated instead of using tools
**Solution**: Check agent prompt, verify tool configuration

### Issue 3: Tool call but no response
**Symptoms**: `function_call` found but `function_response` missing
**Possible causes**:
- Tool execution failed
- Google search quota exceeded
- Network timeout during tool execution
**Solution**: Check tool logs, verify API quotas

## Enhanced Logging (Recent Changes)

The latest deployment includes enhanced logging that will show:

1. **HTTP status codes** from ADK API
2. **Event counts** - how many SSE events were processed
3. **Response text preview** - first 500 chars of agent response
4. **Detailed diagnostic info** - all variables when research fails
5. **Debug info in JSON response** - visible in browser console

These logs will help identify exactly where the process is failing.

## Example: Debugging the Kuala Lumpur Issue

Here's what you should do:

1. **Access Railway logs** using Option 1 (Dashboard)
2. **Search for "Kuala Lumpur"** in the logs
3. **Find the request** starting with `🔍 Triggering cost research for: Kuala Lumpur`
4. **Read the subsequent log lines** to see:
   - ADK API response status
   - Number of events processed
   - Whether tools were called
   - Final diagnostic info
5. **Copy the relevant logs** and share them for analysis

## If Logs Are Not Showing Up

If you don't see detailed logs in Railway:

1. **Check Railway service settings**:
   - Ensure the service is using the latest deployment
   - Verify environment variables are set correctly

2. **Check if stdout is being captured**:
   - Railway should capture all `print()` statements
   - Verify logging configuration in `start.sh`

3. **Trigger a new request**:
   - Try the cost research again
   - Watch the logs in real-time

## Next Steps

After reviewing the Railway logs:

1. **Share the relevant log snippet** (starting from "🔍 Triggering cost research" to "⚠️ Cost research returned no structured data")
2. **Note the debug_info** from the JSON response in browser console
3. **Check if similar issues** occur with other destinations

This will help pinpoint whether it's:
- A specific issue with Kuala Lumpur
- A general problem with the cost research agent
- A configuration or deployment issue
