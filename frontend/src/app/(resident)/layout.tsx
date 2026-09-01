"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import { ResidentSidebar } from "@/components/resident/ResidentSidebar";
import { ResidentHeader } from "@/components/resident/ResidentHeader";
import { ResidentFooter } from "@/components/resident/ResidentFooter";
import { useAuth } from "@/context/AuthContext";
import { useResident } from "@/context/ResidentContext";
import {
  ResidentDashboardProvider,
  useResidentDashboard,
} from "@/context/ResidentDashboardContext";
import { countUnread } from "@/lib/resident";

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
    if (!isLoading && (!isAuthenticated || user?.role !== "resident")) {
      router.replace("/login");
    }
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
  const { logout } = useAuth();
  const { profile, clearProfile } = useResident();
  const { data } = useResidentDashboard();

  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggleDrawer = () => setExpanded((prev) => !prev);
  const handleMobileClose = () => setMobileOpen(false);
  const handleMobileOpen = () => setMobileOpen(true);

  const handleLogout = async () => {
    clearProfile();
    await logout();
    router.replace("/login");
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <ResidentSidebar
        expanded={expanded}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
        residentProfile={profile}
        onLogout={handleLogout}
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
            p: { xs: 0, sm: 3 },
          }}
        >
          <Toolbar />
          {children}
        </Box>

        <ResidentFooter />
      </Box>
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
