import type { ActionError, ActionResult } from '@/lib/types';

/**
 * Typed API client (CODING_STANDARDS.md §3, §10). The single place the SPA talks
 * to the Express API. Every call sends the session cookie (`credentials:
 * 'include'`), posts JSON, and unwraps the server's `ActionResult<T>` envelope:
 * on `ok` it returns `data`; otherwise it throws an `ApiError` carrying the
 * safe, server-provided `{ code, message, requestId, fieldErrors }`.
 *
 * Components never call `fetch` with ad-hoc URLs — they use the helpers below.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly requestId?: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryAfter?: number;

  constructor(error: ActionError) {
    super(error.message);
    this.name = 'ApiError';
    this.code = error.code;
    this.requestId = error.requestId;
    this.fieldErrors = error.fieldErrors;
    this.retryAfter = error.retryAfter;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError({ code: 'NETWORK', message: 'Unable to reach the server. Check your connection.' });
  }

  let body: ActionResult<T> | null = null;
  try {
    body = (await res.json()) as ActionResult<T>;
  } catch {
    body = null;
  }

  if (body && body.ok) return body.data;
  if (body && !body.ok) throw new ApiError(body.error);
  throw new ApiError({ code: 'INTERNAL', message: `Request failed (${res.status}).` });
}

/** POST a JSON body (the standard action/command/read shape). */
export function post<T>(path: string, input: unknown = {}): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(input) });
}

/** GET (used only for session bootstrap and provider availability). */
export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}
