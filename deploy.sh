#!/bin/bash

echo "Warder TX Scanner Deployment Script"
echo "===================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Option 1: Deploy with PM2 (recommended for VPS/servers)
deploy_with_pm2() {
    echo "Deploying with PM2..."
    
    # Check if PM2 is installed
    if ! command_exists pm2; then
        echo "PM2 not found. Installing PM2 globally..."
        npm install -g pm2
    fi
    
    # Build the application
    echo "Building application..."
    npm run build
    
    # Stop existing instance if running
    pm2 stop warder-tx-scanner 2>/dev/null || true
    pm2 delete warder-tx-scanner 2>/dev/null || true
    
    # Start with PM2
    echo "Starting scanner with PM2..."
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 to start on system boot
    pm2 startup
    
    echo "Scanner deployed with PM2!"
    echo "Commands:"
    echo "  pm2 status          - Check scanner status"
    echo "  pm2 logs            - View logs"
    echo "  pm2 restart all     - Restart scanner"
    echo "  pm2 stop all        - Stop scanner"
}

# Option 2: Deploy with Docker
deploy_with_docker() {
    echo "Deploying with Docker..."
    
    # Check if Docker is installed
    if ! command_exists docker; then
        echo "Docker not found. Please install Docker first."
        exit 1
    fi
    
    # Stop and remove existing container
    docker-compose down 2>/dev/null || true
    
    # Build and start container
    echo "Building and starting Docker container..."
    docker-compose up -d --build
    
    echo "Scanner deployed with Docker!"
    echo "Commands:"
    echo "  docker-compose ps           - Check container status"
    echo "  docker-compose logs -f      - View logs"
    echo "  docker-compose restart      - Restart scanner"
    echo "  docker-compose stop         - Stop scanner"
}

# Option 3: Deploy with systemd (Linux systems)
deploy_with_systemd() {
    echo "Creating systemd service..."
    
    # Build the application
    echo "Building application..."
    npm run build
    
    # Create systemd service file
    sudo tee /etc/systemd/system/warder-scanner.service > /dev/null <<EOF
[Unit]
Description=Warder TX Scanner
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node $(pwd)/dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:$(pwd)/logs/scanner.log
StandardError=append:$(pwd)/logs/scanner-error.log

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and start service
    sudo systemctl daemon-reload
    sudo systemctl enable warder-scanner
    sudo systemctl start warder-scanner
    
    echo "Scanner deployed with systemd!"
    echo "Commands:"
    echo "  sudo systemctl status warder-scanner   - Check status"
    echo "  sudo journalctl -u warder-scanner -f   - View logs"
    echo "  sudo systemctl restart warder-scanner  - Restart scanner"
    echo "  sudo systemctl stop warder-scanner     - Stop scanner"
}

# Main menu
echo ""
echo "Select deployment method:"
echo "1) PM2 (Recommended for most servers)"
echo "2) Docker (Containerized deployment)"
echo "3) Systemd (Linux systems)"
echo "4) Exit"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        deploy_with_pm2
        ;;
    2)
        deploy_with_docker
        ;;
    3)
        deploy_with_systemd
        ;;
    4)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Exiting..."
        exit 1
        ;;
esac