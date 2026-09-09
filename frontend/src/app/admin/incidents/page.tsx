"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ForumIcon from "@mui/icons-material/Forum";
import ImageIcon from "@mui/icons-material/Image";
import { useAuth } from "@/context/AuthContext";
import {
  IncidentRecord,
  ResidentRecord,
  fetchIncidentReports,
  fetchResidents,
  updateIncidentReport,
} from "@/lib/admin";
import { isImageUrl } from "@/lib/uploads";

/** Allowed incident statuses (match backend enums). */
const INCIDENT_STATUSES = [
  "Pending",
  "Responding",
  "Resolved",
  "Closed",
] as const;

/** Priority rank for the command-center sort (highest urgency first). */
const PRIORITY_RANK: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

/**
 * Command-center ordering: primarily by priority (HIGH first), with the most
 * recently reported incident first within the same priority level.
 */
function compareIncidents(a: IncidentRecord, b: IncidentRecord): number {
  const rankDiff =
    (PRIORITY_RANK[a.triagePriority] ?? 99) -
    (PRIORITY_RANK[b.triagePriority] ?? 99);
  if (rankDiff !== 0) return rankDiff;
  return new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime();
}

/** Build a map of resident ObjectId (+ residentId) → full name for reporter lookup. */
function buildReporterMap(residents: ResidentRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of residents) {
    const name =
      [r.firstName, r.lastName].filter(Boolean).join(" ") || r.residentId;
    if (r._id) map.set(r._id, name);
    if (r.residentId) map.set(r.residentId, name);
  }
  return map;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Color mapping for the auto-assigned triage priority (read-only badge). */
function priorityColor(priority: string) {
  switch (priority) {
    case "Critical":
      return "error" as const;
    case "High":
      return "warning" as const;
    case "Medium":
      return "info" as const;
    default:
      return "success" as const;
  }
}

/**
 * Admin Incident Reports page — lists all incident reports and lets an admin
 * update each report's triage priority and status in place.
 */
export default function IncidentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [reporterNames, setReporterNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [incidentData, residentData] = await Promise.all([
          fetchIncidentReports(),
          fetchResidents(),
        ]);
        if (!cancelled) {
          setIncidents(incidentData);
          setReporterNames(buildReporterMap(residentData));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load incident reports.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdate = async (
    incident: IncidentRecord,
    body: { triagePriority?: string; incidentStatus?: string },
  ) => {
    setPendingId(incident.incidentId);
    setActionError(null);
    try {
      const updated = await updateIncidentReport(incident.incidentId, body);
      setIncidents((prev) =>
        prev.map((i) =>
          i.incidentId === incident.incidentId ? { ...i, ...updated } : i,
        ),
      );
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to update incident report.",
      );
    } finally {
      setPendingId(null);
    }
  };

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const filteredIncidents = (
    statusFilter === "all"
      ? incidents
      : incidents.filter((i) => i.incidentStatus === statusFilter)
  )
    .slice()
    .sort(compareIncidents);

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Incident Reports
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review community incident reports and manage response priority and
        status.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <iframe
          title="Incident map"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3867.1306425672137!2d121.3657976750994!3d14.245600386199767!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397e31b57a6e0ed%3A0x829e8c8c1bc06bb4!2sLabuin%20Barangay%20Hall!5e0!3m2!1sen!2sph!4v1787824333644!5m2!1sen!2sph"
          width="100%"
          height="400"
          style={{ border: 0, borderRadius: 12, width: "100%", display: "block" }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 2, flexWrap: "wrap" }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <WarningAmberIcon color="primary" />
              <Typography variant="h6" component="h3">
                Incident Reports
              </Typography>
            </Stack>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="incident-status-filter-label">Filter</InputLabel>
              <Select
                labelId="incident-status-filter-label"
                id="incident-status-filter"
                value={statusFilter}
                label="Filter"
                onChange={(event: SelectChangeEvent) =>
                  setStatusFilter(event.target.value)
                }
              >
                <MenuItem value="all">All Statuses</MenuItem>
                {INCIDENT_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {isLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 200,
              }}
            >
              <CircularProgress aria-label="Loading incident reports" />
            </Box>
          ) : filteredIncidents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No incident reports found.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="medium" aria-label="Incident reports">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>
                      Incident ID
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reporter</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Media</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reported</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredIncidents.map((incident) => (
                    <TableRow
                      key={incident.incidentId}
                      hover
                      sx={(theme) => ({
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
                      <TableCell>
                        {reporterNames.get(incident.residentId) ?? "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ maxWidth: 220 }}
                        >
                          {incident.locationDetails || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {incident.evidenceMediaUrls?.length ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <IconButton
                              size="small"
                              component="a"
                              href={incident.evidenceMediaUrls[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="View evidence media"
                            >
                              {isImageUrl(incident.evidenceMediaUrls[0]) ? (
                                <Avatar
                                  variant="rounded"
                                  src={incident.evidenceMediaUrls[0]}
                                  alt="Evidence"
                                  sx={{ width: 48, height: 48 }}
                                >
                                  <ImageIcon />
                                </Avatar>
                              ) : (
                                <ImageIcon />
                              )}
                            </IconButton>
                            {incident.evidenceMediaUrls.length > 1 && (
                              <Typography variant="caption" color="text.secondary">
                                +{incident.evidenceMediaUrls.length - 1}
                              </Typography>
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={incident.triagePriority}
                          size="small"
                          color={priorityColor(incident.triagePriority)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                          <Select
                            id={`status-${incident.incidentId}`}
                            value={incident.incidentStatus}
                            disabled={pendingId === incident.incidentId}
                            onChange={(event: SelectChangeEvent) =>
                              handleUpdate(incident, {
                                incidentStatus: event.target.value,
                              })
                            }
                          >
                            {INCIDENT_STATUSES.map((status) => (
                              <MenuItem key={status} value={status}>
                                {status}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>{formatDate(incident.reportedAt)}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<ForumIcon />}
                          onClick={() =>
                            router.push(
                              `/admin/chat-sessions?incident=${encodeURIComponent(incident.incidentId)}`,
                            )
                          }
                        >
                          Open Triage Chat
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={Boolean(actionError)}
        autoHideDuration={6000}
        onClose={() => setActionError(null)}
        message={actionError ?? ""}
      />
    </Box>
  );
}
