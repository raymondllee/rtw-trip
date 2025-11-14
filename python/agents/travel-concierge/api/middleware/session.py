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

"""Session management middleware."""

from flask import request
from typing import Optional
from api.middleware.error_handler import ValidationError


def get_session_id() -> str:
    """Get session ID from request.

    Returns:
        Session ID from request

    Raises:
        ValidationError: If session_id is missing
    """
    session_id = request.json.get("session_id") if request.is_json else None
    if not session_id:
        raise ValidationError("session_id is required", field="session_id")
    return session_id


def get_optional_session_id() -> Optional[str]:
    """Get optional session ID from request.

    Returns:
        Session ID from request, or None if not provided
    """
    if request.is_json:
        return request.json.get("session_id")
    return None

