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

"""End-to-end tests for itinerary editing workflow."""

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


class TestItineraryEditingWorkflow:
    """Test itinerary editing workflows."""

    @pytest.mark.asyncio
    async def test_add_remove_destination_workflow(self, runner, test_session, sample_itinerary):
        """Test adding then removing a destination."""
        state = create_agent_state(
            itinerary=sample_itinerary,
            web_session_id="test_session_123",
        )
        test_session.state = state

        # Add destination
        message1 = create_user_message("Add Kyoto to my itinerary for 3 days")
        
        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {
                "status": "success",
                "message": "Destination added successfully",
            }
            mock_response.status_code = 200
            mock_post.return_value = mock_response

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
            assert mock_post.called, "API should be called to add destination"

        # Remove destination
        message2 = create_user_message("Remove Kyoto from my trip")
        
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
            assert mock_post.called, "API should be called to remove destination"

    @pytest.mark.asyncio
    async def test_update_duration_workflow(self, runner, test_session, sample_itinerary):
        """Test updating destination duration."""
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
            assert mock_post.called, "API should be called to update duration"

    @pytest.mark.asyncio
    async def test_multiple_modifications_workflow(self, runner, test_session, sample_itinerary):
        """Test multiple itinerary modifications in sequence."""
        state = create_agent_state(
            itinerary=sample_itinerary,
            web_session_id="test_session_123",
        )
        test_session.state = state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {"status": "success"}
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            # Add destination
            message1 = create_user_message("Add Kyoto for 3 days")
            events1 = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message1,
            ):
                events1.append(event)
                if len(events1) > 10:
                    break

            # Update duration
            message2 = create_user_message("Extend Tokyo to 10 days")
            events2 = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message2,
            ):
                events2.append(event)
                if len(events2) > 10:
                    break

            # Update destination
            message3 = create_user_message("Change Tokyo activity type to diving")
            events3 = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message3,
            ):
                events3.append(event)
                if len(events3) > 10:
                    break

            # All modifications should succeed
            assert len(events1) > 0
            assert len(events2) > 0
            assert len(events3) > 0

