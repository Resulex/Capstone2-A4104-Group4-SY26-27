"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
// Stepper UI is hidden for now — the markup is commented out further down.
// These stay commented with it so restoring the four-step header is a matter of
// uncommenting both blocks.
// import Stepper from "@mui/material/Stepper";
// import Step from "@mui/material/Step";
// import StepLabel from "@mui/material/StepLabel";
import Image from "next/image";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";
import { useAccessibilityTheme } from "@/context/ThemeContext";
import { CodeInput, CodeInputHandle } from "@/components/shared/CodeInput";
import { ApiError, fetchJson } from "@/lib/api";
import { getAdminLandingPath } from "@/lib/rbac";
import { getAuthCardSurface } from "@/theme/theme";

// Labels for the hidden Stepper (see the commented block in the JSX below).
// const STEPS = [
//   "Credentials",
//   "Set Password",
//   "Verification",
//   "Authenticator Setup",
// ];

// Backend responses use the `{ success, data, message }` envelope.
interface LoginData {
  token?: string;
  user?: unknown;
  authenticated?: boolean;
  /** Enrolled → prompt for the 6-digit authenticator code. */
  needsTotp?: boolean;
  /** Not enrolled yet → run the QR setup steps. */
  needsTotpSetup?: boolean;
  /** First sign-in with an emailed temporary password → set a new one. */
  needsNewPassword?: boolean;
  session?: string;
}

/** Response of POST /auth/admin/login/new-password. */
interface NewPasswordData {
  needsTotp?: boolean;
  needsTotpSetup?: boolean;
  session?: string;
}

interface MfaLoginData {
  token?: string;
  /** Public admin record returned with the token (includes `assignedRole`). */
  user?: { assignedRole?: string };
}

interface SetupData {
  otpauthUrl?: string;
  secret?: string;
  session?: string;
}

interface VerifyData {
  setupComplete?: boolean;
  /**
   * Session JWT — enrollment doubles as login, so the enroll step never asks
   * for a second authenticator code. Absent only on an older backend.
   */
  token?: string;
  user?: { assignedRole?: string };
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const { highContrast } = useAccessibilityTheme();
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
  const [codeError, setCodeError] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  /**
   * Set when /totp/verify hands back a session token: the enrollment success
   * state shows for a beat, then the session is adopted (auto-login).
   */
  const [pendingLogin, setPendingLogin] = useState<{
    token: string;
    assignedRole?: string;
  } | null>(null);
  /** Refocuses the first code box after a rejected attempt. */
  const codeInputRef = useRef<CodeInputHandle>(null);

  // First-login password change (replaces the emailed temporary password).
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const finishLogin = async (tokenValue: string, assignedRole?: string) => {
    await setToken(tokenValue, "admin");
    // Land on the role's home: a role without a dashboard (INFO_OFFICER) goes
    // straight to its first section instead of a dashboard it cannot use.
    router.push(getAdminLandingPath(assignedRole));
  };

