# Local Development Guide

## Running on Alternate Ports (Local Shell)

If you need to run multiple instances of the application (e.g., to test different branches simultaneously), you can use the `start-alt.sh` script.

### Usage

```bash
./start-alt.sh [OFFSET]
```

- **OFFSET**: A number to add to the default ports.
  - Default ports: Frontend (5173), Flask API (5001), ADK API (8000)
  - Example: `./start-alt.sh 1000` will run on:
    - Frontend: 6173
    - Flask API: 6001
    - ADK API: 9000

### Example Workflow

1. **Terminal 1 (Branch A):**
   ```bash
   cd /path/to/repo-branch-a
   ./start-alt.sh
   # Runs on 5173, 5001, 8000
   ```

2. **Terminal 2 (Branch B):**
   ```bash
   cd /path/to/repo-branch-b
   ./start-alt.sh 1000
   # Runs on 6173, 6001, 9000
   ```

## Running with Docker

You can also use Docker to run the application in isolated containers.

### Prerequisites

- Docker and Docker Compose installed.
- `.env` file with necessary credentials (GOOGLE_MAPS_API_KEY, etc.).

### Usage

```bash
docker compose up --build
```

To run on alternate ports with Docker:

```bash
# Run with custom ports
FLASK_PORT=6001 ADK_PORT=9000 FRONTEND_PORT=6173 docker compose up
```

### Services

- **frontend**: The Vite development server.
- **backend**: The Flask API server.
- **adk**: The Agent Development Kit API server.

## Configuration

The application now supports environment variables for port configuration:

- **Frontend (`vite.config.ts`)**:
  - `VITE_PORT`: Sets the frontend server port.
  - `VITE_API_TARGET`: Sets the backend API URL for proxying.

- **Backend (`api_server.py`)**:
  - `PORT`: Sets the Flask server port.
