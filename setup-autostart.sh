#!/bin/bash

# Invoice Management System - Auto-start Setup Script
# This script enables Docker and sets up the application to start automatically on boot

set -e

echo "🔧 Setting up Invoice Management System auto-start..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run this script with sudo"
    echo "Usage: sudo ./setup-autostart.sh"
    exit 1
fi

# Enable and start Docker service
echo "📦 Enabling Docker service..."
systemctl enable docker
systemctl start docker

# Copy systemd service file
echo "📝 Installing systemd service..."
cp invoice-app.service /etc/systemd/system/

# Reload systemd
echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload

# Enable the service
echo "✅ Enabling invoice-app service..."
systemctl enable invoice-app.service

# Start the service
echo "🚀 Starting invoice-app service..."
systemctl start invoice-app.service

# Check status
echo ""
echo "📊 Service status:"
systemctl status invoice-app.service --no-pager || true

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📋 Useful commands:"
echo "  - Check status:    sudo systemctl status invoice-app"
echo "  - Start service:   sudo systemctl start invoice-app"
echo "  - Stop service:    sudo systemctl stop invoice-app"
echo "  - Restart service: sudo systemctl restart invoice-app"
echo "  - View logs:       sudo journalctl -u invoice-app -f"
echo "  - Docker logs:     docker compose logs -f"
echo ""
echo "🎉 The application will now start automatically after system reboot!"
