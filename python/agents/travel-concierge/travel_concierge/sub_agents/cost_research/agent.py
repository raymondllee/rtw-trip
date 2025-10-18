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

"""Cost Research Agent

Researches accurate pricing for destinations using web search.
"""

from google.adk.agents import Agent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.genai.types import (
    GenerateContentConfig,
    ToolConfig,
    FunctionCallingConfig,
    FunctionDeclaration,
)

from travel_concierge.shared_libraries import types
from travel_concierge.sub_agents.cost_research import prompt
from travel_concierge.tools.search import google_search_grounding
from google.adk.tools.base_tool import BaseTool


class DestinationCostResearchOutputTool(BaseTool):
    """Tool that captures the final structured cost research output."""

    def __init__(self):
        super().__init__(
            name="DestinationCostResearch",
            description=(
                "Return the completed cost research JSON matching the"
                " DestinationCostResearch schema."
            ),
        )

    def _get_declaration(self):
        schema = types.DestinationCostResearch.model_json_schema(
            ref_template="#/$defs/{model}"
        )
        # Inline referenced definitions to satisfy pydantic FunctionDeclaration validation
        defs = schema.pop("$defs", {})
        properties = schema.get("properties", {})
        for prop_name, prop_schema in properties.items():
            ref = prop_schema.get("$ref")
            if ref:
                def_key = ref.split("/")[-1]
                definition = defs.get(def_key)
                if definition:
                    merged = {k: v for k, v in prop_schema.items() if k != "$ref"}
                    merged.update(definition)
                    properties[prop_name] = merged
                else:
                    # If definition missing, drop the $ref to avoid validation error
                    prop_schema.pop("$ref", None)
        return FunctionDeclaration(
            name=self.name,
            description=self.description,
            parameters=schema,
        )

    async def run_async(self, *, args: dict, tool_context):
        """Echo back validated research data so the agent can summarize it."""
        try:
            validated = types.DestinationCostResearch.model_validate(args)
            payload = validated.model_dump()
            return {
                "status": "received",
                "research_data": payload,
            }
        except Exception as exc:
            return {
                "status": "error",
                "message": f"Invalid DestinationCostResearch payload: {exc}",
            }


_destination_cost_output_tool = DestinationCostResearchOutputTool()
_STRUCTURED_OUTPUT_STATE_KEY = "cost_research_structured_mode_enabled"


def structured_output_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
):
    """
    Callback to enable structured output after tools have been used.
    After research is complete (indicated by conversation history),
    remove tools and set output schema for structured JSON response.
    """
    # Check if we have tool responses in the conversation (research is done)
    def _has_tool_response(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionResponse"))
        return bool(getattr(part, "function_response", None))

    def _role_name(message):
        """Extract role name as lowercase string from various message types."""
        role = getattr(message, "role", None)
        if role is None and isinstance(message, dict):
            role = message.get("role")

        # google.genai.types.Content.role may be an enum-like object
        if hasattr(role, "name"):
            role = role.name

        if isinstance(role, str):
            return role.lower()
        return None

    def _iter_parts(message):
        """Safely yield parts from message-like objects."""
        parts = getattr(message, "parts", None)
        if parts is None and isinstance(message, dict):
            parts = message.get("parts", [])
        return parts or []

    tool_response_count = 0
    state = callback_context.state
    for message in llm_request.contents or []:
        role_name = _role_name(message)
        if role_name == "user":
            # New user message marks the start of a turn; reset counts
            tool_response_count = 0
            state[_STRUCTURED_OUTPUT_STATE_KEY] = False
            continue

        for part in _iter_parts(message):
            if _has_tool_response(part):
                tool_response_count += 1

    # Even a single grounding call can yield enough data; as soon as the agent
    # has produced any tool response, force it to emit structured output.
    if tool_response_count >= 1:
        # Switch to structured output phase:
        #   - Disable search tools
        #   - Allow only the structured output tool
        llm_request.config.tools = []
        llm_request.tools_dict = {}
        llm_request.append_tools([_destination_cost_output_tool])
        llm_request.config.tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(
                mode="any",
                allowed_function_names=[_destination_cost_output_tool.name],
            )
        )
        if not state.get(_STRUCTURED_OUTPUT_STATE_KEY, False):
            llm_request.append_instructions([
                (
                    "You have completed research. Call the DestinationCostResearch"
                    " tool exactly once with the full JSON output, then send a short"
                    " confirmation summarizing key findings."
                )
            ])
            state[_STRUCTURED_OUTPUT_STATE_KEY] = True


cost_research_agent = Agent(
    model="gemini-2.5-flash",
    name="cost_research_agent",
    description=(
        "Research accurate, real-world travel costs for destinations using web"
        " search. Returns structured JSON with cost breakdowns for"
        " accommodation, flights, food, transport, and activities with"
        " low/mid/high estimates and source citations."
    ),
    instruction=prompt.COST_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding, _destination_cost_output_tool],
    before_model_callback=structured_output_callback,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5,
    )
)
