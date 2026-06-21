import type { Prisma } from '@prisma/client';
import { DEFAULT_CURRENCY } from '@/utils/currencies';

/**
 * Money helpers (docs/ARCHITECTURE.md §9). Money is stored as Decimal(19,4) and
 * MUST NOT be turned into a JS float anywhere. At the DTO boundary we serialize
 * to a string so precision survives transport to the client and (future) APIs.
 */
export type DecimalLike = Prisma.Decimal | string | number;

/** Serialize a Decimal to a fixed-precision string for DTOs/transport. */
export function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

/**
 * Format a money string for DISPLAY only. The Number() conversion here is for
 * presentation (Intl formatting) — never use it for storage or arithmetic.
 */
export function formatMoney(value: string, currency: string = DEFAULT_CURRENCY): string {
  const n = Number(value);
  // Let Intl apply each currency's own fraction rules (e.g. JPY has 0 decimals).
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(Number.isFinite(n) ? n : 0);
}
