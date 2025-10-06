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

"""Cost Research Agent - Researches accurate pricing for destinations using web search."""

from google.adk.agents import Agent
from google.genai.types import GenerateContentConfig

from travel_concierge.shared_libraries import types
from travel_concierge.sub_agents.cost_research import prompt
from travel_concierge.tools.search import google_search_grounding
from travel_concierge.tools.cost_manager import save_researched_costs


cost_research_agent = Agent(
    model="gemini-2.5-flash",
    name="cost_research_agent",
    description=(
        "Research accurate, real-world travel costs for destinations using web search. "
        "Provides detailed cost breakdowns for accommodation, flights, food, transport, "
        "and activities with low/mid/high estimates and source citations. "
        "Automatically saves researched costs to Firestore."
    ),
    instruction=prompt.COST_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding, save_researched_costs],
    # Provide a typed output schema to make downstream usage predictable
    output_schema=types.DestinationCostResearch,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5
    )
)
