/**
 * Minimal JSON API client used by the frontend.
 *
 * All calls go through relative `/api/...` paths. Next.js `rewrites` in
 * `next.config.ts` proxy the backend-facing routes (`/api/auth/admin/*` and
 * `/api/auth/resident/*`) to the serverless backend, while the local server
 * routes (`/api/auth/callback`, `/api/auth/logout`, `/api/auth/me`) set and
 * clear the httpOnly session cookie.
 */

export class ApiError extends Error {
  readonly status: number;
  /** Optional structured payload from a non-2xx JSON body (`details` field). */
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/** Perform a `fetch` against a relative `/api` path and parse the JSON body. */
export async function fetchJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let details: unknown;
    try {
      const body = (await res.json()) as Record<string, unknown>;
      if (typeof body.message === "string") message = body.message;
      else if (typeof body.error === "string") message = body.error;
      details = body.details;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiError(res.status, message, details);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/**
 * Extract a JWT from a login/setup response body, tolerating common key
 * names so the frontend is resilient to backend response shapes.
 */
export function getJwt(data: unknown): string {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of [
      "token",
      "accessToken",
      "access_token",
      "jwt",
      "idToken",
      "id_token",
    ]) {
      if (typeof record[key] === "string" && (record[key] as string).length > 0) {
        return record[key] as string;
      }
    }
  }
  throw new ApiError(0, "No authentication token was returned by the server.");
}
