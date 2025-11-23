#!/bin/bash

# Wellness Wheel App - Docker Development Helper Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  dev         Start development server (http://localhost:3000)"
    echo "  prod        Start production server (http://localhost:8080)"
    echo "  nginx       Start development with nginx (http://localhost:3001)"
    echo "  build       Build all Docker images"
    echo "  stop        Stop all running containers"
    echo "  logs        Show logs for development container"
    echo "  shell       Access development container shell"
    echo "  clean       Remove all containers, images, and volumes"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev      # Start development server"
    echo "  $0 prod     # Start production server"
    echo "  $0 clean    # Clean up Docker resources"
}

# Function to start development server
start_dev() {
    print_status "Starting development server..."
    docker-compose up -d wellness-wheel-dev
    print_success "Development server started at http://localhost:3000"
    print_status "Use 'docker-compose logs -f wellness-wheel-dev' to view logs"
}

# Function to start production server
start_prod() {
    print_status "Starting production server..."
    docker-compose up -d wellness-wheel-prod
    print_success "Production server started at http://localhost:8080"
}

# Function to start nginx development server
start_nginx() {
    print_status "Starting development server with nginx..."
    docker-compose up -d wellness-wheel-nginx
    print_success "Nginx development server started at http://localhost:3001"
}

# Function to build images
build_images() {
    print_status "Building Docker images..."
    docker-compose build
    print_success "All images built successfully"
}

# Function to stop containers
stop_containers() {
    print_status "Stopping all containers..."
    docker-compose down
    print_success "All containers stopped"
}

# Function to show logs
show_logs() {
    print_status "Showing logs for development container..."
    docker-compose logs -f wellness-wheel-dev
}

# Function to access shell
access_shell() {
    print_status "Accessing development container shell..."
    docker-compose exec wellness-wheel-dev sh
}

# Function to clean up
clean_up() {
    print_warning "This will remove ALL containers, images, and volumes. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up Docker resources..."
        docker-compose down -v --rmi all
        docker system prune -af
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Main script logic
main() {
    check_docker
    
    case "${1:-help}" in
        dev)
            start_dev
            ;;
        prod)
            start_prod
            ;;
        nginx)
            start_nginx
            ;;
        build)
            build_images
            ;;
        stop)
            stop_containers
            ;;
        logs)
            show_logs
            ;;
        shell)
            access_shell
            ;;
        clean)
            clean_up
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"

