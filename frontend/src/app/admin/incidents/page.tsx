"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
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
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useAuth } from "@/context/AuthContext";
import {
  IncidentRecord,
  ResidentRecord,
  fetchIncidentReports,
  fetchResidents,
  updateIncidentReport,
} from "@/lib/admin";

/** Allowed triage priorities and incident statuses (match backend enums). */
const INCIDENT_PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
const INCIDENT_STATUSES = [
  "Pending",
  "Responding",
  "Resolved",
  "Closed",
] as const;

/** Build a map of resident ObjectId → full name for reporter lookup. */
function buildReporterMap(residents: ResidentRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of residents) {
    const key = r._id ?? r.residentId;
    const name =
      [r.firstName, r.lastName].filter(Boolean).join(" ") || r.residentId;
    map.set(key, name);
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

  const filteredIncidents =
    statusFilter === "all"
      ? incidents
      : incidents.filter((i) => i.incidentStatus === statusFilter);

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
                    <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reported</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredIncidents.map((incident) => (
                    <TableRow key={incident.incidentId} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {incident.incidentId}
                      </TableCell>
                      <TableCell>{incident.incidentCategory}</TableCell>
                      <TableCell>
                        {reporterNames.get(incident.residentId) ??
                          incident.residentId}
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
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            id={`priority-${incident.incidentId}`}
                            value={incident.triagePriority}
                            disabled={pendingId === incident.incidentId}
                            onChange={(event: SelectChangeEvent) =>
                              handleUpdate(incident, {
                                triagePriority: event.target.value,
                              })
                            }
                          >
                            {INCIDENT_PRIORITIES.map((priority) => (
                              <MenuItem key={priority} value={priority}>
                                {priority}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
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
