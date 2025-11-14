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

"""Agent monitoring dashboard.

Provides API endpoints for viewing agent metrics and performance.
"""

from flask import Blueprint, jsonify
from typing import Dict, Any
from monitoring.metrics import get_all_metrics
from monitoring.logger import get_logger

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/api/monitoring/metrics', methods=['GET'])
def get_metrics():
    """Get all agent metrics.

    Returns:
        JSON response with metrics for all agents
    """
    try:
        metrics = get_all_metrics()
        return jsonify({
            "status": "success",
            "metrics": metrics,
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
        }), 500


@dashboard_bp.route('/api/monitoring/metrics/<agent_name>', methods=['GET'])
def get_agent_metrics(agent_name: str):
    """Get metrics for a specific agent.

    Args:
        agent_name: Name of the agent

    Returns:
        JSON response with metrics for the agent
    """
    try:
        from monitoring.metrics import get_metrics
        agent_metrics = get_metrics(agent_name)
        stats = agent_metrics.get_stats()
        return jsonify({
            "status": "success",
            "agent_name": agent_name,
            "metrics": stats,
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
        }), 500


@dashboard_bp.route('/api/monitoring/health', methods=['GET'])
def health_check():
    """Health check endpoint.

    Returns:
        JSON response with health status
    """
    try:
        metrics = get_all_metrics()
        total_errors = sum(m.get("error_count", 0) for m in metrics.values())
        total_responses = sum(m.get("total_responses", 0) for m in metrics.values())
        
        health_status = "healthy"
        if total_responses > 0:
            error_rate = total_errors / total_responses
            if error_rate > 0.1:  # 10% error rate threshold
                health_status = "degraded"
            if error_rate > 0.25:  # 25% error rate threshold
                health_status = "unhealthy"

        return jsonify({
            "status": "success",
            "health": health_status,
            "total_responses": total_responses,
            "total_errors": total_errors,
            "error_rate": total_errors / total_responses if total_responses > 0 else 0.0,
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
        }), 500

