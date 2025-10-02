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

"""Itinerary editor agent for real-time trip modification."""

from google.adk.agents import Agent
from google.genai.types import GenerateContentConfig, ToolConfig, FunctionCallingMode

from travel_concierge.sub_agents.itinerary_editor import prompt
from travel_concierge.tools.itinerary_editor import (
    get_current_itinerary,
    add_destination,
    remove_destination,
    update_destination_duration,
    update_destination,
)


itinerary_editor_agent = Agent(
    model="gemini-2.5-flash",
    name="itinerary_editor_agent",
    description="""Helps users modify their travel itinerary in real-time, including adding/removing destinations,
    adjusting durations, and optimizing the trip based on their preferences. This agent has tools to make actual
    changes to the itinerary - it's not just for planning, it can execute changes.""",
    instruction=prompt.ITINERARY_EDITOR_INSTR,
    tools=[
        get_current_itinerary,
        add_destination,
        remove_destination,
        update_destination_duration,
        update_destination,
    ],
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Very low temperature to follow instructions precisely
        top_p=0.5,
        tool_config={
            "function_calling_config": {
                "mode": "ANY"
            }
        },
    ),
    # Don't allow the agent to finish without using tools when asked to make changes
    disallow_transfer_to_parent=False,
)
