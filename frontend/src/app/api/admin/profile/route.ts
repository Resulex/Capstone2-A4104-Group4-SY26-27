import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/profile
 *
 * Resolves the currently signed-in administrator's profile from the backend.
 *
 * The JWT is stored in an httpOnly cookie (`kbc_token`); its `sub` claim holds
 * the admin's Mongo `_id`. This route decodes the `sub` (without verifying the
 * signature — the backend re-verifies the Bearer token) and proxies
 * `GET /admins/{sub}` so the client can render the admin's name + assigned role
 * in the sidebar without exposing the raw token.
 */

const API_BACKEND_URL = process.env.API_BACKEND_URL ?? "http://localhost:3000";
const API_BACKEND_STAGE = process.env.API_BACKEND_STAGE ?? "dev";

interface AdminProfile {
  adminId?: string;
  firstName?: string;
  lastName?: string;
  assignedRole?: string;
  emailAddress?: string;
  [key: string]: unknown;
}

function decodeJwtSub(token: string): string | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("kbc_token")?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Not authenticated." },
      { status: 401 },
    );
  }

  const sub = decodeJwtSub(token);
  if (!sub) {
    return NextResponse.json(
      { success: false, message: "Invalid session token." },
      { status: 401 },
    );
  }

  const target = `${API_BACKEND_URL}/${API_BACKEND_STAGE}/admins/${encodeURIComponent(sub)}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Backend unreachable.", details: String(error) },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { success: false, message: "Unable to load administrator profile." },
      { status: upstream.status },
    );
  }

  const envelope = (await upstream.json()) as {
    data?: AdminProfile;
  };

  return NextResponse.json({ success: true, data: envelope?.data ?? null });
}
