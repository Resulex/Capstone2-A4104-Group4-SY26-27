"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

interface AnnouncementDirtyDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Confirm: discard the unsaved changes and continue. */
  onDiscard: () => void;
  /** Cancel: go back to the current form and keep the unsaved changes. */
  onKeep: () => void;
}

/**
 * Confirmation dialog shown when the admin tries to switch announcements
 * while the shared form still has unsaved changes.
 */
export function AnnouncementDirtyDialog({
  open,
  onDiscard,
  onKeep,
}: AnnouncementDirtyDialogProps) {
  return (
    <Dialog open={open} onClose={onKeep}>
      <DialogTitle>Unsaved changes</DialogTitle>
      <DialogContent>
        <DialogContentText>
          You still have unsaved changes. Save them first before editing
          another announcement.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onKeep} color="inherit">
          Keep editing
        </Button>
        <Button onClick={onDiscard} color="error" variant="contained">
          Discard changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
