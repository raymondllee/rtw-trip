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

"""Prompt A/B testing framework for agent prompt optimization."""

import hashlib
import random
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict


@dataclass
class PromptVersion:
    """A version of a prompt for A/B testing."""

    version_id: str
    prompt_text: str
    description: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    is_active: bool = True
    traffic_percentage: float = 50.0  # Percentage of traffic to use this version


@dataclass
class PromptTestResult:
    """Result of a prompt test."""

    version_id: str
    session_id: str
    response_time_ms: float
    token_usage: Optional[Dict[str, int]] = None
    success: bool = True
    error: Optional[str] = None
    user_rating: Optional[float] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)


class PromptABTester:
    """A/B testing framework for prompts."""

    def __init__(self):
        """Initialize prompt A/B tester."""
        self.prompts: Dict[str, List[PromptVersion]] = defaultdict(list)
        self.results: List[PromptTestResult] = []
        self.session_assignments: Dict[str, str] = {}  # session_id -> version_id

    def register_prompt_version(
        self,
        prompt_name: str,
        version_id: str,
        prompt_text: str,
        description: Optional[str] = None,
        traffic_percentage: float = 50.0,
    ):
        """Register a prompt version for A/B testing.

        Args:
            prompt_name: Name of the prompt (e.g., "root_agent")
            version_id: Unique identifier for this version
            prompt_text: The prompt text
            description: Description of this version
            traffic_percentage: Percentage of traffic to use this version
        """
        version = PromptVersion(
            version_id=version_id,
            prompt_text=prompt_text,
            description=description,
            traffic_percentage=traffic_percentage,
        )
        self.prompts[prompt_name].append(version)

    def get_prompt_version(
        self,
        prompt_name: str,
        session_id: str,
    ) -> Tuple[str, str]:
        """Get prompt version for a session.

        Args:
            prompt_name: Name of the prompt
            session_id: Session ID

        Returns:
            Tuple of (version_id, prompt_text)
        """
        # Check if session already has an assignment
        if session_id in self.session_assignments:
            version_id = self.session_assignments[session_id]
            versions = [v for v in self.prompts[prompt_name] if v.version_id == version_id and v.is_active]
            if versions:
                return version_id, versions[0].prompt_text

        # Assign version based on traffic percentage
        active_versions = [v for v in self.prompts[prompt_name] if v.is_active]
        if not active_versions:
            raise ValueError(f"No active versions found for prompt: {prompt_name}")

        # Simple random assignment based on traffic percentage
        total_percentage = sum(v.traffic_percentage for v in active_versions)
        if total_percentage > 100.0:
            # Normalize percentages
            for v in active_versions:
                v.traffic_percentage = (v.traffic_percentage / total_percentage) * 100.0

        rand = random.random() * 100.0
        cumulative = 0.0
        selected_version = active_versions[0]  # Default to first

        for version in active_versions:
            cumulative += version.traffic_percentage
            if rand <= cumulative:
                selected_version = version
                break

        # Store assignment
        self.session_assignments[session_id] = selected_version.version_id

        return selected_version.version_id, selected_version.prompt_text

    def record_result(
        self,
        version_id: str,
        session_id: str,
        response_time_ms: float,
        token_usage: Optional[Dict[str, int]] = None,
        success: bool = True,
        error: Optional[str] = None,
        user_rating: Optional[float] = None,
    ):
        """Record test result.

        Args:
            version_id: Version ID that was tested
            session_id: Session ID
            response_time_ms: Response time in milliseconds
            token_usage: Token usage statistics
            success: Whether the response was successful
            error: Error message if failed
            user_rating: User rating (1-5 scale)
        """
        result = PromptTestResult(
            version_id=version_id,
            session_id=session_id,
            response_time_ms=response_time_ms,
            token_usage=token_usage,
            success=success,
            error=error,
            user_rating=user_rating,
        )
        self.results.append(result)

    def get_version_stats(self, prompt_name: str) -> Dict[str, Dict[str, any]]:
        """Get statistics for all versions of a prompt.

        Args:
            prompt_name: Name of the prompt

        Returns:
            Dictionary mapping version_id to statistics
        """
        stats = {}
        versions = self.prompts[prompt_name]

        for version in versions:
            version_results = [r for r in self.results if r.version_id == version.version_id]
            
            if not version_results:
                stats[version.version_id] = {
                    "version_id": version.version_id,
                    "description": version.description,
                    "total_tests": 0,
                }
                continue

            successful = [r for r in version_results if r.success]
            avg_response_time = sum(r.response_time_ms for r in version_results) / len(version_results)
            avg_user_rating = (
                sum(r.user_rating for r in version_results if r.user_rating is not None)
                / len([r for r in version_results if r.user_rating is not None])
                if any(r.user_rating for r in version_results)
                else None
            )

            total_tokens = sum(
                (r.token_usage.get("input_tokens", 0) + r.token_usage.get("output_tokens", 0))
                for r in version_results
                if r.token_usage
            )

            stats[version.version_id] = {
                "version_id": version.version_id,
                "description": version.description,
                "total_tests": len(version_results),
                "success_count": len(successful),
                "error_count": len(version_results) - len(successful),
                "success_rate": len(successful) / len(version_results) if version_results else 0.0,
                "avg_response_time_ms": avg_response_time,
                "avg_user_rating": avg_user_rating,
                "total_tokens": total_tokens,
            }

        return stats


# Global A/B tester instance
_ab_tester: Optional[PromptABTester] = None


def get_ab_tester() -> PromptABTester:
    """Get or create A/B tester instance.

    Returns:
        PromptABTester instance
    """
    global _ab_tester
    if _ab_tester is None:
        _ab_tester = PromptABTester()
    return _ab_tester


def register_prompt_version(
    prompt_name: str,
    version_id: str,
    prompt_text: str,
    description: Optional[str] = None,
    traffic_percentage: float = 50.0,
):
    """Register a prompt version for A/B testing.

    Args:
        prompt_name: Name of the prompt
        version_id: Unique identifier for this version
        prompt_text: The prompt text
        description: Description of this version
        traffic_percentage: Percentage of traffic to use this version
    """
    tester = get_ab_tester()
    tester.register_prompt_version(
        prompt_name=prompt_name,
        version_id=version_id,
        prompt_text=prompt_text,
        description=description,
        traffic_percentage=traffic_percentage,
    )


def get_prompt_version(prompt_name: str, session_id: str) -> Tuple[str, str]:
    """Get prompt version for a session.

    Args:
        prompt_name: Name of the prompt
        session_id: Session ID

    Returns:
        Tuple of (version_id, prompt_text)
    """
    tester = get_ab_tester()
    return tester.get_prompt_version(prompt_name, session_id)

