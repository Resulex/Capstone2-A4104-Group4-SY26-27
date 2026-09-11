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
import { fetchJson } from "@/lib/api";

/** Administrator profile fields used by the sidebar and settings page. */
export interface AdminProfile {
  _id?: string;
  adminId?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  userName?: string;
  assignedRole?: string;
  accountStatus?: string;
  emailAddress?: string;
}

export interface AdminProfileContextValue {
  /** The signed-in administrator's profile, or `null` when unavailable. */
  profile: AdminProfile | null;
  /** True while the initial (or a retried) fetch is in flight. */
  isLoading: boolean;
  /** Non-null when the fetch failed — the console fails closed on this. */
  error: string | null;
  /** Re-run the profile fetch (the console's Retry action). */
  reload: () => Promise<void>;
}

const AdminProfileContext = createContext<AdminProfileContextValue | null>(
  null,
);

/**
 * Fetches the signed-in administrator's profile once and shares it with the
 * admin shell and every `/admin/*` page.
 *
 * Mounted only after the session is verified to be an admin (see the admin
 * layout's session gate), so it never issues an anonymous request. Sharing one
 * fetch also means the shell and the page never disagree about `assignedRole`,
 * which is what decides which navigation and routes are visible.
 */
export function AdminProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const body = await fetchJson<{ success: boolean; data?: AdminProfile }>(
        "/api/admin/profile",
      );
      setProfile(body?.data ?? null);
      if (!body?.data) {
        setError("Your administrator profile could not be loaded.");
      }
    } catch (err) {
      setProfile(null);
      setError(
        err instanceof Error
          ? err.message
          : "Your administrator profile could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<AdminProfileContextValue>(
    () => ({ profile, isLoading, error, reload: load }),
    [profile, isLoading, error, load],
  );

  return (
    <AdminProfileContext.Provider value={value}>
      {children}
    </AdminProfileContext.Provider>
  );
}

/**
 * Consume the shared admin profile. Throws if used outside of the provider,
 * which makes a missing provider a loud error instead of a silently empty
 * (and therefore over-permissive) sidebar.
 */
export function useAdminProfileContext(): AdminProfileContextValue {
  const context = useContext(AdminProfileContext);
  if (!context) {
    throw new Error(
      "useAdminProfile must be used within an AdminProfileProvider",
    );
  }
  return context;
}
