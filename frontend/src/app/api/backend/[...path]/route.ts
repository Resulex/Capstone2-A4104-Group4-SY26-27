import { NextRequest, NextResponse } from "next/server";

/**
 * Generic proxy for backend business endpoints.
 *
 * The backend's API Gateway `auth-jwt` authorizer expects the JWT in an
 * `Authorization: Bearer <token>` header, but the frontend stores the token in
 * an httpOnly cookie (`kbc_token`) that client-side JS cannot read. Next.js
 * `rewrites` only proxy the auth routes, so this route handler forwards the
 * cookie value as a Bearer header for the remaining backend resources.
 *
 * This mirrors the cookie-access pattern used by `src/app/api/auth/me/route.ts`.
 */

const API_BACKEND_URL = process.env.API_BACKEND_URL ?? "http://localhost:3000";
const API_BACKEND_STAGE = process.env.API_BACKEND_STAGE ?? "dev";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

/** Shared forwarder: proxies a backend request, forwarding the JWT + JSON body. */
async function forward(request: NextRequest, context: RouteContext, method: string) {
  const { path } = await context.params;
  const token = request.cookies.get("kbc_token")?.value;

  const backendPath = path.map(encodeURIComponent).join("/");
  const query = request.nextUrl.searchParams.toString();
  const target = `${API_BACKEND_URL}/${API_BACKEND_STAGE}/${backendPath}${
    query ? `?${query}` : ""
  }`;

  const hasBody = method !== "GET" && method !== "HEAD";
  let jsonBody: string | undefined;
  if (hasBody) {
    try {
      jsonBody = await request.text();
    } catch {
      jsonBody = undefined;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(jsonBody ? { "Content-Type": "application/json" } : {}),
      },
      body: hasBody ? jsonBody : undefined,
      // Do not forward the browser's cookies; we only pass the auth token.
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Backend unreachable.", details: String(error) },
      { status: 502 },
    );
  }

  let body: unknown;
  try {
    body = await upstream.json();
  } catch {
    body = null;
  }

  return NextResponse.json(
    body ?? { success: false, message: "Empty response from backend." },
    { status: upstream.status },
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, context, "GET");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return forward(request, context, "PATCH");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forward(request, context, "POST");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return forward(request, context, "DELETE");
}
