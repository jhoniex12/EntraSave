import { PrismaClient } from '@prisma/client';
import { env, isProd } from '@/config/env';

/**
 * Singleton Prisma client (docs/ARCHITECTURE.md §7, §11).
 *
 * - This is an API-only process; Prisma never reaches the browser because the
 *   React client is a separate app that talks to this server over HTTP.
 * - A single instance is reused across `tsx watch` hot-reloads in dev to avoid
 *   exhausting the SQL Server connection pool.
 * - Prisma is the ONLY place SQL is issued, and only via parameterized queries
 *   (no string-built SQL) — see docs/ARCHITECTURE.md §11 (A03 Injection).
 *
 * Prisma must only ever be touched by Repository adapters (`*.prisma.ts`) plus
 * the RBAC/audit infra — never from controllers, routes, or services.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error'] : ['error', 'warn'],
  });

if (!isProd) {
  globalForPrisma.prisma = prisma;
}

// Reference env so misconfiguration fails fast at first import.
void env.DATABASE_URL;
