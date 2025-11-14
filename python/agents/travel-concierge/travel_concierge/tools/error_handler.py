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

"""Standardized error handling for agent tools."""

from typing import Dict, Any, Optional
from google.adk.tools import ToolContext


class ToolError(Exception):
    """Base exception for tool errors."""

    def __init__(self, message: str, error_code: Optional[str] = None):
        """Initialize tool error.

        Args:
            message: Error message
            error_code: Error code for handling
        """
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class ToolValidationError(ToolError):
    """Exception for tool validation errors."""

    def __init__(self, message: str, field: Optional[str] = None):
        """Initialize tool validation error.

        Args:
            message: Error message
            field: Field that failed validation
        """
        super().__init__(message, error_code="VALIDATION_ERROR")
        self.field = field


class ToolExecutionError(ToolError):
    """Exception for tool execution errors."""

    def __init__(self, message: str, tool_name: Optional[str] = None):
        """Initialize tool execution error.

        Args:
            message: Error message
            tool_name: Name of the tool that failed
        """
        super().__init__(message, error_code="EXECUTION_ERROR")
        self.tool_name = tool_name


def create_tool_error_response(
    error: Exception,
    tool_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Create standardized error response for tools.

    Args:
        error: Exception that occurred
        tool_name: Name of the tool that failed

    Returns:
        Error response dictionary
    """
    if isinstance(error, ToolError):
        response = {
            "status": "error",
            "error_code": error.error_code,
            "message": error.message,
        }
        if hasattr(error, "field"):
            response["field"] = error.field
        if hasattr(error, "tool_name"):
            response["tool_name"] = error.tool_name
    else:
        response = {
            "status": "error",
            "error_code": "INTERNAL_ERROR",
            "message": str(error) if str(error) else "Tool execution failed",
        }

    if tool_name:
        response["tool_name"] = tool_name

    return response


def handle_tool_error(error: Exception, tool_name: Optional[str] = None) -> Dict[str, Any]:
    """Handle tool error and return standardized response.

    Args:
        error: Exception that occurred
        tool_name: Name of the tool that failed

    Returns:
        Error response dictionary
    """
    return create_tool_error_response(error, tool_name=tool_name)


def validate_tool_context(tool_context: Optional[ToolContext]) -> ToolContext:
    """Validate tool context.

    Args:
        tool_context: Tool context to validate

    Returns:
        Validated tool context

    Raises:
        ToolValidationError: If tool context is invalid
    """
    if not tool_context:
        raise ToolValidationError("tool_context is required", field="tool_context")
    return tool_context

