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

"""Error handling middleware for API endpoints."""

import logging
import traceback
from flask import jsonify
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Base exception for API errors."""

    def __init__(self, message: str, status_code: int = 500, error_code: Optional[str] = None):
        """Initialize API error.

        Args:
            message: Error message
            status_code: HTTP status code
            error_code: Error code for client handling
        """
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(self.message)


class ValidationError(APIError):
    """Exception for validation errors."""

    def __init__(self, message: str, field: Optional[str] = None):
        """Initialize validation error.

        Args:
            message: Error message
            field: Field that failed validation
        """
        super().__init__(message, status_code=400, error_code="VALIDATION_ERROR")
        self.field = field


class NotFoundError(APIError):
    """Exception for not found errors."""

    def __init__(self, message: str, resource: Optional[str] = None):
        """Initialize not found error.

        Args:
            message: Error message
            resource: Resource that was not found
        """
        super().__init__(message, status_code=404, error_code="NOT_FOUND")
        self.resource = resource


class InternalServerError(APIError):
    """Exception for internal server errors."""

    def __init__(self, message: str = "Internal server error"):
        """Initialize internal server error.

        Args:
            message: Error message
        """
        super().__init__(message, status_code=500, error_code="INTERNAL_ERROR")


def create_error_response(
    error: Exception,
    include_traceback: bool = False,
) -> tuple[Dict[str, Any], int]:
    """Create standardized error response.

    Args:
        error: Exception that occurred
        include_traceback: Whether to include stack trace (for debugging)

    Returns:
        Tuple of (error response dict, status code)
    """
    if isinstance(error, APIError):
        response = {
            "status": "error",
            "error_code": error.error_code,
            "message": error.message,
        }
        if hasattr(error, "field"):
            response["field"] = error.field
        if hasattr(error, "resource"):
            response["resource"] = error.resource
        status_code = error.status_code
    else:
        response = {
            "status": "error",
            "error_code": "INTERNAL_ERROR",
            "message": str(error) if str(error) else "Internal server error",
        }
        status_code = 500

    if include_traceback:
        response["traceback"] = traceback.format_exc()

    logger.error(f"API Error: {error}", exc_info=True)

    return response, status_code


def handle_error(error: Exception) -> tuple[Dict[str, Any], int]:
    """Handle error and return standardized response.

    Args:
        error: Exception that occurred

    Returns:
        Tuple of (error response dict, status code)
    """
    return create_error_response(error, include_traceback=False)


def register_error_handlers(app):
    """Register error handlers with Flask app.

    Args:
        app: Flask application instance
    """
    @app.errorhandler(APIError)
    def handle_api_error(error: APIError):
        """Handle API errors."""
        response, status_code = create_error_response(error)
        return jsonify(response), status_code

    @app.errorhandler(ValidationError)
    def handle_validation_error(error: ValidationError):
        """Handle validation errors."""
        response, status_code = create_error_response(error)
        return jsonify(response), status_code

    @app.errorhandler(NotFoundError)
    def handle_not_found_error(error: NotFoundError):
        """Handle not found errors."""
        response, status_code = create_error_response(error)
        return jsonify(response), status_code

    @app.errorhandler(500)
    def handle_internal_error(error):
        """Handle internal server errors."""
        response, status_code = create_error_response(error)
        return jsonify(response), status_code

    @app.errorhandler(Exception)
    def handle_generic_error(error: Exception):
        """Handle generic errors."""
        response, status_code = create_error_response(error)
        return jsonify(response), status_code

