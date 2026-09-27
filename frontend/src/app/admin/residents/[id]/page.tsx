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
import { ResidentActionMenu } from "@/components/admin/ResidentActionMenu";
import {
  fetchResident,
  RESIDENT_DELETION_COLORS,
  RESIDENT_STATUS_COLORS,
  ResidentRecord,
  residentDeletionLabel,
  residentDeletionState,
} from "@/lib/admin";

/** Build a resident's full name from its name fields. */
function fullName(resident: ResidentRecord): string {
  const parts = [
    resident.firstName,
    resident.middleName,
    resident.lastName,
    resident.suffix,
  ]
    .filter(Boolean)
    .join(" ");
  return parts || "—";
}

/** Format an ISO timestamp as a short local date. */
function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
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
 * Admin — Resident Details.
 *
 * Read-only profile view. Account actions (Suspend / Deactivate / Reactivate /
 * Delete) live in the shared overflow menu, and editing is handed off to the
 * existing `/edit` form.
 */
export default function ResidentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [resident, setResident] = useState<ResidentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchResident(id);
        if (cancelled) return;
        if (!data) {
          setError("Resident not found.");
          return;
        }
        setResident(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load resident.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
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
            onClick={() => router.push("/admin/residents")}
          >
            Back
          </Button>
          <Typography variant="h5" component="h2">
            Resident Details
          </Typography>
        </Stack>

        {resident && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              disabled={Boolean(resident.isDeleted)}
              onClick={() =>
                router.push(
                  `/admin/residents/${encodeURIComponent(id)}/edit`,
                )
              }
            >
              Edit
            </Button>
            <ResidentActionMenu
              resident={resident}
              onUpdated={setResident}
              size="medium"
            />
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
          <CircularProgress aria-label="Loading resident" />
        </Box>
      ) : resident ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            {resident.isDeleted && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                This account has been deleted. It is hidden from the Residents
                list but retained in the database.
              </Alert>
            )}

            {/* Resident-INITIATED deletion — a DIFFERENT thing from the admin
                soft-delete above: the resident keeps their sign-in and stays
                listed here, and every record is retained for staff. Only the
                resident's own view of their pre-deletion records is closed. */}
            {residentDeletionState(resident) !== "none" && (
              <Alert
                severity={resident.deletionFinalizedAt ? "error" : "warning"}
                sx={{ mb: 3 }}
              >
                {resident.deletionFinalizedAt
                  ? `This resident deleted their own account on ${formatDate(
                      resident.deletionFinalizedAt,
                    )}. The deletion is permanent and cannot be restored. The records they filed beforehand are hidden from the resident portal and can no longer be changed by them — staff access here is unchanged.`
                  : `This resident requested deletion of their own account. The recovery window closes on ${formatDate(
                      resident.deletionScheduledFor,
                    )}, after which the deletion becomes permanent. Until then they can restore it themselves; their pre-existing records are hidden from the resident portal but unchanged here.`}
              </Alert>
            )}

            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
              sx={{ mb: 3 }}
            >
              <Avatar
                sx={{ width: 56, height: 56, bgcolor: "secondary.main" }}
              >
                {resident.firstName?.[0] ?? "R"}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="h3">
                  {fullName(resident)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {resident.emailAddress}
                </Typography>
              </Box>
              <Chip
                label={resident.accountStatus}
                color={
                  RESIDENT_STATUS_COLORS[resident.accountStatus] ?? "default"
                }
                variant="outlined"
              />
              {residentDeletionState(resident) !== "none" && (
                <Chip
                  label={residentDeletionLabel(residentDeletionState(resident))}
                  color={RESIDENT_DELETION_COLORS[residentDeletionState(resident)]}
                />
              )}
            </Stack>

            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Resident ID" value={resident.residentId} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField
                  label="Provisioned"
                  value={resident.isProvisioned ? "Yes" : "No"}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField
                  label="Registered"
                  value={formatDate(resident.createdAt)}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="First Name" value={resident.firstName} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Middle Name" value={resident.middleName} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Last Name" value={resident.lastName} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Suffix" value={resident.suffix} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField
                  label="Email Address"
                  value={resident.emailAddress}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField
                  label="Contact Number"
                  value={resident.contactNumber}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField
                  label="House / Unit Number"
                  value={resident.houseUnitNumber}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField
                  label="Street / Purok"
                  value={resident.streetPurokName}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="City" value={resident.city} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Province" value={resident.province} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DetailField label="Zip Code" value={resident.zipCode} />
              </Grid>
              {resident.statusReason && (
                <Grid item xs={12}>
                  <DetailField
                    label="Latest account note"
                    value={resident.statusReason}
                  />
                </Grid>
              )}
              {resident.deletionRequestedAt && (
                <Grid item xs={12} sm={6} md={4}>
                  <DetailField
                    label="Deletion requested"
                    value={formatDate(resident.deletionRequestedAt)}
                  />
                </Grid>
              )}
              {resident.deletionScheduledFor && (
                <Grid item xs={12} sm={6} md={4}>
                  <DetailField
                    label="Deletion effective"
                    value={formatDate(resident.deletionScheduledFor)}
                  />
                </Grid>
              )}
              {resident.deletionFinalizedAt && (
                <Grid item xs={12} sm={6} md={4}>
                  <DetailField
                    label="Deletion finalised"
                    value={formatDate(resident.deletionFinalizedAt)}
                  />
                </Grid>
              )}
              {resident.deletionReason && (
                <Grid item xs={12}>
                  <DetailField
                    label="Resident's reason"
                    value={resident.deletionReason}
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
