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
import SettingsIcon from "@mui/icons-material/Settings";
import { useAuth } from "@/context/AuthContext";
import { AdminProfile } from "@/hooks/useAdminProfile";
import { fetchJson } from "@/lib/api";
import { AdminRecord, updateAdmin } from "@/lib/admin";

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
 * Admin Settings page — edit the signed-in admin's name and password.
 * Email/username/role/status are shown read-only.
 */
export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    password: "",
  });

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
          password: "",
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
    setSuccess(false);
    try {
      const body: Partial<AdminRecord> & { password?: string } = {
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName,
      };
      if (form.password) body.password = form.password;

      const updated = await updateAdmin(profile._id, body);
      setProfile(updated);
      setForm((prev) => ({ ...prev, password: "" }));
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
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
              <Grid item xs={12} sm={6}>
                <TextField
                  label="New Password"
                  type="password"
                  value={form.password}
                  onChange={setField("password")}
                  helperText="Leave blank to keep your current password."
                  fullWidth
                />
              </Grid>
            </Grid>

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

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Snackbar
        open={success}
        autoHideDuration={4000}
        onClose={() => setSuccess(false)}
        message="Profile updated."
      />
    </Box>
  );
}
