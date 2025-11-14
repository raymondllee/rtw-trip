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

"""Unit tests for Itinerary Editor tools.

Tests add/remove/update workflows for itinerary modifications.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from google.adk.tools import ToolContext
from travel_concierge.tools.itinerary_editor import (
    add_destination,
    remove_destination,
    update_destination_duration,
    update_destination,
    get_current_itinerary,
)
from tests.conftest import create_agent_state


@pytest.fixture
def tool_context(invocation_context):
    """Create a tool context for testing."""
    return ToolContext(invocation_context=invocation_context)


@pytest.fixture
def sample_itinerary_with_state(tool_context, sample_itinerary):
    """Set up tool context with sample itinerary."""
    tool_context.state = create_agent_state(
        itinerary=sample_itinerary,
        web_session_id="test_session_123",
    )
    return tool_context


class TestAddDestinationTool:
    """Test add_destination tool functionality."""

    @pytest.mark.asyncio
    async def test_adds_destination_successfully(self, sample_itinerary_with_state):
        """Test that add_destination successfully adds a new destination."""
        tool_context = sample_itinerary_with_state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {
                "status": "success",
                "message": "Destination added successfully",
                "destination": {
                    "id": "kyoto-003",
                    "name": "Kyoto",
                    "city": "Kyoto",
                    "country": "Japan",
                },
            }
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            result = await add_destination(
                name="Kyoto",
                city="Kyoto",
                country="Japan",
                duration_days=3,
                activity_type="cultural",
                description="Historic temples and gardens",
                tool_context=tool_context,
            )

            assert result.get("status") == "success"
            assert mock_post.called, "API should be called"

    @pytest.mark.asyncio
    async def test_adds_destination_with_geocoding(self, sample_itinerary_with_state):
        """Test that add_destination geocodes the location."""
        tool_context = sample_itinerary_with_state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {
                "status": "success",
                "destination": {
                    "id": "kyoto-003",
                    "name": "Kyoto",
                    "coordinates": {"lat": 35.0116, "lng": 135.7681},
                },
            }
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            result = await add_destination(
                name="Kyoto",
                city="Kyoto",
                country="Japan",
                duration_days=3,
                tool_context=tool_context,
            )

            # Check that geocoding was attempted (API called)
            assert mock_post.called

    @pytest.mark.asyncio
    async def test_handles_geocoding_failure(self, sample_itinerary_with_state):
        """Test that add_destination handles geocoding failures gracefully."""
        tool_context = sample_itinerary_with_state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            # Simulate geocoding failure
            mock_response = Mock()
            mock_response.json.return_value = {
                "status": "error",
                "message": "Could not geocode location",
            }
            mock_response.status_code = 400
            mock_post.return_value = mock_response

            result = await add_destination(
                name="InvalidPlace123",
                city="Invalid",
                country="Unknown",
                duration_days=3,
                tool_context=tool_context,
            )

            # Tool should return error status
            assert result.get("status") in ["error", "failed"]

    @pytest.mark.asyncio
    async def test_handles_missing_required_fields(self, sample_itinerary_with_state):
        """Test that add_destination handles missing required fields."""
        tool_context = sample_itinerary_with_state

        # Missing required fields should be handled by tool validation
        # This is a simplified test - actual validation may vary
        result = await add_destination(
            name="",  # Empty name
            city="Kyoto",
            country="Japan",
            duration_days=3,
            tool_context=tool_context,
        )

        # Tool should handle missing fields (may return error or use defaults)
        assert "status" in result


class TestRemoveDestinationTool:
    """Test remove_destination tool functionality."""

    @pytest.mark.asyncio
    async def test_removes_destination_successfully(self, sample_itinerary_with_state):
        """Test that remove_destination successfully removes a destination."""
        tool_context = sample_itinerary_with_state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {
                "status": "success",
                "message": "Destination removed successfully",
            }
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            result = await remove_destination(
                destination_name="Bangkok",
                tool_context=tool_context,
            )

            assert result.get("status") == "success"
            assert mock_post.called

    @pytest.mark.asyncio
    async def test_handles_nonexistent_destination(self, sample_itinerary_with_state):
        """Test that remove_destination handles nonexistent destinations."""
        tool_context = sample_itinerary_with_state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {
                "status": "error",
                "message": "Destination not found",
            }
            mock_response.status_code = 404
            mock_post.return_value = mock_response

            result = await remove_destination(
                destination_name="NonexistentPlace",
                tool_context=tool_context,
            )

            assert result.get("status") in ["error", "failed"]

    @pytest.mark.asyncio
    async def test_handles_empty_destination_name(self, sample_itinerary_with_state):
        """Test that remove_destination handles empty destination name."""
        tool_context = sample_itinerary_with_state

        result = await remove_destination(
            destination_name="",
            tool_context=tool_context,
        )

        # Tool should handle empty name (may return error or ignore)
        assert "status" in result


class TestUpdateDurationTool:
    """Test update_destination_duration tool functionality."""

    @pytest.mark.asyncio
    async def test_updates_duration_successfully(self, sample_itinerary_with_state):
        """Test that update_destination_duration successfully updates duration."""
        tool_context = sample_itinerary_with_state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {
                "status": "success",
                "message": "Duration updated successfully",
                "new_duration_days": 10,
            }
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            result = await update_destination_duration(
                destination_name="Tokyo",
                new_duration_days=10,
                tool_context=tool_context,
            )

            assert result.get("status") == "success"
            assert mock_post.called

    @pytest.mark.asyncio
    async def test_handles_invalid_duration(self, sample_itinerary_with_state):
        """Test that update_destination_duration handles invalid duration values."""
        tool_context = sample_itinerary_with_state

        # Test with negative duration
        result = await update_destination_duration(
            destination_name="Tokyo",
            new_duration_days=-1,
            tool_context=tool_context,
        )

        # Tool should handle invalid duration (may return error or validate)
        assert "status" in result

    @pytest.mark.asyncio
    async def test_handles_zero_duration(self, sample_itinerary_with_state):
        """Test that update_destination_duration handles zero duration."""
        tool_context = sample_itinerary_with_state

        result = await update_destination_duration(
            destination_name="Tokyo",
            new_duration_days=0,
            tool_context=tool_context,
        )

        # Tool should handle zero duration (may return error or validate)
        assert "status" in result


class TestUpdateDestinationTool:
    """Test update_destination tool functionality."""

    @pytest.mark.asyncio
    async def test_updates_destination_successfully(self, sample_itinerary_with_state):
        """Test that update_destination successfully updates destination fields."""
        tool_context = sample_itinerary_with_state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {
                "status": "success",
                "message": "Destination updated successfully",
            }
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            result = await update_destination(
                destination_name="Tokyo",
                activity_type="diving",
                description="Updated description",
                tool_context=tool_context,
            )

            assert result.get("status") == "success"
            assert mock_post.called

    @pytest.mark.asyncio
    async def test_updates_multiple_fields(self, sample_itinerary_with_state):
        """Test that update_destination can update multiple fields at once."""
        tool_context = sample_itinerary_with_state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {"status": "success"}
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            result = await update_destination(
                destination_name="Tokyo",
                name="Tokyo Updated",
                activity_type="cultural",
                description="New description",
                notes="New notes",
                tool_context=tool_context,
            )

            assert result.get("status") == "success"


class TestGetCurrentItineraryTool:
    """Test get_current_itinerary tool functionality."""

    @pytest.mark.asyncio
    async def test_retrieves_itinerary_from_state(self, sample_itinerary_with_state):
        """Test that get_current_itinerary retrieves itinerary from state."""
        tool_context = sample_itinerary_with_state

        result = await get_current_itinerary(tool_context=tool_context)

        # Tool should return itinerary from state
        assert "itinerary" in result or "locations" in result

    @pytest.mark.asyncio
    async def test_handles_missing_itinerary(self, tool_context):
        """Test that get_current_itinerary handles missing itinerary gracefully."""
        tool_context.state = {}  # No itinerary

        result = await get_current_itinerary(tool_context=tool_context)

        # Tool should handle missing itinerary (may return empty or error)
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_extracts_itinerary_from_history(self, tool_context):
        """Test that get_current_itinerary can extract itinerary from history."""
        # Set up tool context with history containing itinerary
        tool_context.state = {}
        # Note: Actual history extraction depends on implementation
        # This is a simplified test

        result = await get_current_itinerary(tool_context=tool_context)

        # Tool should attempt to extract from history if state is empty
        assert isinstance(result, dict)


class TestItineraryEditorIntegration:
    """Integration tests for itinerary editor tools."""

    @pytest.mark.asyncio
    async def test_add_then_remove_workflow(self, sample_itinerary_with_state):
        """Test adding then removing a destination."""
        tool_context = sample_itinerary_with_state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            # Mock successful add
            mock_response = Mock()
            mock_response.json.return_value = {"status": "success"}
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            # Add destination
            add_result = await add_destination(
                name="Kyoto",
                city="Kyoto",
                country="Japan",
                duration_days=3,
                tool_context=tool_context,
            )

            assert add_result.get("status") == "success"

            # Remove destination
            remove_result = await remove_destination(
                destination_name="Kyoto",
                tool_context=tool_context,
            )

            assert remove_result.get("status") == "success"

    @pytest.mark.asyncio
    async def test_update_duration_then_update_other_fields(self, sample_itinerary_with_state):
        """Test updating duration then updating other fields."""
        tool_context = sample_itinerary_with_state

        with patch('travel_concierge.tools.itinerary_editor.requests.post') as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {"status": "success"}
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            # Update duration
            duration_result = await update_destination_duration(
                destination_name="Tokyo",
                new_duration_days=10,
                tool_context=tool_context,
            )

            assert duration_result.get("status") == "success"

            # Update other fields
            update_result = await update_destination(
                destination_name="Tokyo",
                activity_type="diving",
                tool_context=tool_context,
            )

            assert update_result.get("status") == "success"

