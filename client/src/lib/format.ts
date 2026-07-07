/**
 * Display helpers (CODING_STANDARDS.md §5). Money is a string everywhere in the
 * app; `Number()` here is for Intl formatting ONLY — never for storage or
 * arithmetic. Mirrors the server's `shared/money.ts` and `shared/currencies.ts`.
 */
export const SUPPORTED_CURRENCIES = [
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
];

export function formatMoney(value: string, currency = 'AUD'): string {
  const n = Number(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    Number.isFinite(n) ? n : 0,
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Transaction dates are timezone-independent wall-clock values: the date/time the
 * user types is stored and shown verbatim, regardless of the server's or the
 * viewer's timezone. These two helpers bridge a `datetime-local` input (a bare
 * "YYYY-MM-DDTHH:mm" wall-clock string) and the ISO value we store. Because
 * storage and display both render in UTC, we deliberately do NOT apply the local
 * timezone offset here — the typed wall clock is stored as-is.
 */

/** Current local wall clock as a `datetime-local` value ("YYYY-MM-DDTHH:mm"). */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Convert a `datetime-local` value ("YYYY-MM-DDTHH:mm") to the stored ISO string
 * by treating the typed wall clock as UTC, so it round-trips unchanged through
 * storage and UTC display no matter where the server or viewer sits.
 */
export function dateTimeLocalToISO(value: string): string {
  return new Date(`${value}Z`).toISOString();
}

const TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Checking',
  SAVINGS: 'Savings',
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  INVESTMENT: 'Investment',
  OTHER: 'Other',
};

export function accountTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}
