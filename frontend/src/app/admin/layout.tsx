"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { NotificationToast } from "@/components/shared/NotificationToast";
import { SessionTimeoutDialog } from "@/components/shared/SessionTimeoutDialog";
import { PageLoader } from "@/components/shared/PageLoader";
import { AdminSidebar, SIDEBAR_WIDTH } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { useAuth } from "@/context/AuthContext";
import { AdminProfileProvider } from "@/context/AdminProfileContext";
import {
  AdminNotificationsProvider,
  useAdminNotifications,
} from "@/context/AdminNotificationsContext";
import {
  DashboardDataProvider,
  useDashboardData,
} from "@/context/DashboardDataContext";
import { OnlineStatusProvider } from "@/context/OnlineStatusContext";
import { useIdleSession } from "@/hooks/useIdleSession";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import type { NotificationRecord } from "@/lib/admin";
import { notificationHref } from "@/lib/notification-routes";
import { clearLastActive } from "@/lib/session";
import {
  ADMIN_DASHBOARD_PATH,
  canAccessAdminRoute,
  canViewAdminDashboard,
  getAdminLandingPath,
} from "@/lib/rbac";

/**
 * Admin console shell.
 *
 * Composes the session gate, the shared profile + dashboard-data providers, the
 * per-route RBAC gate, and finally the visual shell (collapsible sidebar + top
 * app bar). Nothing from the console paints until the signed-in admin's
 * `assignedRole` is known, so the RBAC-filtered navigation never flashes in its
 * unfiltered state.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminAuthGate>{children}</AdminAuthGate>;
}

/**
 * Session gate for the whole admin section.
 *
 * Bounces anyone without an admin session to the login page and, until that
 * session is verified, renders only the loader — never the console chrome. The
 * profile and dashboard-data providers live inside this gate so they are not
 * mounted (and therefore issue no requests) for anonymous visitors.
 */
function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";

  useEffect(() => {
    if (isLoading || isAdmin) return;
    router.replace("/admin/login");
  }, [isLoading, isAdmin, router]);

  if (isLoading || !isAdmin) {
    return <PageLoader label="Loading admin console" />;
  }

  return (
    <AdminProfileProvider>
      <DashboardDataProvider>
        <AdminProfileGate>{children}</AdminProfileGate>
      </DashboardDataProvider>
    </AdminProfileProvider>
  );
}

/**
 * Profile gate.
 *
 * `assignedRole` decides which navigation items and routes are visible, so the
 * shell must not render without it. A role that cannot open the current route is
 * sent to its landing path behind the loader, and a profile that cannot be
 * fetched at all fails closed — an error card with Retry instead of an
 * over-permissive menu.
 */
function AdminProfileGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, isLoading, error, reload } = useAdminProfile();
  const handleLogout = useAdminLogout();
  const adminRole = profile?.assignedRole;

  // Roles without a dashboard (INFO_OFFICER) must not sit on the overview, and
  // a role that cannot open the current route goes to the first section it can.
  const pathAllowed = adminRole
    ? canAccessAdminRoute(adminRole, pathname) &&
      (pathname !== ADMIN_DASHBOARD_PATH || canViewAdminDashboard(adminRole))
    : false;

  useEffect(() => {
    if (!adminRole || pathAllowed) return;
    router.replace(getAdminLandingPath(adminRole));
  }, [adminRole, pathAllowed, router]);

  if (isLoading) {
    return <PageLoader label="Loading admin console" />;
  }

  // No profile means no role, which means no way to decide what is safe to
  // show — so show nothing from the console and offer Retry/Log out instead.
  if (!profile || error) {
    return (
      <AdminProfileError
        message={error}
        onRetry={reload}
        onLogout={handleLogout}
      />
    );
  }

  if (!pathAllowed) {
    // The effect above is navigating; keep the loader up so the blocked route's
    // content never paints for a frame.
    return <PageLoader label="Loading admin console" />;
  }

  // The notification provider sits above the shell so the shell (bell + sidebar
  // counters) and the routed queue pages (per-row unread styling) read one list.
  return (
    <AdminNotificationsProvider>
      <AdminShell>{children}</AdminShell>
    </AdminNotificationsProvider>
  );
}

/**
 * Fail-closed state for an admin profile that could not be loaded.
 *
 * Without `assignedRole` we cannot tell which navigation or routes are allowed,
 * so the console chrome is replaced by this card rather than falling back to
 * every menu item. Log out is offered so a broken session is never a dead end.
 */
