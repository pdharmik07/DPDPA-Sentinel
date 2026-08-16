/**
 * Backend HTTP client.
 *
 * One place that knows about the API base URL, the bearer token and the
 * server's error envelope, so no component ever calls fetch directly.
 */

const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';
export const API_BASE = RAW_BASE.replace(/\/+$/, '');

const TOKEN_KEY = 'dpdpa-sentinel:token:v1';

/** Mirrors the backend error envelope so the UI can show a hint, not a stack. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly hint: string | undefined;
  readonly details: { field: string; message: string }[] | undefined;
  readonly requestId: string | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    hint?: string,
    details?: { field: string; message: string }[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.details = details;
    this.requestId = requestId;
  }

  /** True when the backend could not be reached at all. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — the token stays in memory for this page load only */
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** Send as multipart instead of JSON. */
  formData?: FormData;
  signal?: AbortSignal;
  /** Skip the Authorization header (used by login/register). */
  anonymous?: boolean;
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON error body (proxy, gateway) — fall through to the status text */
  }

  return new ApiError(
    response.status,
    typeof payload.code === 'string' ? payload.code : 'internal_error',
    typeof payload.error === 'string' ? payload.error : `Request failed (${response.status}).`,
    typeof payload.hint === 'string' ? payload.hint : undefined,
    Array.isArray(payload.details) ? (payload.details as { field: string; message: string }[]) : undefined,
    typeof payload.requestId === 'string' ? payload.requestId : undefined,
  );
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};

  if (!options.anonymous) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    // Let the browser set the multipart boundary.
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    });
  } catch {
    throw new ApiError(
      0,
      'network_error',
      'Cannot reach the DPDPA Sentinel backend.',
      'Check that the backend is running and that VITE_API_URL points at it.',
    );
  }

  if (response.status === 401) {
    // The session is gone; clear it so the router sends the user to sign in.
    setToken(null);
    throw await toApiError(response);
  }

  if (!response.ok) throw await toApiError(response);

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Downloads a file through the authenticated API and hands it to the browser. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw await toApiError(response);

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const name = match?.[1] ?? fallbackName;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
