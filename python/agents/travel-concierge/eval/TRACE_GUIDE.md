# Evaluation Trace Guide

## Overview

This guide explains how to capture and review evaluation traces - the prompts, responses, and tool calls from LLM evaluations.

## Quick Start

### 1. Run Evaluations with Trace Capture

```bash
# Run a test with trace capture
poetry run pytest eval/test_simple_trace.py::test_inspire_americas_trace -v -s
```

This will:
- Run the evaluation
- Capture all prompts, responses, and tool calls
- Save trace to `eval/traces/` directory
- Print a summary to console

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

### 1. User Messages
- All user prompts sent to the agent
- Full text of each message

### 2. Agent Responses
- All agent responses
- Full text of each response
- Truncated in summary view, full in verbose mode

### 3. Tool Calls
- All tool/function calls made by the agent
- Tool name and arguments
- Example: `transfer_to_agent`, `add_destination`, etc.

### 4. Tool Responses
- Responses from tools
- Tool name and response data

### 5. Event Sequence
- Complete sequence of events
- Shows the flow of the conversation
- Includes all intermediate steps

## Trace File Structure

Each trace file contains:

```json
{
  "test_name": "test_inspire_americas",
  "timestamp": "2025-11-07T23:08:06.290891+00:00",
  "user_messages": ["Inspire me about the Americas"],
  "initial_state": {
    "user_profile": {
      "passport_nationality": "US Citizen",
      "seat_preference": "window",
      "food_preference": "vegan"
    }
  },
  "conversations": [
    {
      "turn_number": 1,
      "user_message": "Inspire me about the Americas",
      "events": [
        {
          "type": "Event",
          "author": "root_agent",
          "content": {
            "parts": [
              {
                "function_call": {
                  "name": "transfer_to_agent",
                  "args": {"agent_name": "inspiration_agent"}
                }
              }
            ]
          }
        },
        {
          "type": "Event",
          "author": "inspiration_agent",
          "content": {
            "text": "Okay, I have a few ideas..."
          }
        }
      ]
    }
  ],
  "all_events": [...]
}
```

## Using Traces

### Debugging Failed Tests

When a test fails, check the trace to see:
1. What prompts were sent
2. What the agent responded
3. What tools were called
4. Why the evaluation failed

### Understanding Agent Behavior

Traces show:
- How the agent routes requests (which sub-agents are called)
- What tools are used for different scenarios
- The full conversation flow
- All intermediate steps

### Improving Prompts

Review traces to:
- See how prompts are interpreted
- Understand agent reasoning (if available)
- Identify areas for prompt improvement

## Examples

### Example 1: Run and View Trace

```bash
# Run evaluation with trace
poetry run pytest eval/test_simple_trace.py::test_inspire_americas_trace -v -s

# Output shows trace summary and file location
# 💾 Trace saved to: eval/traces/test_inspire_americas_2025-11-07T23-08-06.json

# View the trace
poetry run python eval/view_traces.py eval/traces/test_inspire_americas_*.json
```

### Example 2: View All Traces

```bash
# List all traces
poetry run python eval/view_traces.py -l

# View most recent trace
poetry run python eval/view_traces.py eval/traces/$(ls -t eval/traces/*.json | head -1)
```

### Example 3: Compare Traces

```bash
# Run same test multiple times
poetry run pytest eval/test_simple_trace.py::test_inspire_americas_trace -v -s
poetry run pytest eval/test_simple_trace.py::test_inspire_americas_trace -v -s

# Compare the traces to see variability
poetry run python eval/view_traces.py eval/traces/test_inspire_americas_*.json -v
```

## Creating Custom Traces

To create a custom trace:

```python
from eval.simple_trace_capture import SimpleTraceCapture, print_trace_summary

async def my_custom_test():
    capture = SimpleTraceCapture()
    
    trace = await capture.capture_conversation(
        test_name="my_custom_test",
        user_messages=["Your test message here"],
        initial_state={
            "user_profile": {...},
            "itinerary": {...}
        },
    )
    
    trace_file = capture.save_trace(trace)
    print(f"Trace saved to: {trace_file}")
    print_trace_summary(trace, verbose=True)
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

## Tips

1. **Use `-s` flag** with pytest to see trace summaries in console
2. **Use `-v` flag** with view_traces.py to see full content
3. **Save traces** for comparison over time
4. **Review traces** after test failures to understand what happened
5. **Use traces** to improve prompts and test scenarios

## Troubleshooting

### No traces generated
- Make sure `eval/traces/` directory exists (created automatically)
- Check that trace capture is being used in tests

### Trace file is empty
- Check that conversation completed successfully
- Verify agent returned responses

### Can't view trace
- Make sure trace file exists
- Check JSON format is valid
- Try `-v` flag for verbose output
