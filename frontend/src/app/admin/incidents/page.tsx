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
import Autocomplete from "@mui/material/Autocomplete";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ForumIcon from "@mui/icons-material/Forum";
import HistoryIcon from "@mui/icons-material/History";
import ImageIcon from "@mui/icons-material/Image";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import { useAuth } from "@/context/AuthContext";
import { useAdminNotifications } from "@/context/AdminNotificationsContext";
import { useOnlineStatus } from "@/context/OnlineStatusContext";
import { TimelineSteps } from "@/components/shared/TimelineSteps";
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
  "Duplicate",
] as const;

/** Statuses that cannot be recorded without an explanatory remark. */
const REMARK_REQUIRED_STATUSES = ["Closed", "Duplicate"];

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
  const isOnline = useOnlineStatus();

  // Unread rows come from this admin's own notifications, shared with the sidebar
  // badge — so the number and the bold rows can never disagree.
  const { unreadIncidentIds, markRecordsRead, markRecordsUnread } =
    useAdminNotifications();
  const unreadInQueue = unreadIncidentIds.size;

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [reporterNames, setReporterNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  /** When true the table shows only records this admin has not seen yet. */
  const [unreadOnly, setUnreadOnly] = useState(false);
  /** Pending status change awaiting confirmation in the modal. */
  const [statusModal, setStatusModal] = useState<{
    incident: IncidentRecord;
    newStatus: string;
  } | null>(null);
  const [remarksDraft, setRemarksDraft] = useState("");
  const [remarksError, setRemarksError] = useState<string | null>(null);
  /** Original report selected when the new status is "Duplicate". */
  const [duplicateDraft, setDuplicateDraft] = useState<IncidentRecord | null>(
    null,
  );
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  /** Report whose status history is open in the dialog. */
  const [historyIncident, setHistoryIncident] = useState<IncidentRecord | null>(
    null,
  );

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

  /** Opens the confirmation modal for a status change (never fires directly). */
  const openStatusModal = (incident: IncidentRecord, newStatus: string) => {
    if (newStatus === incident.incidentStatus) return;
    // Acting on a record means the admin has seen it.
    markRecordsRead([incident.incidentId]);
    setRemarksDraft("");
    setRemarksError(null);
    setDuplicateDraft(null);
    setDuplicateError(null);
    setActionError(null);
    setActionSuccess(null);
    setStatusModal({ incident, newStatus });
  };

  const closeStatusModal = () => {
    setStatusModal(null);
    setRemarksDraft("");
    setRemarksError(null);
    setDuplicateDraft(null);
    setDuplicateError(null);
  };

  /** True while this admin still has unread notifications about the report. */
  const isUnread = (incident: IncidentRecord) =>
    unreadIncidentIds.has(incident.incidentId);

  /** Opening the status history counts as having seen the report. */
  const openHistory = (incident: IncidentRecord) => {
    markRecordsRead([incident.incidentId]);
    setHistoryIncident(incident);
  };

  const confirmStatusChange = async () => {
    if (!statusModal) return;
    const { incident, newStatus } = statusModal;
    const remark = remarksDraft.trim();

    // Closed/Duplicate decisions must be explained, and a duplicate must name
    // the report it repeats (both rules are re-enforced by the backend).
    if (REMARK_REQUIRED_STATUSES.includes(newStatus) && !remark) {
      setRemarksError(
        newStatus === "Duplicate"
          ? "A remark is required when marking a report as a duplicate."
          : "A remark is required when closing an incident report.",
      );
      return;
    }
    if (newStatus === "Duplicate" && !duplicateDraft) {
      setDuplicateError("Select the original incident this report duplicates.");
      return;
    }

    setPendingId(incident.incidentId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await updateIncidentReport(incident.incidentId, {
        incidentStatus: newStatus,
        ...(remark ? { remarks: remark } : {}),
        ...(newStatus === "Duplicate" && duplicateDraft
          ? { duplicateOfIncidentId: duplicateDraft.incidentId }
          : {}),
      });
      setIncidents((prev) =>
        prev.map((i) =>
          i.incidentId === incident.incidentId ? { ...i, ...updated } : i,
        ),
      );
      closeStatusModal();
      setActionSuccess(
        `${incident.incidentId} status updated to ${newStatus}.`,
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
    .filter((i) => !unreadOnly || unreadIncidentIds.has(i.incidentId))
    .slice()
    .sort(compareIncidents);

  /** Mark every row currently on screen as read (respects the active filters). */
  const markAllVisibleRead = () =>
    markRecordsRead(filteredIncidents.map((i) => i.incidentId));

  // Candidate originals for the duplicate picker: every other report, drawn
  // from the FULL list so a status filter never hides a valid choice.
  const duplicateOptions = statusModal
    ? incidents
        .filter((i) => i.incidentId !== statusModal.incident.incidentId)
        .slice()
        .sort(compareIncidents)
    : [];

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

            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant={unreadOnly ? "contained" : "outlined"}
                color={unreadOnly ? "primary" : "inherit"}
                startIcon={<MarkEmailUnreadIcon />}
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly((prev) => !prev)}
                sx={{ whiteSpace: "nowrap" }}
              >
                Unread only{unreadInQueue > 0 ? ` (${unreadInQueue})` : ""}
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<MarkEmailReadIcon />}
                disabled={unreadInQueue === 0}
                onClick={markAllVisibleRead}
                sx={{ whiteSpace: "nowrap" }}
              >
                Mark all as read
              </Button>
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
              {unreadOnly
                ? "No unread incident reports match these filters."
                : "No incident reports found."}
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
                    <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
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
                      <TableCell sx={{ fontWeight: isUnread(incident) ? 700 : 400 }}>
                        {incident.incidentId}
                      </TableCell>
                      <TableCell>{incident.incidentCategory}</TableCell>
                      <TableCell sx={{ fontWeight: isUnread(incident) ? 700 : 400 }}>
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
                              openStatusModal(incident, event.target.value)
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
                        <Typography
                          variant="body2"
                          color={incident.remarks ? "text.primary" : "text.secondary"}
                          noWrap
                          sx={{ maxWidth: 200 }}
                        >
                          {incident.remarks || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Tooltip
                            title={
                              isUnread(incident)
                                ? "Mark as read"
                                : "Mark as unread"
                            }
                          >
                            <IconButton
                              size="small"
                              aria-label={
                                isUnread(incident)
                                  ? `Mark ${incident.incidentId} as read`
                                  : `Mark ${incident.incidentId} as unread`
                              }
                              onClick={() =>
                                isUnread(incident)
                                  ? markRecordsRead([incident.incidentId])
                                  : markRecordsUnread([incident.incidentId])
                              }
                            >
                              {isUnread(incident) ? (
                                <MarkEmailReadIcon fontSize="small" />
                              ) : (
                                <MarkEmailUnreadIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View status history">
                            <IconButton
                              size="small"
                              aria-label={`View status history for ${incident.incidentId}`}
                              onClick={() => openHistory(incident)}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(statusModal)}
        onClose={closeStatusModal}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Update incident status</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Change the status of incident {statusModal?.incident.incidentId} to{" "}
            {statusModal?.newStatus}?
          </DialogContentText>

          {statusModal?.newStatus === "Duplicate" && (
            <Autocomplete
              sx={{ mt: 2 }}
              options={duplicateOptions}
              value={duplicateDraft}
              onChange={(_event, value) => {
                setDuplicateDraft(value);
                if (duplicateError) setDuplicateError(null);
              }}
              getOptionLabel={(option) =>
                `${option.incidentId} — ${option.incidentCategory} (${option.incidentStatus})`
              }
              isOptionEqualToValue={(option, value) =>
                option.incidentId === value.incidentId
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Original incident"
                  placeholder="Search by incident ID or category"
                  required
                  error={Boolean(duplicateError)}
                  helperText={
                    duplicateError ??
                    "Select the report this incident duplicates."
                  }
                />
              )}
            />
          )}

          <TextField
            autoFocus={statusModal?.newStatus !== "Duplicate"}
            margin="dense"
            label="Remarks"
            multiline
            minRows={2}
            fullWidth
            required={
              !!statusModal &&
              REMARK_REQUIRED_STATUSES.includes(statusModal.newStatus)
            }
            value={remarksDraft}
            onChange={(event) => {
              setRemarksDraft(event.target.value);
              if (remarksError) setRemarksError(null);
            }}
            error={Boolean(remarksError)}
            helperText={
              remarksError ??
              (statusModal &&
              REMARK_REQUIRED_STATUSES.includes(statusModal.newStatus)
                ? "A remark explaining this decision is required."
                : "Optional — add a note for the resident.")
            }
            placeholder={
              statusModal?.newStatus === "Duplicate"
                ? "e.g. Same fire already reported by another resident"
                : statusModal?.newStatus === "Closed"
                  ? "e.g. Issue addressed and verified on site"
                  : undefined
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeStatusModal} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={confirmStatusChange}
            variant="contained"
            color="primary"
            disabled={pendingId !== null || !isOnline}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(historyIncident)}
        onClose={() => setHistoryIncident(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Status history — {historyIncident?.incidentId}
        </DialogTitle>
        <DialogContent>
          {historyIncident?.timeline && historyIncident.timeline.length > 0 ? (
            <TimelineSteps
              steps={historyIncident.timeline}
              showActor
              currentStatus={historyIncident.incidentStatus}
            />
          ) : (
            <DialogContentText>
              No status history yet — history is recorded from the next status
              change.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryIncident(null)} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(actionSuccess)}
        autoHideDuration={4000}
        onClose={() => setActionSuccess(null)}
        message={actionSuccess ?? ""}
      />

      <Snackbar
        open={Boolean(actionError)}
        autoHideDuration={6000}
        onClose={() => setActionError(null)}
        message={actionError ?? ""}
      />
    </Box>
  );
}
