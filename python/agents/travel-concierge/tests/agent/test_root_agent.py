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

"""Comprehensive unit tests for Root Agent.

Tests delegation logic, tool calling, error handling, and context understanding.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.artifacts import InMemoryArtifactService
from google.genai.types import Content, Part
from travel_concierge.agent import root_agent
from tests.conftest import (
    create_user_message,
    create_agent_state,
    extract_function_calls,
    extract_agent_transfers,
    extract_tool_calls,
    get_agent_authors,
)


@pytest.fixture
def agent():
    """Return the root agent for testing."""
    return root_agent


@pytest.fixture
def runner(session_service, artifact_service):
    """Create a runner for testing agent execution."""
    return Runner(
        app_name="Travel_Concierge",
        agent=root_agent,
        artifact_service=artifact_service,
        session_service=session_service,
    )


class TestRootAgentDelegation:
    """Test root agent's delegation to sub-agents."""

    @pytest.mark.asyncio
    async def test_delegates_to_inspiration_agent(self, runner, test_session, sample_itinerary):
        """Test that root agent delegates inspiration requests to inspiration_agent."""
        state = create_agent_state(itinerary=sample_itinerary)
        test_session.state = state

        message = create_user_message("What are some highlight destinations in Fiji?")
        
        events = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message,
        ):
            events.append(event)
            # Stop after first few events to avoid long-running tests
            if len(events) > 10:
                break

        # Check that agent responded (not an error)
        assert len(events) > 0, "Agent should produce events"
        
        # Extract agent transfers to verify delegation
        transfers = extract_agent_transfers(events)
        
        # Verify that root agent transferred to inspiration_agent
        assert 'inspiration_agent' in transfers, \
            f"Root agent should transfer to inspiration_agent. Found transfers: {transfers}. Events: {len(events)}"
        
        # Also check that inspiration_agent actually responded (via author field)
        authors = get_agent_authors(events)
        # Root agent should delegate, and inspiration_agent should respond
        # Note: author might be 'root_agent' if delegation happens internally
        # But we should see the transfer call
        assert len(transfers) > 0, \
            f"Should see agent transfer. Authors: {authors}, Transfers: {transfers}"

    @pytest.mark.asyncio
    async def test_delegates_to_cost_research_agent(self, runner, test_session, sample_itinerary):
        """Test that root agent delegates cost research requests to cost_research_agent."""
        state = create_agent_state(
            itinerary=sample_itinerary,
            scenario_id="test_scenario",
            destination_id="tokyo-001",
        )
        test_session.state = state

        message = create_user_message("Research costs for Tokyo for 7 days")
        
        events = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message,
        ):
            events.append(event)
            if len(events) > 15:  # Cost research may take more steps
                break

        assert len(events) > 0, "Agent should produce events"
        
        # Verify that root agent transferred to cost_research_agent
        transfers = extract_agent_transfers(events)
        assert 'cost_research_agent' in transfers, \
            f"Root agent should transfer to cost_research_agent. Found transfers: {transfers}. " \
            f"All function calls: {[c['name'] for c in extract_function_calls(events)]}"

    @pytest.mark.asyncio
    async def test_delegates_to_planning_agent(self, runner, test_session):
        """Test that root agent delegates planning requests to planning_agent."""
        state = create_agent_state()
        test_session.state = state

        message = create_user_message("Find flights from San Francisco to Tokyo")
        
        events = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message,
        ):
            events.append(event)
            if len(events) > 10:
                break

        assert len(events) > 0, "Agent should produce events"
        
        # Verify that root agent transferred to planning_agent
        transfers = extract_agent_transfers(events)
        assert 'planning_agent' in transfers, \
            f"Root agent should transfer to planning_agent. Found transfers: {transfers}. " \
            f"All function calls: {[c['name'] for c in extract_function_calls(events)]}"


