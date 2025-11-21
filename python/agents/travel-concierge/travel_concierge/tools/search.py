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

"""Wrapper to Google Search Grounding with custom prompt and caching."""

import hashlib
import time
from typing import Dict, Tuple

from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool

from google.adk.tools.google_search_tool import google_search

# Simple in-memory cache for search results
# Key: hash of search query, Value: (result, timestamp)
_search_cache: Dict[str, Tuple[str, float]] = {}
_CACHE_TTL_SECONDS = 3600  # 1 hour cache

def _get_cache_key(query: str) -> str:
    """Generate a cache key from a search query."""
    return hashlib.md5(query.lower().strip().encode()).hexdigest()


def _get_cached_result(query: str) -> str | None:
    """Retrieve cached search result if valid."""
    cache_key = _get_cache_key(query)
    if cache_key in _search_cache:
        result, timestamp = _search_cache[cache_key]
        if time.time() - timestamp < _CACHE_TTL_SECONDS:
            return result
        else:
            # Cache expired, remove it
            del _search_cache[cache_key]
    return None


def _cache_result(query: str, result: str):
    """Cache a search result."""
    cache_key = _get_cache_key(query)
    _search_cache[cache_key] = (result, time.time())


_search_agent = Agent(
    model="gemini-2.5-flash",
    name="google_search_grounding",
    description="An agent providing Google-search grounding capability with caching",
    instruction="""
    Answer the user's question using google_search grounding tool.
    Provide a concise, fact-focused response with key numbers and sources.
    Focus on actionable travel information (prices, costs, durations).
    Be brief - 1-2 sentences maximum per query.
    """,
    tools=[google_search],
)

google_search_grounding = AgentTool(agent=_search_agent)

# Note: The caching is implemented at the tool invocation level in the cost_research agent
# to avoid modifying the ADK's AgentTool interface. The cache is checked before calling
# google_search_grounding, not within the tool itself.
