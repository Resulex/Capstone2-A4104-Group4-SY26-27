"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArchiveIcon from "@mui/icons-material/Archive";
import PeopleIcon from "@mui/icons-material/People";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useAuth } from "@/context/AuthContext";
import { useCanArchive } from "@/hooks/useCanArchive";
import { ResidentActionMenu } from "@/components/admin/ResidentActionMenu";
import { ArchiveConfirmDialog } from "@/components/admin/ArchiveConfirmDialog";
import { ArchiveScopeToggle } from "@/components/admin/ArchiveScopeToggle";
import {
  ArchiveScope,
  archiveRecord,
  fetchResidents,
  isRecordArchived,
  recordArchivedAt,
  RESIDENT_DELETION_COLORS,
  RESIDENT_STATUS_COLORS,
  ResidentRecord,
  residentDeletionLabel,
  residentDeletionState,
  restoreRecord,
} from "@/lib/admin";

/** Build a resident's full name from its name fields. */
function fullName(resident: ResidentRecord): string {
  const parts = [resident.firstName, resident.middleName, resident.lastName]
    .filter(Boolean)
    .join(" ");
  return parts || "—";
}

/** Address composed from available fields. */
function address(resident: ResidentRecord): string {
  const parts = [resident.houseUnitNumber, resident.streetPurokName, resident.city]
    .filter(Boolean)
    .join(", ");
  return parts || "—";
}

/** "Archived 12 Mar 2026 — reason" tooltip for an archived row's chip. */
function archivedLabel(resident: ResidentRecord): string {
  const at = recordArchivedAt(resident);
  const when = at
    ? `Archived ${new Date(at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    : "Archived";
  const reason = resident.archivedReason?.trim();
  return reason ? `${when} — ${reason}` : when;
}

/**
 * Admin Residents page — lists all residents (scoped by role on the backend)
 * with their contact details, address, account status, and provisioning state.
 */
export default function ResidentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { canArchive } = useCanArchive();

  const [residents, setResidents] = useState<ResidentRecord[]>([]);
  /** Active or archived slice of the resident list; archived is SUPER_ADMIN only. */
  const [scope, setScope] = useState<ArchiveScope>("active");
  /** Row awaiting archive/restore confirmation. */
  const [pendingArchive, setPendingArchive] = useState<
    { resident: ResidentRecord; action: "archive" | "restore" } | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  /** Apply an action-menu result: replace the row, or drop it when deleted. */
  const handleResidentUpdated = (updated: ResidentRecord) => {
    setActionError(null);
    const key = (record: ResidentRecord) =>
      record._id ?? record.residentId ?? record.emailAddress;
    setResidents((prev) => {
      if (updated.isDeleted) {
        return prev.filter((r) => key(r) !== key(updated));
      }
      return prev.map((r) => (key(r) === key(updated) ? { ...r, ...updated } : r));
    });
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        // The scope is part of the request, not a client-side filter: the
        // backend refuses the archived slice for anyone but a Super Admin.
        const data = await fetchResidents(scope);
        if (!cancelled) setResidents(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load residents.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  /** Archive or restore the resident awaiting confirmation. */
  const handleArchiveAction = async (reason?: string) => {
    const target = pendingArchive;
    if (!target) return;
    const key = target.resident._id ?? target.resident.residentId;
    setActionError(null);
    try {
      if (target.action === "archive") {
        await archiveRecord("residents", key, reason);
        setSuccessMessage("Resident archived.");
      } else {
        await restoreRecord("residents", key);
        setSuccessMessage("Resident restored.");
      }
      // The row no longer belongs to the visible scope.
      const matches = (record: ResidentRecord) =>
        (record._id ?? record.residentId) !== key;
      setResidents((prev) => prev.filter(matches));
      setPendingArchive(null);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to update the archive state.",
      );
    }
  };

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  /** True while showing the archived slice; every row is archived then. */
  const isArchivedView = scope === "archived";

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            Residents
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isArchivedView
              ? "Archived resident records are hidden from the list. Restore one to make it active again."
              : "Manage and review registered barangay residents."}
          </Typography>
        </Box>
        <ArchiveScopeToggle
          scope={scope}
          onChange={setScope}
          label="residents"
          disabled={isLoading}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <PeopleIcon color="primary" />
            <Typography variant="h6" component="h3">
              All Residents
            </Typography>
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
              <CircularProgress aria-label="Loading residents" />
            </Box>
          ) : residents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No residents found.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="medium" aria-label="Residents">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Resident</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Address</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Provisioned</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {residents.map((resident) => (
                    <TableRow
                      key={
                        resident._id ??
                        resident.residentId ??
                        resident.emailAddress
                      }
                      hover
                    >
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar
                            sx={{ width: 36, height: 36, bgcolor: "secondary.main", fontSize: 14 }}
                          >
                            {resident.firstName?.[0] ?? "R"}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {fullName(resident)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {resident.residentId}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{resident.emailAddress}</TableCell>
                      <TableCell>{resident.contactNumber ?? "—"}</TableCell>
                      <TableCell>{address(resident)}</TableCell>
                      <TableCell>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Chip
                            label={resident.accountStatus}
                            size="small"
                            color={
                              RESIDENT_STATUS_COLORS[resident.accountStatus] ??
                              "default"
                            }
                            variant="outlined"
                          />
                          {/* Resident-INITIATED deletion. Rendered filled so it
                              cannot be mistaken for the admin sandbox/states
                              above; the row stays listed because staff keep
                              full access to a deleted resident's records. */}
                          {residentDeletionState(resident) !== "none" && (
                            <Chip
                              label={residentDeletionLabel(
                                residentDeletionState(resident),
                              )}
                              size="small"
                              color={
                                RESIDENT_DELETION_COLORS[
                                  residentDeletionState(resident)
                                ]
                              }
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={resident.isProvisioned ? "Yes" : "No"}
                          size="small"
                          color={resident.isProvisioned ? "primary" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                        >
                          {isRecordArchived(resident) && (
                            <Tooltip title={archivedLabel(resident)}>
                              <Chip
                                label="Archived"
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            </Tooltip>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityIcon />}
                            onClick={() =>
                              router.push(
                                `/admin/residents/${encodeURIComponent(
                                  resident._id ?? resident.residentId,
                                )}`,
                              )
                            }
                          >
                            View
                          </Button>
                          {isArchivedView ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<UnarchiveIcon />}
                              onClick={() =>
                                setPendingArchive({ resident, action: "restore" })
                              }
                            >
                              Restore
                            </Button>
                          ) : (
                            <>
                              <ResidentActionMenu
                                resident={resident}
                                onUpdated={handleResidentUpdated}
                              />
                              {canArchive && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  startIcon={<ArchiveIcon />}
                                  onClick={() =>
                                    setPendingArchive({
                                      resident,
                                      action: "archive",
                                    })
                                  }
                                >
                                  Archive
                                </Button>
                              )}
                            </>
                          )}
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

      <Snackbar
        open={Boolean(actionError)}
        autoHideDuration={6000}
        onClose={() => setActionError(null)}
        message={actionError ?? ""}
      />

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        message={successMessage ?? ""}
      />

      <ArchiveConfirmDialog
        open={pendingArchive !== null}
        action={pendingArchive?.action ?? "archive"}
        subject={`Resident "${pendingArchive ? fullName(pendingArchive.resident) : ""}"`}
        onConfirm={handleArchiveAction}
        onCancel={() => setPendingArchive(null)}
      />
    </Box>
  );
}
