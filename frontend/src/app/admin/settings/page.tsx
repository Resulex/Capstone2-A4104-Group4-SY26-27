"use client";

import { useEffect, useState } from "react";
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
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import SettingsIcon from "@mui/icons-material/Settings";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useAuth } from "@/context/AuthContext";
import { AdminProfile } from "@/hooks/useAdminProfile";
import { fetchJson } from "@/lib/api";
import { changeAdminPassword, updateAdmin } from "@/lib/admin";
import { PASSWORD_POLICY_MESSAGE, passwordPolicyViolation } from "@/lib/password-policy";

function accountStatusColor(status: string) {
  switch (status) {
    case "active":
      return "success" as const;
    case "suspended":
      return "warning" as const;
    default:
      return "default" as const;
  }
}

/**
 * Admin Settings page — edit the signed-in admin's own account.
 *
 * Names and the password are saved by two independent actions: names go
 * through the admin-management route (`PATCH /admins/{id}`), while a password
 * change goes through the self-service endpoint
 * (`PATCH /auth/admin/password`), which requires the current password.
 * Email/username/role/status are shown read-only.
 */
export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = await fetchJson<{ success: boolean; data?: AdminProfile }>(
          "/api/admin/profile",
        );
        if (cancelled) return;
        const data = body?.data ?? null;
        setProfile(data);
        setForm({
          firstName: data?.firstName ?? "",
          lastName: data?.lastName ?? "",
          middleName: data?.middleName ?? "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load profile.",
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

  const setField =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleSave = async () => {
    if (!profile?._id) {
      setError("Unable to determine your account ID.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdmin(profile._id, {
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName,
      });
      setProfile(updated);
      setSnackMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  // Client-side mirror of the backend's checks, so the Update Password button
  // reflects the same rules without a round-trip. The backend re-validates.
  const newPasswordViolation = form.newPassword
    ? passwordPolicyViolation(form.newPassword)
    : null;
  const sameAsCurrent =
    form.newPassword.length > 0 && form.newPassword === form.currentPassword;
  const confirmMismatch =
    form.confirmPassword.length > 0 &&
    form.confirmPassword !== form.newPassword;
  const canChangePassword =
    form.currentPassword.length > 0 &&
    form.newPassword.length > 0 &&
    form.confirmPassword.length > 0 &&
    newPasswordViolation === null &&
    !sameAsCurrent &&
    !confirmMismatch &&
    !savingPassword;

  const handlePasswordChange = async () => {
    setPasswordError(null);
    if (
      !form.currentPassword ||
      !form.newPassword ||
      !form.confirmPassword
    ) {
      setPasswordError("Enter your current password and the new one twice.");
      return;
    }
    if (newPasswordViolation) {
      setPasswordError(newPasswordViolation);
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setPasswordError("The two passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await changeAdminPassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setSnackMessage("Password updated.");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to update the password.",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage your administrator account details.
      </Typography>

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
          <CircularProgress aria-label="Loading settings" />
        </Box>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <SettingsIcon color="primary" />
              <Typography variant="h6" component="h3">
                Account
              </Typography>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  value={form.firstName}
                  onChange={setField("firstName")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  value={form.lastName}
                  onChange={setField("lastName")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Middle Name"
                  value={form.middleName}
                  onChange={setField("middleName")}
                  fullWidth
                />
              </Grid>
            </Grid>

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </Stack>

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Account information (read-only)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email Address"
                  value={profile?.emailAddress ?? ""}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Username"
                  value={profile?.userName ?? ""}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Assigned Role"
                  value={profile?.assignedRole ?? ""}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Admin ID"
                  value={profile?.adminId ?? profile?._id ?? ""}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <Chip
                  label={`Account status: ${profile?.accountStatus ?? "unknown"}`}
                  size="small"
                  color={accountStatusColor(profile?.accountStatus ?? "")}
                  variant="outlined"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" component="h3" sx={{ mb: 0.5 }}>
              Change Password
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Confirm your current password, then choose a new one.
            </Typography>

            {passwordError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {passwordError}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Current Password"
                  type={showCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={form.currentPassword}
                  onChange={setField("currentPassword")}
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={
                            showCurrentPassword
                              ? "Hide current password"
                              : "Show current password"
                          }
                          onClick={() => setShowCurrentPassword((v) => !v)}
                          edge="end"
                        >
                          {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="New Password"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={setField("newPassword")}
                  error={sameAsCurrent || newPasswordViolation !== null}
                  helperText={
                    sameAsCurrent
                      ? "The new password must be different from the current password."
                      : PASSWORD_POLICY_MESSAGE
                  }
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={
                            showNewPassword
                              ? "Hide new password"
                              : "Show new password"
                          }
                          onClick={() => setShowNewPassword((v) => !v)}
                          edge="end"
                        >
                          {showNewPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Confirm Password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={setField("confirmPassword")}
                  error={confirmMismatch}
                  helperText={
                    confirmMismatch
                      ? "The two passwords do not match."
                      : " "
                  }
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={
                            showConfirmPassword
                              ? "Hide password confirmation"
                              : "Show password confirmation"
                          }
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          edge="end"
                        >
                          {showConfirmPassword ? (
                            <VisibilityOff />
                          ) : (
                            <Visibility />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={handlePasswordChange}
                disabled={!canChangePassword}
              >
                {savingPassword ? "Updating…" : "Update Password"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Snackbar
        open={snackMessage !== null}
        autoHideDuration={4000}
        onClose={() => setSnackMessage(null)}
        message={snackMessage ?? ""}
      />
    </Box>
  );
}
