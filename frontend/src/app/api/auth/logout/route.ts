import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 *
 * Clears the httpOnly session cookie.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("kbc_token", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
