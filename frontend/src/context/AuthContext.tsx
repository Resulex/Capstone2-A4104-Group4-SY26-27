"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError, fetchJson, getJwt } from "@/lib/api";

export interface AuthUser {
  /** Authenticator app / email subject, email, or display name when known. */
  name?: string;
  /**
   * Role from the server-verified session. `official` is a real backend role
   * (`User.role`) that has no portal yet — it is surfaced as-is so the shells
   * can tell it apart from a resident instead of silently treating it as one.
   */
  role: "admin" | "resident" | "official";
  /**
   * Server-verified timestamp of the resident's Terms + Data Privacy consent
   * (`null` when not yet consented, or for non-residents). Comes from
   * `/api/auth/me`, which asks the backend — never from a cached profile.
   */
  termsAcceptedAt?: string | null;
}

/** Shape returned by the `/api/auth/me` route handler. */
interface SessionPayload {
  authenticated: boolean;
  role?: string | null;
  termsAcceptedAt?: string | null;
}

/** Roles the app knows how to route. Anything else is not a usable session. */
const KNOWN_ROLES = ["admin", "resident", "official"] as const;

function toKnownRole(value: unknown): AuthUser["role"] | null {
  return typeof value === "string" &&
    (KNOWN_ROLES as readonly string[]).includes(value)
    ? (value as AuthUser["role"])
    : null;
}

export interface AuthContextValue {
  /** Whether the session cookie exists. */
  isAuthenticated: boolean;
  /** Set while an initial session check is in flight. */
  isLoading: boolean;
  user: AuthUser | null;
  /**
   * Store a backend JWT in the httpOnly cookie (via the server callback
   * route) and refresh the session. Returns the stored user.
   */
  setToken: (token: string, role: AuthUser["role"]) => Promise<AuthUser>;
  /**
   * Re-read the session (role + server-verified consent) from `/api/auth/me`.
   * Call after accepting the Terms so the resident gate lifts immediately.
   * Returns the refreshed user, or `null` when the session is gone.
   */
  refreshSession: () => Promise<AuthUser | null>;
  /** Clear the session cookie. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Decode a JWT payload without validating signature (display purposes only). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return {};
    const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractName(payload: Record<string, unknown>): string | undefined {
  for (const key of ["name", "displayName", "username", "email", "sub"]) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  /** Mirrors `user` so callbacks can read it without gaining a dependency. */
  const userRef = useRef<AuthUser | null>(null);

  const applyUser = useCallback((next: AuthUser | null) => {
    userRef.current = next;
    setUser(next);
  }, []);

  /**
   * Read the session (role + server-verified consent) from `/api/auth/me`.
   * Returns the resulting user (or `null` when unauthenticated) so callers can
   * verify that a state change — e.g. accepting the Terms — actually landed.
   */
  const loadSession = useCallback(async (): Promise<AuthUser | null> => {
    let res: SessionPayload;
    try {
      res = await fetchJson<SessionPayload>("/api/auth/me");
    } catch (error) {
      // A 502 means the backend could not be reached, NOT that the session is
      // invalid. Keep the session the user already has instead of bouncing
      // them to the login page over an outage.
      if (error instanceof ApiError && error.status === 502) {
        return userRef.current;
      }
      throw error;
    }

    if (!res.authenticated) {
      setIsAuthenticated(false);
      applyUser(null);
      return null;
    }

    const role = toKnownRole(res.role);
    if (!role) {
      // A verified token whose role we cannot route is treated as no session.
      setIsAuthenticated(false);
      applyUser(null);
      return null;
    }

    setIsAuthenticated(true);
    const nextUser: AuthUser = {
      role,
      termsAcceptedAt: res.termsAcceptedAt ?? null,
    };
    applyUser(nextUser);
    return nextUser;
  }, [applyUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSession();
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
          applyUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSession, applyUser]);

  const setToken = useCallback(
    async (token: string, role: AuthUser["role"]): Promise<AuthUser> => {
      await fetchJson<{ ok: boolean }>("/api/auth/callback", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      const nextUser: AuthUser = {
        role,
        name: extractName(decodeJwtPayload(token)),
      };
      setIsAuthenticated(true);
      applyUser(nextUser);

      // Pull the server-verified consent so the resident gate never trusts a
      // client-cached value. Failure is non-fatal: `termsAcceptedAt` stays
      // unset and the gate fails closed to `/legal`.
      try {
        await loadSession();
      } catch {
        // Keep the optimistic user set above.
      }
      return nextUser;
    },
    [loadSession, applyUser],
  );

  const logout = useCallback(async () => {
    await fetchJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
    applyUser(null);
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      setToken,
      refreshSession: loadSession,
      logout,
    }),
    [isAuthenticated, isLoading, user, setToken, loadSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Consume the auth context. Throws if used outside of the `AuthProvider`.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Re-exported helper so login pages can extract a token from backend bodies.
export { getJwt };
