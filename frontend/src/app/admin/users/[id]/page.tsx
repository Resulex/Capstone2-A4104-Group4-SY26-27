"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import { useAuth } from "@/context/AuthContext";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { AdminActionMenu } from "@/components/admin/AdminActionMenu";
import { ADMIN_STATUS_COLORS, AdminRecord, fetchAdmin } from "@/lib/admin";
import { ADMIN_ROLE_LABELS, getAdminLandingPath } from "@/lib/rbac";

/** Build an admin's full name from its name fields. */
function fullName(admin: AdminRecord): string {
  const parts = [admin.firstName, admin.middleName, admin.lastName]
    .filter(Boolean)
    .join(" ");
  return parts || "—";
}

/** Format an ISO timestamp as a short local date + time. */
function formatDateTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Read-only labelled value used by the detail grid. */
function DetailField({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value || "—"}
      </Typography>
    </Stack>
  );
}

/**
 * Admin — Staff Details (`/admin/users/[id]`) — SUPER_ADMIN only.
 *
 * Read-only profile view of another administrator. Account actions (Suspend /
 * Reactivate) live in the shared overflow menu and editing is handed off to
 * `/admin/users/[id]/edit`.
 */
export default function AdminDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { profile, isLoading: isLoadingProfile } = useAdminProfile();

  const [admin, setAdmin] = useState<AdminRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  useEffect(() => {
    // Guard: only a SUPER_ADMIN may reach User Management. The admin shell
    // already blocks the route and hides the nav entry; this is defence in
    // depth.
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

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={2}
        sx={{ mb: 3 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push("/admin/users")}
          >
            Back
          </Button>
          <Typography variant="h5" component="h2">
            Staff Details
          </Typography>
        </Stack>

        {admin && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() =>
                router.push(`/admin/users/${encodeURIComponent(id)}/edit`)
              }
            >
              Edit
            </Button>
            <AdminActionMenu admin={admin} onUpdated={setAdmin} size="medium" />
          </Stack>
        )}
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
            {admin.accountStatus !== "active" && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                This account is {admin.accountStatus} and cannot sign in. Use the
                action menu to reactivate it.
                {admin.statusReason ? ` Reason: ${admin.statusReason}` : ""}
              </Alert>
            )}

            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
              sx={{ mb: 3 }}
            >
              <Avatar sx={{ width: 56, height: 56, bgcolor: "secondary.main" }}>
                {admin.firstName?.[0] ?? "A"}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="h3">
                  {fullName(admin)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {admin.emailAddress}
                </Typography>
              </Box>
              <Chip
                label={
                  ADMIN_ROLE_LABELS[
                    admin.assignedRole as keyof typeof ADMIN_ROLE_LABELS
                  ] ?? admin.assignedRole
                }
                size="small"
                variant="outlined"
              />
              <Chip
                label={admin.accountStatus}
                color={ADMIN_STATUS_COLORS[admin.accountStatus] ?? "default"}
                variant="outlined"
              />
            </Stack>

            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Admin ID" value={admin.adminId} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Username" value={admin.userName} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Email Address" value={admin.emailAddress} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="First Name" value={admin.firstName} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Middle Name" value={admin.middleName} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Last Name" value={admin.lastName} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField
                  label="Role"
                  value={
                    ADMIN_ROLE_LABELS[
                      admin.assignedRole as keyof typeof ADMIN_ROLE_LABELS
                    ] ?? admin.assignedRole
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Contact Number" value={admin.phoneNumber} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField
                  label="Registered"
                  value={formatDateTime(admin.createdAt)}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField
                  label="Last sign-in"
                  value={formatDateTime(admin.lastLogin)}
                />
              </Grid>
              {admin.statusReason && (
                <Grid item xs={12}>
                  <DetailField
                    label="Latest account note"
                    value={admin.statusReason}
                  />
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
