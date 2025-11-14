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

"""Simple trace capture by running agent directly and capturing events."""

import json
import pathlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.artifacts import InMemoryArtifactService
from google.genai.types import Content, Part

from travel_concierge.agent import root_agent


class SimpleTraceCapture:
    """Capture traces by running agent directly and capturing all events."""
    
    def __init__(self, output_dir: Optional[pathlib.Path] = None):
        """Initialize trace capture.
        
        Args:
            output_dir: Directory to save trace files. Defaults to eval/traces/
        """
        if output_dir is None:
            output_dir = pathlib.Path(__file__).parent / "traces"
        self.output_dir = output_dir
        self.output_dir.mkdir(exist_ok=True)
    
    async def capture_conversation(
        self,
        test_name: str,
        user_messages: List[str],
        initial_state: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Capture a conversation trace.
        
        Args:
            test_name: Name of the test
            user_messages: List of user messages
            initial_state: Initial session state
            
        Returns:
            Trace dictionary with all conversation details
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Set up runner
        session_service = InMemorySessionService()
        artifact_service = InMemoryArtifactService()
        runner = Runner(
            app_name="travel_concierge",
            agent=root_agent,
            artifact_service=artifact_service,
            session_service=session_service,
        )
        
        # Create session
        session = await session_service.create_session(
            state=initial_state or {},
            app_name="travel_concierge",
            user_id="trace_user",
        )
        
        # Capture all events
        all_events = []
        conversations = []
        
        for i, user_message in enumerate(user_messages):
            # Create user message
            message = Content(role="user", parts=[Part(text=user_message)])
            
            # Capture events for this turn
            turn_events = []
            turn_data = {
                "turn_number": i + 1,
                "user_message": user_message,
                "events": [],
            }
            
            async for event in runner.run_async(
                session_id=session.id,
                user_id="trace_user",
                new_message=message,
            ):
                event_data = self._extract_event(event)
                turn_events.append(event_data)
                all_events.append(event_data)
                turn_data["events"].append(event_data)
            
            conversations.append(turn_data)
        
        # Build trace
        trace = {
            "test_name": test_name,
            "timestamp": timestamp,
            "user_messages": user_messages,
            "initial_state": initial_state or {},
            "conversations": conversations,
            "all_events": all_events,
        }
        
        return trace
    
    def _extract_event(self, event: Any) -> Dict[str, Any]:
        """Extract data from an event."""
        event_data = {
            "type": type(event).__name__,
        }
        
        # Extract author
        if hasattr(event, 'author'):
            event_data['author'] = event.author
        
        # Extract content
        if hasattr(event, 'content'):
            content_data = {}
            
            # Extract text
            if hasattr(event.content, 'text') and event.content.text:
                content_data['text'] = event.content.text
            
            # Extract parts
            if hasattr(event.content, 'parts'):
                parts_data = []
                for part in event.content.parts:
                    part_data = {}
                    
                    # Extract text from part
                    if hasattr(part, 'text') and part.text:
                        part_data['text'] = part.text
                    
                    # Extract function call
                    if hasattr(part, 'function_call') and part.function_call:
                        func_call = part.function_call
                        part_data['function_call'] = {
                            'name': getattr(func_call, 'name', None),
                            'args': self._extract_args(getattr(func_call, 'args', None)),
                        }
                    
                    # Extract function response
                    if hasattr(part, 'function_response') and part.function_response:
                        func_resp = part.function_response
                        part_data['function_response'] = {
                            'name': getattr(func_resp, 'name', None),
                            'response': self._extract_response(getattr(func_resp, 'response', None)),
                        }
                    
                    if part_data:
                        parts_data.append(part_data)
                
                if parts_data:
                    content_data['parts'] = parts_data
            
            if content_data:
                event_data['content'] = content_data
        
        return event_data
    
    def _extract_args(self, args: Any) -> Any:
        """Extract arguments from function call."""
        if args is None:
            return {}
        
        if isinstance(args, dict):
            return args
        
        if hasattr(args, '__dict__'):
            return args.__dict__
        
        try:
            return dict(args) if hasattr(args, 'items') else {}
        except:
            return str(args)
    
    def _extract_response(self, response: Any) -> Any:
        """Extract response from function response."""
        if response is None:
            return {}
        
        if isinstance(response, (dict, list, str, int, float, bool)):
            return response
        
        if hasattr(response, '__dict__'):
            return response.__dict__
        
        try:
            return dict(response) if hasattr(response, 'items') else {}
        except:
            return str(response)
    
    def save_trace(self, trace: Dict[str, Any]) -> pathlib.Path:
        """Save trace to file.
        
        Args:
            trace: Trace dictionary
            
        Returns:
            Path to saved trace file
        """
        test_name = trace.get('test_name', 'unknown')
        timestamp = trace.get('timestamp', datetime.now(timezone.utc).isoformat())
        safe_name = "".join(c for c in test_name if c.isalnum() or c in ('-', '_'))
        filename = f"{safe_name}_{timestamp.replace(':', '-').replace('.', '-').replace('+', '-')}.json"
        filepath = self.output_dir / filename
        
        with open(filepath, 'w') as f:
            json.dump(trace, f, indent=2)
        
        return filepath


def print_trace_summary(trace: Dict[str, Any], verbose: bool = False):
    """Print a human-readable summary of a trace."""
    print("\n" + "=" * 80)
    print(f"EVALUATION TRACE: {trace.get('test_name', 'Unknown')}")
    print("=" * 80)
    print(f"Test: {trace.get('test_name')}")
    print(f"Timestamp: {trace.get('timestamp')}")
    
    conversations = trace.get('conversations', [])
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
                        print(f"  🔧 Tool Call: {func_call.get('name')}({func_call.get('args', {})})")
                    if 'function_response' in part:
                        func_resp = part['function_response']
                        print(f"  ✅ Tool Response: {func_resp.get('name')}")
                        if verbose:
                            resp_data = func_resp.get('response', {})
                            print(f"     Response: {json.dumps(resp_data, indent=6)[:500]}...")
    
    print("\n" + "=" * 80)

