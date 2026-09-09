"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

interface SessionTimeoutDialogProps {
  /** Whether the warning dialog is visible. */
  open: boolean;
  /** Whole seconds until the session expires (drives the countdown text). */
  secondsRemaining: number;
  /** Reset the inactivity window and keep the user signed in. */
  onStay: () => void;
  /** End the session now. */
  onSignOut: () => void;
}

/**
 * Countdown dialog shown shortly before an idle session is automatically
 * ended. Lets the user stay signed in (resets the inactivity clock) or sign
 * out immediately. Used by both the admin and resident shells.
 */
export function SessionTimeoutDialog({
  open,
  secondsRemaining,
  onStay,
  onSignOut,
}: SessionTimeoutDialogProps) {
  const seconds = Math.max(1, secondsRemaining);

  return (
    <Dialog open={open} onClose={onStay}>
      <DialogTitle>Session expiring</DialogTitle>
      <DialogContent>
        <DialogContentText>
          You have been inactive for a while. For your security you will be
          signed out in about {seconds} second{seconds === 1 ? "" : "s"}.
          Stay signed in to keep working, or sign out now.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onStay} color="primary" variant="outlined" autoFocus>
          Stay signed in
        </Button>
        <Button onClick={onSignOut} color="error" variant="contained">
          Sign out now
        </Button>
      </DialogActions>
    </Dialog>
  );
}
