"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { MediaUploader } from "@/components/shared/MediaUploader";
import { useAuth } from "@/context/AuthContext";
import { createOfficial } from "@/lib/admin";

/**
 * Admin — Add Official.
 *
 * Form to create a new barangay official via POST /officials, then navigate
 * back to the directory.
 */
export default function AddOfficialPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    designatedPosition: "",
    contactNumber: "",
    emailAddress: "",
    officeLocation: "",
    coreResponsibilities: "",
    profileImageUrl: "",
  });

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  const setField =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleSave = async () => {
    if (
      !form.fullName.trim() ||
      !form.designatedPosition.trim() ||
      !form.contactNumber.trim() ||
      !form.emailAddress.trim() ||
      !form.officeLocation.trim()
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createOfficial({
        officialId: `off-${Date.now()}`,
        fullName: form.fullName.trim(),
        designatedPosition: form.designatedPosition.trim(),
        contactNumber: form.contactNumber.trim(),
        emailAddress: form.emailAddress.trim(),
        officeLocation: form.officeLocation.trim(),
        coreResponsibilities: form.coreResponsibilities
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        ...(form.profileImageUrl.trim()
          ? { profileImageUrl: form.profileImageUrl.trim() }
          : {}),
      });
      router.push("/admin/officials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add official.");
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
          Add Official
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Full Name"
                value={form.fullName}
                onChange={setField("fullName")}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Position"
                value={form.designatedPosition}
                onChange={setField("designatedPosition")}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Contact Number"
                value={form.contactNumber}
                onChange={setField("contactNumber")}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email Address"
                value={form.emailAddress}
                onChange={setField("emailAddress")}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Office Location"
                value={form.officeLocation}
                onChange={setField("officeLocation")}
                fullWidth
                required
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
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Official"}
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
    </Box>
  );
}
