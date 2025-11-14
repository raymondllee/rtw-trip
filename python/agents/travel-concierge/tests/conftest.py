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

"""Shared pytest fixtures and utilities for agent testing."""

import pytest
from dotenv import load_dotenv
from google.adk.agents.invocation_context import InvocationContext
from google.adk.artifacts import InMemoryArtifactService
from google.adk.sessions import InMemorySessionService
from google.adk.tools import ToolContext
from google.genai.types import Content, Part


@pytest.fixture(scope="session", autouse=True)
def load_env():
    """Load environment variables from .env file."""
    load_dotenv()


@pytest.fixture(scope="session")
def session_service():
    """Create a shared session service for all tests."""
    return InMemorySessionService()


@pytest.fixture(scope="session")
def artifact_service():
    """Create a shared artifact service for all tests."""
    return InMemoryArtifactService()


@pytest.fixture
def test_session(session_service):
    """Create a test session for each test."""
    return session_service.create_session_sync(
        app_name="Travel_Concierge",
        user_id="test_user",
    )


@pytest.fixture
def invocation_context(session_service, test_session):
    """Create an invocation context for testing agents."""
    from travel_concierge.agent import root_agent
    return InvocationContext(
        session_service=session_service,
        invocation_id="test_invocation",
        agent=root_agent,
        session=test_session,
    )


@pytest.fixture
def tool_context(invocation_context):
    """Create a tool context for testing tools."""
    return ToolContext(invocation_context=invocation_context)


@pytest.fixture
def sample_itinerary():
    """Sample itinerary data for testing."""
    return {
        "locations": [
            {
                "id": "tokyo-001",
                "name": "Tokyo",
                "city": "Tokyo",
                "country": "Japan",
                "region": "Asia",
                "arrival_date": "2026-07-01",
                "departure_date": "2026-07-08",
                "duration_days": 7,
                "activity_type": "cultural",
                "coordinates": {"lat": 35.6762, "lng": 139.6503},
            },
            {
                "id": "bangkok-002",
                "name": "Bangkok",
                "city": "Bangkok",
                "country": "Thailand",
                "region": "Southeast Asia",
                "arrival_date": "2026-07-08",
                "departure_date": "2026-07-15",
                "duration_days": 7,
                "activity_type": "cultural",
                "coordinates": {"lat": 13.7563, "lng": 100.5018},
            },
        ],
        "trip": {
            "start_date": "2026-07-01",
            "end_date": "2026-12-24",
            "leg_name": "all",
        },
    }


@pytest.fixture
def sample_user_profile():
    """Sample user profile for testing."""
    return {
        "passport_nationality": "US Citizen",
        "seat_preference": "window",
        "food_preference": "vegan",
        "allergies": [],
        "home": {
            "address": "San Francisco, CA",
            "local_prefer_mode": "drive",
        },
    }


def create_user_message(text: str) -> Content:
    """Helper function to create a user message."""
    return Content(role="user", parts=[Part(text=text)])


def create_agent_state(itinerary=None, user_profile=None, **kwargs):
    """Helper function to create agent state for testing."""
    state = {}
    if itinerary:
        state["itinerary"] = itinerary
    if user_profile:
        state["user_profile"] = user_profile
    state.update(kwargs)
    return state


def extract_function_calls(events):
    """Extract all function calls from events.
    
    Args:
        events: List of events from runner
        
    Returns:
        List of function call objects with name and args
    """
    function_calls = []
    for event in events:
        if not hasattr(event, 'content') or not event.content:
            continue
        
        # Check parts for function calls (this is the standard ADK pattern)
        if hasattr(event.content, 'parts'):
            for part in event.content.parts:
                # Function call is an attribute on the part
                func_call = getattr(part, 'function_call', None)
                if func_call:
                    # Extract name and args from function call object
                    name = getattr(func_call, 'name', None)
                    args = getattr(func_call, 'args', None)
                    author = getattr(event, 'author', None) or 'unknown'
                    
                    # Handle args - could be dict or object
                    if args is not None:
                        if hasattr(args, '__dict__'):
                            args_dict = args.__dict__
                        elif isinstance(args, dict):
                            args_dict = args
                        else:
                            # Try to convert to dict
                            try:
                                args_dict = dict(args) if hasattr(args, 'items') else {}
                            except:
                                args_dict = {}
                    else:
                        args_dict = {}
                    
                    function_calls.append({
                        'name': name,
                        'args': args_dict,
                        'author': author,
                    })
        
        # Also check top-level function call (some events may have it there)
        top_level_call = getattr(event, 'function_call', None)
        if top_level_call:
            name = getattr(top_level_call, 'name', None)
            args = getattr(top_level_call, 'args', None)
            author = getattr(event, 'author', None) or 'unknown'
            
            if args is not None:
                if hasattr(args, '__dict__'):
                    args_dict = args.__dict__
                elif isinstance(args, dict):
                    args_dict = args
                else:
                    args_dict = {}
            else:
                args_dict = {}
            
            function_calls.append({
                'name': name,
                'args': args_dict,
                'author': author,
            })
    
    return function_calls


def extract_agent_transfers(events):
    """Extract agent transfer calls from events.
    
    Args:
        events: List of events from runner
        
    Returns:
        List of agent names that were transferred to
    """
    function_calls = extract_function_calls(events)
    transfers = []
    for call in function_calls:
        if call['name'] == 'transfer_to_agent':
            agent_name = None
            args = call.get('args', {})
            if isinstance(args, dict):
                agent_name = args.get('agent_name')
            elif hasattr(args, 'agent_name'):
                agent_name = args.agent_name
            if agent_name:
                transfers.append(agent_name)
    return transfers


def extract_tool_calls(events, tool_name=None):
    """Extract tool calls from events.
    
    Args:
        events: List of events from runner
        tool_name: Optional tool name to filter by
        
    Returns:
        List of tool call objects
    """
    function_calls = extract_function_calls(events)
    tool_calls = []
    for call in function_calls:
        name = call.get('name')
        # Tool calls are function calls that aren't transfers
        if name and name != 'transfer_to_agent':
            if tool_name is None or name == tool_name:
                tool_calls.append(call)
    return tool_calls


def get_agent_authors(events):
    """Get list of agents that produced events.
    
    Args:
        events: List of events from runner
        
    Returns:
        Set of agent names that authored events
    """
    authors = set()
    for event in events:
        author = getattr(event, 'author', None)
        if author:
            authors.add(author)
    return authors

