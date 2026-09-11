import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, clearSessionCookie } from "@/lib/session-cookie";
import { verifySessionToken } from "@/lib/session-guard";

/**
 * GET /api/auth/me
 *
 * Reports whether the session cookie holds a *valid* session, and which role
 * it belongs to. For residents it also returns the Terms + Data Privacy
 * consent recorded on the backend, so the portal gate is enforced from server
 * state instead of a client-cached profile (which can be stale or tampered
 * with).
 *
 * Validity is decided by the backend (see `@/lib/session-guard`) rather than by
 * decoding the JWT here, so an expired or hand-edited cookie is detected and
 * cleared instead of leaving the user in a shell whose every request fails.
 */

interface SessionResponse {
  authenticated: boolean;
  role: string | null;
  termsAcceptedAt: string | null;
  /**
   * True when the session could not be checked because the backend was
   * unreachable. This is NOT a logout: callers should keep the state they
   * already hold rather than evicting a user over an outage.
   */
  unavailable?: boolean;
}

/** Session responses are per-user and must never be cached. */
function sessionResponse(body: SessionResponse, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

const UNAUTHENTICATED: SessionResponse = {
  authenticated: false,
  role: null,
  termsAcceptedAt: null,
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return sessionResponse(UNAUTHENTICATED);
  }

  const session = await verifySessionToken(token);

  if (session.unreachable) {
    // Fail OPEN: an outage must never log the user out.
    return sessionResponse({ ...UNAUTHENTICATED, unavailable: true }, 502);
  }

  if (!session.valid) {
    // The backend rejected the token, so the cookie is unusable. Clear it
    // rather than resending it on every request for the rest of its max-age.
    return clearSessionCookie(sessionResponse(UNAUTHENTICATED));
  }

  return sessionResponse({
    authenticated: true,
    role: session.role,
    termsAcceptedAt: session.termsAcceptedAt,
  });
}
