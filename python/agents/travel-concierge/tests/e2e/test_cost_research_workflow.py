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

"""End-to-end tests for cost research workflow."""

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


class TestCostResearchWorkflow:
    """Test cost research workflows."""

    @pytest.mark.asyncio
    async def test_cost_research_to_save_workflow(self, runner, test_session):
        """Test cost research then save to Firestore."""
        state = create_agent_state(
            destination_id="tokyo-001",
            destination_name="Tokyo, Japan",
            duration_days=7,
            num_travelers=2,
            travel_style="mid-range",
            scenario_id="test_scenario",
        )
        test_session.state = state

        # Request cost research
        message = create_user_message("Research costs for Tokyo for 7 days, mid-range, 2 people")
        
        with patch('travel_concierge.tools.search.google_search_grounding') as mock_search:
            mock_search.return_value = {
                "status": "success",
                "results": [
                    {
                        "title": "Tokyo Hotel Prices",
                        "url": "https://booking.com/tokyo",
                        "snippet": "Average price: $80-150/night",
                    }
                ],
            }

            events = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message,
            ):
                events.append(event)
                if len(events) > 20:  # Cost research may take more steps
                    break

            # Agent should research costs
            assert len(events) > 0

    @pytest.mark.asyncio
    async def test_cost_research_multiple_destinations(self, runner, test_session):
        """Test cost research for multiple destinations."""
        state = create_agent_state()
        test_session.state = state

        # Research costs for first destination
        message1 = create_user_message("Research costs for Tokyo for 7 days")
        
        with patch('travel_concierge.tools.search.google_search_grounding') as mock_search:
            mock_search.return_value = {
                "status": "success",
                "results": [{"title": "Test", "url": "https://test.com", "snippet": "Test"}],
            }

            events1 = []
            async for event in runner.run_async(
                session_id=test_session.id,
                user_id="test_user",
                new_message=message1,
            ):
                events1.append(event)
                if len(events1) > 15:
                    break

            assert len(events1) > 0

        # Research costs for second destination
        message2 = create_user_message("Research costs for Bangkok for 5 days")
        
        events2 = []
        async for event in runner.run_async(
            session_id=test_session.id,
            user_id="test_user",
            new_message=message2,
        ):
            events2.append(event)
            if len(events2) > 15:
                break

        assert len(events2) > 0

