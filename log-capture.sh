#!/bin/bash
LOG_DIR=/home/moein/new_invoice/logs
mkdir -p "$LOG_DIR"

DATE=$(/bin/date +%Y-%m-%d_%H%M)
LOG_FILE="$LOG_DIR/app-$DATE.log"

# Capture last 500 lines of docker logs (stdout+stderr)
docker logs invoice2_web --tail 500 2>&1 > "$LOG_FILE"

# Also capture errors specifically
docker logs invoice2_web --tail 500 2>&1 | grep -iE 'error|ERR|fail|exception|TRPCError|throw' > "$LOG_FILE.errors" 2>/dev/null

# Keep only last 24 log files (4 hours at 10-min intervals)
ls -t "$LOG_DIR"/app-*.log 2>/dev/null | tail -n +25 | xargs rm -f 2>/dev/null
ls -t "$LOG_DIR"/app-*.errors 2>/dev/null | tail -n +25 | xargs rm -f 2>/dev/null

echo "[$DATE] Log captured to $LOG_FILE"
