"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Link from "next/link";
import AddIcon from "@mui/icons-material/Add";
import EmergencyIcon from "@mui/icons-material/EmergencyShare";
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
  const { data, isLoading } = useResidentDashboard();
  const incidents = data.incidentReports;

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
      ) : (
        <Grid container spacing={2}>
          {incidents.map((incident) => (
            <Grid item key={incident.incidentId ?? incident._id} xs={12} sm={6} lg={4}>
              <IncidentCard
                incident={incident}
                href={`/incidents/${encodeURIComponent(incident.incidentId ?? incident._id ?? "")}`}
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
