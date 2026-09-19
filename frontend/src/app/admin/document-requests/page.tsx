"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
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
import Tooltip from "@mui/material/Tooltip";
import DescriptionIcon from "@mui/icons-material/Description";
import HistoryIcon from "@mui/icons-material/History";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import { useAdminNotifications } from "@/context/AdminNotificationsContext";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/context/OnlineStatusContext";
import { TimelineSteps } from "@/components/shared/TimelineSteps";
import {
  DocumentQueueRecord,
  documentReferenceKeys,
  fetchDocumentRequests,
  hasUnreadReference,
  updateDocumentRequest,
} from "@/lib/admin";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** All document statuses, used for the filter buttons. */
const DOCUMENT_STATUSES = [
  "Submitted",
  "Processing",
  "Ready for Pickup",
  "Released",
  "Rejected",
] as const;

/**
 * Route entry point.
 *
 * The deep-link parameter below is read with `useSearchParams()`, which must sit
 * inside a `<Suspense>` boundary or the static prerender of this route fails the
 * production build ("useSearchParams() should be wrapped in a suspense
 * boundary") — the trap `/admin/chat-sessions` already hit. The inner component
 * owns every hook; this wrapper only supplies the boundary.
 */
export default function DocumentRequestsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentRequestsPageContent />
    </Suspense>
  );
}

/**
 * Admin Document Queue page — lists all document requests with applicant,
 * document type, purpose, status, request date, and remarks.
 */
function DocumentRequestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestParam = searchParams.get("request");
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const isOnline = useOnlineStatus();
  // The same shared list the sidebar badge counts, so a row's bold state and its
  // badge can never disagree.
  const { unreadDocumentIds, markRecordsRead } = useAdminNotifications();

  const [documents, setDocuments] = useState<DocumentQueueRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  /** When true the table shows only requests with unseen updates. */
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    doc: DocumentQueueRecord;
    newStatus: string;
  } | null>(null);
  const [remarksDraft, setRemarksDraft] = useState("");
  const [remarksError, setRemarksError] = useState<string | null>(null);
  /** Request whose processing history is open in the dialog. */
  const [historyDoc, setHistoryDoc] = useState<DocumentQueueRecord | null>(
    null,
  );

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  const openStatusModal = (doc: DocumentQueueRecord, newStatus: string) => {
    if (newStatus === doc.currentStatus) return;
    setRemarksDraft("");
    setRemarksError(null);
    setActionError(null);
    setActionSuccess(null);
    setStatusModal({ doc, newStatus });
  };

  const closeStatusModal = () => {
    setStatusModal(null);
    setRemarksDraft("");
    setRemarksError(null);
  };

  const confirmStatusChange = async () => {
    if (!statusModal) return;
    const { doc, newStatus } = statusModal;
    if (newStatus === "Rejected" && !remarksDraft.trim()) {
      setRemarksError("A remark is required when rejecting a document request.");
      return;
    }

    // Guard against a stale resident session: the admin and resident portals
    // share the `kbc_token` cookie, so signing into the resident app silently
    // replaces the admin session. Re-validate the CURRENT session role before
    // performing this staff-only status change.
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const session = (await res.json()) as {
        authenticated?: boolean;
        role?: string | null;
        /** Backend unreachable — the session was not actually rejected. */
        unavailable?: boolean;
      };
      // An outage must not be reported as a logout: the cookie is still valid,
      // so ask the user to retry instead of ejecting them to the login page.
      if (session.unavailable) {
        setActionError("Could not verify your session. Please try again.");
        return;
      }
      if (!session.authenticated || session.role !== "admin") {
        setActionError(
          "Your admin session ended. Please log in again as an administrator.",
        );
        router.replace("/admin/login");
        return;
      }
    } catch {
      setActionError("Could not verify your session. Please try again.");
      return;
    }

    setPendingId(doc.requestId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await updateDocumentRequest(doc.requestId, {
        currentStatus: newStatus,
        ...(remarksDraft.trim() ? { remarks: remarksDraft.trim() } : {}),
      });
      setDocuments((prev) =>
        prev.map((d) => (d.requestId === doc.requestId ? updated : d)),
      );
      closeStatusModal();
      setActionSuccess(`${doc.requestId} status updated to ${newStatus}.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update document status.",
      );
    } finally {
      setPendingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDocumentRequests();
        if (!cancelled) setDocuments(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load document requests.",
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
   * referenced request's history dialog, so the admin lands on the record itself
   * rather than just the queue. The link carries the custom `REQ-…` id; the Mongo
   * `_id` is accepted too, for notifications written before the ids settled.
   */
  const openedRequestParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!requestParam || isLoading) return;
    if (openedRequestParamRef.current === requestParam) return;
    const match = documents.find(
      (doc) => doc.requestId === requestParam || doc._id === requestParam,
    );
    if (!match) return;
    openedRequestParamRef.current = requestParam;
    setHistoryDoc(match);
  }, [requestParam, isLoading, documents]);

  /**
   * Opening a record marks it seen: the admin has the request in front of them, so
   * leaving its row bold would be a lie. Both dialogs count — the history view and
   * the status-change confirmation the row's Select opens.
   *
   * Guarded on the reference still being unread, so re-opening a dialog (or the set
   * re-identifying after an unrelated notification) cannot fire a pointless PATCH.
   */
  useEffect(() => {
    const keys = historyDoc
      ? documentReferenceKeys(historyDoc).filter((key) =>
          unreadDocumentIds.has(key),
        )
      : [];
    if (keys.length > 0) markRecordsRead(keys);
  }, [historyDoc, unreadDocumentIds, markRecordsRead]);

  useEffect(() => {
    const keys = statusModal
      ? documentReferenceKeys(statusModal.doc).filter((key) =>
          unreadDocumentIds.has(key),
        )
      : [];
    if (keys.length > 0) markRecordsRead(keys);
  }, [statusModal, unreadDocumentIds, markRecordsRead]);

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  // Unread is counted per RECORD — a request can carry several notifications
  // (submitted, then one per status change) — so this is exactly the number of bold
  // rows, and it matches the sidebar's Document Queue badge.
  const isDocumentUnread = (doc: DocumentQueueRecord) =>
    hasUnreadReference(unreadDocumentIds, documentReferenceKeys(doc));
  const unreadCount = documents.filter(isDocumentUnread).length;

  const filteredDocuments = (
    statusFilter === "all"
      ? documents
      : documents.filter((d) => d.currentStatus === statusFilter)
  ).filter((d) => !unreadOnly || isDocumentUnread(d));

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Document Requests
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review and process incoming document requests.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

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
              <DescriptionIcon color="primary" />
              <Typography variant="h6" component="h3">
                Document Queue
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
                  markRecordsRead(documents.flatMap(documentReferenceKeys))
                }
                sx={{ whiteSpace: "nowrap" }}
              >
                Mark all as read
              </Button>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="status-filter-label">Filter</InputLabel>
                <Select
                  labelId="status-filter-label"
                  id="status-filter"
                  value={statusFilter}
                  label="Filter"
                  onChange={(event: SelectChangeEvent) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <MenuItem value="all">All Status</MenuItem>
                  {DOCUMENT_STATUSES.map((status) => (
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
              <CircularProgress aria-label="Loading document requests" />
            </Box>
          ) : filteredDocuments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {unreadOnly
                ? "No unread document requests."
                : "No document requests found."}
            </Typography>
          ) : (
            <TableContainer>
              <Table size="medium" aria-label="Document requests">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Request ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Applicant</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Document Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Purpose</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Requested</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow
                      key={doc.requestId}
                      hover
                      sx={(theme) => ({
                        // Zebra striping using a light tint of the theme color.
                        "&:nth-of-type(odd)": {
                          backgroundColor: alpha(theme.palette.primary.main, 0.08),
                        },
                      })}
                    >
                      {/* Bold while unread — the same signal the resident portal and
                          the Live Chat queue use. Read rows keep their old weight. */}
                      <TableCell
                        sx={{
                          fontWeight: isDocumentUnread(doc) ? 700 : 600,
                        }}
                      >
                        {doc.requestId}
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {doc.applicantDetails?.fullName ?? "—"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {doc.applicantDetails?.emailAddress ?? ""}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{doc.documentType}</TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                          {doc.purpose || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <Select
                            value={doc.currentStatus}
                            disabled={
                              doc.currentStatus === "Released" ||
                              pendingId === doc.requestId
                            }
                            inputProps={{ "aria-label": "Document status" }}
                            onChange={(event) =>
                              openStatusModal(doc, event.target.value as string)
                            }
                          >
                            {DOCUMENT_STATUSES.map((status) => (
                              <MenuItem key={status} value={status}>
                                {status}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>{formatDate(doc.dateRequested)}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ maxWidth: 240, minWidth: 120 }}
                        >
                          {doc.remarks || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View processing history">
                          <IconButton
                            size="small"
                            aria-label={`View processing history for ${doc.requestId}`}
                            onClick={() => setHistoryDoc(doc)}
                          >
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(statusModal)} onClose={closeStatusModal}>
        <DialogTitle>Update document status</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Change the status of request {statusModal?.doc.requestId} to{" "}
            {statusModal?.newStatus}?
          </DialogContentText>
          {statusModal?.newStatus === "Released" && (
            <DialogContentText sx={{ mt: 1, color: "warning.main" }}>
              Please make sure that this document has already been paid before
              proceeding.
            </DialogContentText>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Remarks"
            multiline
            minRows={2}
            fullWidth
            required={statusModal?.newStatus === "Rejected"}
            value={remarksDraft}
            onChange={(event) => {
              setRemarksDraft(event.target.value);
              if (remarksError) setRemarksError(null);
            }}
            error={Boolean(remarksError)}
            helperText={
              remarksError ??
              (statusModal?.newStatus === "Rejected"
                ? "A remark explaining the rejection is required."
                : "Optional — add a note for the resident.")
            }
            placeholder={
              statusModal?.newStatus === "Rejected"
                ? "e.g. Missing supporting document"
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
        open={Boolean(historyDoc)}
        onClose={() => setHistoryDoc(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Processing history — {historyDoc?.requestId}</DialogTitle>
        <DialogContent>
          {historyDoc?.timeline && historyDoc.timeline.length > 0 ? (
            <TimelineSteps
              steps={historyDoc.timeline}
              showActor
              currentStatus={historyDoc.currentStatus}
            />
          ) : (
            <DialogContentText>
              No processing history yet — history is recorded from the next
              status change.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDoc(null)} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(actionSuccess)}
        autoHideDuration={4000}
        onClose={() => setActionSuccess(null)}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setActionSuccess(null)}
        >
          {actionSuccess}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(actionError)}
        autoHideDuration={6000}
        onClose={() => setActionError(null)}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setActionError(null)}
        >
          {actionError}
        </Alert>
      </Snackbar>
    </Box>
  );
}
