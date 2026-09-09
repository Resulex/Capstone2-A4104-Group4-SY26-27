/**
 * Admin RBAC helpers.
 *
 * The admin `assignedRole` field is a strict enum:
 *   - SUPER_ADMIN        → full access (including User Management)
 *   - OPERATIONS_CLERK   → incidents + document queues (+ chat/notifications/settings)
 *   - INFO_OFFICER       → announcements/content only
 */
export type AssignedAdminRole =
  | "SUPER_ADMIN"
  | "OPERATIONS_CLERK"
  | "INFO_OFFICER";

export const ADMIN_ROLES: AssignedAdminRole[] = [
  "SUPER_ADMIN",
  "OPERATIONS_CLERK",
  "INFO_OFFICER",
];

/** Human-readable labels for selects / badges. */
export const ADMIN_ROLE_LABELS: Record<AssignedAdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  OPERATIONS_CLERK: "Operations Clerk",
  INFO_OFFICER: "Information Officer",
};

/** Non-super-admin route prefixes they are allowed to open. */
const ROLE_ALLOWED_PREFIXES: Record<
  Exclude<AssignedAdminRole, "SUPER_ADMIN">,
  string[]
> = {
  OPERATIONS_CLERK: [
    "/admin/incidents",
    "/admin/document-requests",
    "/admin/notifications",
    "/admin/chat-sessions",
    "/admin/settings",
  ],
  INFO_OFFICER: ["/admin/announcements", "/admin/settings"],
};

const USER_MANAGEMENT_PATH = "/admin/settings/users";

/**
 * Whether a role may navigate to a full admin route. SUPER_ADMIN can go
 * anywhere; the dashboard (home) is allowed for everyone so redirects always
 * have a destination. User Management is SUPER_ADMIN-only.
 */
export function canAccessAdminRoute(
  role: string | undefined,
  pathname: string,
): boolean {
  if (!role || role === "SUPER_ADMIN") return true;
  if (pathname === USER_MANAGEMENT_PATH) return false;
  if (pathname === "/admin") return true;
  const prefixes =
    ROLE_ALLOWED_PREFIXES[role as Exclude<AssignedAdminRole, "SUPER_ADMIN">] ??
    [];
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Whether a sidebar nav item should be shown for a role. */
export function canViewNavItem(
  role: string | undefined,
  href: string,
): boolean {
  if (!role || role === "SUPER_ADMIN") return true;
  if (href === USER_MANAGEMENT_PATH) return false;
  if (href === "/admin") return true;
  const prefixes =
    ROLE_ALLOWED_PREFIXES[role as Exclude<AssignedAdminRole, "SUPER_ADMIN">] ??
    [];
  return prefixes.some((p) => href === p || href.startsWith(`${p}/`));
}
