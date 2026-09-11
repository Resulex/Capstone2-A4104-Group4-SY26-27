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
  INFO_OFFICER: ["/admin/announcements", "/admin/officials", "/admin/settings"],
};

const USER_MANAGEMENT_PATH = "/admin/users";

/**
 * Read-only legal copy. Every admin role may open it — the policy applies to
 * them regardless of what else they are allowed to manage.
 */
const ADMIN_LEGAL_PATH = "/admin/legal";

/**
 * The dashboard home. `canAccessAdminRoute` deliberately lets every role read
 * it so a redirect always has a safe destination — whether a role actually
 * *uses* it is decided by `canViewAdminDashboard`.
 */
export const ADMIN_DASHBOARD_PATH = "/admin";

/**
 * Where each role lands after signing in.
 *
 * A value MUST be the first entry in that role's visible `NAV_GROUPS` order
 * (see `AdminSidebar.tsx`), because a role without a dashboard is sent here
 * instead of `/admin`.
 */
const ROLE_LANDING_PATH: Record<AssignedAdminRole, string> = {
  SUPER_ADMIN: ADMIN_DASHBOARD_PATH,
  OPERATIONS_CLERK: ADMIN_DASHBOARD_PATH,
  INFO_OFFICER: "/admin/announcements",
};

/**
 * The route a role should treat as its "home": the dashboard for roles that
 * can use it, otherwise the first section the role can open. Unknown or
 * not-yet-loaded roles fall back to the dashboard so we never redirect before
 * the profile has resolved.
 */
export function getAdminLandingPath(role: string | undefined): string {
  if (!role) return ADMIN_DASHBOARD_PATH;
  return ROLE_LANDING_PATH[role as AssignedAdminRole] ?? ADMIN_DASHBOARD_PATH;
}

/**
 * Whether a role has a dashboard worth showing. INFO_OFFICER manages
 * announcements and officials only, so every dashboard panel would be hidden
 * and the page would be empty — such roles are sent to
 * `getAdminLandingPath` instead.
 */
export function canViewAdminDashboard(role: string | undefined): boolean {
  return getAdminLandingPath(role) === ADMIN_DASHBOARD_PATH;
}

/**
 * Whether a role may navigate to a full admin route. SUPER_ADMIN can go
 * anywhere; the dashboard (home) is allowed for everyone so redirects always
 * have a destination (`canViewAdminDashboard` decides who actually uses it).
 * User Management is SUPER_ADMIN-only.
 */
export function canAccessAdminRoute(
  role: string | undefined,
  pathname: string,
): boolean {
  if (!role || role === "SUPER_ADMIN") return true;
  if (pathname === USER_MANAGEMENT_PATH) return false;
  if (pathname === ADMIN_DASHBOARD_PATH) return true;
  if (pathname === ADMIN_LEGAL_PATH) return true;
  const prefixes =
    ROLE_ALLOWED_PREFIXES[role as Exclude<AssignedAdminRole, "SUPER_ADMIN">] ??
    [];
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Whether a sidebar nav item should be shown for a role.
 *
 * An unknown role (the profile has not resolved yet, or failed to load) FAILS
 * CLOSED — an unresolved role must never reveal items that RBAC would hide. The
 * admin shell already gates rendering until `assignedRole` is known, so this is
 * defence in depth rather than the primary guard.
 */
export function canViewNavItem(
  role: string | undefined,
  href: string,
): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  if (href === USER_MANAGEMENT_PATH) return false;
  // The Dashboard entry only exists for roles that have a dashboard.
  if (href === ADMIN_DASHBOARD_PATH) return canViewAdminDashboard(role);
  if (href === ADMIN_LEGAL_PATH) return true;
  const prefixes =
    ROLE_ALLOWED_PREFIXES[role as Exclude<AssignedAdminRole, "SUPER_ADMIN">] ??
    [];
  return prefixes.some((p) => href === p || href.startsWith(`${p}/`));
}
