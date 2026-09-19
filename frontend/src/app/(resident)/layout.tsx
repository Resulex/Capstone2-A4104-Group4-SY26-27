"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import { NotificationToast } from "@/components/shared/NotificationToast";
import { SessionTimeoutDialog } from "@/components/shared/SessionTimeoutDialog";
import { ResidentSidebar } from "@/components/resident/ResidentSidebar";
import { ResidentHeader } from "@/components/resident/ResidentHeader";
import { ResidentFooter } from "@/components/resident/ResidentFooter";
import { useAuth } from "@/context/AuthContext";
import { useResident } from "@/context/ResidentContext";
import {
  ResidentDashboardProvider,
  useResidentDashboard,
} from "@/context/ResidentDashboardContext";
import { useIdleSession } from "@/hooks/useIdleSession";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  NotificationRecord,
  fetchNotifications,
  playNotificationSound,
} from "@/lib/admin";
import { notificationHref } from "@/lib/notification-routes";
import { countUnread, fetchResidentWsToken } from "@/lib/resident";
import { clearLastActive } from "@/lib/session";

/**
 * Shared shell for the resident section.
 *
 * Guards access (redirects to `/login` unless a resident is signed in), then
 * renders the hamburger sidebar + top app bar + footer around every `/` page,
 * so resident pages inherit a consistent, accessible layout without repeating
 * the scaffolding. Wraps children in the resident-dashboard provider so the
 * header badge and pages share a single fetch.
 */
export default function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading || (isAuthenticated && user?.role === "resident")) return;
    // Distinguish "no session" from "session with a role that has no portal"
    // (e.g. `official`, or an admin session left in the shared cookie) so the
    // login page can explain itself instead of silently re-rendering the form.
    router.replace(isAuthenticated ? "/login?role=unsupported" : "/login");
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || user?.role !== "resident") {
    return null;
  }

  return (
    <ResidentDashboardProvider>
      <ResidentShell>{children}</ResidentShell>
    </ResidentDashboardProvider>
  );
}

function ResidentShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // The dashboard's hero is full-bleed and starts flush under the header, so
  // the extra top/bottom vertical rhythm is applied only to sub-pages.
  const isDashboard = pathname === "/";
  const { isAuthenticated, user, logout } = useAuth();
  const { profile, clearProfile } = useResident();
  const { data, addNotificationLocal, markRecordsRead } = useResidentDashboard();

  const hasConsented = Boolean(user?.termsAcceptedAt);
  const isLegalPage = pathname === "/legal";

  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggleDrawer = () => setExpanded((prev) => !prev);
  const handleMobileClose = () => setMobileOpen(false);
  const handleMobileOpen = () => setMobileOpen(true);

  // A resident must accept the Terms + Data Privacy Policy before using the
  // portal; only `/legal` is reachable until they do. Consent comes from the
  // server-verified session (`/api/auth/me` → backend), not from the cached
  // resident profile, which can be stale or tampered with.
  useEffect(() => {
    if (!hasConsented && !isLegalPage) router.replace("/legal");
  }, [hasConsented, isLegalPage, router]);

  const handleLogout = async () => {
    clearLastActive("resident");
    clearProfile();
    await logout();
    router.replace("/login");
  };

  // Auto sign-out after 2 hours of inactivity in the resident portal.
  const { warningVisible, secondsRemaining, staySignedIn } = useIdleSession({
    role: "resident",
    enabled: isAuthenticated && user?.role === "resident",
    onExpire: handleLogout,
  });

  // ---- Real-time resident notifications -------------------------------
  const [wsToken, setWsToken] = useState<string | null>(null);
  const [toast, setToast] = useState<NotificationRecord | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Keep the "already surfaced" set in sync with the shared snapshot so a
  // fresh poll/WS event doesn't re-toast an existing notification.
  useEffect(() => {
    const ids = new Set<string>();
    for (const n of data.notifications) {
      ids.add(n.notificationId ?? n._id ?? "");
    }
    seenIdsRef.current = ids;
  }, [data.notifications]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await fetchResidentWsToken();
      if (!cancelled) setWsToken(token);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const presentNotification = useCallback(
    (notification: NotificationRecord) => {
      const key = notification.notificationId ?? notification._id ?? "";
      if (!key || seenIdsRef.current.has(key)) return;
      seenIdsRef.current.add(key);
      addNotificationLocal(notification);
      setToast(notification);
      playNotificationSound();
    },
    [addNotificationLocal],
  );

  const handleSocketMessage = useCallback(
    (raw: unknown) => {
      const message = raw as {
        type?: string;
        notification?: NotificationRecord;
      };
      if (message?.type !== "notification" || !message.notification) return;
      presentNotification(message.notification);
    },
    [presentNotification],
  );

  const { connectionStatus } = useWebSocket({
    token: wsToken,
    onMessage: handleSocketMessage,
  });
  void connectionStatus;

  // Polling fallback so residents still receive alerts under `serverless
  // offline` (no WS endpoint) and immediately after a cold start.
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "resident") return;
    const tick = async () => {
      const fresh = await fetchNotifications();
      for (const n of fresh) presentNotification(n);
    };
    const timer = window.setInterval(() => void tick(), 8000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, user?.role, presentNotification]);

  /**
   * Open the record a notification is about: clear that record's unread state,
   * then navigate to it. Backs the toast click-through.
   */
  const handleOpenNotification = useCallback(
    (notification: NotificationRecord) => {
      if (notification.referenceUrlId) {
        markRecordsRead([notification.referenceUrlId]);
      }
      const href = notificationHref(notification, "resident");
      if (href) router.push(href);
    },
    [markRecordsRead, router],
  );

  // Red dot on the sidebar's Live Chat entry while unread chat replies exist.
  const unreadChatCount = data.notifications.filter(
    (n) => n.notificationCategory === "chatMessage" && !n.isRead,
  ).length;

  // Count badge on the sidebar's Notifications entry (every unread category,
  // so incident/document status updates are not missed).
  const unreadNotifications = data.notifications.filter((n) => !n.isRead).length;

  // Block navigation into the portal until consent is recorded (the `/legal`
  // page remains reachable). Render nothing while the redirect is in flight.
  if (!hasConsented && !isLegalPage) return null;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <ResidentSidebar
        expanded={expanded}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
        residentProfile={profile}
        onLogout={handleLogout}
        legalOnly={!hasConsented}
        chatUnread={unreadChatCount}
        notificationsUnread={unreadNotifications}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minWidth: 0,
        }}
      >
        <ResidentHeader
          expanded={expanded}
          onToggleDrawer={handleToggleDrawer}
          onOpenMobile={handleMobileOpen}
          unreadNotifications={countUnread(data.notifications)}
          title={getHeaderTitle(pathname)}
        />

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            // The wrapper column above already accounts for the sidebar width
            // (it is a `flexGrow: 1` sibling of the drawer), so `main` simply
            // fills the column — no extra `calc()` here.
            minWidth: 0,
            bgcolor: "background.default",
            // Horizontal gutter on all sizes. On mobile the dashboard hero
            // opts back out with a negative-margin full-bleed escape.
            px: { xs: 2, sm: 3 },
            // Vertical rhythm on sub-pages: breathing room under the header
            // (xs: 16px) and above the footer (24px). The dashboard hero stays
            // flush under the header, so it keeps zero top padding on mobile.
            pt: isDashboard ? { xs: 0, sm: 3 } : { xs: 2, sm: 3 },
            pb: isDashboard ? { xs: 0, sm: 3 } : { xs: 3, sm: 3 },
          }}
        >
          {/* Match the fixed header's toolbar height (64px at every breakpoint)
              so page content never tucks underneath it on mobile. */}
          <Toolbar sx={{ minHeight: 64 }} />
          {children}
        </Box>

        <ResidentFooter />
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
        onClose={() => setToast(null)}
        onOpen={toast ? () => handleOpenNotification(toast) : undefined}
        maxWidth={420}
      />
    </Box>
  );
}

/** Map a route path to the header page title. */
function getHeaderTitle(pathname: string): string {
  if (pathname === "/" || pathname === "") return "Home";
  if (pathname.startsWith("/documents")) return "My Document Requests";
  if (pathname.startsWith("/incidents")) return "My Incident Reports";
  if (pathname.startsWith("/announcements")) return "Announcements";
  if (pathname.startsWith("/officials")) return "Barangay Officials";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/chat")) return "Live Chat";
  if (pathname.startsWith("/help")) return "Help & Support Center";
  if (pathname.startsWith("/legal")) return "Data Privacy & Terms of Service";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Home";
}
