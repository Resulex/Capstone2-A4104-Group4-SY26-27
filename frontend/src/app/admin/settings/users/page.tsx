"use client";

import { useCallback, useEffect, useState } from "react";
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
import TextField from "@mui/material/TextField";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { useOnlineStatus } from "@/context/OnlineStatusContext";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import {
  AdminRecord,
  fetchAdmins,
  createAdmin,
} from "@/lib/admin";
import { ADMIN_ROLES, ADMIN_ROLE_LABELS, AssignedAdminRole } from "@/lib/rbac";

const STATUS_COLORS: Record<string, "success" | "warning" | "error" | "default"> = {
  active: "success",
  suspended: "warning",
  deactivated: "error",
};

interface CreateFormState {
  adminId: string;
  firstName: string;
  lastName: string;
  userName: string;
  emailAddress: string;
  password: string;
  assignedRole: AssignedAdminRole;
}

const EMPTY_FORM: CreateFormState = {
  adminId: "",
  firstName: "",
  lastName: "",
  userName: "",
  emailAddress: "",
  password: "",
  assignedRole: "OPERATIONS_CLERK",
};

/**
 * User Management (`/admin/settings/users`) — SUPER_ADMIN only.
 *
 * Lists all staff accounts and lets the super admin provision new ones. The
 * backend POST /admins creates the Mongo record AND auto-provisions the AWS
 * Cognito pool user (capturing the Cognito `sub`), rolling the Mongo record
 * back if Cognito fails.
 */
export default function UserManagementPage() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const { profile } = useAdminProfile();

  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setAdmins(await fetchAdmins());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admins.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Guard: only a SUPER_ADMIN may reach this page.
    if (profile && profile.assignedRole !== "SUPER_ADMIN") {
      router.replace("/admin");
      return;
    }
    void load();
  }, [profile, router, load]);

  const openCreate = () => {
    setForm({
      ...EMPTY_FORM,
      adminId: `adm-${Date.now().toString().slice(-6)}`,
    });
    setCreateOpen(true);
  };

  const setField = <K extends keyof CreateFormState>(
    key: K,
    value: CreateFormState[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    if (
      !form.adminId ||
      !form.firstName ||
      !form.lastName ||
      !form.userName ||
      !form.emailAddress ||
      !form.password
    ) {
      setNotice("All fields are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAdmin({
        adminId: form.adminId.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        userName: form.userName.trim(),
        emailAddress: form.emailAddress.trim(),
        password: form.password,
        assignedRole: form.assignedRole,
        accountStatus: "active",
      });
      setCreateOpen(false);
      setNotice(`Admin ${form.userName} created.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create admin.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && admins.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 240,
        }}
      >
        <CircularProgress aria-label="Loading admins" />
      </Box>
    );
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
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Provision and manage barangay staff accounts (Super Admin only).
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={openCreate}
          disabled={!isOnline}
        >
          Create Staff
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <TableContainer>
            <Table size="medium" aria-label="Admin accounts">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Admin</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow
                    key={admin.adminId}
                    sx={(theme) => ({
                      "&:nth-of-type(odd)": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      },
                    })}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>
                      {admin.firstName} {admin.lastName}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {admin.userName} · {admin.adminId}
                      </Typography>
                    </TableCell>
                    <TableCell>{admin.emailAddress}</TableCell>
                    <TableCell>
                      <Chip
                        label={ADMIN_ROLE_LABELS[admin.assignedRole as keyof typeof ADMIN_ROLE_LABELS] ?? admin.assignedRole}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={admin.accountStatus}
                        size="small"
                        color={STATUS_COLORS[admin.accountStatus] ?? "default"}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Staff Account</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Admin ID"
              value={form.adminId}
              onChange={(e) => setField("adminId", e.target.value)}
              fullWidth
              helperText="Unique id for this account (e.g. adm-001)."
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="First Name"
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                fullWidth
              />
              <TextField
                label="Last Name"
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label="Username"
              value={form.userName}
              onChange={(e) => setField("userName", e.target.value)}
              fullWidth
              helperText="e.g. j.doe"
            />
            <TextField
              label="Email Address"
              type="email"
              value={form.emailAddress}
              onChange={(e) => setField("emailAddress", e.target.value)}
              fullWidth
              helperText="Used as the Cognito sign-in name."
            />
            <TextField
              label="Temporary Password"
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              fullWidth
              helperText="The admin uses this password to sign in before enrolling MFA."
            />
            <Box>
              <InputLabel id="role-select-label">Assigned Role</InputLabel>
              <Select
                labelId="role-select-label"
                id="role-select"
                value={form.assignedRole}
                label="Assigned Role"
                fullWidth
                onChange={(e: SelectChangeEvent) =>
                  setField("assignedRole", e.target.value as AssignedAdminRole)
                }
              >
                {ADMIN_ROLES.map((role) => (
                  <MenuItem key={role} value={role}>
                    {ADMIN_ROLE_LABELS[role]}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={saving || !isOnline}
          >
            {saving ? "Creating…" : "Create Account"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
      >
        <Alert severity="success" variant="filled" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
