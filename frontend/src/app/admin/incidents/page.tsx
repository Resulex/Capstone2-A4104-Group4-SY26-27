"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Skeleton from "@mui/material/Skeleton";
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
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ForumIcon from "@mui/icons-material/Forum";
import HistoryIcon from "@mui/icons-material/History";
import ImageIcon from "@mui/icons-material/Image";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import { useAdminNotifications } from "@/context/AdminNotificationsContext";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/context/OnlineStatusContext";
import { TimelineSteps } from "@/components/shared/TimelineSteps";
import {
  IncidentRecord,
  ResidentRecord,
  fetchIncidentReports,
  fetchResidents,
  formatIncidentLocation,
  hasUnreadReference,
  incidentReferenceKeys,
  updateIncidentReport,
} from "@/lib/admin";
import { coordinatesFrom } from "@/lib/geo";
import { isImageUrl } from "@/lib/uploads";

/**
 * Banner map: the same keyless Leaflet/OpenStreetMap base the resident incident
 * pages use. Loaded with `ssr: false` because Leaflet reads `window` while its
 * module is evaluated, which fails during the App Router's server render. This
 * page is a client component, so that wrapper is allowed.
 */
const IncidentMap = dynamic(() => import("@/components/shared/IncidentMap"), {
  ssr: false,
  loading: () => <Skeleton variant="rounded" height={400} />,
});

/**
 * Mini map inside the Location-cell hover popup. Its own `ssr: false` chunk for
 * the same reason as `IncidentMap`: Leaflet needs `window` at module scope.
 */
const IncidentLocationPreview = dynamic(
  () => import("@/components/shared/IncidentLocationPreview"),
  { ssr: false },
);

/**
 * Settle time before a Location-cell hover opens the popup. Sweeping the pointer
 * down the queue would otherwise build and tear down a Leaflet map for every row
 * it crosses.
 */
const LOCATION_PREVIEW_DELAY_MS = 150;

/** Allowed incident statuses (match backend enums). */
const INCIDENT_STATUSES = [
  "Pending",
  "Responding",
  "Resolved",
  "Closed",
  "Duplicate",
] as const;

/** Statuses that cannot be recorded without an explanatory remark (see TERMINAL_STATUSES). */
const REMARK_REQUIRED_STATUSES = ["Closed", "Duplicate"];

/**
 * Terminal statuses: a Closed or Duplicate report is settled, so those rows sink
 * below the incidents that still need a response in the command-center sort.
 */
const TERMINAL_STATUSES = ["Closed", "Duplicate"];

/** Priority rank for the command-center sort (highest urgency first). */
const PRIORITY_RANK: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

/** Sort tier: 0 for incidents still needing attention, 1 for terminal ones. */
function terminalRank(status: string): number {
  return TERMINAL_STATUSES.includes(status) ? 1 : 0;
}

/**
 * Command-center ordering: incidents still needing attention come first, then
 * the terminal statuses (Closed/Duplicate). Within each tier, rows are ordered
 * by priority (HIGH first), with the most recently reported incident first
 * within the same priority level.
 */
