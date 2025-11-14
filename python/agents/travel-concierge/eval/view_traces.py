#!/usr/bin/env python3
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""View evaluation traces in a human-readable format."""

import argparse
import json
import pathlib
import sys
from typing import Dict, Any


def print_trace(trace: Dict[str, Any], verbose: bool = False):
    """Print a trace in human-readable format."""
    print("\n" + "=" * 80)
    print(f"EVALUATION TRACE: {trace.get('test_name', 'Unknown')}")
    print("=" * 80)
    print(f"Test Name: {trace.get('test_name')}")
    print(f"Timestamp: {trace.get('timestamp')}")
    
    # Handle both formats: eval_cases (from AgentEvaluator) or conversations (from SimpleTraceCapture)
    conversations = trace.get('conversations', [])
    eval_cases = trace.get('eval_cases', [])
    
    if conversations:
        # Simple trace format
        print(f"\n📝 Conversations: {len(conversations)}")
        
        for i, conv in enumerate(conversations, 1):
            print(f"\n{'─' * 80}")
            print(f"Turn {i}: {conv.get('user_message', 'Unknown')[:60]}...")
            
            events = conv.get('events', [])
            print(f"Events: {len(events)}")
            
            for j, event in enumerate(events, 1):
                author = event.get('author', 'unknown')
                content = event.get('content', {})
                
                # Print text response
                if 'text' in content:
                    text = content['text']
                    print(f"\n  [{author}]: {text[:200]}{'...' if len(text) > 200 else ''}")
                
                # Print function calls
                if 'parts' in content:
                    for part in content['parts']:
                        if 'function_call' in part:
                            func_call = part['function_call']
                            print(f"  🔧 Tool Call: {func_call.get('name')}({json.dumps(func_call.get('args', {}), indent=2)})")
                        if 'function_response' in part:
                            func_resp = part['function_response']
                            print(f"  ✅ Tool Response: {func_resp.get('name')}")
                            if verbose:
                                resp_data = func_resp.get('response', {})
                                print(f"     Response: {json.dumps(resp_data, indent=6)[:500]}...")
    
    elif eval_cases:
        # AgentEvaluator format
        print(f"\n📝 Evaluation Cases: {len(eval_cases)}")
        
        for i, case in enumerate(eval_cases, 1):
            print(f"\n{'─' * 80}")
            print(f"Case {i}: {case.get('eval_id', 'Unknown')}")
            if case.get('status'):
                print(f"Status: {case.get('status')}")
            
            case_conversations = case.get('conversations', [])
            print(f"Conversation Turns: {len(case_conversations)}")
            
            for j, conv in enumerate(case_conversations, 1):
                print(f"\n  🔄 Turn {j}:")
                
                if 'user_message' in conv:
                    user_msg = conv['user_message']
                    print(f"    👤 User:")
                    if verbose:
                        print(f"      {user_msg}")
                    else:
                        print(f"      {user_msg[:200]}{'...' if len(user_msg) > 200 else ''}")
                
                if 'tool_calls' in conv and conv['tool_calls']:
                    print(f"    🔧 Tool Calls ({len(conv['tool_calls'])}):")
                    for tool_call in conv['tool_calls']:
                        tool_name = tool_call.get('name', 'unknown')
                        tool_args = tool_call.get('args', {})
                        print(f"      • {tool_name}")
                        if verbose and tool_args:
                            print(f"        Args: {json.dumps(tool_args, indent=8)}")
                
                if 'tool_responses' in conv and conv['tool_responses']:
                    print(f"    ✅ Tool Responses ({len(conv['tool_responses'])}):")
                    for tool_resp in conv['tool_responses']:
                        tool_name = tool_resp.get('name', 'unknown')
                        print(f"      • {tool_name}")
                        if verbose:
                            resp_data = tool_resp.get('response', {})
                            print(f"        Response: {json.dumps(resp_data, indent=8)[:500]}...")
                
                if 'agent_response' in conv:
                    agent_resp = conv['agent_response']
                    print(f"    🤖 Agent Response:")
                    if verbose:
                        print(f"      {agent_resp}")
                    else:
                        print(f"      {agent_resp[:300]}{'...' if len(agent_resp) > 300 else ''}")
    
    print("\n" + "=" * 80)


def main():
    parser = argparse.ArgumentParser(
        description="View evaluation traces in human-readable format"
    )
    parser.add_argument(
        "trace_file",
        type=pathlib.Path,
        nargs="?",
        help="Path to trace JSON file (optional if using -l)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Show full content (not truncated)"
    )
    parser.add_argument(
        "-l", "--list",
        action="store_true",
        help="List all available trace files"
    )
    
    args = parser.parse_args()
    
    # List traces if requested
    if args.list:
        traces_dir = pathlib.Path(__file__).parent / "traces"
        if traces_dir.exists():
            trace_files = sorted(traces_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
            print(f"\n📁 Available trace files in {traces_dir}:")
            for i, trace_file in enumerate(trace_files, 1):
                print(f"  {i}. {trace_file.name}")
                print(f"     Modified: {datetime.fromtimestamp(trace_file.stat().st_mtime)}")
        else:
            print(f"❌ Traces directory not found: {traces_dir}")
        return
    
    # Require trace_file if not listing
    if not args.trace_file:
        parser.error("trace_file is required unless using -l/--list")
    
    # Load and display trace
    if not args.trace_file.exists():
        print(f"❌ Trace file not found: {args.trace_file}")
        sys.exit(1)
    
    try:
        with open(args.trace_file, 'r') as f:
            data = json.load(f)
        
        # Handle both single trace and all_traces format
        if 'traces' in data:
            # All traces file
            traces = data['traces']
            print(f"\n📊 Found {len(traces)} traces in file")
            for trace in traces:
                print_trace(trace, verbose=args.verbose)
        else:
            # Single trace file
            print_trace(data, verbose=args.verbose)
    
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    from datetime import datetime
    main()

