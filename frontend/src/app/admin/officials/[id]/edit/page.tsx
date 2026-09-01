"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { MediaUploader } from "@/components/shared/MediaUploader";
import { useAuth } from "@/context/AuthContext";
import { fetchOfficial, OfficialRecord, updateOfficial } from "@/lib/admin";

/**
 * Admin — Edit Official.
 *
 * Editable form for a barangay official's details, saved via
 * PATCH /officials/{id}.
 */
export default function EditOfficialPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [official, setOfficial] = useState<OfficialRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state (editable fields only).
  const [form, setForm] = useState({
    fullName: "",
    designatedPosition: "",
    contactNumber: "",
    emailAddress: "",
    officeLocation: "",
    coreResponsibilities: "",
    profileImageUrl: "",
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
        const data = await fetchOfficial(id);
        if (cancelled) return;
        if (!data) {
          setError("Official not found.");
          return;
        }
        setOfficial(data);
        setForm({
          fullName: data.fullName ?? "",
          designatedPosition: data.designatedPosition ?? "",
          contactNumber: data.contactNumber ?? "",
          emailAddress: data.emailAddress ?? "",
          officeLocation: data.officeLocation ?? "",
          coreResponsibilities: (data.coreResponsibilities ?? []).join("\n"),
          profileImageUrl: data.profileImageUrl ?? "",
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load official.",
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

  const setField =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateOfficial(id, {
        fullName: form.fullName,
        designatedPosition: form.designatedPosition,
        contactNumber: form.contactNumber,
        emailAddress: form.emailAddress,
        officeLocation: form.officeLocation,
        coreResponsibilities: form.coreResponsibilities
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        profileImageUrl: form.profileImageUrl,
      });
      router.push("/admin/officials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save official.");
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push("/admin/officials")}
        >
          Back
        </Button>
        <Typography variant="h5" component="h2">
          Edit Official
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
          <CircularProgress aria-label="Loading official" />
        </Box>
      ) : official ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Official ID"
                  value={official.officialId}
                  fullWidth
                  disabled
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Full Name"
                  value={form.fullName}
                  onChange={setField("fullName")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Position"
                  value={form.designatedPosition}
                  onChange={setField("designatedPosition")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Contact Number"
                  value={form.contactNumber}
                  onChange={setField("contactNumber")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email Address"
                  value={form.emailAddress}
                  onChange={setField("emailAddress")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Office Location"
                  value={form.officeLocation}
                  onChange={setField("officeLocation")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Core Responsibilities (one per line)"
                  value={form.coreResponsibilities}
                  onChange={setField("coreResponsibilities")}
                  fullWidth
                  multiline
                  minRows={4}
                />
              </Grid>
              <Grid item xs={12}>
                <MediaUploader
                  label="Profile Photo"
                  value={form.profileImageUrl ? [form.profileImageUrl] : []}
                  onChange={(urls) =>
                    setForm((prev) => ({ ...prev, profileImageUrl: urls[0] ?? "" }))
                  }
                  folder="profile"
                  multiple={false}
                  maxFiles={1}
                  accept="image/*"
                  helperText="Optional profile photo for the official directory."
                />
              </Grid>
            </Grid>

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </Button>
              <Button
                variant="outlined"
                onClick={() => router.push("/admin/officials")}
                disabled={saving}
              >
                Cancel
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Official not found.
        </Typography>
      )}
    </Box>
  );
}
