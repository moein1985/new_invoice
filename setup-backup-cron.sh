#!/bin/bash

# Invoice Management System - Setup Daily Backup Cron Job
# This script sets up automatic daily backups at 2 AM

set -e

echo "🔧 Setting up automatic daily backups..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run this script with sudo"
    echo "Usage: sudo ./setup-backup-cron.sh"
    exit 1
fi

# Get the current user's home directory
SCRIPT_DIR="/home/moein/new_invoice"

# Make backup script executable
chmod +x "$SCRIPT_DIR/backup-database.sh"
chmod +x "$SCRIPT_DIR/restore-database.sh"

# Create backup directory
mkdir -p "$SCRIPT_DIR/backups/db"
chown -R moein:moein "$SCRIPT_DIR/backups"

# Add cron job for moein user (runs at 2 AM daily)
CRON_JOB="0 2 * * * $SCRIPT_DIR/backup-database.sh >> $SCRIPT_DIR/backups/backup.log 2>&1"

# Check if cron job already exists
if crontab -u moein -l 2>/dev/null | grep -q "backup-database.sh"; then
    echo "⚠️  Backup cron job already exists"
else
    # Add the cron job
    (crontab -u moein -l 2>/dev/null; echo "$CRON_JOB") | crontab -u moein -
    echo "✅ Backup cron job added successfully"
fi

echo ""
echo "📋 Backup schedule: Every day at 2:00 AM"
echo "📁 Backup location: $SCRIPT_DIR/backups/db/"
echo "📝 Backup logs: $SCRIPT_DIR/backups/backup.log"
echo "🔄 Retention: 30 days"
echo ""
echo "🔧 You can also run manual backups:"
echo "   $SCRIPT_DIR/backup-database.sh"
echo ""
echo "📥 To restore a backup:"
echo "   $SCRIPT_DIR/restore-database.sh /path/to/backup.sql.gz"
echo ""
echo "✅ Setup completed successfully!"
