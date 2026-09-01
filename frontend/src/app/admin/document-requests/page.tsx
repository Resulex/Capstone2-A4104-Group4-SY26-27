"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
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
import DescriptionIcon from "@mui/icons-material/Description";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import InventoryIcon from "@mui/icons-material/Inventory";
import { useAuth } from "@/context/AuthContext";
import {
  DocumentQueueRecord,
  fetchDocumentRequests,
  updateDocumentRequest,
} from "@/lib/admin";

/** Color mapping for a document request's current status. */
function statusColor(status: string) {
  switch (status) {
    case "Ready for Pickup":
    case "Released":
      return "success" as const;
    case "Rejected":
      return "error" as const;
    case "Processing":
      return "info" as const;
    default:
      return "warning" as const;
  }
}

/** Color mapping for payment status. */
function paymentColor(status: string) {
  return status === "Paid Offline" ? ("success" as const) : ("warning" as const);
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
 * document type, purpose, status, payment, and request date.
 */
export default function DocumentRequestsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [documents, setDocuments] = useState<DocumentQueueRecord[]>([]);
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

  const handleStatusChange = async (doc: DocumentQueueRecord, currentStatus: string) => {
    setPendingId(doc.requestId);
    setActionError(null);
    try {
      const updated = await updateDocumentRequest(doc.requestId, {
        currentStatus,
      });
      setDocuments((prev) =>
        prev.map((d) =>
          d.requestId === doc.requestId
            ? { ...d, currentStatus: updated.currentStatus }
            : d,
        ),
      );
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
                    <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Requested</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.requestId} hover>
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
                        <Chip
                          label={doc.currentStatus}
                          size="small"
                          color={statusColor(doc.currentStatus)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={doc.paymentStatus ?? "Unpaid"}
                          size="small"
                          color={paymentColor(doc.paymentStatus ?? "Unpaid")}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatDate(doc.dateRequested)}</TableCell>
                      <TableCell>
                        {(() => {
                          const status = doc.currentStatus;
                          const isTerminal =
                            status === "Rejected" ||
                            status === "Released" ||
                            status === "Ready for Pickup";
                          const isReady =
                            status === "Ready for Pickup" || status === "Released";
                          return (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap">
                              {!isTerminal && (
                                <>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                    startIcon={<CheckCircleIcon />}
                                    disabled={pendingId === doc.requestId}
                                    onClick={() =>
                                      handleStatusChange(doc, "Processing")
                                    }
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={<CancelIcon />}
                                    disabled={pendingId === doc.requestId}
                                    onClick={() =>
                                      handleStatusChange(doc, "Rejected")
                                    }
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              {!isReady && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  startIcon={<InventoryIcon />}
                                  disabled={pendingId === doc.requestId}
                                  onClick={() =>
                                    handleStatusChange(doc, "Ready for Pickup")
                                  }
                                >
                                  Mark as Ready
                                </Button>
                              )}
                            </Stack>
                          );
                        })()}
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
