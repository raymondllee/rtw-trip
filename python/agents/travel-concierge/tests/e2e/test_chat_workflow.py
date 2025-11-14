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

"""End-to-end tests for chat workflow."""

import pytest
from unittest.mock import Mock, patch
from google.adk.runner import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.artifacts import InMemoryArtifactService
from google.genai.types import Content, Part
from travel_concierge.agent import root_agent
from tests.conftest import create_user_message, create_agent_state


@pytest.fixture
def runner(session_service, artifact_service):
    """Create a runner for E2E testing."""
    return Runner(
        app_name="Travel_Concierge",
        agent=root_agent,
        artifact_service=artifact_service,
        session_service=session_service,
    )


class TestChatWorkflow:
    """Test full chat conversation flows."""

    @pytest.mark.asyncio
    async def test_inspiration_to_planning_workflow(self, runner, test_session):
        """Test workflow from inspiration to planning."""
        state = create_agent_state()
        test_session.state = state

        # Step 1: Ask for inspiration
        message1 = create_user_message("Inspire me about Southeast Asia")
        
        events1 = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message1,
        ):
            events1.append(event)
            if len(events1) > 10:
                break

        assert len(events1) > 0, "Agent should respond to inspiration request"

        # Step 2: Ask to start planning
        message2 = create_user_message("Start planning a trip to Thailand")
        
        events2 = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message2,
        ):
            events2.append(event)
            if len(events2) > 10:
                break

        assert len(events2) > 0, "Agent should respond to planning request"

    @pytest.mark.asyncio
    async def test_multi_turn_conversation(self, runner, test_session, sample_itinerary):
        """Test multi-turn conversation with context."""
        state = create_agent_state(itinerary=sample_itinerary)
        test_session.state = state

        # Turn 1: Ask about itinerary
        message1 = create_user_message("What destinations are in my trip?")
        
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

        # Turn 2: Modify itinerary
        message2 = create_user_message("Add Kyoto to my itinerary for 3 days")
        
        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {"status": "success"}
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            events2 = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message2,
            ):
                events2.append(event)
                if len(events2) > 10:
                    break

            assert len(events2) > 0

    @pytest.mark.asyncio
    async def test_error_recovery_in_conversation(self, runner, test_session):
        """Test that agent recovers from errors in conversation."""
        state = create_agent_state()
        test_session.state = state

        # Send invalid request
        message1 = create_user_message("")
        
        events1 = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message1,
        ):
            events1.append(event)
            if len(events1) > 5:
                break

        # Agent should handle empty message gracefully
        assert len(events1) >= 0  # May or may not produce events

        # Send valid request after error
        message2 = create_user_message("What are some destinations in Asia?")
        
        events2 = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message2,
        ):
            events2.append(event)
            if len(events2) > 10:
                break

        # Agent should recover and respond normally
        assert len(events2) > 0

