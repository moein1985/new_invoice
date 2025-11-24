#!/bin/bash

# Invoice Management System - Database Restore Script
# This script restores a PostgreSQL database from backup

set -e

# Configuration
BACKUP_DIR="/home/moein/new_invoice/backups/db"
CONTAINER_NAME="invoice_postgres"
DB_USER="invoice_user"
DB_NAME="invoice_db"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "❌ Error: No backup file specified"
    echo ""
    echo "Usage: ./restore-database.sh <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will replace all current data in the database!"
echo "📁 Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

echo ""
echo "🔄 Starting database restore..."

# Stop the web application
echo "⏸️  Stopping web application..."
docker compose stop web

# Create a safety backup of current database
SAFETY_BACKUP="$BACKUP_DIR/safety_backup_$(date +%Y%m%d_%H%M%S).sql"
echo "💾 Creating safety backup: $SAFETY_BACKUP"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$SAFETY_BACKUP"
gzip "$SAFETY_BACKUP"

# Drop and recreate database
echo "🗑️  Dropping existing database..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"

# Restore from backup
echo "📥 Restoring from backup..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" "$DB_NAME"
else
    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" "$DB_NAME" < "$BACKUP_FILE"
fi

# Start the web application
echo "▶️  Starting web application..."
docker compose start web

echo ""
echo "✅ Database restored successfully!"
echo "📋 Safety backup saved at: ${SAFETY_BACKUP}.gz"
echo ""
echo "🌐 Application is starting up..."
echo "   Check status: docker compose logs -f web"
