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

"""Evaluation tests with trace capture for easy review."""

import pathlib

import dotenv
from google.adk.evaluation import AgentEvaluator
import pytest

from eval.trace_capture import EvaluationTraceCapture, print_trace_summary


@pytest.fixture(scope="session", autouse=True)
def load_env():
    dotenv.load_dotenv()


@pytest.fixture(scope="function")
def trace_capture():
    """Create a trace capture instance for each test."""
    capture = EvaluationTraceCapture()
    yield capture
    # Save trace after test completes
    if capture.current_trace:
        trace_file = capture.save_trace()
        print(f"\n💾 Trace saved to: {trace_file}")
        print_trace_summary(capture.current_trace)


@pytest.mark.asyncio
async def test_inspire_americas_with_trace(trace_capture):
    """Test inspiration for Americas with trace capture."""
    test_data_file = pathlib.Path(__file__).parent / "data/inspire.test.json"
    
    eval_result = await AgentEvaluator.evaluate(
        "travel_concierge",
        str(test_data_file),
        num_runs=1  # Use 1 run for faster trace generation
    )
    
    trace = trace_capture.capture_evaluation(
        test_name="test_inspire_americas",
        eval_set_id="inspire-americas-trace",
        eval_result=eval_result,
        test_data_file=str(test_data_file),
    )
    
    print_trace_summary(trace)


@pytest.mark.asyncio
async def test_itinerary_add_with_trace(trace_capture):
    """Test itinerary add destination with trace capture."""
    test_data_file = pathlib.Path(__file__).parent / "data/itinerary_editing.test.json"
    
    eval_result = await AgentEvaluator.evaluate(
        "travel_concierge",
        str(test_data_file),
        num_runs=1
    )
    
    trace = trace_capture.capture_evaluation(
        test_name="test_itinerary_add_destination",
        eval_set_id="itinerary-add-trace",
        eval_result=eval_result,
        test_data_file=str(test_data_file),
    )
    
    print_trace_summary(trace)


@pytest.mark.asyncio
async def test_cost_research_with_trace(trace_capture):
    """Test cost research with trace capture."""
    test_data_file = pathlib.Path(__file__).parent / "data/cost_research.test.json"
    
    eval_result = await AgentEvaluator.evaluate(
        "travel_concierge",
        str(test_data_file),
        num_runs=1
    )
    
    trace = trace_capture.capture_evaluation(
        test_name="test_cost_research",
        eval_set_id="cost-research-trace",
        eval_result=eval_result,
        test_data_file=str(test_data_file),
    )
    
    print_trace_summary(trace)