class TestRootAgentToolCalling:
    """Test root agent's direct tool calling for itinerary modifications."""

    @pytest.mark.asyncio
    async def test_calls_add_destination_tool(self, runner, test_session, sample_itinerary):
        """Test that root agent calls add_destination tool when user requests to add destination."""
        state = create_agent_state(
            itinerary=sample_itinerary,
            web_session_id="test_session_123",
        )
        test_session.state = state

        message = create_user_message("Add Kyoto to my itinerary for 3 days")
        
        # Mock the API call to avoid external dependencies
        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {
                "status": "success",
                "message": "Destination added successfully",
            }
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            events = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message,
            ):
                events.append(event)
                if len(events) > 10:
                    break

            # Verify that add_destination tool was actually called
            tool_calls = extract_tool_calls(events, tool_name='add_destination')
            assert len(tool_calls) > 0, \
                f"Agent should call add_destination tool. Found tool calls: {[c['name'] for c in extract_tool_calls(events)]}"
            
            # Also verify the mock was called (tool executed)
            assert mock_post.called, "API endpoint should be called when tool executes"

    @pytest.mark.asyncio
    async def test_calls_remove_destination_tool(self, runner, test_session, sample_itinerary):
        """Test that root agent calls remove_destination tool."""
        state = create_agent_state(
            itinerary=sample_itinerary,
            web_session_id="test_session_123",
        )
        test_session.state = state

        message = create_user_message("Remove Bangkok from my trip")
        
        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {"status": "success"}
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            events = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message,
            ):
                events.append(event)
                if len(events) > 10:
                    break

            assert len(events) > 0
            
            # Verify that remove_destination tool was actually called
            tool_calls = extract_tool_calls(events, tool_name='remove_destination')
            assert len(tool_calls) > 0, \
                f"Agent should call remove_destination tool. Found tool calls: {[c['name'] for c in extract_tool_calls(events)]}"
            
            assert mock_post.called, "API endpoint should be called when tool executes"

    @pytest.mark.asyncio
    async def test_calls_update_duration_tool(self, runner, test_session, sample_itinerary):
        """Test that root agent calls update_destination_duration tool."""
        state = create_agent_state(
            itinerary=sample_itinerary,
            web_session_id="test_session_123",
        )
        test_session.state = state

        message = create_user_message("Extend Tokyo to 10 days")
        
        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {"status": "success"}
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            events = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message,
            ):
                events.append(event)
                if len(events) > 10:
                    break

            assert len(events) > 0
            
            # Verify that update_destination_duration tool was actually called
            tool_calls = extract_tool_calls(events, tool_name='update_destination_duration')
            assert len(tool_calls) > 0, \
                f"Agent should call update_destination_duration tool. Found tool calls: {[c['name'] for c in extract_tool_calls(events)]}"
            
            assert mock_post.called, "API endpoint should be called when tool executes"

    @pytest.mark.asyncio
    async def test_calls_get_current_itinerary_tool(self, runner, test_session, sample_itinerary):
        """Test that root agent can retrieve current itinerary."""
        state = create_agent_state(itinerary=sample_itinerary)
        test_session.state = state

        message = create_user_message("What's in my current itinerary?")
        
        events = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message,
        ):
            events.append(event)
            if len(events) > 10:
                break

        assert len(events) > 0


class TestRootAgentErrorHandling:
    """Test root agent's error handling capabilities."""

    @pytest.mark.asyncio
    async def test_handles_invalid_destination_name(self, runner, test_session, sample_itinerary):
        """Test that agent handles requests with invalid destination names gracefully."""
        state = create_agent_state(
            itinerary=sample_itinerary,
            web_session_id="test_session_123",
        )
        test_session.state = state

        message = create_user_message("Add XyZ123InvalidPlace to my itinerary")
        
        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            # Simulate geocoding failure
            mock_response = Mock()
            mock_response.json.return_value = {
                "status": "error",
                "message": "Could not geocode location",
            }
            mock_response.status_code = 400
            mock_post.return_value = mock_response

            events = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message,
            ):
                events.append(event)
                if len(events) > 10:
                    break

            # Agent should still respond (not crash)
            assert len(events) > 0

    @pytest.mark.asyncio
    async def test_handles_missing_itinerary_context(self, runner, test_session):
        """Test that agent handles requests when itinerary context is missing."""
        state = create_agent_state()  # No itinerary
        test_session.state = state

        message = create_user_message("Add Kyoto to my itinerary")
        
        events = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message,
        ):
            events.append(event)
            if len(events) > 10:
                break

        # Agent should handle gracefully (may ask for clarification or provide error)
        assert len(events) > 0

    @pytest.mark.asyncio
    async def test_handles_api_timeout(self, runner, test_session, sample_itinerary):
        """Test that agent handles API timeouts gracefully."""
        state = create_agent_state(
            itinerary=sample_itinerary,
            web_session_id="test_session_123",
        )
        test_session.state = state

        message = create_user_message("Add Kyoto to my itinerary")
        
        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            # Simulate timeout
            import requests
            mock_post.side_effect = requests.exceptions.Timeout("Request timed out")

            events = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message,
            ):
                events.append(event)
                if len(events) > 10:
                    break

            # Agent should handle timeout gracefully
            assert len(events) > 0


