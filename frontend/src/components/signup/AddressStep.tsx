"use client";

import { FormEvent, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import { SignupBarangay } from "@/lib/signup";

export interface AddressValues {
  houseUnitNumber: string;
  streetPurokName: string;
}

interface AddressStepProps {
  /** Barangay fetched from the registration system; null while loading/failed. */
  barangay: SignupBarangay | null;
  loading: boolean;
  error: string | null;
  submitting?: boolean;
  /** Called with the validated address when "CONFIRM ADDRESS" is pressed. */
  onSubmit: (values: AddressValues) => void;
}

/**
 * Step 2 of the resident sign-up — Residential Address.
 * Auto-filled, read-only barangay/city/province/ZIP (from the registration
 * system) plus user-entered house/unit and street/purok.
 */
export function AddressStep({
  barangay,
  loading,
  error,
  submitting = false,
  onSubmit,
}: AddressStepProps) {
  const [houseUnitNumber, setHouseUnitNumber] = useState("");
  const [streetPurokName, setStreetPurokName] = useState("");
  const [errors, setErrors] = useState<{
    houseUnitNumber?: string;
    streetPurokName?: string;
  }>({});

  const confirmDisabled = submitting || loading || !!error || !barangay;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!houseUnitNumber.trim())
      next.houseUnitNumber = "House / unit number is required.";
    if (!streetPurokName.trim())
      next.streetPurokName = "Street / purok name is required.";
    setErrors(next);
    if (Object.keys(next).length === 0) {
      onSubmit({
        houseUnitNumber: houseUnitNumber.trim(),
        streetPurokName: streetPurokName.trim(),
      });
    }
  };

  const readOnlyField = (label: string, value: string | undefined) => (
    <TextField
      label={label}
      value={value ?? ""}
      fullWidth
      size="small"
      disabled
      InputProps={{ readOnly: true }}
    />
  );

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        <Box
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "grey.100",
            p: { xs: 2, sm: 2.5 },
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <AccountBalanceOutlined fontSize="small" color="action" />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Auto-filled — Read only (from registration system)
            </Typography>
          </Stack>

          {loading ? (
            <Stack spacing={1.5} role="status" aria-label="Loading address">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rounded" height={40} />
              ))}
            </Stack>
          ) : error ? (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              {readOnlyField("Barangay", barangay?.name)}
              {readOnlyField("City / Municipality", barangay?.city)}
              {readOnlyField("Province", barangay?.province)}
              {readOnlyField("ZIP / Postal Code", barangay?.zipCode)}
            </Stack>
          )}
        </Box>

        <TextField
          label="House / Unit Number"
          placeholder="e.g. Unit 2B, House #5"
          fullWidth
          required
          value={houseUnitNumber}
          onChange={(e) => setHouseUnitNumber(e.target.value)}
          error={!!errors.houseUnitNumber}
          helperText={errors.houseUnitNumber}
        />
        <TextField
          label="Street / Purok Name"
          placeholder="e.g. Sampaguita St., Purok 4"
          fullWidth
          required
          value={streetPurokName}
          onChange={(e) => setStreetPurokName(e.target.value)}
          error={!!errors.streetPurokName}
          helperText={errors.streetPurokName}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={confirmDisabled}
          sx={{
            bgcolor: "common.black",
            color: "common.white",
            "&:hover": { bgcolor: "grey.900" },
          }}
        >
          CONFIRM ADDRESS ✓
        </Button>
      </Stack>
    </Box>
  );
}
