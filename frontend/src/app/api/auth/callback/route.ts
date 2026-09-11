import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionMaxAgeSeconds,
} from "@/lib/session-cookie";

/**
 * POST /api/auth/callback
 *
 * Receives a JWT (obtained from the backend during login) and stores it in an
 * httpOnly cookie. Storing it in an httpOnly cookie keeps the token out of
 * client-side JS (localStorage) and automatically attaches it to subsequent
 * requests to the backend-proxied routes.
 *
 * The cookie attributes live in `@/lib/session-cookie` so this route and the
 * logout route can never drift apart.
 */
export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "A JSON body with a token is required." },
      { status: 400 },
    );
  }

  const token = body.token;
  if (typeof token !== "string" || token.length === 0) {
    return NextResponse.json(
      { error: "A valid token is required." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(sessionMaxAgeSeconds()),
  );

  return response;
}
