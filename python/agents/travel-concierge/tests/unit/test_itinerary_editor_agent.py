import json
from types import SimpleNamespace

import pytest

from travel_concierge.tools import itinerary_editor


@pytest.fixture(autouse=True)
def clear_reference_cache(monkeypatch):
    # Ensure cached reference data does not leak between tests.
    itinerary_editor._load_reference_data.cache_clear()
    yield
    itinerary_editor._load_reference_data.cache_clear()


def _build_tool_context():
    itinerary_state = {
        "locations": [
            {
                "id": 1,
                "name": "Sample Base",
                "city": "Sample City",
                "country": "Sampleland",
                "region": "Sample Region",
                "duration_days": 2,
                "coordinates": {"lat": 1.0, "lng": 2.0},
            }
        ]
    }
    state = {
        "web_session_id": "session-abc",
        "itinerary": json.loads(json.dumps(itinerary_state)),
    }
    return SimpleNamespace(state=state, history=[])


def test_add_destination_enriches_payload(monkeypatch):
    tool_context = _build_tool_context()

    captured_payload = {}

    def fake_post(url, json=None, timeout=None):
        nonlocal captured_payload
        captured_payload = json

        class FakeResponse:
            status_code = 200

            def json(self_inner):
                return {"destination": json["destination"]}

        return FakeResponse()

    monkeypatch.setattr(itinerary_editor.requests, "post", fake_post)
    monkeypatch.setattr(
        itinerary_editor,
        "_geocode_location",
        lambda *args, **kwargs: {"lat": 10.0, "lng": 20.0, "source": "test"},
    )

    result = itinerary_editor.add_destination(
        name="Atlantis",
        city="Mythica",
        country="Oceanus",
        duration_days=4,
        activity_type="exploration",
        description="Discover the lost city.",
        tool_context=tool_context,
    )

    destination = captured_payload["destination"]

    assert result["status"] == "success"
    assert destination["id"]
    assert destination["coordinates"]["lat"] == 10.0
    assert destination["coordinates"]["lng"] == 20.0
    assert destination["region"] == "Custom"
    assert destination["duration_days"] == 4
    assert tool_context.state["itinerary"]["locations"][-1]["name"] == "Atlantis"


def test_remove_updates_cached_state(monkeypatch):
    tool_context = _build_tool_context()
    tool_context.state["itinerary"]["locations"].append(
        {
            "id": 2,
            "name": "To Delete",
            "city": "Delete City",
            "country": "Sampleland",
            "region": "Sample Region",
            "duration_days": 3,
            "coordinates": {"lat": 5.0, "lng": 6.0},
        }
    )

    def fake_post(url, json=None, timeout=None):
        class FakeResponse:
            status_code = 200

            def json(self_inner):
                return {"status": "success"}

        return FakeResponse()

    monkeypatch.setattr(itinerary_editor.requests, "post", fake_post)

    result = itinerary_editor.remove_destination(
        destination_name="To Delete",
        tool_context=tool_context,
    )

    names = [loc["name"] for loc in tool_context.state["itinerary"]["locations"]]
    assert result["status"] == "success"
    assert "To Delete" not in names
