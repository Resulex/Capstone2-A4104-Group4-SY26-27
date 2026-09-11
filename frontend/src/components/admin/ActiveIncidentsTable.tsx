"use client";

import { useRouter } from "next/navigation";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { IncidentReportRecord } from "@/lib/telemetry";

interface ActiveIncidentsTableProps {
  /** Open incidents (Pending/Responding), newest first. */
  incidents: IncidentReportRecord[];
  /** Optional route opened when a row is clicked (quick link). */
  href?: string;
}

/** Color mapping for triage priority. */
function priorityColor(priority: string) {
  switch (priority) {
    case "Critical":
      return "error" as const;
    case "High":
      return "warning" as const;
    case "Medium":
      return "info" as const;
    default:
      return "default" as const;
  }
}

/** Color mapping for incident status. */
function statusColor(status: string) {
  if (status === "Responding") return "info" as const;
  if (status === "Duplicate") return "default" as const;
  return "warning" as const;
}

/**
 * Active Incidents table — lists open incident reports with category,
 * location, priority, status, and reported time. When `href` is supplied,
 * each row becomes a clickable quick link to it.
 */
export function ActiveIncidentsTable({
  incidents,
  href,
}: ActiveIncidentsTableProps) {
  const router = useRouter();

  const openRow = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (!href) return;
    if (e.type === "keydown") {
      const key = (e as React.KeyboardEvent).key;
      if (key !== "Enter" && key !== " ") return;
      e.preventDefault();
    }
    router.push(href);
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <WarningAmberIcon color="warning" />
          <Typography variant="h6" component="h2">
            Active Incidents
          </Typography>
        </Stack>

        {incidents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No active incidents.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="medium" aria-label="Active incidents">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Incident ID</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow
                    key={incident.incidentId}
                    hover
                    onClick={openRow}
                    onKeyDown={openRow}
                    tabIndex={href ? 0 : undefined}
                    sx={(theme) => ({
                      cursor: href ? "pointer" : undefined,
                      // Zebra striping using a light tint of the theme color.
                      "&:nth-of-type(odd)": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      },
                    })}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>
                      {incident.incidentId}
                    </TableCell>
                    <TableCell>{incident.incidentCategory}</TableCell>
                    {/* <TableCell>
                      <Box sx={{ maxWidth: 220 }}>
                        <Typography variant="body2" noWrap>
                          {incident.locationDetails}
                        </Typography>
                      </Box>
                    </TableCell> */}
                    <TableCell>
                      <Chip
                        label={incident.triagePriority}
                        size="small"
                        color={priorityColor(incident.triagePriority)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={incident.incidentStatus}
                        size="small"
                        color={statusColor(incident.incidentStatus)}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
