import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
  adapter: PrismaPg | undefined;
};

// Create pool singleton (MUST be reused)
if (!globalForPrisma.pool) {
  console.log('[Prisma] Creating new Pool connection');
  globalForPrisma.pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
}

// Create adapter singleton
if (!globalForPrisma.adapter) {
  console.log('[Prisma] Creating new adapter');
  globalForPrisma.adapter = new PrismaPg(globalForPrisma.pool);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: globalForPrisma.adapter,
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