  /**
   * POST /auth/admin/login and route to the next step. Shared by the initial
   * credentials submit and the post-password-change re-login so both paths
   * handle the challenge set identically.
   */
  const submitCredentials = async (passwordToUse: string): Promise<void> => {
    const body = await fetchJson<{ data?: LoginData }>(
      "/api/auth/admin/login",
      {
        method: "POST",
        body: JSON.stringify({
          userName: username.trim(),
          password: passwordToUse,
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

    if (data?.needsNewPassword && data.session) {
      // First sign-in with an emailed temporary password → choose a new one.
      setSession(data.session);
      setStep(1);
      return;
    }

    if (data?.needsTotp && data.session) {
      // Enrolled → prompt for the 6-digit authenticator code.
      setSession(data.session);
      setStep(2);
      return;
    }

    if (data?.needsTotpSetup && data.session) {
      // Not enrolled → show the QR setup step.
      setSession(data.session);
      setStep(3);
      return;
    }

    setError("Unexpected login response. Please try again.");
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
      await submitCredentials(password);
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

  /**
   * Step 2 — replace the temporary password, then continue with the MFA
   * challenge the backend hands back (MFA_SETUP for a brand-new admin).
   */
  const handleNewPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!session) {
      setError("Your session has expired. Please sign in again.");
      return;
    }
    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      setError(
        "Use at least 8 characters with upper-case, lower-case, and numeric characters.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const body = await fetchJson<{ data?: NewPasswordData }>(
        "/api/auth/admin/login/new-password",
        {
          method: "POST",
          body: JSON.stringify({
            userName: username.trim(),
            session,
            newPassword,
          }),
        },
      );
      const data = body.data;

      // The temporary password is single-use, so every later step of this
      // first-time setup must use the new one.
      setPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");

      if (data?.needsTotp && data.session) {
        setSession(data.session);
        setStep(2);
        return;
      }
      if (data?.needsTotpSetup && data.session) {
        setSession(data.session);
        setStep(3);
        return;
      }

      // Fallback: re-run the sign-in so the normal challenge routing applies.
      await submitCredentials(newPassword);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to set the new password. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Code edits clear the rejected-code styling immediately, so the red boxes
   * only ever describe the attempt the user has not yet changed.
   */
  const handleCodeChange = (value: string) => {
    setCode(value);
    setCodeError(false);
  };

  /** Step 3 — already enrolled: verify the 6-digit authenticator code. */
  const handleCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCodeError(false);

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
      await finishLogin(data.token, data.user?.assignedRole);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Verification failed. Please check your code and try again.",
      );
      // Keep the digits so a single mistyped box can be corrected, and put
      // the caret back on the first box.
      setCodeError(true);
      codeInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  // Step 4a — load the QR provisioning data as soon as the setup step opens.
  useEffect(() => {
    if (step !== 3 || !session || otpauthUrl) return;

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

  // Step 4b — register the new authenticator. Success signs the admin in
  // directly (the backend issues the session JWT), so there is NO second code
  // prompt. The re-login path below is only a fallback for a response without
  // a token (e.g. an older deployed backend).
  const handleSetupCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCodeError(false);

    if (!session || code.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      const verifyBody = await fetchJson<{ data?: VerifyData }>(
        "/api/auth/admin/login/totp/verify",
        {
          method: "POST",
          body: JSON.stringify({ userName: username.trim(), session, code }),
        },
      );
      const verifyData = verifyBody.data;

      if (verifyData?.token) {
        // Auto-login: show the success state, then adopt the session and land
        // on the role's home.
        setCode("");
        setSecret(null);
        setPendingLogin({
          token: verifyData.token,
          assignedRole: verifyData.user?.assignedRole,
        });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try {
          await finishLogin(
            verifyData.token,
            verifyData.user?.assignedRole,
          );
        } catch {
          // The authenticator IS registered — only the session hand-off
          // failed. Drop back to credentials (which now asks for a normal
          // 6-digit code) instead of stranding the admin on a dead success
          // screen, and say so plainly rather than echoing the raw error.
          setPendingLogin(null);
          setStep(0);
          setError(
            "Authenticator registered, but signing you in failed. Please sign in again.",
          );
        }
        return;
      }

      // Fallback — MFA is now enabled, so sign in again to obtain the real
      // challenge and finish with a fresh code.
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
        setStep(2);
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
      // Keep the digits so a single mistyped box can be corrected, and put
      // the caret back on the first box.
      setCodeError(true);
      codeInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setStep(0);
    setError(null);
    setSession(null);
    setCode("");
    setCodeError(false);;
    setOtpauthUrl(null);
    setSecret(null);
    setPendingLogin(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 3, sm: 5 },
        borderRadius: 3,
        bgcolor: getAuthCardSurface(highContrast),
        // MUI outlined inputs are transparent by default, so on the tinted
        // auth card the fields blended into the card. Put them back on the
        // paper surface so every credential field reads as its own white box.
        "& .MuiOutlinedInput-root": {
          backgroundColor: (theme) => theme.palette.background.paper,
        },
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
        {/* <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper> */}

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
          /* Step 2 — Set a new password (first sign-in with a temporary one) */
          <Box component="form" onSubmit={handleNewPasswordSubmit} noValidate>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Your temporary password was accepted. Choose a new password,
                then continue to two-factor setup.
              </Typography>
              <TextField
                label="New Password"
                type="password"
                autoComplete="new-password"
                fullWidth
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                inputProps={{ "aria-label": "New password" }}
                helperText="At least 8 characters with upper-case, lower-case, and numeric characters."
              />
              <TextField
                label="Confirm New Password"
                type="password"
                autoComplete="new-password"
                fullWidth
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                inputProps={{ "aria-label": "Confirm new password" }}
              />

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={submitting || !newPassword || !confirmPassword}
              >
                SET PASSWORD &amp; CONTINUE
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
          /* Step 3 — Authenticator code (already enrolled) */
          <Box component="form" onSubmit={handleCodeSubmit} noValidate>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Enter the 6-digit code from your authenticator app (e.g. Google
                Authenticator) to finish signing in.
              </Typography>
              <CodeInput
                key="mfa-code"
                ref={codeInputRef}
                label="Verification Code"
                value={code}
                onChange={handleCodeChange}
                ariaLabel="6-digit authenticator code"
                helperText={`${code.length}/6 digits entered`}
                error={codeError}
                disabled={submitting}
                required
                autoFocus
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
        ) : step === 3 ? (
          /* Step 4 — Authenticator Setup (first login / QR enrollment) */
          pendingLogin ? (
            /* Enrollment succeeded and the backend signed us in — a beat of
               feedback, then the redirect to the role's landing page. */
            <Stack spacing={2} alignItems="center">
              <Alert severity="success" sx={{ width: "100%" }}>
                Authenticator registered. Signing you in…
              </Alert>
              <CircularProgress size={28} aria-label="Signing in" />
            </Stack>
          ) : (
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

              <CodeInput
                key="enroll-code"
                ref={codeInputRef}
                label="Verification Code"
                value={code}
                onChange={handleCodeChange}
                ariaLabel="6-digit verification code"
                helperText={`${code.length}/6 digits entered`}
                error={codeError}
                disabled={submitting}
                required
                autoFocus
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
          )
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