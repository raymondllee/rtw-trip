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
import logging
from typing import Dict, Tuple

from google.adk.agents import Agent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools.base_tool import BaseTool

from google.adk.tools.google_search_tool import google_search

logger = logging.getLogger(__name__)

# Simple in-memory cache for search results
# Key: hash of search query, Value: (result, timestamp)
_search_cache: Dict[str, Tuple[str, float]] = {}
_CACHE_TTL_SECONDS = 3600  # 1 hour cache
_cache_hits = 0
_cache_misses = 0


def _get_cache_key(query: str) -> str:
    """Generate a cache key from a search query."""
    return hashlib.md5(query.lower().strip().encode()).hexdigest()


def _get_cached_result(query: str) -> str | None:
    """Retrieve cached search result if valid."""
    global _cache_hits, _cache_misses
    cache_key = _get_cache_key(query)
    if cache_key in _search_cache:
        result, timestamp = _search_cache[cache_key]
        if time.time() - timestamp < _CACHE_TTL_SECONDS:
            _cache_hits += 1
            logger.info(f"Cache HIT for query: {query[:50]}... (total hits: {_cache_hits})")
            return result
        else:
            # Cache expired, remove it
            del _search_cache[cache_key]
    _cache_misses += 1
    logger.info(f"Cache MISS for query: {query[:50]}... (total misses: {_cache_misses})")
    return None


def _cache_result(query: str, result: str):
    """Cache a search result."""
    cache_key = _get_cache_key(query)
    _search_cache[cache_key] = (result, time.time())
    logger.info(f"Cached result for query: {query[:50]}... (cache size: {len(_search_cache)})")


def get_cache_stats() -> Dict[str, int]:
    """Get cache statistics."""
    return {
        "cache_hits": _cache_hits,
        "cache_misses": _cache_misses,
        "cache_size": len(_search_cache),
        "hit_rate": _cache_hits / (_cache_hits + _cache_misses) if (_cache_hits + _cache_misses) > 0 else 0.0,
    }


# Streamlined search agent with minimal prompt overhead
_search_agent = Agent(
    model="gemini-2.5-flash",
    name="google_search_grounding",
    description="Fast Google search for travel cost research",
    instruction="""Answer using google_search. Be concise: key prices, sources, 1-2 sentences max.""",
    tools=[google_search],
)

google_search_grounding_base = AgentTool(agent=_search_agent)


class CachedSearchTool(BaseTool):
    """Search tool with built-in caching for faster repeated queries."""

    def __init__(self):
        super().__init__(
            name="google_search_grounding",
            description=(
                "Search Google for travel cost information. Results are cached for 1 hour. "
                "Use for researching accommodation, food, transport, and activity prices."
            ),
        )
        self._base_tool = google_search_grounding_base

    def _get_declaration(self):
        """Return the function declaration for the search tool."""
        return self._base_tool._get_declaration()

    async def run_async(self, *, args: dict, tool_context):
        """Execute search with caching."""
        query = args.get("query", "")

        # Check cache first
        cached_result = _get_cached_result(query)
        if cached_result:
            return cached_result

        # Cache miss - execute actual search
        start_time = time.time()
        result = await self._base_tool.run_async(args=args, tool_context=tool_context)
        duration_ms = (time.time() - start_time) * 1000

        logger.info(f"Search completed in {duration_ms:.0f}ms for query: {query[:50]}...")

        # Cache the result (convert to string if needed)
        result_str = str(result) if not isinstance(result, str) else result
        _cache_result(query, result_str)

        return result


# Export the cached version as the default
google_search_grounding = CachedSearchTool()
