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

"""Simple evaluation tests with trace capture."""

import asyncio
import pathlib

import dotenv
import pytest

from eval.simple_trace_capture import SimpleTraceCapture, print_trace_summary


@pytest.fixture(scope="session", autouse=True)
def load_env():
    dotenv.load_dotenv()


@pytest.mark.asyncio
async def test_inspire_americas_trace():
    """Test inspiration for Americas with trace capture."""
    capture = SimpleTraceCapture()
    
    trace = await capture.capture_conversation(
        test_name="test_inspire_americas",
        user_messages=["Inspire me about the Americas"],
        initial_state={
            "user_profile": {
                "passport_nationality": "US Citizen",
                "seat_preference": "window",
                "food_preference": "vegan",
            }
        },
    )
    
    trace_file = capture.save_trace(trace)
    print(f"\n💾 Trace saved to: {trace_file}")
    print_trace_summary(trace, verbose=False)


@pytest.mark.asyncio
async def test_itinerary_add_trace():
    """Test adding destination with trace capture."""
    capture = SimpleTraceCapture()
    
    trace = await capture.capture_conversation(
        test_name="test_itinerary_add",
        user_messages=["Add Kyoto to my itinerary for 3 days"],
        initial_state={
            "web_session_id": "test_session_123",
            "itinerary": {
                "locations": [
                    {"id": "tokyo-001", "name": "Tokyo", "city": "Tokyo", "country": "Japan", "duration_days": 7}
                ]
            }
        },
    )
    
    trace_file = capture.save_trace(trace)
    print(f"\n💾 Trace saved to: {trace_file}")
    print_trace_summary(trace, verbose=False)


@pytest.mark.asyncio
async def test_cost_research_trace():
    """Test cost research with trace capture."""
    capture = SimpleTraceCapture()
    
    trace = await capture.capture_conversation(
        test_name="test_cost_research",
        user_messages=["Research costs for Tokyo, Japan for 7 days, mid-range, 2 people"],
        initial_state={
            "destination_id": "tokyo-001",
            "destination_name": "Tokyo, Japan",
            "duration_days": 7,
            "num_travelers": 2,
            "travel_style": "mid-range",
        },
    )
    
    trace_file = capture.save_trace(trace)
    print(f"\n💾 Trace saved to: {trace_file}")
    print_trace_summary(trace, verbose=False)

