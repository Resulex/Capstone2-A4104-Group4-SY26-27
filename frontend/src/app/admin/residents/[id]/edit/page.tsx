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
import { useAuth } from "@/context/AuthContext";
import { fetchResident, ResidentRecord, updateResident } from "@/lib/admin";

/**
 * Admin — Edit Resident.
 *
 * Editable form for a resident's fields. The `residentId` is shown read-only;
 * everything else can be edited and saved via PATCH /residents/{id}.
 */
export default function EditResidentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [resident, setResident] = useState<ResidentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state (editable fields only).
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    emailAddress: "",
    contactNumber: "",
    houseUnitNumber: "",
    streetPurokName: "",
    city: "",
    province: "",
    zipCode: "",
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
        const data = await fetchResident(id);
        if (cancelled) return;
        if (!data) {
          setError("Resident not found.");
          return;
        }
        setResident(data);
        setForm({
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          middleName: data.middleName ?? "",
          suffix: data.suffix ?? "",
          emailAddress: data.emailAddress ?? "",
          contactNumber: data.contactNumber ?? "",
          houseUnitNumber: data.houseUnitNumber ?? "",
          streetPurokName: data.streetPurokName ?? "",
          city: data.city ?? "",
          province: data.province ?? "",
          zipCode: data.zipCode ?? "",
        });
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

  const setField = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateResident(id, {
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName,
        suffix: form.suffix,
        emailAddress: form.emailAddress,
        contactNumber: form.contactNumber,
        houseUnitNumber: form.houseUnitNumber,
        streetPurokName: form.streetPurokName,
      });
      router.push("/admin/residents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save resident.");
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push("/admin/residents")}
        >
          Back
        </Button>
        <Typography variant="h5" component="h2">
          Edit Resident
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
          <CircularProgress aria-label="Loading resident" />
        </Box>
      ) : resident ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Resident ID"
                  value={resident.residentId}
                  fullWidth
                  disabled
                  InputProps={{ readOnly: true }}
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
                <TextField
                  label="Suffix"
                  value={form.suffix}
                  onChange={setField("suffix")}
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
                  label="House / Unit Number"
                  value={form.houseUnitNumber}
                  onChange={setField("houseUnitNumber")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Street / Purok"
                  value={form.streetPurokName}
                  onChange={setField("streetPurokName")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="City"
                  value={form.city}
                  onChange={setField("city")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Province"
                  value={form.province}
                  onChange={setField("province")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Zip Code"
                  value={form.zipCode}
                  onChange={setField("zipCode")}
                  fullWidth
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
                onClick={() => router.push("/admin/residents")}
              >
                Cancel
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
