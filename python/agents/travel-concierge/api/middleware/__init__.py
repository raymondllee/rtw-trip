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

"""API middleware."""

from api.middleware.error_handler import (
    APIError,
    ValidationError,
    NotFoundError,
    InternalServerError,
    create_error_response,
    handle_error,
    register_error_handlers,
)
from api.middleware.session import get_session_id, get_optional_session_id

__all__ = [
    "APIError",
    "ValidationError",
    "NotFoundError",
    "InternalServerError",
    "create_error_response",
    "handle_error",
    "register_error_handlers",
    "get_session_id",
    "get_optional_session_id",
]

