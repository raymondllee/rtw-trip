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

"""Capture and display evaluation traces - prompts, responses, and tool calls."""

import json
import pathlib
from datetime import datetime
from typing import Any, Dict, List, Optional, Any as EvalResult
from google.adk.evaluation import AgentEvaluator


class EvaluationTraceCapture:
    """Capture evaluation traces for easy review."""
    
    def __init__(self, output_dir: Optional[pathlib.Path] = None):
        """Initialize trace capture.
        
        Args:
            output_dir: Directory to save trace files. Defaults to eval/traces/
        """
        if output_dir is None:
            output_dir = pathlib.Path(__file__).parent / "traces"
        self.output_dir = output_dir
        self.output_dir.mkdir(exist_ok=True)
        
        self.current_trace: Optional[Dict[str, Any]] = None
        self.traces: List[Dict[str, Any]] = []
    
    def capture_evaluation(
        self,
        test_name: str,
        eval_set_id: str,
        eval_result: Any,
        test_data_file: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Capture an evaluation result as a trace.
        
        Args:
            test_name: Name of the test
            eval_set_id: Evaluation set ID
            eval_result: Result from AgentEvaluator.evaluate
            test_data_file: Path to test data file
            
        Returns:
            Trace dictionary with all evaluation details
        """
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        trace = {
            "test_name": test_name,
            "eval_set_id": eval_set_id,
            "timestamp": timestamp,
            "test_data_file": str(test_data_file) if test_data_file else None,
            "overall_status": eval_result.overall_eval_status.name if hasattr(eval_result.overall_eval_status, 'name') else str(eval_result.overall_eval_status),
            "metrics": self._extract_metrics(eval_result),
            "eval_cases": self._extract_eval_cases(eval_result),
        }
        
        self.current_trace = trace
        self.traces.append(trace)
        
        return trace
    
    def _extract_metrics(self, eval_result: Any) -> Dict[str, Any]:
        """Extract metrics from evaluation result."""
        metrics = {}
        
        # Try to extract common metrics
        if hasattr(eval_result, 'tool_trajectory_avg_score'):
            metrics['tool_trajectory_avg_score'] = eval_result.tool_trajectory_avg_score
        if hasattr(eval_result, 'response_quality_score'):
            metrics['response_quality_score'] = eval_result.response_quality_score
        if hasattr(eval_result, 'overall_score'):
            metrics['overall_score'] = eval_result.overall_score
        
        # Extract any other attributes
        for attr in dir(eval_result):
            if not attr.startswith('_') and attr not in ['overall_eval_status']:
                try:
                    value = getattr(eval_result, attr)
                    if not callable(value) and not isinstance(value, type):
                        metrics[attr] = str(value) if not isinstance(value, (str, int, float, bool, type(None))) else value
                except:
                    pass
        
        return metrics
    
    def _extract_eval_cases(self, eval_result: Any) -> List[Dict[str, Any]]:
        """Extract evaluation cases with conversations."""
        eval_cases = []
        
        # Try to extract eval cases from result
        if hasattr(eval_result, 'eval_cases'):
            for case in eval_result.eval_cases:
                case_data = {
                    "eval_id": getattr(case, 'eval_id', None),
                    "status": getattr(case, 'status', None),
                    "conversations": self._extract_conversations(case),
                }
                eval_cases.append(case_data)
        elif hasattr(eval_result, 'results'):
            # Alternative structure
            for result in eval_result.results:
                case_data = {
                    "eval_id": getattr(result, 'eval_id', None),
                    "conversations": self._extract_conversations(result),
                }
                eval_cases.append(case_data)
        
        return eval_cases
    
    def _extract_conversations(self, case: Any) -> List[Dict[str, Any]]:
        """Extract conversation traces from an eval case."""
        conversations = []
        
        # Try different ways to access conversation data
        if hasattr(case, 'conversation'):
            conv_data = case.conversation
        elif hasattr(case, 'conversations'):
            conv_data = case.conversations
        elif hasattr(case, 'actual_conversation'):
            conv_data = case.actual_conversation
        else:
            return conversations
        
        if isinstance(conv_data, list):
            for turn in conv_data:
                turn_data = self._extract_turn(turn)
                if turn_data:
                    conversations.append(turn_data)
        elif hasattr(conv_data, '__iter__'):
            for turn in conv_data:
                turn_data = self._extract_turn(turn)
                if turn_data:
                    conversations.append(turn_data)
        
        return conversations
    
    def _extract_turn(self, turn: Any) -> Optional[Dict[str, Any]]:
        """Extract a single conversation turn."""
        turn_data = {}
        
        # Extract user message
        if hasattr(turn, 'user_content'):
            turn_data['user_message'] = self._extract_text(turn.user_content)
        elif hasattr(turn, 'user_message'):
            turn_data['user_message'] = self._extract_text(turn.user_message)
        
        # Extract agent response
        if hasattr(turn, 'final_response'):
            turn_data['agent_response'] = self._extract_text(turn.final_response)
        elif hasattr(turn, 'agent_response'):
            turn_data['agent_response'] = self._extract_text(turn.agent_response)
        elif hasattr(turn, 'response'):
            turn_data['agent_response'] = self._extract_text(turn.response)
        
        # Extract tool calls
        tool_calls = []
        if hasattr(turn, 'intermediate_data'):
            if hasattr(turn.intermediate_data, 'tool_uses'):
                tool_calls = self._extract_tool_calls(turn.intermediate_data.tool_uses)
            elif isinstance(turn.intermediate_data, dict) and 'tool_uses' in turn.intermediate_data:
                tool_calls = self._extract_tool_calls(turn.intermediate_data['tool_uses'])
        elif hasattr(turn, 'tool_calls'):
            tool_calls = self._extract_tool_calls(turn.tool_calls)
        
        if tool_calls:
            turn_data['tool_calls'] = tool_calls
        
        # Extract tool responses
        tool_responses = []
        if hasattr(turn, 'tool_responses'):
            tool_responses = self._extract_tool_responses(turn.tool_responses)
        elif hasattr(turn, 'intermediate_data'):
            if hasattr(turn.intermediate_data, 'tool_responses'):
                tool_responses = self._extract_tool_responses(turn.intermediate_data.tool_responses)
        
        if tool_responses:
            turn_data['tool_responses'] = tool_responses
        
        return turn_data if turn_data else None
    
    def _extract_text(self, content: Any) -> str:
        """Extract text from content object."""
        if isinstance(content, str):
            return content
        elif isinstance(content, dict):
            if 'text' in content:
                return content['text']
            elif 'parts' in content:
                texts = []
                for part in content['parts']:
                    if isinstance(part, dict) and 'text' in part:
                        texts.append(part['text'])
                    elif isinstance(part, str):
                        texts.append(part)
                return '\n'.join(texts)
        elif hasattr(content, 'text'):
            return content.text
        elif hasattr(content, 'parts'):
            texts = []
            for part in content.parts:
                if hasattr(part, 'text'):
                    texts.append(part.text)
                elif isinstance(part, str):
                    texts.append(part)
            return '\n'.join(texts)
        
        return str(content)
    
    def _extract_tool_calls(self, tool_uses: Any) -> List[Dict[str, Any]]:
        """Extract tool call information."""
        tool_calls = []
        
        if not tool_uses:
            return tool_calls
        
        if isinstance(tool_uses, list):
            for tool_use in tool_uses:
                if isinstance(tool_use, dict):
                    tool_calls.append({
                        "name": tool_use.get('name', 'unknown'),
                        "args": tool_use.get('args', {}),
                    })
                elif hasattr(tool_use, 'name'):
                    tool_calls.append({
                        "name": tool_use.name,
                        "args": getattr(tool_use, 'args', {}),
                    })
        
        return tool_calls
    
    def _extract_tool_responses(self, tool_responses: Any) -> List[Dict[str, Any]]:
        """Extract tool response information."""
        responses = []
        
        if not tool_responses:
            return responses
        
        if isinstance(tool_responses, list):
            for resp in tool_responses:
                if isinstance(resp, dict):
                    responses.append({
                        "name": resp.get('name', 'unknown'),
                        "response": resp.get('response', {}),
                    })
                elif hasattr(resp, 'name'):
                    responses.append({
                        "name": resp.name,
                        "response": getattr(resp, 'response', {}),
                    })
        
        return responses
    
    def save_trace(self, trace: Optional[Dict[str, Any]] = None) -> pathlib.Path:
        """Save trace to file.
        
        Args:
            trace: Trace to save. If None, saves current_trace.
            
        Returns:
            Path to saved trace file
        """
        if trace is None:
            trace = self.current_trace
        
        if trace is None:
            raise ValueError("No trace to save")
        
        # Create filename from test name and timestamp
        test_name = trace.get('test_name', 'unknown')
        timestamp = trace.get('timestamp', datetime.utcnow().isoformat())
        safe_name = "".join(c for c in test_name if c.isalnum() or c in ('-', '_'))
        filename = f"{safe_name}_{timestamp.replace(':', '-').replace('.', '-')}.json"
        filepath = self.output_dir / filename
        
        with open(filepath, 'w') as f:
            json.dump(trace, f, indent=2)
        
        return filepath
    
    def save_all_traces(self) -> pathlib.Path:
        """Save all captured traces to a single file.
        
        Returns:
            Path to saved trace file
        """
        timestamp = datetime.utcnow().isoformat().replace(':', '-').replace('.', '-')
        filename = f"all_traces_{timestamp}.json"
        filepath = self.output_dir / filename
        
        with open(filepath, 'w') as f:
            json.dump({
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "total_traces": len(self.traces),
                "traces": self.traces,
            }, f, indent=2)
        
        return filepath


def print_trace_summary(trace: Dict[str, Any]):
    """Print a human-readable summary of a trace."""
    print("\n" + "=" * 80)
    print(f"EVALUATION TRACE: {trace.get('test_name', 'Unknown')}")
    print("=" * 80)
    print(f"Test: {trace.get('test_name')}")
    print(f"Status: {trace.get('overall_status')}")
    print(f"Timestamp: {trace.get('timestamp')}")
    
    metrics = trace.get('metrics', {})
    if metrics:
        print("\nMetrics:")
        for key, value in metrics.items():
            print(f"  {key}: {value}")
    
    eval_cases = trace.get('eval_cases', [])
    print(f"\nEvaluation Cases: {len(eval_cases)}")
    
    for i, case in enumerate(eval_cases, 1):
        print(f"\n--- Case {i}: {case.get('eval_id', 'Unknown')} ---")
        conversations = case.get('conversations', [])
        
        for j, conv in enumerate(conversations, 1):
            print(f"\n  Turn {j}:")
            if 'user_message' in conv:
                print(f"    User: {conv['user_message'][:200]}...")
            if 'agent_response' in conv:
                print(f"    Agent: {conv['agent_response'][:200]}...")
            if 'tool_calls' in conv:
                print(f"    Tool Calls: {len(conv['tool_calls'])}")
                for tool_call in conv['tool_calls']:
                    print(f"      - {tool_call.get('name', 'unknown')}({tool_call.get('args', {})})")
    
    print("\n" + "=" * 80)

