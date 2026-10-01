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
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import AddIcon from "@mui/icons-material/Add";
import PersonIcon from "@mui/icons-material/Person";
import EditIcon from "@mui/icons-material/Edit";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import { MediaUploader } from "@/components/shared/MediaUploader";
import { ArchiveConfirmDialog } from "@/components/admin/ArchiveConfirmDialog";
import { ArchiveScopeToggle } from "@/components/admin/ArchiveScopeToggle";
import { useAuth } from "@/context/AuthContext";
import { useCanArchive } from "@/hooks/useCanArchive";
import {
  ArchiveScope,
  OfficialRecord,
  archiveRecord,
  fetchOfficials,
  isRecordArchived,
  recordArchivedAt,
  restoreRecord,
  updateOfficial,
} from "@/lib/admin";

/** Derive a committee label from a position like "Councilor – Peace & Order". */
function committeeOf(position: string): string | null {
  const parts = position
    .split(/[–—-]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

/** "Archived 12 Mar 2026 — reason" line shown on an archived official's card. */
function archivedLabel(record: OfficialRecord): string {
  const at = recordArchivedAt(record);
  const when = at
    ? `Archived ${new Date(at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    : "Archived";
  const reason = record.archivedReason?.trim();
  return reason ? `${when} — ${reason}` : when;
}

/**
 * Admin Barangay Officials Directory — card grid view. The "+ Add Official"
 * button navigates to the add page; each card has Edit / Update Photo / Remove.
 */
export default function OfficialsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { canArchive } = useCanArchive();

  const [officials, setOfficials] = useState<OfficialRecord[]>([]);
  /** Active or archived slice of the directory; archived is SUPER_ADMIN only. */
  const [scope, setScope] = useState<ArchiveScope>("active");
  /** Card awaiting archive/restore confirmation. */
  const [pendingArchive, setPendingArchive] = useState<
    { official: OfficialRecord; action: "archive" | "restore" } | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [photoDialog, setPhotoDialog] = useState<{
    open: boolean;
    official: OfficialRecord | null;
    url: string;
  }>({ open: false, official: null, url: "" });
  const [savingPhoto, setSavingPhoto] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        // The scope is part of the request, not a client-side filter: the
        // backend refuses the archived slice for anyone but a Super Admin.
        const data = await fetchOfficials(scope);
        if (!cancelled) setOfficials(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load officials.",
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

  /**
   * Archive or restore the official awaiting confirmation.
   *
   * Replaces the old "Remove" action, which soft-deleted through the generic
   * PATCH route — reachable by any staff account and recording neither an actor
   * nor a date. Archiving is now SUPER_ADMIN-only, audited, and reversible.
   */
  const handleArchiveAction = async (reason?: string) => {
    const target = pendingArchive;
    if (!target) return;
    setPendingId(target.official.officialId);
    setActionError(null);
    try {
      if (target.action === "archive") {
        await archiveRecord("officials", target.official.officialId, reason);
        setSuccessMessage("Official archived.");
      } else {
        await restoreRecord("officials", target.official.officialId);
        setSuccessMessage("Official restored.");
      }
      setOfficials((prev) =>
        prev.filter((o) => o.officialId !== target.official.officialId),
      );
      setPendingArchive(null);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to update the archive state.",
      );
    } finally {
      setPendingId(null);
    }
  };

  const openPhotoDialog = (official: OfficialRecord) => {
    setPhotoDialog({ open: true, official, url: official.profileImageUrl ?? "" });
  };

  const closePhotoDialog = () => {
    setPhotoDialog({ open: false, official: null, url: "" });
  };

  const handleSavePhoto = async () => {
    const official = photoDialog.official;
    if (!official) return;
    setSavingPhoto(true);
    setActionError(null);
    try {
      const updated = await updateOfficial(official.officialId, {
        profileImageUrl: photoDialog.url.trim(),
      });
      setOfficials((prev) =>
        prev.map((o) =>
          o.officialId === official.officialId ? { ...o, ...updated } : o,
        ),
      );
      closePhotoDialog();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update photo.",
      );
    } finally {
      setSavingPhoto(false);
    }
  };

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  /** True while showing the archived slice; every card is archived then. */
  const isArchivedView = scope === "archived";

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 3, flexWrap: "wrap" }}
      >
        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            Barangay Officials Directory Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isArchivedView
              ? "Archived officials are hidden from the public directory. Restore one to list them again."
              : "Manage the list of barangay officials and their contact details."}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <ArchiveScopeToggle
            scope={scope}
            onChange={setScope}
            label="officials"
            disabled={isLoading}
          />
          {!isArchivedView && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push("/admin/officials/add")}
            >
              Add Official
            </Button>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 200,
          }}
        >
          <CircularProgress aria-label="Loading officials" />
        </Box>
      ) : officials.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No officials found.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {officials.map((official) => {
            const committee = committeeOf(official.designatedPosition);
            return (
              <Grid item xs={12} sm={6} md={4} key={official.officialId}>
                <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                  <CardContent sx={{ p: 3, textAlign: "center" }}>
                    <Box
                      sx={{
                        width: 96,
                        height: 96,
                        mx: "auto",
                        mb: 1.5,
                        borderRadius: 2,
                        border: 1,
                        borderColor: "divider",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        bgcolor: "action.hover",
                      }}
                    >
                      {official.profileImageUrl ? (
                        <Box
                          component="img"
                          src={official.profileImageUrl}
                          alt={official.fullName}
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <PersonIcon sx={{ fontSize: 48, color: "text.disabled" }} />
                      )}
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {official.fullName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {official.designatedPosition}
                    </Typography>
                    {committee && (
                      <Typography variant="body2" color="text.secondary">
                        {committee}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {official.contactNumber}
                    </Typography>
                    {isRecordArchived(official) && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 1 }}
                      >
                        {archivedLabel(official)}
                      </Typography>
                    )}
                    <Stack
                      direction="column"
                      spacing={1}
                      sx={{ mt: 2 }}
                    >
                      {isArchivedView ? (
                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          startIcon={<UnarchiveIcon />}
                          disabled={pendingId === official.officialId}
                          onClick={() =>
                            setPendingArchive({ official, action: "restore" })
                          }
                        >
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Button
                            fullWidth
                            size="small"
                            variant="outlined"
                            startIcon={<EditIcon />}
                            onClick={() =>
                              router.push(
                                `/admin/officials/${encodeURIComponent(
                                  official.officialId,
                                )}/edit`,
                              )
                            }
                          >
                            Edit Profile
                          </Button>
                          <Button
                            fullWidth
                            size="small"
                            variant="outlined"
                            startIcon={<PhotoCameraIcon />}
                            onClick={() => openPhotoDialog(official)}
                          >
                            Update Photo
                          </Button>
                          {canArchive && (
                            <Button
                              fullWidth
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<ArchiveIcon />}
                              disabled={pendingId === official.officialId}
                              onClick={() =>
                                setPendingArchive({ official, action: "archive" })
                              }
                            >
                              Archive
                            </Button>
                          )}
                        </>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

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
        subject={`Official "${pendingArchive?.official.fullName ?? ""}"`}
        busy={pendingId !== null}
        onConfirm={handleArchiveAction}
        onCancel={() => setPendingArchive(null)}
      />

      <Dialog
        open={photoDialog.open}
        onClose={closePhotoDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Photo</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <MediaUploader
              label="Profile Photo"
              value={photoDialog.url ? [photoDialog.url] : []}
              onChange={(urls) =>
                setPhotoDialog((p) => ({ ...p, url: urls[0] ?? "" }))
              }
              folder="profile"
              multiple={false}
              maxFiles={1}
              accept="image/*"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closePhotoDialog}>Cancel</Button>
          <Button
            onClick={handleSavePhoto}
            variant="contained"
            disabled={savingPhoto}
          >
            {savingPhoto ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
