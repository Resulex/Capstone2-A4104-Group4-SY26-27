"use client";

import { useEffect, useState } from "react";
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

interface AdminProfileResult {
  profile: AdminProfile | null;
  isLoading: boolean;
}

/**
 * Resolves the signed-in administrator's profile via `/api/admin/profile`
 * (which proxies `GET /admins/{id}` using the JWT `sub`). Falls back to
 * `null` on failure so the sidebar can render an initials-only placeholder.
 */
export function useAdminProfile(): AdminProfileResult {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = await fetchJson<{ success: boolean; data?: AdminProfile }>(
          "/api/admin/profile",
        );
        if (!cancelled) setProfile(body?.data ?? null);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, isLoading };
}

/** Derive display initials from a profile's first/last name. */
export function getInitials(profile: AdminProfile | null): string {
  const first = profile?.firstName?.trim();
  const last = profile?.lastName?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  return "A";
}
