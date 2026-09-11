"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DescriptionIcon from "@mui/icons-material/Description";
import GroupIcon from "@mui/icons-material/Group";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/context/DashboardDataContext";
import { TelemetryCard } from "@/components/admin/TelemetryCard";
import { RecentDocuments } from "@/components/admin/RecentDocuments";
import { ActiveIncidentsTable } from "@/components/admin/ActiveIncidentsTable";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { canAccessAdminRoute } from "@/lib/rbac";

/**
 * Admin Dashboard.
 *
 * Renders the telemetry cards (Pending Incidents, Pending Documents, Active
 * Users) plus the Active Incidents table and the Recent Documents queue. Each
 * element is shown only when the signed-in admin's `assignedRole` may open its
 * destination route, and the column spans are recomputed from the number of
 * visible cards so the row always fills. Data is shared from the admin
 * layout's dashboard-data provider (fetched once from the backend list
 * endpoints).
 */
export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { profile, isLoading: isLoadingProfile } = useAdminProfile();
  const { dashboardData, isLoading: isLoadingData, error } = useDashboardData();
  const adminRole = profile?.assignedRole;

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const allCards = dashboardData
    ? [
        {
          title: "Pending Incidents",
          value: dashboardData.pendingIncidents,
          icon: <WarningAmberIcon />,
          color: "warning.main",
          href: "/admin/incidents",
        },
        {
          title: "Pending Documents",
          value: dashboardData.pendingDocuments,
          icon: <DescriptionIcon />,
          color: "primary.main",
          href: "/admin/document-requests",
        },
        {
          title: "Active Users",
          value: dashboardData.activeUsers,
          icon: <GroupIcon />,
          color: "secondary.main",
          href: "/admin/residents",
        },
      ]
    : [];

  // Show only the elements whose destination the signed-in role may open —
  // e.g. OPERATIONS_CLERK cannot reach /admin/residents, so the Active Users
  // card is hidden rather than linking to a route that bounces back.
  const cards = allCards.filter((card) =>
    canAccessAdminRoute(adminRole, card.href),
  );

  // Fill the row: 3 cards → 3-up, 2 cards → 2-up, a lone card → full width.
  const cardMd = cards.length >= 3 ? 4 : cards.length === 2 ? 6 : 12;
  const cardSm = cards.length === 1 ? 12 : 6;

  const showUserActivity = canAccessAdminRoute(adminRole, "/admin/residents");
  const showDocuments = canAccessAdminRoute(
    adminRole,
    "/admin/document-requests",
  );
  const showIncidents = canAccessAdminRoute(adminRole, "/admin/incidents");
  // Two panels share a row on large screens and stack at md; a lone panel
  // spans the full width so no space is left empty beside it.
  const panelBreakpoints =
    showDocuments && showIncidents ? { md: 8, lg: 6 } : { md: 12, lg: 12 };

  const subtitle = showUserActivity
    ? "Live summary of incidents, document requests, and user activity."
    : "Live summary of the queues you have access to.";

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Overview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {subtitle}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {isLoadingData || isLoadingProfile ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 200,
          }}
        >
          <CircularProgress aria-label="Loading dashboard data" />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {cards.map((card) => (
            <Grid item key={card.title} xs={12} sm={cardSm} md={cardMd}>
              <TelemetryCard
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
                href={card.href}
              />
            </Grid>
          ))}
          {showDocuments && (
            <Grid item xs={12} {...panelBreakpoints}>
              <RecentDocuments
                documents={dashboardData?.recentDocuments ?? []}
                href="/admin/document-requests"
              />
            </Grid>
          )}

          {showIncidents && (
            <Grid item xs={12} {...panelBreakpoints}>
              <ActiveIncidentsTable
                incidents={dashboardData?.activeIncidents ?? []}
                href="/admin/incidents"
              />
            </Grid>
          )}

          
        </Grid>
      )}
    </Box>
  );
}
