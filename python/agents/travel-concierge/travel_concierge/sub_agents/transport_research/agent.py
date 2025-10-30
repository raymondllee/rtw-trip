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

"""Transport Research Agent

Researches accurate flight and transport pricing using web search.
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
from travel_concierge.sub_agents.transport_research import prompt
from travel_concierge.tools.search import google_search_grounding
from google.adk.tools.base_tool import BaseTool


class TransportResearchOutputTool(BaseTool):
    """Tool that captures the final structured transport research output."""

    def __init__(self):
        super().__init__(
            name="TransportResearchResult",
            description=(
                "Return the completed transport research JSON matching the"
                " TransportResearchResult schema."
            ),
        )

    def _get_declaration(self):
        schema = types.TransportResearchResult.model_json_schema(
            ref_template="#/$defs/{model}"
        )
        # Inline referenced definitions to satisfy pydantic FunctionDeclaration validation
        defs = schema.pop("$defs", {})

        def inline_refs(obj):
            """Recursively inline $ref definitions in a schema object."""
            if isinstance(obj, dict):
                # Handle direct $ref
                if "$ref" in obj:
                    ref = obj["$ref"]
                    def_key = ref.split("/")[-1]
                    definition = defs.get(def_key)
                    if definition:
                        # Create merged object without $ref
                        merged = {k: v for k, v in obj.items() if k != "$ref"}
                        merged.update(definition)
                        return inline_refs(merged)  # Recursively inline nested refs
                    else:
                        # If definition missing, remove $ref
                        return {k: v for k, v in obj.items() if k != "$ref"}

                # Handle array items with $ref
                if "items" in obj and isinstance(obj["items"], dict):
                    obj["items"] = inline_refs(obj["items"])

                # Recursively process all nested objects
                for key, value in obj.items():
                    if isinstance(value, dict):
                        obj[key] = inline_refs(value)
                    elif isinstance(value, list):
                        obj[key] = [inline_refs(item) if isinstance(item, dict) else item for item in value]

            return obj

        # Inline refs in properties
        properties = schema.get("properties", {})
        for prop_name in properties:
            properties[prop_name] = inline_refs(properties[prop_name])

        return FunctionDeclaration(
            name=self.name,
            description=self.description,
            parameters=schema,
        )

    async def run_async(self, *, args: dict, tool_context):
        """Echo back validated research data so the agent can summarize it."""
        try:
            validated = types.TransportResearchResult.model_validate(args)
            payload = validated.model_dump()
            return {
                "status": "received",
                "research_data": payload,
            }
        except Exception as exc:
            return {
                "status": "error",
                "message": f"Invalid TransportResearchResult payload: {exc}",
            }


_transport_research_output_tool = TransportResearchOutputTool()
_STRUCTURED_OUTPUT_STATE_KEY = "transport_research_structured_mode_enabled"


def structured_output_callback(
    callback_context: CallbackContext, llm_request: LlmRequest
):
    """
    Callback to enable structured output after tools have been used.
    After research is complete (indicated by conversation history),
    remove tools and set output schema for structured JSON response.
    """
    # Check if we have tool calls or responses in the conversation
    def _has_tool_response(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionResponse"))
        return bool(getattr(part, "function_response", None))

    def _has_tool_call(part) -> bool:
        if isinstance(part, dict):
            return bool(part.get("functionCall"))
        return bool(getattr(part, "function_call", None))

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
            # Count both tool calls and tool responses
            if _has_tool_call(part) or _has_tool_response(part):
                tool_response_count += 1

    # Wait for the agent to do thorough research (at least 3 search calls)
    # before forcing structured output. This allows it to research:
    # - Primary route pricing
    # - Alternative airports
    # - Alternative cities/routing
    print(f"[DEBUG] tool_response_count: {tool_response_count}, structured_mode: {state.get(_STRUCTURED_OUTPUT_STATE_KEY, False)}")
    if tool_response_count >= 3:
        # Switch to structured output phase:
        #   - Disable search tools
        #   - Allow only the structured output tool
        llm_request.config.tools = []
        llm_request.tools_dict = {}
        llm_request.append_tools([_transport_research_output_tool])
        llm_request.config.tool_config = ToolConfig(
            function_calling_config=FunctionCallingConfig(
                mode="any",
                allowed_function_names=[_transport_research_output_tool.name],
            )
        )
        if not state.get(_STRUCTURED_OUTPUT_STATE_KEY, False):
            llm_request.append_instructions([
                (
                    "You have completed your web research. Now you MUST call the "
                    "TransportResearchResult tool with all your findings. This is "
                    "the ONLY way to return your research data. Do NOT just output "
                    "JSON text - you MUST call the TransportResearchResult tool function."
                )
            ])
            state[_STRUCTURED_OUTPUT_STATE_KEY] = True


transport_research_agent = Agent(
    model="gemini-2.5-flash",
    name="transport_research_agent",
    description=(
        "Research accurate, real-world flight and transport costs between destinations"
        " using web search. Returns structured JSON with cost estimates (low/mid/high),"
        " airline options, flight details (duration, stops), and alternative routing"
        " suggestions (different airports, cities, multi-leg routes) with cost savings"
        " calculations. Searches for 2 adults + 1 child, checks ±3 days for best pricing."
    ),
    instruction=prompt.TRANSPORT_RESEARCH_AGENT_INSTR,
    tools=[google_search_grounding, _transport_research_output_tool],
    before_model_callback=structured_output_callback,
    generate_content_config=GenerateContentConfig(
        temperature=0.1,  # Low temperature for consistent, factual research
        top_p=0.5,
    )
)
