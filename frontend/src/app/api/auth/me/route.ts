import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/me
 *
 * Reports whether a session cookie is present and, when it is, decodes the
 * JWT's `role` claim so the client can restore the user's role after a full
 * page reload. The token payload is not otherwise exposed, and its signature
 * is re-verified by the backend on every proxied request.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("kbc_token")?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false, role: null });
  }

  const role = decodeJwtRole(token);
  return NextResponse.json({ authenticated: true, role });
}

/** Decode the `role` claim from a JWT payload (no signature verification). */
function decodeJwtRole(token: string): string | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8"),
    ) as Record<string, unknown>;
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}
