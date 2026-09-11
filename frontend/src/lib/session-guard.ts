/**
 * Server-side session verification against the backend.
 *
 * SERVER ONLY — reads non-public env vars and performs the backend call that
 * decides whether a `kbc_token` value is still usable. Do not import this from
 * a client component.
 *
 * Validity must be decided by the backend (`GET /auth/session`, behind the
 * auth-jwt authorizer) rather than by decoding the JWT locally: a decode cannot
 * check the signature or the `exp` claim, so it would report an expired or
 * hand-edited cookie as authenticated.
 */

const API_BACKEND_URL = process.env.API_BACKEND_URL ?? "http://localhost:3000";
const API_BACKEND_STAGE = process.env.API_BACKEND_STAGE ?? "dev";

export interface SessionVerification {
  /** The backend confirmed the token's signature and expiry. */
  valid: boolean;
  role: string | null;
  termsAcceptedAt: string | null;
  /**
   * The backend could not be reached, so validity is UNKNOWN. Callers must not
   * treat this as a rejection — an outage is not a logout.
   */
  unreachable: boolean;
}

/** A rejected session: the backend answered, and the token is not usable. */
const REJECTED: SessionVerification = {
  valid: false,
  role: null,
  termsAcceptedAt: null,
  unreachable: false,
};

/**
 * Asks the backend whether `token` is a valid, unexpired session, and returns
 * the authoritative role + resident consent that go with it.
 */
export async function verifySessionToken(
  token: string,
): Promise<SessionVerification> {
  let upstream: Response;
  try {
    upstream = await fetch(
      `${API_BACKEND_URL}/${API_BACKEND_STAGE}/auth/session`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
  } catch {
    return { ...REJECTED, unreachable: true };
  }

  // The authorizer denies an invalid/expired token with a Deny policy, which a
  // REST API Gateway surfaces as 403; 401 covers a missing/malformed header.
  if (upstream.status === 401 || upstream.status === 403) {
    return REJECTED;
  }
  if (!upstream.ok) {
    return { ...REJECTED, unreachable: true };
  }

  let envelope: { data?: { role?: unknown; termsAcceptedAt?: unknown } };
  try {
    envelope = (await upstream.json()) as typeof envelope;
  } catch {
    return { ...REJECTED, unreachable: true };
  }

  const role =
    typeof envelope?.data?.role === "string" ? envelope.data.role : null;
  if (!role) {
    // A verified token with no routable role cannot reach a shell.
    return REJECTED;
  }

  return {
    valid: true,
    role,
    termsAcceptedAt:
      typeof envelope.data?.termsAcceptedAt === "string"
        ? envelope.data.termsAcceptedAt
        : null,
    unreachable: false,
  };
}