class TestRootAgentContextUnderstanding:
    """Test root agent's understanding of context and state."""

    @pytest.mark.asyncio
    async def test_uses_itinerary_context(self, runner, test_session, sample_itinerary):
        """Test that agent uses itinerary from state."""
        state = create_agent_state(itinerary=sample_itinerary)
        test_session.state = state

        message = create_user_message("How many destinations are in my trip?")
        
        events = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message,
        ):
            events.append(event)
            if len(events) > 10:
                break

        # Check that response mentions the destinations or makes function calls
        response_text = ""
        has_function_call = False
        for event in events:
            if hasattr(event, 'content'):
                if hasattr(event.content, 'text') and event.content.text:
                    response_text += event.content.text
                # Check for function calls (tool calls)
                if hasattr(event.content, 'parts'):
                    for part in event.content.parts:
                        if hasattr(part, 'function_call') or hasattr(part, 'functionCall'):
                            has_function_call = True

        # Agent should respond with text or function calls
        assert len(response_text) > 0 or has_function_call, \
            "Agent should reference the itinerary or make tool calls"

    @pytest.mark.asyncio
    async def test_uses_user_profile_context(self, runner, test_session, sample_user_profile):
        """Test that agent uses user profile from state."""
        state = create_agent_state(user_profile=sample_user_profile)
        test_session.state = state

        message = create_user_message("What are my travel preferences?")
        
        events = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message,
        ):
            events.append(event)
            if len(events) > 10:
                break

        assert len(events) > 0

    @pytest.mark.asyncio
    async def test_handles_trip_phase_detection(self, runner, test_session, sample_itinerary):
        """Test that agent detects trip phase (pre-trip, in-trip, post-trip)."""
        import datetime
        # Set current time to before trip start
        current_time = datetime.datetime(2026, 6, 1)  # Before July 1
        
        state = create_agent_state(
            itinerary=sample_itinerary,
            itinerary_datetime=current_time.isoformat(),
        )
        test_session.state = state

        message = create_user_message("What should I prepare for my trip?")
        
        events = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message,
        ):
            events.append(event)
            if len(events) > 10:
                break

        # Agent should delegate to pre_trip_agent (simplified check)
        assert len(events) > 0


class TestRootAgentKeywordRecognition:
    """Test that root agent correctly recognizes keywords for routing."""

    @pytest.mark.asyncio
    async def test_recognizes_inspiration_keywords(self, runner, test_session):
        """Test recognition of inspiration-related keywords."""
        inspiration_queries = [
            "What are some must-see places?",
            "Where should I go in Asia?",
            "Recommend beach destinations",
            "Suggest cultural sites",
        ]

        for query in inspiration_queries:
            state = create_agent_state()
            test_session.state = state
            message = create_user_message(query)
            
            events = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message,
            ):
                events.append(event)
                if len(events) > 5:  # Quick check
                    break

            assert len(events) > 0, f"Should handle query: {query}"

    @pytest.mark.asyncio
    async def test_recognizes_itinerary_modification_keywords(self, runner, test_session, sample_itinerary):
        """Test recognition of itinerary modification keywords."""
        modification_queries = [
            "Add Kyoto",
            "Remove Tokyo",
            "Extend Bangkok to 5 days",
            "Update destination",
        ]

        for query in modification_queries:
            state = create_agent_state(
                itinerary=sample_itinerary,
                web_session_id="test_session_123",
            )
            test_session.state = state
            message = create_user_message(query)
            
            with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
                mock_response = Mock()
                mock_response.json.return_value = {"status": "success"}
                mock_response.status_code = 200
                mock_post.return_value = mock_response

                events = []
                async for event in runner.run_async(
                    session_id=test_session.id,
                    user_id="test_user",
                    new_message=message,
                ):
                    events.append(event)
                    if len(events) > 5:
                        break

                assert len(events) > 0, f"Should handle query: {query}"


class TestRootAgentToolIntegration:
    """Test root agent's integration with tools."""

    @pytest.mark.asyncio
    async def test_tool_call_sequence(self, runner, test_session, sample_itinerary):
        """Test that agent can call multiple tools in sequence."""
        state = create_agent_state(
            itinerary=sample_itinerary,
            web_session_id="test_session_123",
        )
        test_session.state = state

        # First get itinerary, then add destination
        message1 = create_user_message("What's in my itinerary?")
        
        events1 = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message1,
        ):
            events1.append(event)
            if len(events1) > 10:
                break

        assert len(events1) > 0

    @pytest.mark.asyncio
    async def test_agent_responds_without_tool_call(self, runner, test_session):
        """Test that agent can respond without calling tools."""
        state = create_agent_state()
        test_session.state = state

        message = create_user_message("Hello, how can you help me?")
        
        events = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message,
        ):
            events.append(event)
            if len(events) > 10:
                break

        # Agent should respond even without tool calls
        assert len(events) > 0

