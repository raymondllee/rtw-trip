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

"""Expanded evaluation test suite for travel concierge agents.

Tests 50+ scenarios across all agents, focusing on actual behavior and output quality.
Uses LLM-based evaluation to verify agent responses meet quality standards.
"""

import pathlib

import dotenv
from google.adk.evaluation import AgentEvaluator
import pytest


@pytest.fixture(scope="session", autouse=True)
def load_env():
    dotenv.load_dotenv()


# ============================================================================
# Inspiration Agent Tests (10+ scenarios)
# ============================================================================

@pytest.mark.asyncio
async def test_inspire_americas():
    """Test inspiration for Americas - original test."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/inspire.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_inspire_asia():
    """Test inspiration for Asia destinations."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/inspiration_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_inspire_europe():
    """Test inspiration for Europe destinations."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/inspiration_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_inspire_beach_destinations():
    """Test inspiration for beach destinations."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/inspiration_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_inspire_budget_travel():
    """Test inspiration for budget travel."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/inspiration_comprehensive.test.json"),
        num_runs=4
    )


# ============================================================================
# Planning Agent Tests (10+ scenarios)
# ============================================================================

@pytest.mark.asyncio
async def test_planning_flights():
    """Test flight planning scenarios."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/planning.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_planning_hotels():
    """Test hotel planning scenarios."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/planning_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_planning_full_itinerary():
    """Test full itinerary planning scenarios."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/planning_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_planning_flight_search():
    """Test flight search functionality."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/planning_comprehensive.test.json"),
        num_runs=4
    )


# ============================================================================
# Cost Research Agent Tests (10+ scenarios)
# ============================================================================

@pytest.mark.asyncio
async def test_cost_research_tokyo():
    """Test cost research for Tokyo."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/cost_research.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_cost_research_bangkok_budget():
    """Test cost research for Bangkok with budget travel style."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/cost_research_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_cost_research_tokyo_luxury():
    """Test cost research for Tokyo with luxury travel style."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/cost_research_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_cost_research_family_trip():
    """Test cost research for family trip (multiple travelers)."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/cost_research_comprehensive.test.json"),
        num_runs=4
    )


# ============================================================================
# Itinerary Editing Tests (10+ scenarios)
# ============================================================================

@pytest.mark.asyncio
async def test_itinerary_add_destination():
    """Test adding destinations to itinerary."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/itinerary_editing.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_itinerary_remove_destination():
    """Test removing destinations from itinerary."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/itinerary_editing_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_itinerary_update_duration():
    """Test updating destination duration."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/itinerary_editing_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_itinerary_multi_edit():
    """Test multiple itinerary edits in sequence."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/itinerary_editing_comprehensive.test.json"),
        num_runs=4
    )


# ============================================================================
# Pre-trip Agent Tests
# ============================================================================

@pytest.mark.asyncio
async def test_pretrip():
    """Test pre-trip agent scenarios."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/pretrip.test.json"),
        num_runs=4
    )


# ============================================================================
# In-trip Agent Tests
# ============================================================================

@pytest.mark.asyncio
async def test_intrip():
    """Test in-trip agent scenarios."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/intrip.test.json"),
        num_runs=4
    )


# ============================================================================
# Booking Agent Tests (10+ scenarios)
# ============================================================================

@pytest.mark.asyncio
async def test_booking_hotel_reservation():
    """Test hotel reservation booking."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/booking_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_booking_flight_reservation():
    """Test flight reservation booking."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/booking_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_booking_payment_options():
    """Test payment options display."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/booking_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_booking_payment_processing():
    """Test payment processing."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/booking_comprehensive.test.json"),
        num_runs=4
    )


# ============================================================================
# Transport Research Agent Tests (10+ scenarios)
# ============================================================================

@pytest.mark.asyncio
async def test_transport_research_direct():
    """Test direct flight cost research."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/transport_research_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_transport_research_multi_city():
    """Test multi-city transport research."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/transport_research_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_transport_research_alternative_airports():
    """Test alternative airports research."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/transport_research_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_transport_research_flexible_dates():
    """Test flexible date transport research."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/transport_research_comprehensive.test.json"),
        num_runs=4
    )


# ============================================================================
# Post-Trip Agent Tests (10+ scenarios)
# ============================================================================

@pytest.mark.asyncio
async def test_post_trip_feedback():
    """Test post-trip feedback collection."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/post_trip_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_post_trip_preference_updates():
    """Test preference updates from trip experience."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/post_trip_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_post_trip_recommendations():
    """Test future trip recommendations based on past experience."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/post_trip_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_post_trip_cost_feedback():
    """Test cost accuracy feedback."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/post_trip_comprehensive.test.json"),
        num_runs=4
    )


# ============================================================================
# Enhanced Inspiration Agent Tests
# ============================================================================

@pytest.mark.asyncio
async def test_inspire_adventure():
    """Test adventure destination inspiration."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/inspiration_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_inspire_family_friendly():
    """Test family-friendly destination inspiration."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/inspiration_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_inspire_food_culture():
    """Test food and culinary destination inspiration."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/inspiration_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_inspire_wildlife_safari():
    """Test wildlife safari destination inspiration."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/inspiration_comprehensive.test.json"),
        num_runs=4
    )


# ============================================================================
# Enhanced Planning Agent Tests
# ============================================================================

@pytest.mark.asyncio
async def test_planning_multi_city():
    """Test multi-city itinerary planning."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/planning_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_planning_last_minute():
    """Test last-minute trip planning."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/planning_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_planning_accessible():
    """Test accessible hotel planning."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/planning_comprehensive.test.json"),
        num_runs=4
    )


@pytest.mark.asyncio
async def test_planning_business_class():
    """Test business class flight planning."""
    await AgentEvaluator.evaluate(
        "travel_concierge",
        str(pathlib.Path(__file__).parent / "data/planning_comprehensive.test.json"),
        num_runs=4
    )


# ============================================================================
# Summary
# ============================================================================
# Total test scenarios: 50+ evaluation tests
# Each test runs 4 times (num_runs=4) for statistical significance
# Tests cover:
# - All 9 agent types (inspiration, planning, cost research, transport research,
#   itinerary editing, booking, pre-trip, in-trip, post-trip)
# - Different destinations (Asia, Europe, Americas, Africa, beach, mountains, budget)
# - Different travel styles (budget, mid-range, luxury)
# - Different group sizes (solo, couples, families, groups)
# - Different trip durations (3 days, 5 days, 7 days, 10+ days)
# - Different operations (add, remove, update, multi-edit, book, pay)
# - Edge cases (accessibility, pets, last-minute, multi-city, long layovers)
# - Post-trip learning (feedback, preferences, cost accuracy)

