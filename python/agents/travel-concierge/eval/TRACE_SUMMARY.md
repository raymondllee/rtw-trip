# Evaluation Trace Summary

## ✅ Trace Capture System is Working!

You can now easily review evaluation traces - all prompts, responses, and tool calls from LLM evaluations.

## Quick Start

### 1. Run Evaluation with Trace Capture

```bash
# Run a test with trace capture
poetry run pytest eval/test_simple_trace.py::test_inspire_americas_trace -v -s
```

**Output:**
- ✅ Trace saved to `eval/traces/test_inspire_americas_*.json`
- ✅ Summary printed to console
- ✅ All prompts, responses, and tool calls captured

### 2. View Traces

```bash
# List all available traces
poetry run python eval/view_traces.py -l

# View a specific trace
poetry run python eval/view_traces.py eval/traces/test_inspire_americas_*.json

# View with full content (not truncated)
poetry run python eval/view_traces.py eval/traces/test_inspire_americas_*.json -v
```

## What's Captured

Each trace file contains:

1. **User Messages** - All prompts sent to the agent
2. **Agent Responses** - All responses from the agent
3. **Tool Calls** - All function/tool calls made by the agent
   - Tool name (e.g., `transfer_to_agent`, `add_destination`)
   - Tool arguments
4. **Tool Responses** - Responses from tools
5. **Event Sequence** - Complete flow of the conversation
6. **Initial State** - Session state at the start

## Example Trace Output

```
================================================================================
EVALUATION TRACE: test_inspire_americas
================================================================================
Test Name: test_inspire_americas
Timestamp: 2025-11-07T23:08:06.290891+00:00

📝 Conversations: 1

────────────────────────────────────────────────────────────────────────────────
Turn 1: Inspire me about the Americas...
Events: 6
  🔧 Tool Call: transfer_to_agent({"agent_name": "inspiration_agent"})
  ✅ Tool Response: transfer_to_agent
  🔧 Tool Call: place_agent({"request": "Americas"})
  ✅ Tool Response: place_agent
  [root_agent]: (text response)
  [inspiration_agent]: (text response)
```

## Available Tests

### Current Tests with Trace Capture

1. **test_inspire_americas_trace** - Inspiration for Americas
2. **test_itinerary_add_trace** - Adding destination to itinerary
3. **test_cost_research_trace** - Cost research functionality

### Run All Trace Tests

```bash
poetry run pytest eval/test_simple_trace.py -v -s
```

## Trace Files Location

All traces are saved to:
```
eval/traces/
```

Files are named:
```
{test_name}_{timestamp}.json
```

Example:
```
test_inspire_americas_2025-11-07T23-08-06-290891-00-00.json
```

## What You Can See in Traces

### 1. Prompts Sent to LLM
- Exact user messages
- Initial state/context

### 2. LLM Responses
- Full agent responses
- Text output from each agent

### 3. Tool Calls
- Which tools were called
- Tool arguments
- Tool responses

### 4. Agent Routing
- Which sub-agents were called
- How requests were delegated
- Transfer flow between agents

### 5. Complete Flow
- Full conversation sequence
- All intermediate steps
- Event-by-event breakdown

## Use Cases

### 1. Debugging Failed Tests
- See exactly what happened
- Identify where things went wrong
- Understand agent behavior

### 2. Understanding Agent Behavior
- See how agent routes requests
- Understand tool usage patterns
- Review decision-making process

### 3. Improving Prompts
- See how prompts are interpreted
- Identify areas for improvement
- Test prompt variations

### 4. Comparing Runs
- Run same test multiple times
- Compare traces to see variability
- Identify consistency issues

## Tips

1. **Use `-s` flag** with pytest to see trace summaries in console
2. **Use `-v` flag** with view_traces.py to see full content
3. **Save traces** for comparison over time
4. **Review traces** after test failures
5. **Use traces** to improve prompts and test scenarios

## Next Steps

1. ✅ Trace capture is working
2. ✅ Trace viewer is working
3. 📝 Add more test scenarios
4. 📝 Integrate with CI/CD
5. 📝 Add trace comparison tools

## Files Created

1. **`eval/simple_trace_capture.py`** - Trace capture implementation
2. **`eval/test_simple_trace.py`** - Tests with trace capture
3. **`eval/view_traces.py`** - Trace viewer tool
4. **`eval/TRACE_GUIDE.md`** - Detailed guide
5. **`eval/TRACE_SUMMARY.md`** - This summary

## Example: Full Workflow

```bash
# 1. Run evaluation with trace
poetry run pytest eval/test_simple_trace.py::test_inspire_americas_trace -v -s

# Output shows:
# 💾 Trace saved to: eval/traces/test_inspire_americas_2025-11-07T23-08-06.json
# [Summary printed to console]

# 2. View the trace
poetry run python eval/view_traces.py eval/traces/test_inspire_americas_*.json

# 3. View with full details
poetry run python eval/view_traces.py eval/traces/test_inspire_americas_*.json -v

# 4. List all traces
poetry run python eval/view_traces.py -l
```

## Conclusion

You now have a complete trace capture system that:
- ✅ Captures all prompts and responses
- ✅ Shows tool calls and responses
- ✅ Displays complete conversation flow
- ✅ Saves traces for later review
- ✅ Provides easy-to-read summaries

This makes it easy to review and understand what happened during evaluations!

