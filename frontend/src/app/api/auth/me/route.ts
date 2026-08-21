import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/me
 *
 * Reports whether a session cookie is present. The token payload itself is
 * never exposed to the client; it is decoded client-side only for lightweight
 * display after a fresh login.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("kbc_token")?.value;
  return NextResponse.json({ authenticated: Boolean(token) });
}
