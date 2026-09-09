"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
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

const STEPS = ["Credentials", "Verification", "Authenticator Setup"];

// Backend responses use the `{ success, data, message }` envelope.
interface LoginData {
  token?: string;
  user?: unknown;
  authenticated?: boolean;
  /** Enrolled → prompt for the 6-digit authenticator code. */
  needsTotp?: boolean;
  /** Not enrolled yet → run the QR setup steps. */
  needsTotpSetup?: boolean;
  session?: string;
}

interface MfaLoginData {
  token?: string;
  user?: unknown;
}

interface SetupData {
  otpauthUrl?: string;
  secret?: string;
  session?: string;
}

interface VerifyData {
  setupComplete?: boolean;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // MFA state — the one-time Cognito challenge `session` (stateless
  // round-trip), the 6-digit authenticator code, and the TOTP enrollment
  // data (QR provisioning URI + raw secret shown only once).
  const [session, setSession] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const finishLogin = async (tokenValue: string) => {
    await setToken(tokenValue, "admin");
    router.push("/admin");
  };

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

      // Security: step-1 /login must NEVER return a session token. Every admin
      // is required to complete a TOTP challenge (enrolled → 6-digit code,
      // not enrolled → QR setup). If a token ever arrives here (e.g. an older
      // backend), refuse to auto-login without MFA.
      if (data?.token) {
        setError(
          "Two-factor authentication is required for this account. Please try again.",
        );
        return;
      }

      if (data?.needsTotp && data.session) {
        // Enrolled → prompt for the 6-digit authenticator code.
        setSession(data.session);
        setStep(1);
        return;
      }

      if (data?.needsTotpSetup && data.session) {
        // Not enrolled → show the QR setup step.
        setSession(data.session);
        setStep(2);
        return;
      }

      setError("Unexpected login response. Please try again.");
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

  /** Step 1 — already enrolled: verify the 6-digit authenticator code. */
  const handleCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!session || code.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      const body = await fetchJson<{ data?: MfaLoginData }>(
        "/api/auth/admin/login/mfa",
        {
          method: "POST",
          body: JSON.stringify({
            userName: username.trim(),
            session,
            code,
          }),
        },
      );
      const data = body.data;
      if (!data?.token) {
        throw new ApiError(0, "No authentication token was returned.");
      }
      await finishLogin(data.token);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Verification failed. Please check your code and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2a — load the QR provisioning data as soon as the setup step opens.
  useEffect(() => {
    if (step !== 2 || !session || otpauthUrl) return;

    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const body = await fetchJson<{ data?: SetupData }>(
          "/api/auth/admin/login/totp/setup",
          {
            method: "POST",
            body: JSON.stringify({ userName: username.trim(), session }),
          },
        );
        if (cancelled) return;
        setOtpauthUrl(body.data?.otpauthUrl ?? null);
        setSecret(body.data?.secret ?? null);
        if (body.data?.session) setSession(body.data.session);
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
  }, [step, session, otpauthUrl, username]);

  // Step 2b — verify the new authenticator, then re-submit credentials so the
  // now-enabled MFA returns a real code challenge (step 1) to finish login.
  const handleSetupCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!session || code.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchJson<{ data?: VerifyData }>("/api/auth/admin/login/totp/verify", {
        method: "POST",
        body: JSON.stringify({ userName: username.trim(), session, code }),
      });

      // MFA is now enabled → sign in again to obtain the real challenge.
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

      // After enrollment the re-login returns a real SOFTWARE_TOKEN_MFA
      // challenge (needsTotp). A token at this step would mean MFA was
      // bypassed — treat it as an error, never auto-login.
      if (data?.needsTotp && data.session) {
        setSession(data.session);
        setCode("");
        setStep(1);
        return;
      }
      if (data?.token) {
        setError(
          "Authenticator registered, but MFA was not enforced on sign-in. Please try again.",
        );
        return;
      }
      setError(
        "Authenticator registered, but the sign-in step was unexpected. Please try again.",
      );
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
    setSession(null);
    setCode("");
    setOtpauthUrl(null);
    setSecret(null);
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
              width: 120,
              height: 120,
              position: "relative",
            }}
            aria-label="KaBarangayConnect secure admin logo"
          >
            <Image
              src="/images/KaBarangay-logo.png"
              alt="KaBarangayConnect logo"
              fill
              priority
              sizes="120px"
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

              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Link href="/admin/forgot-password" aria-label="Forgot password">
                  <Typography component="span" variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                    Forgot password?
                  </Typography>
                </Link>
              </Box>

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
          /* Step 2 — Authenticator code (already enrolled) */
          <Box component="form" onSubmit={handleCodeSubmit} noValidate>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Enter the 6-digit code from your authenticator app (e.g. Google
                Authenticator) to finish signing in.
              </Typography>
              <TextField
                label="Verification Code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                fullWidth
                required
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputProps={{
                  "aria-label": "6-digit authenticator code",
                  maxLength: 6,
                }}
                helperText={`${code.length}/6 digits entered`}
              />

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={submitting || code.length !== 6}
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
        ) : step === 2 ? (
          /* Step 3 — Authenticator Setup (first login / QR enrollment) */
          <Box component="form" onSubmit={handleSetupCodeSubmit} noValidate>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {otpauthUrl
                  ? "Scan the QR code with your authenticator app (e.g. Google Authenticator), then enter the 6-digit code to register it."
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
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputProps={{
                  "aria-label": "6-digit verification code",
                  maxLength: 6,
                }}
                helperText={`${code.length}/6 digits entered`}
              />

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={submitting || code.length !== 6 || !otpauthUrl}
              >
                REGISTER AUTHENTICATOR
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
        ) : null}

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