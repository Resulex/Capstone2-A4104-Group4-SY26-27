"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { SessionTimeoutDialog } from "@/components/shared/SessionTimeoutDialog";
import { AdminSidebar, SIDEBAR_WIDTH } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { useAuth } from "@/context/AuthContext";
import { DashboardDataProvider, useDashboardData } from "@/context/DashboardDataContext";
import { OnlineStatusProvider } from "@/context/OnlineStatusContext";
import { useIdleSession } from "@/hooks/useIdleSession";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useWebSocket } from "@/hooks/useWebSocket";
import { clearLastActive } from "@/lib/session";
import { canAccessAdminRoute } from "@/lib/rbac";
import {
  NotificationRecord,
  fetchMyNotifications,
  fetchAdminWsToken,
  markAllNotificationsRead,
  updateNotification,
  playNotificationSound,
} from "@/lib/admin";

/**
 * Shared shell for the admin section.
 *
 * Owns the collapsible sidebar (persistent mini-variant on desktop, temporary
 * on mobile) and the top app bar, so every `/admin/*` page inherits a
 * consistent layout without repeating the scaffolding. Wraps children in the
 * dashboard-data provider so the header badge and the page share one fetch.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardDataProvider>
      <AdminShell>{children}</AdminShell>
    </DashboardDataProvider>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuth();
  const { profile } = useAdminProfile();
  const { dashboardData } = useDashboardData();
  const adminRole = profile?.assignedRole;

  // Role-based route guard: send restricted roles back to the dashboard home.
  useEffect(() => {
    if (adminRole && !canAccessAdminRoute(adminRole, pathname)) {
      router.replace("/admin");
    }
  }, [adminRole, pathname, router]);

  // ---- Real-time admin notifications --------------------------------------
  const [wsToken, setWsToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [toast, setToast] = useState<NotificationRecord | null>(null);
  const [unreadIncidentsCount, setUnreadIncidentsCount] = useState(0);
  const [unreadDocumentsCount, setUnreadDocumentsCount] = useState(0);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Authenticate the socket and seed unread state from the server.
      const token = await fetchAdminWsToken();
      if (!cancelled) setWsToken(token);
      const mine = await fetchMyNotifications();
      if (!cancelled) {
        setNotifications(mine);
        // Seed the granular sidebar counters from already-unread items.
        setUnreadIncidentsCount(
          mine.filter(
            (n) => n.notificationCategory === "incidentAlert" && !n.isRead,
          ).length,
        );
        setUnreadDocumentsCount(
          mine.filter(
            (n) => n.notificationCategory === "documentUpdate" && !n.isRead,
          ).length,
        );
        for (const n of mine) {
          const id = n.notificationId ?? n._id ?? "";
          if (id) seenNotifIdsRef.current.add(id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMessage = useCallback((data: unknown) => {
    const message = data as { type?: string; notification?: NotificationRecord };
    if (message?.type !== "notification" || !message.notification) return;
    const incoming = message.notification;
    const key = incoming.notificationId ?? incoming._id ?? "";
    // Dedupe (a reconnect can redeliver an event we already surfaced).
    if (!key || seenNotifIdsRef.current.has(key)) return;
    seenNotifIdsRef.current.add(key);
    setNotifications((prev) => [incoming, ...prev]);
    // Bump the matching sidebar counter alongside the global bell.
    if (incoming.notificationCategory === "incidentAlert") {
      setUnreadIncidentsCount((c) => c + 1);
    } else if (incoming.notificationCategory === "documentUpdate") {
      setUnreadDocumentsCount((c) => c + 1);
    }
    setToast(incoming);
    playNotificationSound();
  }, []);

  const { connectionStatus } = useWebSocket({
    token: wsToken,
    onMessage: handleMessage,
  });

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

  // The console is only "online" when the browser has a network connection AND
  // the real-time WebSocket is connected.
  const isOnline = browserOnline && connectionStatus === "connected";

  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === id ? { ...n, isRead: true } : n)),
    );
    void updateNotification(id, { isRead: true });
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    void markAllNotificationsRead();
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  // Reset the granular sidebar counters once the admin lands on the page that
  // consumes that queue (the records stay in the bell until marked read).
  useEffect(() => {
    if (pathname.startsWith("/admin/incidents")) {
      setUnreadIncidentsCount(0);
    }
    if (pathname.startsWith("/admin/document-requests")) {
      setUnreadDocumentsCount(0);
    }
  }, [pathname]);
  // ---- End real-time admin notifications ----------------------------------

  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = getHeaderTitle(pathname);

  const handleToggleDrawer = () => setExpanded((prev) => !prev);
  const handleMobileClose = () => setMobileOpen(false);
  const handleMobileOpen = () => setMobileOpen(true);

  const handleLogout = useCallback(async () => {
    clearLastActive("admin");
    await logout();
    router.replace("/admin/login");
  }, [logout, router]);

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
      />

      <AdminHeader
        expanded={expanded}
        onToggleDrawer={handleToggleDrawer}
        onOpenMobile={handleMobileOpen}
        pendingIncidents={dashboardData?.pendingIncidents ?? 0}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        online={isOnline}
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

      {/* Real-time notification toast (top-right, 10s). */}
      <Snackbar
        open={toast !== null}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        autoHideDuration={10000}
        onClose={dismissToast}
      >
        <Alert
          severity="info"
          variant="filled"
          onClose={dismissToast}
          sx={{ width: "100%", maxWidth: 400 }}
        >
          {toast?.messageBody ?? ""}
        </Alert>
      </Snackbar>
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
  if (pathname.startsWith("/admin/settings")) return "Settings";
  return "Admin Dashboard";
}
