"use client";

import type { AdminProfile } from "@/context/AdminProfileContext";
import { useAdminProfileContext } from "@/context/AdminProfileContext";

export type {
  AdminProfile,
  AdminProfileContextValue,
} from "@/context/AdminProfileContext";

/**
 * Resolves the signed-in administrator's profile.
 *
 * The request itself lives in `AdminProfileProvider` (mounted by the admin
 * layout's session gate), so the shell and the page share a single fetch and can
 * never disagree about `assignedRole` — the value that decides which navigation
 * items and routes are visible. The returned value also exposes `error` and
 * `reload` for the console's fail-closed error state.
 */
export function useAdminProfile() {
  return useAdminProfileContext();
}

/** Derive display initials from a profile's first/last name. */
export function getInitials(profile: AdminProfile | null): string {
  const first = profile?.firstName?.trim();
  const last = profile?.lastName?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  return "A";
}
