"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import { AdminSidebar, SIDEBAR_WIDTH } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { useAuth } from "@/context/AuthContext";
import { DashboardDataProvider, useDashboardData } from "@/context/DashboardDataContext";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useWebSocket } from "@/hooks/useWebSocket";

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
  const { logout } = useAuth();
  const { connectionStatus } = useWebSocket();
  const { profile } = useAdminProfile();
  const { dashboardData } = useDashboardData();

  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = getHeaderTitle(pathname);

  const handleToggleDrawer = () => setExpanded((prev) => !prev);
  const handleMobileClose = () => setMobileOpen(false);
  const handleMobileOpen = () => setMobileOpen(true);

  const handleLogout = async () => {
    await logout();
    router.replace("/admin/login");
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AdminSidebar
        expanded={expanded}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
        adminProfile={profile}
        onLogout={handleLogout}
      />

      <AdminHeader
        expanded={expanded}
        onToggleDrawer={handleToggleDrawer}
        onOpenMobile={handleMobileOpen}
        pendingIncidents={dashboardData?.pendingIncidents ?? 0}
        websocketStatus={connectionStatus}
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
    </Box>
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