function compareIncidents(a: IncidentRecord, b: IncidentRecord): number {
  const terminalDiff =
    terminalRank(a.incidentStatus) - terminalRank(b.incidentStatus);
  if (terminalDiff !== 0) return terminalDiff;
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
 * Route entry point.
 *
 * The deep-link parameter below is read with `useSearchParams()`, which must sit
 * inside a `<Suspense>` boundary or the static prerender of this route fails the
 * production build ("useSearchParams() should be wrapped in a suspense
 * boundary") — the trap `/admin/chat-sessions` already hit. The inner component
 * owns every hook; this wrapper only supplies the boundary.
 */
export default function IncidentsPage() {
  return (
    <Suspense fallback={null}>
      <IncidentsPageContent />
    </Suspense>
  );
}

/**
 * Admin Incident Reports page — lists all incident reports and lets an admin
 * update each report's triage priority and status in place.
 */
function IncidentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const incidentParam = searchParams.get("incident");
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const isOnline = useOnlineStatus();
  // The same shared list the sidebar badge counts, so a row's bold state and its
  // badge can never disagree.
  const { unreadIncidentIds, markRecordsRead } = useAdminNotifications();

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
  /** When true the table shows only reports with unseen updates. */
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
  /**
   * Location-cell hover: the banner map narrows to that report AND a mini map
   * opens under the cell, so the pin is visible without scrolling back up to the
   * banner. `anchorEl` is the cell itself, which is what positions the popup.
   */
  const [hoveredLocation, setHoveredLocation] = useState<{
    anchorEl: HTMLElement;
    incident: IncidentRecord;
  } | null>(null);
  /**
   * Pending hover-open timer. The hover is delayed before it opens anything, so
   * sweeping the pointer down the queue does not build and tear down a Leaflet
   * map per row (see `LOCATION_PREVIEW_DELAY_MS`).
   */
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Pins for the banner map, derived from the SAME filters the table applies so
   * the two views cannot disagree.
   *
   * "All Statuses" keeps the command-center default of live reports only — a
   * settled Closed/Duplicate report is not something to keep on the response map
   * — while explicitly filtering to a terminal status does pin it, because that
   * is then the question the admin asked. Reports filed before the map picker
   * existed carry no coordinates and are dropped; the table still lists them.
   *
   * Declared with the other hooks (above the auth early-return) because a hook
   * after a conditional return breaks the hook order on re-render.
   */
  const mapIncidents = useMemo(
    () =>
      incidents
        .filter(
          (incident) =>
            !unreadOnly ||
            hasUnreadReference(unreadIncidentIds, incidentReferenceKeys(incident)),
        )
        .filter((incident) =>
          statusFilter === "all"
            ? !TERMINAL_STATUSES.includes(incident.incidentStatus)
            : incident.incidentStatus === statusFilter,
        )
        .filter((incident) => coordinatesFrom(incident) !== null),
    [incidents, unreadOnly, statusFilter, unreadIncidentIds],
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

  /**
   * Deep link from a notification (toast click-through or bell row): open the
   * referenced report's history dialog, so the admin lands on the record itself
   * rather than just the queue. The link carries the custom `INC-…` id; the Mongo
   * `_id` is accepted too, for notifications written before the ids settled.
   */
  const openedIncidentParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!incidentParam || isLoading) return;
    if (openedIncidentParamRef.current === incidentParam) return;
    const match = incidents.find(
      (incident) =>
        incident.incidentId === incidentParam ||
        incident._id === incidentParam,
    );
    if (!match) return;
    openedIncidentParamRef.current = incidentParam;
    setHistoryIncident(match);
  }, [incidentParam, isLoading, incidents]);

  /**
   * Opening a record marks it seen: the admin has the report in front of them, so
   * leaving its row bold would be a lie. Both dialogs count — the history view and
   * the status-change confirmation the row's Select opens.
   *
   * Guarded on the reference still being unread, so re-opening a dialog (or the set
   * re-identifying after an unrelated notification) cannot fire a pointless PATCH.
   */
  useEffect(() => {
    const keys = historyIncident
      ? incidentReferenceKeys(historyIncident).filter((key) =>
          unreadIncidentIds.has(key),
        )
      : [];
    if (keys.length > 0) markRecordsRead(keys);
  }, [historyIncident, unreadIncidentIds, markRecordsRead]);

  useEffect(() => {
    const keys = statusModal
      ? incidentReferenceKeys(statusModal.incident).filter((key) =>
          unreadIncidentIds.has(key),
        )
      : [];
    if (keys.length > 0) markRecordsRead(keys);
  }, [statusModal, unreadIncidentIds, markRecordsRead]);

  /** Opens the Location-cell hover popup, after a short settle delay. */
  const openLocationPreview = (
    incident: IncidentRecord,
    anchorEl: HTMLElement,
  ) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(
      () => setHoveredLocation({ incident, anchorEl }),
      LOCATION_PREVIEW_DELAY_MS,
    );
  };

  const closeLocationPreview = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredLocation(null);
  };

  // A pending hover timer must not outlive the page.
  useEffect(
    () => () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    },
    [],
  );

  /** Opens the confirmation modal for a status change (never fires directly). */
  const openStatusModal = (incident: IncidentRecord, newStatus: string) => {
    if (newStatus === incident.incidentStatus) return;
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

  // Unread is counted per RECORD — a report can carry several notifications
  // (created, then one per status change) — so this is exactly the number of bold
  // rows, and it matches the sidebar's Incident Reports badge.
  const isIncidentUnread = (incident: IncidentRecord) =>
    hasUnreadReference(unreadIncidentIds, incidentReferenceKeys(incident));
  const unreadCount = incidents.filter(isIncidentUnread).length;

  const filteredIncidents = (
    statusFilter === "all"
      ? incidents
      : incidents.filter((i) => i.incidentStatus === statusFilter)
  )
    .filter((i) => !unreadOnly || isIncidentUnread(i))
    .slice()
    .sort(compareIncidents);

  // Candidate originals for the duplicate picker: every other report, drawn
  // from the FULL list so a status filter never hides a valid choice. Reuses the
  // command-center order, so Closed/Duplicate candidates sort last.
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

      {/* Live response map: one priority-coloured pin per report in the current
          filter. The old Google-Maps iframe could only ever show the barangay
          hall at a fixed centre. */}
      <Box sx={{ mb: 3 }}>
        <IncidentMap
          incidents={mapIncidents}
          focusIncident={hoveredLocation?.incident ?? null}
          height={400}
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

            {/* Unread controls sit LEFT of the status filter and wrap with it, so
                the row stays on one line on wide screens and never squeezes the
                Select on narrow ones. */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ flexWrap: "wrap", rowGap: 1 }}
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
                // Clears the WHOLE queue, not just the filtered rows: this is the
                // page-level twin of the bell's "Read all", and what clears the
                // sidebar badge.
                onClick={() =>
                  markRecordsRead(incidents.flatMap(incidentReferenceKeys))
                }
                sx={{ whiteSpace: "nowrap" }}
              >
                Mark all as read
              </Button>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="incident-status-filter-label">
                  Filter
                </InputLabel>
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
                ? "No unread incident reports."
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
                      {/* Bold while unread — the same signal the Live Chat queue
                          uses. Read rows fall back to the body weight (400); a
                          600 here would still read as bold next to the 700. */}
                      <TableCell
                        sx={{
                          fontWeight: isIncidentUnread(incident) ? 700 : 400,
                        }}
                      >
                        {incident.incidentId}
                      </TableCell>
                      <TableCell>{incident.incidentCategory}</TableCell>
                      <TableCell>
                        {reporterNames.get(incident.residentId) ?? "Unknown"}
                      </TableCell>
                      {/* Hovering the cell narrows the banner map to this row's
                          pin AND opens a mini map under the cell (see
                          `hoveredLocation`), so the pin is visible without
                          scrolling back up to the banner. Reports with no pin
                          get a tooltip saying so instead. */}
                      <TableCell
                        onMouseEnter={(event) => {
                          if (coordinatesFrom(incident)) {
                            openLocationPreview(incident, event.currentTarget);
                          }
                        }}
                        onMouseLeave={closeLocationPreview}
                      >
                        <Tooltip
                          title="No pinned location for this report."
                          disableHoverListener={Boolean(
                            coordinatesFrom(incident),
                          )}
                          disableFocusListener={Boolean(
                            coordinatesFrom(incident),
                          )}
                        >
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ maxWidth: 220 }}
                          >
                            {formatIncidentLocation(incident) || "—"}
                          </Typography>
                        </Tooltip>
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
                          <Tooltip title="View status history">
                            <IconButton
                              size="small"
                              aria-label={`View status history for ${incident.incidentId}`}
                              onClick={() => setHistoryIncident(incident)}
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

      {/*
        Location preview. `pointerEvents: "none"` (set on the root, inherited by
        the paper) is what makes a hover-opened popup work: the cursor stays "on"
        the cell that opened it, so the popup cannot steal its own hover, cancel
        the mouseleave, or swallow a click on the row underneath.
      */}
      <Popover
        open={Boolean(hoveredLocation)}
        anchorEl={hoveredLocation?.anchorEl ?? null}
        onClose={closeLocationPreview}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        disableScrollLock
        sx={{ pointerEvents: "none" }}
      >
        {hoveredLocation && (
          <Box sx={{ p: 1 }}>
            <IncidentLocationPreview
              key={hoveredLocation.incident.incidentId}
              incident={hoveredLocation.incident}
            />
          </Box>
        )}
      </Popover>

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
