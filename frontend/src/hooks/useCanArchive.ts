"use client";

import { useAdminProfile } from "@/hooks/useAdminProfile";

/**
 * Whether the signed-in administrator may archive and restore records.
 *
 * Archive / restore is a SUPER_ADMIN-only, records-governance action — not part
 * of the queues an operations clerk or information officer runs. The backend
 * enforces this independently (the archived scope 403s and every archive route
 * calls `requireSuperAdmin`), so this hook only decides what the UI OFFERS; it is
 * never the guard.
 *
 * `isLoading` is surfaced so callers fail closed: while the profile is in flight
 * the role is unknown, and treating "unknown" as "allowed" would flash a control
 * that the backend would then refuse.
 */
export function useCanArchive(): { canArchive: boolean; isLoading: boolean } {
  const { profile, isLoading } = useAdminProfile();
  return {
    canArchive: !isLoading && profile?.assignedRole === "SUPER_ADMIN",
    isLoading,
  };
}
