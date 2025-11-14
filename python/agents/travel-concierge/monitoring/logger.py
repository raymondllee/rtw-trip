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

"""Structured logging for agent decisions and tool calls."""

import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, Optional
from functools import wraps


class AgentLogger:
    """Structured logger for agent operations."""

    def __init__(self, name: str = "travel_concierge", level: int = logging.INFO):
        """Initialize agent logger.

        Args:
            name: Logger name
            level: Logging level
        """
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)

        # Create console handler if not exists
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setLevel(level)
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

    def log_agent_decision(
        self,
        agent_name: str,
        user_message: str,
        decision: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Log agent decision.

        Args:
            agent_name: Name of the agent making the decision
            user_message: User's input message
            decision: Agent's decision (e.g., "delegate to inspiration_agent")
            metadata: Additional metadata
        """
        log_data = {
            "event_type": "agent_decision",
            "agent_name": agent_name,
            "user_message": user_message,
            "decision": decision,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        if metadata:
            log_data["metadata"] = metadata

        self.logger.info(json.dumps(log_data))

    def log_tool_call(
        self,
        tool_name: str,
        agent_name: str,
        args: Dict[str, Any],
        result: Optional[Dict[str, Any]] = None,
        duration_ms: Optional[float] = None,
        error: Optional[str] = None,
    ):
        """Log tool call.

        Args:
            tool_name: Name of the tool called
            agent_name: Name of the agent calling the tool
            args: Tool arguments
            result: Tool result (if successful)
            duration_ms: Duration in milliseconds
            error: Error message (if failed)
        """
        log_data = {
            "event_type": "tool_call",
            "tool_name": tool_name,
            "agent_name": agent_name,
            "args": args,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        if result:
            log_data["result"] = result
            log_data["status"] = "success"
        if duration_ms:
            log_data["duration_ms"] = duration_ms
        if error:
            log_data["error"] = error
            log_data["status"] = "error"

        self.logger.info(json.dumps(log_data))

    def log_agent_response(
        self,
        agent_name: str,
        response_text: str,
        duration_ms: Optional[float] = None,
        token_usage: Optional[Dict[str, int]] = None,
    ):
        """Log agent response.

        Args:
            agent_name: Name of the agent
            response_text: Agent's response text
            duration_ms: Response duration in milliseconds
            token_usage: Token usage statistics
        """
        log_data = {
            "event_type": "agent_response",
            "agent_name": agent_name,
            "response_text": response_text[:500],  # Truncate for logging
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        if duration_ms:
            log_data["duration_ms"] = duration_ms
        if token_usage:
            log_data["token_usage"] = token_usage

        self.logger.info(json.dumps(log_data))

    def log_error(
        self,
        agent_name: str,
        error_type: str,
        error_message: str,
        stack_trace: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        """Log error.

        Args:
            agent_name: Name of the agent where error occurred
            error_type: Type of error
            error_message: Error message
            stack_trace: Stack trace (if available)
            context: Additional context
        """
        log_data = {
            "event_type": "error",
            "agent_name": agent_name,
            "error_type": error_type,
            "error_message": error_message,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        if stack_trace:
            log_data["stack_trace"] = stack_trace
        if context:
            log_data["context"] = context

        self.logger.error(json.dumps(log_data))


# Global logger instance
_logger_instance: Optional[AgentLogger] = None


def get_logger(name: str = "travel_concierge") -> AgentLogger:
    """Get or create logger instance.

    Args:
        name: Logger name

    Returns:
        AgentLogger instance
    """
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = AgentLogger(name=name)
    return _logger_instance


def log_tool_call(func):
    """Decorator to log tool calls automatically."""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        logger = get_logger()
        tool_name = func.__name__
        start_time = time.time()

        # Extract agent name from context if available
        agent_name = "unknown"
        tool_context = kwargs.get("tool_context")
        if tool_context:
            agent_name = getattr(tool_context, "agent_name", "unknown")

        try:
            result = await func(*args, **kwargs)
            duration_ms = (time.time() - start_time) * 1000

            logger.log_tool_call(
                tool_name=tool_name,
                agent_name=agent_name,
                args=kwargs,
                result=result if isinstance(result, dict) else None,
                duration_ms=duration_ms,
            )

            return result
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000

            logger.log_tool_call(
                tool_name=tool_name,
                agent_name=agent_name,
                args=kwargs,
                duration_ms=duration_ms,
                error=str(e),
            )

            raise

    return wrapper

