"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Image from "next/image";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, fetchJson } from "@/lib/api";

const STEPS = ["Credentials", "MFA Verification", "Authenticator Setup"];

// Backend login/totp responses use the `{ success, data, message }` envelope.
interface LoginData {
  token?: string;
  user?: unknown;
  authenticated?: boolean;
  needsSetup?: boolean;
  enrollmentJwt?: string;
}

interface SetupData {
  secret?: string;
  otpauthUrl?: string;
}

interface VerifyData {
  backupCodes?: string[];
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setTokenValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Enrollment (first-login) state.
  const [enrollmentJwt, setEnrollmentJwt] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");

  // Load the authenticator provisioning data as soon as the setup step opens.
  useEffect(() => {
    if (step !== 2 || !enrollmentJwt || otpauthUrl) return;

    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const body = await fetchJson<{ data?: SetupData }>(
          "/api/auth/admin/totp/setup",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${enrollmentJwt}` },
          },
        );
        if (cancelled) return;
        setOtpauthUrl(body.data?.otpauthUrl ?? null);
        setSecret(body.data?.secret ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Failed to start authenticator setup. Please try again.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, enrollmentJwt, otpauthUrl]);

  const handleCredentialsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setSubmitting(true);
    try {
      const body = await fetchJson<{ data?: LoginData }>(
        "/api/auth/admin/login",
        {
          method: "POST",
          body: JSON.stringify({
            userName: username.trim(),
            password,
          }),
        },
      );
      const data = body.data;

      // Fully authenticated in a single step.
      if (data?.token) {
        await setToken(data.token, "admin");
        router.push("/admin");
        return;
      }

      if (data?.needsSetup) {
        // First login — no authenticator enrolled yet. Show the QR setup.
        setEnrollmentJwt(data.enrollmentJwt ?? null);
        setStep(2);
      } else {
        // MFA enrolled — prompt for the OTP.
        setStep(1);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Login failed. Please check your credentials and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTokenSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (token.trim().length !== 6) {
      setError("Please enter the 6-digit verification token.");
      return;
    }

    setSubmitting(true);
    try {
      const body = await fetchJson<{ data?: LoginData }>(
        "/api/auth/admin/login",
        {
          method: "POST",
          body: JSON.stringify({
            userName: username.trim(),
            password,
            code: token,
          }),
        },
      );
      const data = body.data;
      if (!data?.token) {
        throw new ApiError(0, "No authentication token was returned.");
      }
      await setToken(data.token, "admin");
      router.push("/admin");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Login failed. Please check your credentials and token and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (verificationCode.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    if (!enrollmentJwt) {
      setError("Authenticator setup session expired. Please start over.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchJson<{ data?: VerifyData }>("/api/auth/admin/totp/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${enrollmentJwt}` },
        body: JSON.stringify({ code: verificationCode }),
      });

      // Now complete the login with the same code to obtain a full session.
      const loginBody = await fetchJson<{ data?: LoginData }>(
        "/api/auth/admin/login",
        {
          method: "POST",
          body: JSON.stringify({
            userName: username.trim(),
            password,
            code: verificationCode,
          }),
        },
      );
      const data = loginBody.data;
      if (!data?.token) {
        throw new ApiError(0, "No authentication token was returned.");
      }
      await setToken(data.token, "admin");
      router.push("/admin");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Verification failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setStep(0);
    setError(null);
    setTokenValue("");
    setVerificationCode("");
    setOtpauthUrl(null);
    setSecret(null);
    setEnrollmentJwt(null);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 3, sm: 5 },
        borderRadius: 3,
      }}
    >
      <Stack spacing={3}>
        {/* Header */}
        <Stack spacing={1.5} alignItems="center" textAlign="center">
          <Box
            sx={{
              width: 96,
              height: 96,
              position: "relative",
            }}
            aria-label="KaBarangayConnect secure admin logo"
          >
            <Image
              src="/images/KaBarangay-logo.png"
              alt="KaBarangayConnect logo"
              fill
              priority
              sizes="96px"
              style={{ objectFit: "contain" }}
            />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              KaBarangayConnect
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Secure Administrative Portal
            </Typography>
          </Box>
        </Stack>

        {/* Stepper */}
        {/* Temporarily disabled to isolate SSR error */}
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}

        {step === 0 ? (
          /* Step 1 — Credential Verification */
          <Box component="form" onSubmit={handleCredentialsSubmit} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Admin Email or Username"
                type="text"
                autoComplete="username"
                fullWidth
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                inputProps={{ "aria-label": "Admin email or username" }}
              />
              <TextField
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                fullWidth
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                inputProps={{ "aria-label": "Password" }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
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
                color="primary"
                size="large"
                fullWidth
                disabled={submitting}
              >
                CONTINUE
              </Button>
            </Stack>
          </Box>
        ) : step === 1 ? (
          /* Step 2 — MFA Verification (already enrolled) */
          <Box component="form" onSubmit={handleTokenSubmit} noValidate>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Enter the 6-digit verification code from your authenticator app.
              </Typography>
              <TextField
                label="Verification Code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                fullWidth
                required
                value={token}
                onChange={(e) =>
                  setTokenValue(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputProps={{
                  "aria-label": "6-digit verification code",
                  maxLength: 6,
                }}
                helperText={`${token.length}/6 digits entered`}
              />

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={submitting || token.length !== 6}
              >
                VERIFY &amp; SIGN IN
              </Button>

              <Button
                variant="text"
                color="inherit"
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                fullWidth
              >
                Back to credentials
              </Button>
            </Stack>
          </Box>
        ) : (
          /* Step 3 — Authenticator Setup (first login) */
          <Box component="form" onSubmit={handleVerifyCodeSubmit} noValidate>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {otpauthUrl
                  ? "Scan the QR code with your authenticator app (e.g. Google Authenticator), then enter the 6-digit code to verify."
                  : "Preparing your authenticator setup…"}
              </Typography>

              {otpauthUrl && (
                <Stack spacing={1.5} alignItems="center">
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <QRCodeSVG value={otpauthUrl} size={180} />
                  </Paper>
                  {secret && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      align="center"
                    >
                      Can&apos;t scan? Enter this key manually:{" "}
                      <Chip
                        label={secret}
                        size="small"
                        sx={{ fontFamily: "monospace" }}
                      />
                    </Typography>
                  )}
                </Stack>
              )}

              <TextField
                label="Verification Code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                fullWidth
                required
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(
                    e.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                inputProps={{
                  "aria-label": "6-digit verification code",
                  maxLength: 6,
                }}
                helperText={`${verificationCode.length}/6 digits entered`}
              />

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={
                  submitting || verificationCode.length !== 6 || !otpauthUrl
                }
              >
                VERIFY &amp; COMPLETE SETUP
              </Button>

              <Button
                variant="text"
                color="inherit"
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                fullWidth
              >
                Back to credentials
              </Button>
            </Stack>
          </Box>
        )}

        <Divider />

        {/* Security footer */}
        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          sx={{ display: "block" }}
        >
          Restricted access. All administrative sessions are subject to
          institutional audit logging. Unauthorized access attempts are
          monitored and reported.
        </Typography>
      </Stack>
    </Paper>
  );
}