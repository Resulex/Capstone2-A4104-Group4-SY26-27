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
import { MediaUploader } from "@/components/shared/MediaUploader";
import { useAuth } from "@/context/AuthContext";
import {
  OfficialRecord,
  fetchOfficials,
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

/**
 * Admin Barangay Officials Directory — card grid view. The "+ Add Official"
 * button navigates to the add page; each card has Edit / Update Photo / Remove.
 */
export default function OfficialsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [officials, setOfficials] = useState<OfficialRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
    (async () => {
      try {
        const data = await fetchOfficials();
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
  }, []);

  const handleRemove = async (official: OfficialRecord) => {
    setPendingId(official.officialId);
    setActionError(null);
    try {
      await updateOfficial(official.officialId, { isDeleted: true });
      setOfficials((prev) =>
        prev.filter((o) => o.officialId !== official.officialId),
      );
      setSuccess(true);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove official.",
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
            Manage the list of barangay officials and their contact details.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push("/admin/officials/add")}
        >
          Add Official
        </Button>
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
                    <Stack
                      direction="row"
                      spacing={0.5}
                      justifyContent="center"
                      flexWrap="wrap"
                      sx={{ mt: 2 }}
                    >
                      <Button
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
                        size="small"
                        variant="outlined"
                        startIcon={<PhotoCameraIcon />}
                        onClick={() => openPhotoDialog(official)}
                      >
                        Update Photo
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<ArchiveIcon />}
                        disabled={pendingId === official.officialId}
                        onClick={() => handleRemove(official)}
                      >
                        Remove
                      </Button>
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
        open={success}
        autoHideDuration={4000}
        onClose={() => setSuccess(false)}
        message="Official removed."
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
