# Wellness Wheel App - Docker Setup

This document explains how to run the Wellness Wheel app using Docker for quick and easy local development.

## Prerequisites

- Docker installed on your system
- Docker Compose installed on your system

## Quick Start

### 1. Development Mode (Recommended for local development)

```bash
# Start development server with hot reloading
docker-compose up wellness-wheel-dev

# Or run in background
docker-compose up -d wellness-wheel-dev
```

The app will be available at: **http://localhost:3000**

### 2. Production Build

```bash
# Build and run production version
docker-compose up wellness-wheel-prod

# Or run in background
docker-compose up -d wellness-wheel-prod
```

The app will be available at: **http://localhost:8080**

### 3. Development with Nginx

```bash
# Run development version with nginx
docker-compose up wellness-wheel-nginx

# Or run in background
docker-compose up -d wellness-wheel-nginx
```

The app will be available at: **http://localhost:3001**

## Docker Commands

### Build Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build wellness-wheel-dev
docker-compose build wellness-wheel-prod
```

### Run Services

```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up wellness-wheel-dev

# Start in background
docker-compose up -d

# Start and rebuild
docker-compose up --build
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all
```

### View Logs

```bash
# View logs for all services
docker-compose logs

# View logs for specific service
docker-compose logs wellness-wheel-dev

# Follow logs in real-time
docker-compose logs -f wellness-wheel-dev
```

### Access Container Shell

```bash
# Access development container
docker-compose exec wellness-wheel-dev sh

# Access production container
docker-compose exec wellness-wheel-prod sh
```

## Development Workflow

### 1. Start Development Environment

```bash
docker-compose up wellness-wheel-dev
```

### 2. Make Code Changes

Edit your code files - the changes will automatically reload thanks to volume mounting and hot reloading.

### 3. View Changes

Open **http://localhost:3000** in your browser to see the app with live reloading.

### 4. Stop Development

```bash
docker-compose down
```

## Production Deployment

### 1. Build Production Image

```bash
docker-compose build wellness-wheel-prod
```

### 2. Run Production Container

```bash
docker-compose up wellness-wheel-prod
```

### 3. Access Production App

Open **http://localhost:8080** in your browser.

## Customization

### Environment Variables

You can customize the app by setting environment variables in the `docker-compose.yml` file:

```yaml
environment:
  - NODE_ENV=development
  - CHOKIDAR_USEPOLLING=true
  - WATCHPACK_POLLING=true
```

### Port Mapping

Change the port mappings in `docker-compose.yml` if you need different ports:

```yaml
ports:
  - "3000:3000"  # Host:Container
```

### Volume Mounting

The development services use volume mounting for hot reloading:

```yaml
volumes:
  - .:/app                    # Source code
  - /app/node_modules         # Preserve node_modules
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using the port
   lsof -i :3000
   
   # Kill the process or change port in docker-compose.yml
   ```

2. **Container won't start**
   ```bash
   # Check logs
   docker-compose logs wellness-wheel-dev
   
   # Rebuild image
   docker-compose build --no-cache wellness-wheel-dev
   ```

3. **Hot reloading not working**
   ```bash
   # Ensure volume mounting is correct
   docker-compose exec wellness-wheel-dev ls -la /app
   
   # Check file permissions
   docker-compose exec wellness-wheel-dev chown -R node:node /app
   ```

### Performance Tips

1. **Use .dockerignore** - Excludes unnecessary files from build context
2. **Multi-stage builds** - Production Dockerfile uses multi-stage build for smaller images
3. **Volume mounting** - Development uses volume mounting for fast file changes
4. **Nginx caching** - Production nginx configuration includes caching headers

## File Structure

```
.
├── Dockerfile              # Production multi-stage build
├── Dockerfile.dev          # Development with hot reloading
├── Dockerfile.dev-nginx    # Development with nginx
├── docker-compose.yml      # Service orchestration
├── nginx.conf              # Nginx configuration
├── .dockerignore           # Docker build exclusions
└── README-Docker.md        # This file
```

## Next Steps

- Customize the nginx configuration in `nginx.conf`
- Add environment-specific configurations
- Set up CI/CD pipeline with Docker
- Configure monitoring and logging
- Add health checks and metrics

## Support

For issues or questions about the Docker setup, check the logs and ensure all prerequisites are met.

