"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Link from "next/link";
import AddIcon from "@mui/icons-material/Add";
import EmergencyIcon from "@mui/icons-material/EmergencyShare";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { PageHeader } from "@/components/resident/PageHeader";
import { IncidentCard } from "@/components/resident/IncidentCard";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { EmptyState } from "@/components/resident/EmptyState";

/**
 * Incident Reports (`/incidents`).
 *
 * Shows an emergency-reporting callout and the resident's recent incident
 * reports (category, status and triage priority). Data is shared from the
 * resident shell's dashboard-data provider.
 */
export default function IncidentReportsPage() {
  const {
    data,
    isLoading,
    unreadIncidentIds,
    markRecordsRead,
    markRecordsUnread,
  } = useResidentDashboard();
  const incidents = data.incidentReports;
  /** When true the grid shows only reports with unseen updates. */
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Unread is counted per RECORD (a report can carry several notifications), so
  // this matches the number of cards showing the "New" chip.
  const unreadCount = unreadIncidentIds.size;
  const visible = unreadOnly
    ? incidents.filter((i) => unreadIncidentIds.has(i.incidentId))
    : incidents;

  const handleToggleRead = (referenceUrlId: string, isRead: boolean) =>
    isRead
      ? markRecordsRead([referenceUrlId])
      : markRecordsUnread([referenceUrlId]);

  /** Mark every report currently on screen as read. */
  const markAllVisibleRead = () =>
    markRecordsRead(visible.map((i) => i.incidentId));

  return (
    <Box sx={{ maxWidth: 860, mx: "auto" }}>
      <PageHeader
        title="Incident Reports"
        subtitle="Report and track incidents in your barangay."
      />

      {/* Emergency reporting callout. */}
      <Button
        component={Link}
        href="/incidents/new"
        variant="outlined"
        color="inherit"
        fullWidth
        aria-label="Open emergency incident report"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          py: 3,
          borderRadius: 3,
          borderWidth: 2,
          borderColor: "text.primary",
          "&:hover": { borderColor: "error.main", color: "error.main" },
          textAlign: "center",
        }}
      >
        <EmergencyIcon sx={{ fontSize: 40, color: "error.main" }} />
        <Typography variant="h6" component="span" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
          EMERGENCY REPORT
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Tap above for immediate emergency reporting
        </Typography>
      </Button>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
        My Recent Reports
      </Typography>

      {/* Unread controls appear only once there is something to act on, and are
          kept while filtering so the toggle can always be switched back. */}
      {!isLoading && incidents.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mb: 2, flexWrap: "wrap" }}
        >
          <Button
            size="small"
            variant={unreadOnly ? "contained" : "outlined"}
            color={unreadOnly ? "primary" : "inherit"}
            startIcon={<MarkEmailUnreadIcon />}
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly((prev) => !prev)}
            sx={{ whiteSpace: "nowrap" }}
          >
            Unread only{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<MarkEmailReadIcon />}
            disabled={unreadCount === 0}
            onClick={markAllVisibleRead}
            sx={{ whiteSpace: "nowrap" }}
          >
            Mark all as read
          </Button>
        </Stack>
      )}

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : incidents.length === 0 ? (
        <EmptyState
          title="No incident reports yet"
          description="If you see something, report it — every report helps the barangay respond faster."
          action={
            <Button
              component={Link}
              href="/incidents/new"
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
            >
              New Incident Report
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing unread"
          description="You're all caught up — there are no unread updates on your incident reports."
        />
      ) : (
        <Grid container spacing={2}>
          {visible.map((incident) => (
            <Grid item key={incident.incidentId ?? incident._id} xs={12} sm={6} lg={4}>
              <IncidentCard
                incident={incident}
                href={`/incidents/${encodeURIComponent(incident.incidentId ?? incident._id ?? "")}`}
                isUnread={unreadIncidentIds.has(incident.incidentId)}
                onToggleRead={handleToggleRead}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {incidents.length > 0 && (
        <Button
          component={Link}
          href="/incidents/new"
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          startIcon={<AddIcon />}
          sx={{ mt: 3 }}
        >
          New Incident Report
        </Button>
      )}
    </Box>
  );
}
