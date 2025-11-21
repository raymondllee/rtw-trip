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

"""The 'memorize' tool for several agents to affect session states."""

from datetime import datetime
import json
import os
from pathlib import Path
from typing import Dict, Any

from google.adk.agents.callback_context import CallbackContext
from google.adk.sessions.state import State
from google.adk.tools import ToolContext

from travel_concierge.shared_libraries import constants

# Get the directory containing this module to construct relative paths
MODULE_DIR = Path(__file__).parent.parent  # Goes up to travel_concierge/

SAMPLE_SCENARIO_PATH = os.getenv(
    "TRAVEL_CONCIERGE_SCENARIO",
    str(MODULE_DIR / "profiles" / "itinerary_empty_default.json")
)

SESSION_STATE_FILE = "session_state.json"


def save_session_state(state: dict):
    """
    Save the session state to a JSON file.
    """
    with open(SESSION_STATE_FILE, "w") as f:
        json.dump({"state": state}, f, indent=2)


def load_session_state() -> dict | None:
    """
    Load the session state from a JSON file if it exists.
    """
    if os.path.exists(SESSION_STATE_FILE):
        with open(SESSION_STATE_FILE, "r") as f:
            data = json.load(f)
            return data.get("state", {})
    return None


def memorize_list(key: str, value: str, tool_context: ToolContext):
    """
    Memorize pieces of information.

    Args:
        key: the label indexing the memory to store the value.
        value: the information to be stored.
        tool_context: The ADK tool context.

    Returns:
        A status message.
    """
    mem_dict = tool_context.state
    if key not in mem_dict:
        mem_dict[key] = []
    if value not in mem_dict[key]:
        mem_dict[key].append(value)
    return {"status": f'Stored "{key}": "{value}"'}


def memorize(key: str, value: str, tool_context: ToolContext):
    """
    Memorize pieces of information, one key-value pair at a time.

    Args:
        key: the label indexing the memory to store the value.
        value: the information to be stored.
        tool_context: The ADK tool context.

    Returns:
        A status message.
    """
    mem_dict = tool_context.state
    mem_dict[key] = value
    return {"status": f'Stored "{key}": "{value}"'}


def forget(key: str, value: str, tool_context: ToolContext):
    """
    Forget pieces of information.

    Args:
        key: the label indexing the memory to store the value.
        value: the information to be removed.
        tool_context: The ADK tool context.

    Returns:
        A status message.
    """
    if tool_context.state[key] is None:
        tool_context.state[key] = []
    if value in tool_context.state[key]:
        tool_context.state[key].remove(value)
    return {"status": f'Removed "{key}": "{value}"'}


def _set_initial_states(source: Dict[str, Any], target: State | dict[str, Any]):
    """
    Setting the initial session state given a JSON object of states.

    Args:
        source: A JSON object of states.
        target: The session state object to insert into.
    """
    if constants.SYSTEM_TIME not in target:
        target[constants.SYSTEM_TIME] = str(datetime.now())

    # ALWAYS check if itinerary exists in target (passed from API) and preserve it
    # This allows the API server to pass fresh itinerary data on every request
    existing_itinerary = target.get(constants.ITIN_KEY)
    has_existing_itinerary = existing_itinerary and (
        isinstance(existing_itinerary, dict) and
        existing_itinerary.get('locations')
    )

    if constants.ITIN_INITIALIZED not in target:
        target[constants.ITIN_INITIALIZED] = True
        target.update(source)

    # Restore/use the existing itinerary if we have one (from API)
    # Otherwise use the one from the source (default scenario file)
    if has_existing_itinerary:
        target[constants.ITIN_KEY] = existing_itinerary
        itinerary = existing_itinerary
        print(f"[memory] Preserved itinerary from API with {len(existing_itinerary.get('locations', []))} locations")
    else:
        itinerary = source.get(constants.ITIN_KEY, {})
        if itinerary:
            print(f"[memory] Using itinerary from scenario file")

    if itinerary:
        # Get dates from itinerary or trip sub-object
        if constants.START_DATE in itinerary:
            target[constants.ITIN_START_DATE] = itinerary[constants.START_DATE]
            target[constants.ITIN_END_DATE] = itinerary[constants.END_DATE]
            target[constants.ITIN_DATETIME] = itinerary[constants.START_DATE]
        elif 'trip' in itinerary:
            trip = itinerary['trip']
            target[constants.ITIN_START_DATE] = trip.get(constants.START_DATE, '')
            target[constants.ITIN_END_DATE] = trip.get(constants.END_DATE, '')
            target[constants.ITIN_DATETIME] = trip.get(constants.START_DATE, '')


def _load_precreated_itinerary(callback_context: CallbackContext):
    """
    Sets up the initial state.
    Set this as a callback as before_agent_call of the root_agent.
    This gets called before the system instruction is contructed.

    Args:
        callback_context: The callback context.
    """
    data = {}
    with open(SAMPLE_SCENARIO_PATH, "r") as file:
        data = json.load(file)
        print(f"\nLoading Initial State: {data}\n")

    _set_initial_states(data["state"], callback_context.state)
