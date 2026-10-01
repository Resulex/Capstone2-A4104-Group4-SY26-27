"use client";

import { Fragment, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import ArchiveIcon from "@mui/icons-material/Archive";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import {
  archiveRecord,
  ResidentAccountStatus,
  ResidentRecord,
  updateResident,
} from "@/lib/admin";

/** The four account actions offered by the overflow menu. */
type ResidentActionKey = "suspend" | "deactivate" | "reactivate" | "delete";

interface ResidentAction {
  key: ResidentActionKey;
  label: string;
  icon: React.ReactNode;
  title: string;
  /** Body copy shown in the confirmation dialog. */
  description: string;
  confirmLabel: string;
  color: "primary" | "warning" | "error";
  /** Status written on confirm (absent for the delete action). */
  accountStatus?: ResidentAccountStatus;
  /** Whether the action is unavailable for the given account status. */
  disabled: (status: ResidentAccountStatus) => boolean;
}

/**
 * Suspend and Deactivate are distinct statuses but behave identically (both
 * block sign-in and are restored by Reactivate). Delete is a soft delete: the
 * record is retained but hidden from the Residents list.
 */
const ACTIONS: ResidentAction[] = [
  {
    key: "suspend",
    label: "Suspend",
    icon: <PauseCircleOutlineIcon fontSize="small" />,
    title: "Suspend resident account",
    description:
      "The resident will be blocked from signing in until the account is reactivated.",
    confirmLabel: "Suspend",
    color: "warning",
    accountStatus: "suspended",
    disabled: (status) => status !== "active",
  },
  {
    key: "deactivate",
    label: "Deactivate",
    icon: <BlockIcon fontSize="small" />,
    title: "Deactivate resident account",
    description:
      "The resident will be blocked from signing in until the account is reactivated.",
    confirmLabel: "Deactivate",
    color: "error",
    accountStatus: "deactivated",
    disabled: (status) => status !== "active",
  },
  {
    key: "reactivate",
    label: "Reactivate",
    icon: <CheckCircleOutlineIcon fontSize="small" />,
    title: "Reactivate resident account",
    description: "The resident will be able to sign in again.",
    confirmLabel: "Reactivate",
    color: "primary",
    accountStatus: "active",
    disabled: (status) => status === "active",
  },
  {
    key: "delete",
    label: "Archive Account",
    icon: <ArchiveIcon fontSize="small" />,
    title: "Archive resident account",
    description:
      "The record leaves the Residents list but is kept in the database. A Super Admin can restore it from the Archived view at any time.",
    confirmLabel: "Archive Account",
    color: "error",
    disabled: () => false,
  },
];

/** Build the resident's full name for dialog copy. */
function displayName(resident: ResidentRecord): string {
  const parts = [resident.firstName, resident.middleName, resident.lastName]
    .filter(Boolean)
    .join(" ");
  return parts || resident.emailAddress;
}

/** Identifier used for the PATCH call (Mongo id first, else the human id). */
function residentKey(resident: ResidentRecord): string | undefined {
  return resident._id ?? resident.residentId;
}

interface ResidentActionMenuProps {
  resident: ResidentRecord;
  /** Receives the updated record; a soft-deleted one carries `isDeleted: true`. */
  onUpdated: (resident: ResidentRecord) => void;
  disabled?: boolean;
  size?: "small" | "medium";
}

/**
 * Reusable overflow menu for resident account actions. Renders the vertical
 * 3-dots button used by both the Residents list rows and the detail page.
 */
export function ResidentActionMenu({
  resident,
  onUpdated,
  disabled = false,
  size = "small",
}: ResidentActionMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState<ResidentAction | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = resident.accountStatus;
  const isDeleted = Boolean(resident.isDeleted);
  const key = residentKey(resident);
  const menuDisabled = disabled || isDeleted || !key;

  const openDialog = (action: ResidentAction) => {
    setAnchorEl(null);
    setError(null);
    setReason("");
    setPending(action);
  };

  const closeDialog = () => {
    if (saving) return;
    setPending(null);
  };

  const handleConfirm = async () => {
    if (!pending || !key) return;
    setSaving(true);
    setError(null);
    try {
      // Archiving is not a generic update any more: it goes through the
      // SUPER_ADMIN-only archive endpoint, which is also the only path that can
      // record who archived the account and why. The old `{ isDeleted: true }`
      // PATCH is now rejected by the backend with a 400.
      if (pending.accountStatus === undefined) {
        await archiveRecord("residents", key, reason.trim() || undefined);
        // The endpoint answers with no body, so mirror the change locally —
        // the list only needs to know the row left the active scope.
        onUpdated({ ...resident, isDeleted: true, deletedAt: new Date().toISOString() });
        setPending(null);
        return;
      }

      const body: Partial<ResidentRecord> = {
        accountStatus: pending.accountStatus,
      };
      if (reason.trim()) body.statusReason = reason.trim();

      const updated = await updateResident(key, body);
      onUpdated(updated);
      setPending(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update resident.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Tooltip title="More actions">
        <span>
          <IconButton
            size={size}
            aria-label={`More actions for ${displayName(resident)}`}
            onClick={(event) => setAnchorEl(event.currentTarget)}
            disabled={menuDisabled}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {ACTIONS.map((action) => (
          <Fragment key={action.key}>
            {action.key === "delete" && <Divider sx={{ my: 0.5 }} />}
            <MenuItem
              onClick={() => openDialog(action)}
              disabled={action.disabled(status)}
            >
              <ListItemIcon>{action.icon}</ListItemIcon>
              <ListItemText>{action.label}</ListItemText>
            </MenuItem>
          </Fragment>
        ))}
      </Menu>

      <Dialog
        open={Boolean(pending)}
        onClose={closeDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{pending?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{pending?.description}</DialogContentText>
          <DialogContentText sx={{ mt: 1.5, fontWeight: 600 }}>
            {displayName(resident)} · {resident.emailAddress}
          </DialogContentText>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            fullWidth
            multiline
            minRows={2}
            disabled={saving}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={pending?.color ?? "primary"}
            onClick={handleConfirm}
            disabled={saving}
            startIcon={
              saving ? <CircularProgress size={16} color="inherit" /> : undefined
            }
          >
            {saving ? "Saving…" : (pending?.confirmLabel ?? "Confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
