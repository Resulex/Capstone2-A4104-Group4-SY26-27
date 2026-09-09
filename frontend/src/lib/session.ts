/**
 * Session inactivity helpers for the automatic sign-out feature.
 *
 * The app tracks the last real user interaction (mouse, keyboard, scroll,
 * touch, returning to the tab) per role and persists it in localStorage so
 * the inactivity window survives page reloads and is shared across tabs of
 * the same role. When no interaction has happened for the role's limit, the
 * UI signs the session out.
 *
 * NOTE: this is client-side only — it protects an unattended device but does
 * not revoke the backend JWT. Sign-out clears the httpOnly `kbc_token`
 * cookie, exactly like a manual logout.
 */

export type SessionRole = "admin" | "resident";

export interface SessionConfig {
  /** Maximum time without activity before the session expires (ms). */
  idleMs: number;
  /** Idle threshold at which the countdown warning should appear (ms). */
  warnMs: number;
  /** localStorage key holding the last-activity epoch timestamp (ms). */
  storageKey: string;
}

/** Per-role inactivity windows. */
export const SESSION_CONFIG: Record<SessionRole, SessionConfig> = {
  admin: {
    // 30 minutes of inactivity.
    idleMs: 30 * 60 * 1000,
    // Warn 1 minute before the limit.
    warnMs: 29 * 60 * 1000,
    storageKey: "kbc_admin_last_active",
  },
  resident: {
    // 2 hours of inactivity (resident records/documents can be confidential).
    idleMs: 2 * 60 * 60 * 1000,
    // Warn 1 minute before the limit.
    warnMs: 2 * 60 * 60 * 1000 - 60 * 1000,
    storageKey: "kbc_resident_last_active",
  },
};

/** Returns the inactivity config for a role. */
export function getSessionConfig(role: SessionRole): SessionConfig {
  return SESSION_CONFIG[role];
}

/**
 * Reads the persisted last-activity timestamp (epoch ms) for a role, or
 * `null` when nothing has been recorded yet (storage may be unavailable).
 */
export function readLastActive(role: SessionRole): number | null {
  try {
    const raw = window.localStorage.getItem(SESSION_CONFIG[role].storageKey);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Records activity at `now` (defaults to the current time) for a role. */
export function touchLastActive(
  role: SessionRole,
  now: number = Date.now(),
): void {
  try {
    window.localStorage.setItem(SESSION_CONFIG[role].storageKey, String(now));
  } catch {
    // Storage can be unavailable (private mode / quota). Idle detection then
    // falls back to the in-memory value, which is still enforced.
  }
}

/** Clears the persisted last-activity timestamp for a role. */
export function clearLastActive(role: SessionRole): void {
  try {
    window.localStorage.removeItem(SESSION_CONFIG[role].storageKey);
  } catch {
    // Ignore storage failures; clearing is best-effort.
  }
}

/**
 * True when the persisted activity for a role is older than the role's idle
 * window. An absent timestamp is treated as fresh (the caller seeds it).
 */
export function isSessionExpired(
  role: SessionRole,
  now: number = Date.now(),
): boolean {
  const last = readLastActive(role);
  if (last === null) return false;
  return now - last >= SESSION_CONFIG[role].idleMs;
}
