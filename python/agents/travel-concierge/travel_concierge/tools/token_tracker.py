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

"""Token usage tracking and cost calculation for agent interactions."""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# Gemini 2.5 Flash pricing (as of Jan 2025)
# Source: https://ai.google.dev/pricing
GEMINI_FLASH_PRICING = {
    "input_per_1m": 0.075,  # $0.075 per 1M input tokens (prompts up to 128k)
    "output_per_1m": 0.30,  # $0.30 per 1M output tokens
    "input_per_1m_long": 0.15,  # $0.15 per 1M input tokens (prompts > 128k)
}

# Context caching pricing (if used)
CONTEXT_CACHE_PRICING = {
    "storage_per_1m_per_hour": 1.00,  # $1.00 per 1M tokens per hour
    "input_cached_per_1m": 0.01875,  # $0.01875 per 1M cached input tokens
}


@dataclass
class TokenUsage:
    """Track token usage for a single interaction."""

    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        """Total tokens used."""
        return self.input_tokens + self.output_tokens

    def calculate_cost(self, use_cache_pricing: bool = False) -> float:
        """Calculate cost in USD for this token usage.

        Args:
            use_cache_pricing: Whether to use cached input pricing

        Returns:
            Cost in USD
        """
        input_cost = 0.0

        if use_cache_pricing and self.cached_input_tokens > 0:
            # Cached inputs
            input_cost += (self.cached_input_tokens / 1_000_000) * CONTEXT_CACHE_PRICING["input_cached_per_1m"]
            # Non-cached inputs
            uncached = self.input_tokens - self.cached_input_tokens
            input_cost += (uncached / 1_000_000) * GEMINI_FLASH_PRICING["input_per_1m"]
        else:
            # All inputs at regular price
            input_cost = (self.input_tokens / 1_000_000) * GEMINI_FLASH_PRICING["input_per_1m"]

        # Output tokens
        output_cost = (self.output_tokens / 1_000_000) * GEMINI_FLASH_PRICING["output_per_1m"]

        return input_cost + output_cost

    def __add__(self, other: "TokenUsage") -> "TokenUsage":
        """Add two TokenUsage instances together."""
        return TokenUsage(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
            cached_input_tokens=self.cached_input_tokens + other.cached_input_tokens,
        )


@dataclass
class InteractionMetrics:
    """Track metrics for a complete cost research interaction."""

    destination_name: str
    duration_seconds: float
    token_usage: TokenUsage
    search_count: int = 0
    cache_hits: int = 0
    cache_misses: int = 0

    @property
    def cost_usd(self) -> float:
        """Calculate total cost in USD."""
        return self.token_usage.calculate_cost()

    @property
    def cost_per_search(self) -> float:
        """Average cost per search."""
        if self.search_count == 0:
            return 0.0
        return self.cost_usd / self.search_count

    def summary(self) -> Dict:
        """Return a summary dictionary."""
        return {
            "destination": self.destination_name,
            "duration_seconds": round(self.duration_seconds, 1),
            "input_tokens": self.token_usage.input_tokens,
            "output_tokens": self.token_usage.output_tokens,
            "total_tokens": self.token_usage.total_tokens,
            "cost_usd": round(self.cost_usd, 4),
            "cost_per_search": round(self.cost_per_search, 4),
            "searches": self.search_count,
            "cache_hit_rate": round(self.cache_hits / (self.cache_hits + self.cache_misses), 2) if (self.cache_hits + self.cache_misses) > 0 else 0,
        }


@dataclass
class CostResearchTracker:
    """Track aggregate metrics across multiple cost research requests."""

    interactions: List[InteractionMetrics] = field(default_factory=list)

    def add_interaction(self, metrics: InteractionMetrics):
        """Add a new interaction to the tracker."""
        self.interactions.append(metrics)
        self._log_interaction(metrics)

    def _log_interaction(self, metrics: InteractionMetrics):
        """Log interaction details."""
        summary = metrics.summary()
        logger.info(
            f"💰 Cost Research Complete | "
            f"{summary['destination']} | "
            f"⏱️ {summary['duration_seconds']}s | "
            f"🔢 {summary['total_tokens']:,} tokens | "
            f"💵 ${summary['cost_usd']:.4f} | "
            f"🔍 {summary['searches']} searches @ ${summary['cost_per_search']:.4f} each | "
            f"📊 {summary['cache_hit_rate']:.0%} cache hits"
        )

    @property
    def total_interactions(self) -> int:
        """Total number of interactions tracked."""
        return len(self.interactions)

    @property
    def total_cost(self) -> float:
        """Total cost across all interactions."""
        return sum(i.cost_usd for i in self.interactions)

    @property
    def total_tokens(self) -> int:
        """Total tokens across all interactions."""
        return sum(i.token_usage.total_tokens for i in self.interactions)

    @property
    def avg_cost_per_destination(self) -> float:
        """Average cost per destination research."""
        if not self.interactions:
            return 0.0
        return self.total_cost / len(self.interactions)

    @property
    def avg_duration(self) -> float:
        """Average research duration in seconds."""
        if not self.interactions:
            return 0.0
        return sum(i.duration_seconds for i in self.interactions) / len(self.interactions)

    def get_aggregate_stats(self) -> Dict:
        """Get aggregate statistics."""
        if not self.interactions:
            return {
                "total_interactions": 0,
                "total_cost_usd": 0,
                "total_tokens": 0,
                "avg_cost_per_destination": 0,
                "avg_duration_seconds": 0,
            }

        return {
            "total_interactions": self.total_interactions,
            "total_cost_usd": round(self.total_cost, 4),
            "total_tokens": self.total_tokens,
            "avg_cost_per_destination": round(self.avg_cost_per_destination, 4),
            "avg_duration_seconds": round(self.avg_duration, 1),
            "avg_tokens_per_destination": round(self.total_tokens / self.total_interactions),
            "total_input_tokens": sum(i.token_usage.input_tokens for i in self.interactions),
            "total_output_tokens": sum(i.token_usage.output_tokens for i in self.interactions),
        }

    def log_aggregate_stats(self):
        """Log aggregate statistics."""
        stats = self.get_aggregate_stats()
        if stats["total_interactions"] == 0:
            return

        logger.info(
            f"\n{'='*80}\n"
            f"📊 COST RESEARCH AGGREGATE STATS\n"
            f"{'='*80}\n"
            f"Total Destinations Researched: {stats['total_interactions']}\n"
            f"Total Cost: ${stats['total_cost_usd']:.4f}\n"
            f"Total Tokens: {stats['total_tokens']:,}\n"
            f"  - Input: {stats['total_input_tokens']:,}\n"
            f"  - Output: {stats['total_output_tokens']:,}\n"
            f"Average per Destination:\n"
            f"  - Cost: ${stats['avg_cost_per_destination']:.4f}\n"
            f"  - Duration: {stats['avg_duration_seconds']:.1f}s\n"
            f"  - Tokens: {stats['avg_tokens_per_destination']:,}\n"
            f"{'='*80}\n"
        )


# Global tracker instance
_tracker: Optional[CostResearchTracker] = None


def get_tracker() -> CostResearchTracker:
    """Get the global cost research tracker."""
    global _tracker
    if _tracker is None:
        _tracker = CostResearchTracker()
    return _tracker


def estimate_cost(input_tokens: int, output_tokens: int) -> float:
    """Estimate cost for given token counts.

    Args:
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        Estimated cost in USD
    """
    usage = TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens)
    return usage.calculate_cost()
