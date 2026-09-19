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
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/context/OnlineStatusContext";
import { TimelineSteps } from "@/components/shared/TimelineSteps";
import {
  DocumentQueueRecord,
  fetchDocumentRequests,
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
 * Admin Document Queue page — lists all document requests with applicant,
 * document type, purpose, status, request date, and remarks.
 */
export default function DocumentRequestsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const isOnline = useOnlineStatus();

  const [documents, setDocuments] = useState<DocumentQueueRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const filteredDocuments =
    statusFilter === "all"
      ? documents
      : documents.filter((d) => d.currentStatus === statusFilter);

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
              No document requests found.
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
                      <TableCell sx={{ fontWeight: 600 }}>
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
