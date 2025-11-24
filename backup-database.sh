#!/bin/bash

# Invoice Management System - Daily Backup Script
# This script creates daily backups of the PostgreSQL database

set -e

# Configuration
BACKUP_DIR="/home/moein/new_invoice/backups/db"
CONTAINER_NAME="invoice_postgres"
DB_USER="invoice_user"
DB_NAME="invoice_db"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

echo "🔄 Starting database backup..."
echo "📅 Timestamp: $TIMESTAMP"

# Create backup
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_FILE"

echo "✅ Backup created: ${BACKUP_FILE}.gz"

# Calculate file size
SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
echo "📦 Backup size: $SIZE"

# Remove old backups (older than RETENTION_DAYS)
echo "🗑️  Removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
echo "📊 Total backups: $BACKUP_COUNT"

echo "✅ Backup completed successfully!"
