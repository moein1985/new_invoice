#!/bin/sh
set -e

echo "🚀 Starting Invoice Management System..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
until node -e "const { Client } = require('pg'); const client = new Client({ connectionString: process.env.DATABASE_URL }); client.connect().then(() => { console.log('✅ Database ready'); client.end(); process.exit(0); }).catch(() => { process.exit(1); });" 2>/dev/null; do
  echo "⏳ Database not ready yet, retrying in 2 seconds..."
  sleep 2
done

echo "📦 Running database migrations..."
npx prisma migrate deploy

echo "🌱 Seeding database..."
npx prisma db seed || echo "⚠️  Seed already exists or failed, continuing..."

echo "✅ Starting Next.js application..."
exec node server.js
