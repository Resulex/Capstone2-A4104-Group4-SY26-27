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

/**
 * Admin Dashboard.
 *
 * Renders the three core telemetry panels (Pending Incidents, Pending
 * Documents, Active Users) plus the Active Incidents table and the Recent
 * Documents queue. Data is shared from the admin layout's dashboard-data
 * provider (fetched once from the backend list endpoints).
 */
export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { dashboardData, isLoading: isLoadingData, error } = useDashboardData();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const cards = dashboardData
    ? [
        {
          title: "Pending Incidents",
          value: dashboardData.pendingIncidents,
          icon: <WarningAmberIcon />,
          color: "warning.main",
        },
        {
          title: "Pending Documents",
          value: dashboardData.pendingDocuments,
          icon: <DescriptionIcon />,
          color: "primary.main",
        },
        {
          title: "Active Users",
          value: dashboardData.activeUsers,
          icon: <GroupIcon />,
          color: "secondary.main",
        },
      ]
    : [];

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Overview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Live summary of incidents, document requests, and user activity.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {isLoadingData ? (
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
            <Grid item key={card.title} xs={12} sm={6} md={4}>
              <TelemetryCard
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
              />
            </Grid>
          ))}
          <Grid item xs={12} md={8} lg={6}>
            <RecentDocuments documents={dashboardData?.recentDocuments ?? []} />
          </Grid>

          <Grid item xs={12} md={8} lg={6}>
            <ActiveIncidentsTable
              incidents={dashboardData?.activeIncidents ?? []}
            />
          </Grid>

          
        </Grid>
      )}
    </Box>
  );
}
