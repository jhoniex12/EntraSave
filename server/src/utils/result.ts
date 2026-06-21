/**
 * Discriminated result type returned by the API to the client
 * (docs/ARCHITECTURE.md §15). Safe to import from both client and server code —
 * contains no server internals. Every route handler responds with this shape.
 */
export type ActionError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  /** Correlation id so users can reference an incident to support. */
  requestId?: string;
  retryAfter?: number;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: ActionError): ActionResult<T> {
  return { ok: false, error };
}
