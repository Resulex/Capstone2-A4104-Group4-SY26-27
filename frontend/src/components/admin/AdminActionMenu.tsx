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
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import { AdminAccountStatus, AdminRecord, updateAdmin } from "@/lib/admin";

/** The account actions offered by the overflow menu. */
type AdminActionKey = "suspend" | "reactivate";

interface AdminAction {
  key: AdminActionKey;
  label: string;
  icon: React.ReactNode;
  title: string;
  /** Body copy shown in the confirmation dialog. */
  description: string;
  confirmLabel: string;
  color: "primary" | "warning";
  /** Status written on confirm. */
  accountStatus: AdminAccountStatus;
  /** Whether the action is unavailable for the given account status. */
  disabled: (status: AdminAccountStatus) => boolean;
  /** Whether the confirm dialog offers the optional reason field. */
  captureReason: boolean;
}

/**
 * Suspend blocks sign-in (the backend also mirrors the status into the Cognito
 * pool); Reactivate restores it. Both write `accountStatus` through
 * PATCH /admins/{id}, which the backend gates to SUPER_ADMIN and refuses for the
 * caller's own account.
 */
const ACTIONS: AdminAction[] = [
  {
    key: "suspend",
    label: "Suspend",
    icon: <PauseCircleOutlineIcon fontSize="small" />,
    title: "Suspend admin account",
    description:
      "The admin will be blocked from signing in until the account is reactivated. A session they already hold stays valid until it expires.",
    confirmLabel: "Suspend",
    color: "warning",
    accountStatus: "suspended",
    disabled: (status) => status !== "active",
    captureReason: true,
  },
  {
    key: "reactivate",
    label: "Reactivate",
    icon: <CheckCircleOutlineIcon fontSize="small" />,
    title: "Reactivate admin account",
    description: "The admin will be able to sign in again.",
    confirmLabel: "Reactivate",
    color: "primary",
    accountStatus: "active",
    disabled: (status) => status === "active",
    captureReason: false,
  },
];

/** Build the admin's full name for dialog copy. */
function displayName(admin: AdminRecord): string {
  const parts = [admin.firstName, admin.middleName, admin.lastName]
    .filter(Boolean)
    .join(" ");
  return parts || admin.emailAddress;
}

/** Identifier used for the PATCH call (Mongo id first, else the human id). */
function adminKey(admin: AdminRecord): string | undefined {
  return admin._id ?? admin.adminId;
}

interface AdminActionMenuProps {
  admin: AdminRecord;
  /** Receives the updated record so the caller can patch its own state. */
  onUpdated: (admin: AdminRecord) => void;
  disabled?: boolean;
  size?: "small" | "medium";
}

/**
 * Reusable overflow menu for admin account actions. Rendered by the User
 * Management list rows and by the admin detail page.
 */
export function AdminActionMenu({
  admin,
  onUpdated,
  disabled = false,
  size = "small",
}: AdminActionMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState<AdminAction | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = admin.accountStatus;
  const key = adminKey(admin);
  const menuDisabled = disabled || !key;

  const openDialog = (action: AdminAction) => {
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
      const body: { accountStatus: AdminAccountStatus; statusReason?: string } = {
        accountStatus: pending.accountStatus,
      };
      if (pending.captureReason && reason.trim()) {
        body.statusReason = reason.trim();
      }

      const updated = await updateAdmin(key, body);
      onUpdated(updated);
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update admin.");
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
            aria-label={`More actions for ${displayName(admin)}`}
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
            {displayName(admin)} · {admin.emailAddress}
          </DialogContentText>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {pending?.captureReason && (
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
          )}
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
