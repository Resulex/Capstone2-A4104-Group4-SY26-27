"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchJson, getJwt } from "@/lib/api";

export interface AuthUser {
  /** Authenticator app / email subject, email, or display name when known. */
  name?: string;
  /** Whether this user is an admin or a resident. */
  role: "admin" | "resident";
}

export interface AuthContextValue {
  /** Whether the session cookie exists. */
  isAuthenticated: boolean;
  /** Set while an initial session check is in flight. */
  isLoading: boolean;
  user: AuthUser | null;
  /**
   * Store a backend JWT in the httpOnly cookie (via the server callback
   * route). Returns the stored user.
   */
  setToken: (token: string, role: "admin" | "resident") => Promise<AuthUser>;
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchJson<{
          authenticated: boolean;
          role?: string | null;
        }>("/api/auth/me");
        if (cancelled) return;

        if (!res.authenticated) {
          setIsAuthenticated(false);
          setUser(null);
          return;
        }

        const role = res.role === "admin" || res.role === "resident"
          ? res.role
          : null;
        setIsAuthenticated(true);
        setUser(role ? { role } : null);
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setToken = useCallback(
    async (token: string, role: "admin" | "resident"): Promise<AuthUser> => {
      await fetchJson<{ ok: boolean }>("/api/auth/callback", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      const nextUser: AuthUser = {
        role,
        name: extractName(decodeJwtPayload(token)),
      };
      setIsAuthenticated(true);
      setUser(nextUser);
      return nextUser;
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetchJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, isLoading, user, setToken, logout }),
    [isAuthenticated, isLoading, user, setToken, logout],
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
