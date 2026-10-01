"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { ContactNumberField } from "@/components/shared/ContactNumberField";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatus } from "@/context/OnlineStatusContext";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { AdminRecord, fetchAdmin, updateAdmin } from "@/lib/admin";
import { contactNumberError, normalizeContactNumber } from "@/lib/phone";
import {
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  AssignedAdminRole,
  getAdminLandingPath,
} from "@/lib/rbac";

/**
 * Admin — Edit Staff (`/admin/users/[id]/edit`) — SUPER_ADMIN only.
 *
 * Editable: names, contact number and assigned role. `userName` and
 * `emailAddress` are read-only — the email IS the Cognito sign-in name (the
 * backend refuses to change it on a provisioned account) and a silent username
 * change would alter a credential the admin is never told about.
 * `accountStatus` is managed from the action menu, not this form.
 */
export default function EditAdminPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  /** Back/cancel/save-return destination: the read-only detail page. */
  const detailPath = `/admin/users/${encodeURIComponent(id)}`;
  const isOnline = useOnlineStatus();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { profile, isLoading: isLoadingProfile } = useAdminProfile();

  const [admin, setAdmin] = useState<AdminRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state (editable fields only).
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    phoneNumber: "",
    assignedRole: "OPERATIONS_CLERK" as AssignedAdminRole,
  });

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  useEffect(() => {
    // Guard: only a SUPER_ADMIN may reach User Management. The admin shell
    // already blocks the route; this is defence in depth.
    if (isLoadingProfile || !profile) return;
    if (profile.assignedRole !== "SUPER_ADMIN") {
      router.replace(getAdminLandingPath(profile.assignedRole));
    }
  }, [isLoadingProfile, profile, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdmin(id);
        if (cancelled) return;
        if (!data) {
          setError("Admin not found.");
          return;
        }
        setAdmin(data);
        setForm({
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          middleName: data.middleName ?? "",
          phoneNumber: normalizeContactNumber(data.phoneNumber ?? ""),
          assignedRole: data.assignedRole,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load admin.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (
    isAuthLoading ||
    !isAuthenticated ||
    user?.role !== "admin" ||
    isLoadingProfile ||
    profile?.assignedRole !== "SUPER_ADMIN"
  ) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 240,
        }}
      >
        <CircularProgress aria-label="Loading admin" />
      </Box>
    );
  }

  const setField =
    (key: "firstName" | "lastName" | "middleName" | "phoneNumber") =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    const contactProblem = contactNumberError(form.phoneNumber, {
      required: true,
    });
    if (contactProblem) {
      setError(contactProblem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateAdmin(id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        middleName: form.middleName.trim(),
        phoneNumber: normalizeContactNumber(form.phoneNumber),
        assignedRole: form.assignedRole,
      });
      router.push(detailPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save admin.");
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(detailPath)}
        >
          Back
        </Button>
        <Typography variant="h5" component="h2">
          Edit Staff Account
        </Typography>
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
          <CircularProgress aria-label="Loading admin" />
        </Box>
      ) : admin ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Admin ID"
                  value={admin.adminId}
                  fullWidth
                  disabled
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Username"
                  value={admin.userName}
                  fullWidth
                  disabled
                  InputProps={{ readOnly: true }}
                  helperText="Sign-in identifier — contact the developer if it must change."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email Address"
                  value={admin.emailAddress}
                  fullWidth
                  disabled
                  InputProps={{ readOnly: true }}
                  helperText="This is the Cognito sign-in name and cannot be changed on a provisioned account."
                />
              </Grid>
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
                <ContactNumberField
                  value={form.phoneNumber}
                  onChange={(next) =>
                    setForm((prev) => ({ ...prev, phoneNumber: next }))
                  }
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InputLabel id="admin-role-select-label" sx={{ mb: 1 }}>
                  Assigned Role
                </InputLabel>
                <Select
                  labelId="admin-role-select-label"
                  id="admin-role-select"
                  value={form.assignedRole}
                  fullWidth
                  onChange={(event: SelectChangeEvent) =>
                    setForm((prev) => ({
                      ...prev,
                      assignedRole: event.target.value as AssignedAdminRole,
                    }))
                  }
                >
                  {ADMIN_ROLES.map((role) => (
                    <MenuItem key={role} value={role}>
                      {ADMIN_ROLE_LABELS[role]}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 3 }}>
              A role change applies the next time the admin&apos;s console loads
              the profile; a session they already hold keeps its current access
              until it expires or they sign out.
            </Alert>

            <Stack
              direction="row"
              spacing={1}
              justifyContent="flex-end"
              sx={{ mt: 3 }}
            >
              <Button color="inherit" onClick={() => router.push(detailPath)}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || !isOnline}
              >
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
