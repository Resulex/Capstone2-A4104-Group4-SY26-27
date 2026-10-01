"use client";

import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";

interface ArchiveConfirmDialogProps {
  open: boolean;
  /** "archive" or "restore" — decides the copy and the confirm button colour. */
  action: "archive" | "restore";
  /** What is being acted on, for the copy, e.g. "incident report INC-2026001". */
  subject: string;
  busy?: boolean;
  /** Receives the optional note; only archive uses it. */
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

/**
 * Confirmation for a soft archive or a restore.
 *
 * Both actions are reversible, which is exactly why a dialog is worth having:
 * the copy spells out that nothing is deleted, so a Super Admin can act without
 * wondering whether they are about to lose a record.
 *
 * The note is optional on purpose — requiring one would block a routine tidy-up,
 * and the timeline/archive columns already record who did it and when.
 */
export function ArchiveConfirmDialog({
  open,
  action,
  subject,
  busy = false,
  onConfirm,
  onCancel,
}: ArchiveConfirmDialogProps) {
  const [reason, setReason] = useState("");

  // Reset per opening, so a note typed for one record never follows the dialog
  // onto the next one.
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const isArchive = action === "archive";

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} fullWidth maxWidth="xs">
      <DialogTitle>
        {isArchive ? "Archive record" : "Restore record"}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {isArchive
            ? `${subject} will be removed from every queue and kept in the archive. Nothing is deleted — you can restore it at any time.`
            : `${subject} will return to the active queue.`}
        </DialogContentText>
        {isArchive && (
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy}
            helperText="Recorded on the archive entry with your name and the date."
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={isArchive ? "warning" : "primary"}
          onClick={() => onConfirm(reason.trim() || undefined)}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {isArchive ? "Archive" : "Restore"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
