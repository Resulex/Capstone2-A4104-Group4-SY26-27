"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { PageHeader } from "@/components/resident/PageHeader";
import { OfficialCard } from "@/components/resident/OfficialCard";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { EmptyState } from "@/components/resident/EmptyState";
import { BARANGAY_OFFICE_INFO } from "@/lib/resident";

/** Derive a committee label from a position like "Kagawad - Flood Control". */
function committeeFromPosition(position: string): string | null {
  const parts = position.split(" - ");
  return parts.length === 2 && parts[1].trim() ? parts[1].trim() : null;
}

/**
 * Barangay Officials (`/officials`).
 *
 * Filterable directory of barangay officials (by position and committee) plus
 * the office hours and emergency contact information.
 */
export default function OfficialsPage() {
  const { data, isLoading } = useResidentDashboard();
  const officials = data.officials;

  const positions = useMemo(
    () => [...new Set(officials.map((o) => o.designatedPosition).filter(Boolean))],
    [officials],
  );
  const committees = useMemo(() => {
    const all = officials
      .map((o) => committeeFromPosition(o.designatedPosition))
      .filter((c): c is string => Boolean(c));
    return [...new Set(all)];
  }, [officials]);

  const [position, setPosition] = useState("All Positions");
  const [committee, setCommittee] = useState("All Committees");

  const filtered = useMemo(() => {
    return officials.filter((o) => {
      const matchesPosition =
        position === "All Positions" || o.designatedPosition === position;
      const matchesCommittee =
        committee === "All Committees" ||
        committeeFromPosition(o.designatedPosition) === committee;
      return matchesPosition && matchesCommittee;
    });
  }, [officials, position, committee]);

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <PageHeader
        title="Barangay Officials"
        subtitle="Directory of your barangay officials and their contact information."
      />

      {/* Filters. */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3, maxWidth: 560 }}>
        <TextField
          select
          size="small"
          label="Filter by Position"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          fullWidth
          inputProps={{ "aria-label": "Filter by position" }}
        >
          <MenuItem value="All Positions">All Positions</MenuItem>
          {positions.map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Filter by Committees"
          value={committee}
          onChange={(e) => setCommittee(e.target.value)}
          fullWidth
          inputProps={{ "aria-label": "Filter by committee" }}
        >
          <MenuItem value="All Committees">All Committees</MenuItem>
          {committees.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No officials found"
          description="Try adjusting the position or committee filters."
        />
      ) : (
        <Grid container spacing={2}>
          {filtered.map((official) => (
            <Grid item key={official.officialId ?? official._id} xs={12} sm={6} lg={4}>
              <OfficialCard official={official} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Office hours & contact information. */}
      <Card variant="outlined" sx={{ borderRadius: 3, mt: 4 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
            Office Hours &amp; Contact Information
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <AccessTimeIcon color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Office Hours
                </Typography>
              </Box>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {BARANGAY_OFFICE_INFO.officeHours.map((line) => (
                  <Typography key={line} component="li" variant="body2" color="text.secondary">
                    {line}
                  </Typography>
                ))}
              </Box>
            </Box>

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <LocationOnIcon color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Main Office
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {BARANGAY_OFFICE_INFO.mainOffice}
              </Typography>
            </Box>

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <PhoneIcon color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Emergency Contact
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <SmartphoneIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                <Typography variant="body2" color="text.secondary">
                  {BARANGAY_OFFICE_INFO.emergencyHotline}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                <PhoneIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                <Typography variant="body2" color="text.secondary">
                  {BARANGAY_OFFICE_INFO.emergencyMobile}
                </Typography>
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
