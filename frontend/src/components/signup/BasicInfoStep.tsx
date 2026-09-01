"use client";

import { FormEvent, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

export interface BasicInfoValues {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  email: string;
  contactNumber: string;
  password: string;
}

type BasicErrors = Partial<Record<keyof BasicInfoValues, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PH_MOBILE_RE = /^(?:\+?63|0)9\d{9}$/;

interface BasicInfoStepProps {
  /** Called with the validated Step 1 values when "NEXT" is pressed. */
  onSubmit: (values: BasicInfoValues) => void;
}

/**
 * Step 1 of the resident sign-up — Basic Information.
 * Collects name, suffix, email, contact number, and a new password.
 */
export function BasicInfoStep({ onSubmit }: BasicInfoStepProps) {
  const [values, setValues] = useState<BasicInfoValues>({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    email: "",
    contactNumber: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<BasicErrors>({});

  const setField =
    (key: keyof BasicInfoValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: BasicErrors = {};

    if (!values.firstName.trim()) next.firstName = "First name is required.";
    if (!values.lastName.trim()) next.lastName = "Last name is required.";

    if (!values.email.trim()) next.email = "Email address is required.";
    else if (!EMAIL_RE.test(values.email.trim()))
      next.email = "Enter a valid email address.";

    const digits = values.contactNumber.replace(/[\s-]/g, "");
    if (!values.contactNumber.trim()) next.contactNumber = "Contact number is required.";
    else if (!PH_MOBILE_RE.test(digits))
      next.contactNumber =
        "Enter a valid Philippine mobile number (e.g., +63 9XX XXX XXXX).";

    if (!values.password) next.password = "Password is required.";
    else if (values.password.length < 8)
      next.password = "Password must be at least 8 characters.";

    setErrors(next);
    if (Object.keys(next).length === 0) {
      onSubmit({
        ...values,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        contactNumber: values.contactNumber.trim(),
      });
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        <TextField
          label="First Name"
          placeholder="First Name"
          fullWidth
          required
          autoComplete="given-name"
          value={values.firstName}
          onChange={setField("firstName")}
          error={!!errors.firstName}
          helperText={errors.firstName}
        />
        <TextField
          label="Last Name"
          placeholder="Last Name"
          fullWidth
          required
          autoComplete="family-name"
          value={values.lastName}
          onChange={setField("lastName")}
          error={!!errors.lastName}
          helperText={errors.lastName}
        />
        <TextField
          label="Middle Name (optional)"
          fullWidth
          autoComplete="additional-name"
          value={values.middleName}
          onChange={setField("middleName")}
        />
        <TextField
          label="Suffix (optional)"
          placeholder="Jr., Sr., III..."
          fullWidth
          value={values.suffix}
          onChange={setField("suffix")}
        />
        <TextField
          label="Email Address"
          type="email"
          placeholder="name@email.com"
          fullWidth
          required
          autoComplete="email"
          value={values.email}
          onChange={setField("email")}
          error={!!errors.email}
          helperText={errors.email}
        />
        <TextField
          label="Contact Number"
          placeholder="+63 9XX XXX XXXX"
          fullWidth
          required
          inputMode="tel"
          autoComplete="tel"
          value={values.contactNumber}
          onChange={setField("contactNumber")}
          error={!!errors.contactNumber}
          helperText={errors.contactNumber}
        />
        <TextField
          label="Create Password"
          type={showPassword ? "text" : "password"}
          fullWidth
          required
          autoComplete="new-password"
          value={values.password}
          onChange={setField("password")}
          error={!!errors.password}
          helperText={errors.password}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          sx={{
            bgcolor: "common.black",
            color: "common.white",
            "&:hover": { bgcolor: "grey.900" },
          }}
        >
          NEXT →
        </Button>
      </Stack>
    </Box>
  );
}
