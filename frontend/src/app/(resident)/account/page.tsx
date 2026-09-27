"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import RestoreIcon from "@mui/icons-material/Restore";
import { PageHeader } from "@/components/resident/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useResident } from "@/context/ResidentContext";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import {
  cancelAccountDeletion,
  formatDisplayDate,
  requestAccountDeletion,
} from "@/lib/resident";

/** Typed by the resident to confirm the destructive action. */
const CONFIRM_PHRASE = "DELETE";

/** Fallback quoted in the dialog copy when the server has not said otherwise. */
const DEFAULT_GRACE_DAYS = 30;

/** One label/value line in the account summary. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 0.5 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 160, fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Account Settings (`/account`).
 *
 * Read-only account details plus the danger zone that lets a resident
 * permanently delete their own account. Deletion is not immediate: it starts a
 * grace window (30 days) during which the resident stays signed in and can
 * restore the account, and during which their PRE-EXISTING document requests,
 * incident reports and chats are hidden from this portal and locked against
 * their own edits. Admins keep full visibility of everything, always.
 *
 * The window is only quoted in the UI — the authoritative dates come from the
 * server-verified session (`useAuth().user`), never from a local calculation.
 */
export default function AccountSettingsPage() {
  const { user, refreshSession } = useAuth();
  const { profile } = useResident();
  const { reload } = useResidentDashboard();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const requestedAt = user?.deletionRequestedAt ?? null;
  const scheduledFor = user?.deletionScheduledFor ?? null;
  const finalizedAt = user?.deletionFinalizedAt ?? null;
  const isPending = Boolean(requestedAt) && !finalizedAt;
  const isFinalized = Boolean(finalizedAt);

  const fullName =
    [profile?.firstName, profile?.middleName, profile?.lastName]
      .filter(Boolean)
      .join(" ") || "—";

  const closeDialog = () => {
    setDialogOpen(false);
    setConfirmText("");
    setReason("");
    setError(null);
  };

  const handleRequestDeletion = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await requestAccountDeletion(reason);
      // Re-read the server's own dates, then drop the resident's now-hidden
      // records from the shared snapshot so every page agrees immediately.
      await refreshSession();
      reload();
      closeDialog();
      setSnack("Account deletion requested. You can still restore it from here.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not request account deletion.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelDeletion = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await cancelAccountDeletion();
      await refreshSession();
      reload();
      setSnack("Account restored. Your records are back.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore the account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <PageHeader
        title="Account Settings"
        subtitle="Review your account details or permanently delete your account."
      />

      {/* Current deletion state, if any. */}
      {isPending && (
        <Alert
          severity="warning"
          icon={<DeleteForeverIcon />}
          sx={{ mb: 3, borderRadius: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RestoreIcon />}
              onClick={() => void handleCancelDeletion()}
              disabled={submitting}
            >
              Restore
            </Button>
          }
        >
          <AlertTitle sx={{ fontWeight: 700 }}>
            Your account is scheduled for deletion
          </AlertTitle>
          Your account and its previous document requests, incident reports and
          chats will be permanently deleted on{" "}
          <strong>{formatDisplayDate(scheduledFor ?? undefined)}</strong>. Until
          then you can restore your account, and the records you filed before
          requesting deletion stay hidden from this portal. Barangay staff can
          still see them.
        </Alert>
      )}

      {isFinalized && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 3 }}>
          <AlertTitle sx={{ fontWeight: 700 }}>This account has been deleted</AlertTitle>
          Deleted on{" "}
          <strong>{formatDisplayDate(finalizedAt ?? undefined)}</strong>. The
          document requests, incident reports and chats you filed before that date
          are no longer available here, and they can no longer be changed. You can
          still use this account to submit new requests and reports.
        </Alert>
      )}

      {/* Account summary — read-only on purpose: profile editing is not part of
          this page's scope. */}
      {error && !dialogOpen && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <ManageAccountsIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Account Information
            </Typography>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <DetailRow label="Full name" value={fullName} />
            <DetailRow label="Email address" value={profile?.emailAddress ?? "—"} />
            <DetailRow
              label="Resident ID"
              value={profile?.residentId ?? "Not yet assigned"}
            />
            <DetailRow
              label="Contact number"
              value={profile?.contactNumber ?? "Not provided"}
            />
            <DetailRow
              label="Registered on"
              value={formatDisplayDate(profile?.createdAt)}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Danger zone. */}
      <Card
        variant="outlined"
        sx={{ borderRadius: 3, borderColor: "error.main", borderWidth: 1 }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <DeleteForeverIcon color="error" />
            <Typography
              variant="subtitle1"
              color="error"
              sx={{ fontWeight: 700 }}
            >
              Delete Account
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Deleting your account removes your access to the document requests,
            incident reports and chats you filed beforehand. Those records are
            retained by the barangay for its records and can no longer be changed
            by you.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Deletion is not immediate: for {DEFAULT_GRACE_DAYS} days you can sign
            back in and restore your account and records.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={() => setDialogOpen(true)}
            disabled={isPending || isFinalized || submitting}
          >
            {isPending
              ? "Deletion already requested"
              : isFinalized
                ? "Account already deleted"
                : "Delete my account"}
          </Button>
          {(isPending || isFinalized) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              {isPending
                ? "Restore your account above if you changed your mind."
                : "A deleted account cannot be deleted again."}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog — the ONLY place the resident is told about the
          grace window, since this flow sends no notification records or email. */}
      <Dialog
        open={dialogOpen}
        onClose={submitting ? undefined : closeDialog}
        fullWidth
        maxWidth="sm"
        aria-labelledby="delete-account-dialog-title"
      >
        <DialogTitle id="delete-account-dialog-title" sx={{ fontWeight: 700 }}>
          Permanently delete your account?
        </DialogTitle>
        <DialogContent>
          <DialogContentText component="div" sx={{ mb: 2 }}>
            <Typography variant="body2" component="p" sx={{ mb: 1 }}>
              Your account will be scheduled for deletion. For the next{" "}
              <strong>{DEFAULT_GRACE_DAYS} days</strong> you can still sign in and
              restore it. After that the deletion is permanent and cannot be
              undone.
            </Typography>
            <Typography variant="body2" component="p" sx={{ mb: 1 }}>
              While the deletion is pending, the document requests, incident
              reports and chats you filed beforehand are hidden from your account
              and can no longer be changed by you. Barangay staff keep their copies
              for official records.
            </Typography>
            <Typography variant="body2" component="p">
              You will stay signed in so you can restore your account straight
              away if you change your mind.
            </Typography>
          </DialogContentText>

          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            disabled={submitting}
            helperText="Shared with barangay staff along with your deletion request."
            sx={{ mb: 2 }}
          />

          <TextField
            label={`Type ${CONFIRM_PHRASE} to confirm`}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            fullWidth
            size="small"
            disabled={submitting}
            autoComplete="off"
            inputProps={{ "aria-label": `Type ${CONFIRM_PHRASE} to confirm deletion` }}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} disabled={submitting} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={() => void handleRequestDeletion()}
            color="error"
            variant="contained"
            disabled={confirmText.trim() !== CONFIRM_PHRASE || submitting}
            startIcon={
              submitting ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            Delete my account
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={4000}
        message={snack}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