function AdminProfileError({
  message,
  onRetry,
  onLogout,
}: {
  message: string | null;
  onRetry: () => void;
  onLogout: () => void;
}) {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, sm: 3 },
        bgcolor: "background.default",
      }}
    >
      <Card variant="outlined" sx={{ borderRadius: 3, maxWidth: 480 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" component="h1" gutterBottom>
            Couldn&apos;t load your admin profile
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            {message ?? "Your administrator profile could not be loaded."}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your role decides which parts of the console you can use, so the menu
            stays hidden until it loads.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={onRetry}>
              Retry
            </Button>
            <Button variant="text" onClick={onLogout}>
              Log out
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

/** Sign out of the console: clear the idle marker, drop the cookie, leave. */
function useAdminLogout(): () => Promise<void> {
  const router = useRouter();
  const { logout } = useAuth();
  return useCallback(async () => {
    clearLastActive("admin");
    await logout();
    router.replace("/admin/login");
  }, [logout, router]);
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();
  const { profile } = useAdminProfile();
  const { dashboardData } = useDashboardData();

  // ---- Real-time admin notifications --------------------------------------
  // The list, socket, polling fallback and unread bookkeeping live in a provider
  // mounted above the shell (context/AdminNotificationsContext.tsx) so the queue
  // pages can style the same rows these badges count.
  const {
    notifications,
    unreadCount,
    unreadIncidentIds,
    unreadDocumentIds,
    unreadChatKeys,
    toast,
    dismissToast,
    connectionStatus,
    markNotificationRead,
    markAllRead,
  } = useAdminNotifications();

  // Unread *records* per queue: a record with several unread notifications is
  // counted once, so each number equals the number of bold rows in that queue.
  const unreadIncidentsCount = unreadIncidentIds.size;
  const unreadDocumentsCount = unreadDocumentIds.size;
  const unreadChatCount = unreadChatKeys.size;

  /**
   * Open the record a notification is about: mark that one notification read,
   * then navigate to its page. Shared by the toast click-through and the bell
   * rows so both behave identically.
   */
  const handleOpenNotification = useCallback(
    (notification: NotificationRecord) => {
      markNotificationRead(
        notification.notificationId ?? notification._id ?? "",
      );
      const href = notificationHref(notification, "admin");
      if (href) router.push(href);
    },
    [markNotificationRead, router],
  );

  // A destination exists for every category the backend writes, but keep the
  // toast inert if one ever stops resolving.
  const toastHref = toast ? notificationHref(toast, "admin") : null;

  // ---- Connection monitoring ---------------------------------------------
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // The status chip distinguishes two different degradations, so the shell hands
  // it both facts instead of one combined boolean: whether the device still has
  // a network connection, and whether the push channel is up. (`OnlineStatusProvider`
  // below stays browser-only on purpose — form buttons must not disable just
  // because the WebSocket happens to be reconnecting.)

  // ---- End real-time admin notifications ----------------------------------

  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = getHeaderTitle(pathname);

  const handleToggleDrawer = () => setExpanded((prev) => !prev);
  const handleMobileClose = () => setMobileOpen(false);
  const handleMobileOpen = () => setMobileOpen(true);

  const handleLogout = useAdminLogout();

  // Auto sign-out after 30 minutes of inactivity in the admin console.
  const { warningVisible, secondsRemaining, staySignedIn } = useIdleSession({
    role: "admin",
    enabled: isAuthenticated && user?.role === "admin",
    onExpire: handleLogout,
  });

  return (
    <OnlineStatusProvider value={browserOnline}>
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AdminSidebar
        expanded={expanded}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
        adminProfile={profile}
        onLogout={handleLogout}
        unreadIncidentsCount={unreadIncidentsCount}
        unreadDocumentsCount={unreadDocumentsCount}
        unreadChatCount={unreadChatCount}
      />

      <AdminHeader
        expanded={expanded}
        onToggleDrawer={handleToggleDrawer}
        onOpenMobile={handleMobileOpen}
        pendingIncidents={dashboardData?.pendingIncidents ?? 0}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAllRead={markAllRead}
        onOpenNotification={handleOpenNotification}
        browserOnline={browserOnline}
        socketConnected={connectionStatus === "connected"}
        title={title}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          minWidth: 0,
          p: { xs: 2, sm: 3 },
          bgcolor: "background.default",
        }}
      >
        <Toolbar />
        {children}
      </Box>

      <SessionTimeoutDialog
        open={warningVisible}
        secondsRemaining={secondsRemaining}
        onStay={staySignedIn}
        onSignOut={handleLogout}
      />

      {/* Real-time notification toast (top-right): shows a progress bar for its
          10s display time, holds while the pointer or keyboard focus is on it,
          and opens the referenced record when clicked. */}
      <NotificationToast
        notificationKey={toast?.notificationId ?? toast?._id ?? null}
        title={toast?.titleText}
        body={toast?.messageBody ?? ""}
        onClose={dismissToast}
        onOpen={
          toast && toastHref
            ? () => handleOpenNotification(toast)
            : undefined
        }
        maxWidth={400}
      />
    </Box>
    </OnlineStatusProvider>
  );
}

/** Map a route path to the header page title. */
function getHeaderTitle(pathname: string): string {
  if (pathname === "/admin") return "Admin Dashboard";
  if (pathname.startsWith("/admin/residents")) return "Residents Collection";
  if (pathname.startsWith("/admin/document-requests")) {
    return "Document Request Management";
  }
  if (pathname.startsWith("/admin/incidents")) return "Incident Reports";
  if (pathname.startsWith("/admin/announcements")) return "Announcements";
  if (pathname.startsWith("/admin/officials")) return "Barangay Officials";
  if (pathname.startsWith("/admin/notifications")) return "Notifications";
  if (pathname.startsWith("/admin/chat-sessions")) return "Chat Sessions";
  if (pathname.startsWith("/admin/legal")) return "Data Privacy & Terms";
  if (pathname.startsWith("/admin/settings")) return "Settings";
  return "Admin Dashboard";
}
