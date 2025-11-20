FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="/root/.local/bin:$PATH"

# Copy project files
COPY python/agents/travel-concierge/pyproject.toml python/agents/travel-concierge/poetry.lock* /app/python/agents/travel-concierge/

WORKDIR /app/python/agents/travel-concierge

# Install dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi

# Copy the rest of the code
COPY python /app/python

# Set python path
ENV PYTHONPATH=/app/python/agents

CMD ["python", "api_server.py"]
