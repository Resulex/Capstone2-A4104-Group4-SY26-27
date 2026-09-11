import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session-cookie";

/**
 * POST /api/auth/logout
 *
 * Clears the httpOnly session cookie. Attribute-handling is shared with the
 * login callback (`@/lib/session-cookie`) so the clearing Set-Cookie always
 * matches the one that stored it.
 */
export async function POST() {
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
