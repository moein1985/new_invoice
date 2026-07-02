#!/bin/sh
set -e

echo "🚀 Starting Invoice Management System..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
until node -e "const { Client } = require('pg'); const client = new Client({ connectionString: process.env.DATABASE_URL }); client.connect().then(() => { console.log('✅ Database ready'); client.end(); process.exit(0); }).catch(() => { process.exit(1); });" 2>/dev/null; do
  echo "⏳ Database not ready yet, retrying in 2 seconds..."
  sleep 2
done

echo "📦 Running database migrations (skip if already pushed)..."
# Use the local prisma version from node_modules directly
./node_modules/.bin/prisma migrate deploy || echo "⚠️  Migrate deploy failed, continuing (db push already applied)..."

echo "🌱 Seeding database..."
./node_modules/.bin/prisma db seed || echo "⚠️  Seed already exists or failed, continuing..."

echo "✅ Starting Next.js application..."
exec node server.js
