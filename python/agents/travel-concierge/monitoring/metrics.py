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

"""Metrics collection for agent performance tracking."""

import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class AgentMetrics:
    """Metrics for agent performance."""

    agent_name: str
    response_times: List[float] = field(default_factory=list)
    token_usage: List[Dict[str, int]] = field(default_factory=list)
    error_count: int = 0
    success_count: int = 0
    tool_call_count: int = 0
    last_updated: Optional[datetime] = None

    def record_response(
        self,
        duration_ms: float,
        token_usage: Optional[Dict[str, int]] = None,
        success: bool = True,
    ):
        """Record agent response metrics.

        Args:
            duration_ms: Response duration in milliseconds
            token_usage: Token usage statistics
            success: Whether the response was successful
        """
        self.response_times.append(duration_ms)
        if token_usage:
            self.token_usage.append(token_usage)
        if success:
            self.success_count += 1
        else:
            self.error_count += 1
        self.last_updated = datetime.utcnow()

    def record_tool_call(self):
        """Record a tool call."""
        self.tool_call_count += 1
        self.last_updated = datetime.utcnow()

    def get_stats(self) -> Dict[str, any]:
        """Get aggregated statistics.

        Returns:
            Dictionary with aggregated metrics
        """
        stats = {
            "agent_name": self.agent_name,
            "total_responses": self.success_count + self.error_count,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "error_rate": (
                self.error_count / (self.success_count + self.error_count)
                if (self.success_count + self.error_count) > 0
                else 0.0
            ),
            "tool_call_count": self.tool_call_count,
        }

        if self.response_times:
            stats["avg_response_time_ms"] = sum(self.response_times) / len(self.response_times)
            stats["min_response_time_ms"] = min(self.response_times)
            stats["max_response_time_ms"] = max(self.response_times)
            stats["p95_response_time_ms"] = sorted(self.response_times)[
                int(len(self.response_times) * 0.95)
            ]

        if self.token_usage:
            total_input_tokens = sum(t.get("input_tokens", 0) for t in self.token_usage)
            total_output_tokens = sum(t.get("output_tokens", 0) for t in self.token_usage)
            stats["total_input_tokens"] = total_input_tokens
            stats["total_output_tokens"] = total_output_tokens
            stats["total_tokens"] = total_input_tokens + total_output_tokens

        if self.last_updated:
            stats["last_updated"] = self.last_updated.isoformat() + "Z"

        return stats


class MetricsCollector:
    """Collector for agent metrics."""

    def __init__(self):
        """Initialize metrics collector."""
        self.metrics: Dict[str, AgentMetrics] = defaultdict(
            lambda: AgentMetrics(agent_name="unknown")
        )

    def get_metrics(self, agent_name: str) -> AgentMetrics:
        """Get or create metrics for an agent.

        Args:
            agent_name: Name of the agent

        Returns:
            AgentMetrics instance
        """
        if agent_name not in self.metrics:
            self.metrics[agent_name] = AgentMetrics(agent_name=agent_name)
        return self.metrics[agent_name]

    def get_all_stats(self) -> Dict[str, Dict[str, any]]:
        """Get statistics for all agents.

        Returns:
            Dictionary mapping agent names to their statistics
        """
        return {name: metrics.get_stats() for name, metrics in self.metrics.items()}

    def reset(self):
        """Reset all metrics."""
        self.metrics.clear()


# Global metrics collector instance
_metrics_collector: Optional[MetricsCollector] = None


def get_metrics(agent_name: str = "unknown") -> AgentMetrics:
    """Get metrics for an agent.

    Args:
        agent_name: Name of the agent

    Returns:
        AgentMetrics instance
    """
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector.get_metrics(agent_name)


def get_all_metrics() -> Dict[str, Dict[str, any]]:
    """Get all agent metrics.

    Returns:
        Dictionary mapping agent names to their statistics
    """
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector.get_all_stats()

