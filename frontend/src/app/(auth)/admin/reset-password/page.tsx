"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { ApiError } from "@/lib/api";
import { confirmAdminPasswordReset } from "@/lib/admin";
import {
  PASSWORD_POLICY_MESSAGE,
  passwordPolicyViolation,
} from "@/lib/password-policy";

const STEPS = ["Email", "New password"];
/** How long the success message stays up before returning to the login page. */
const REDIRECT_DELAY_MS = 1500;

/**
 * Route entry point.
 *
 * `useSearchParams()` must be read inside a `<Suspense>` boundary, otherwise
 * the static prerender of this route fails the production build with
 * "useSearchParams() should be wrapped in a suspense boundary". The inner
 * component owns the hook; this wrapper supplies the boundary.
 */
export default function AdminResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <AdminResetPasswordPageContent />
    </Suspense>
  );
}

/**
 * Admin Reset Password — step 2 of the link-based reset flow.
 *
 * Reachable only through the recovery email: that link carries the `email` and
 * the Cognito `code` as query parameters, so this page never asks for a code —
 * just the new password. Landing here without both parameters is treated as an
 * invalid link, and submitting with a stale one surfaces the backend's
 * "link is invalid or has expired" message.
 */
function AdminResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = (searchParams.get("email") ?? "").trim();
  // The token is the credential; `email` is only used to name the account.
  const token = (searchParams.get("token") ?? "").trim();
  const linkIsValid = token.length > 0;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // The confirm field keeps its OWN toggle (matching admin Settings): the two
  // are compared by eye, so revealing one must not reveal the other.
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  // After a successful reset, hand the admin back to the login page. The timer
  // is cleared on unmount so a manual navigation can't be overridden later.
  useEffect(() => {
    if (!resetComplete) return;
    const timer = setTimeout(() => router.push("/admin/login"), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [resetComplete, router]);

  const policyViolation = passwordPolicyViolation(password);
  const passwordsMismatch = confirm.length > 0 && confirm !== password;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (policyViolation) {
      setError(policyViolation);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmAdminPasswordReset({ token, newPassword: password });
      setPassword("");
      setConfirm("");
      setInfo("Password reset successfully. Returning you to the sign-in page…");
      setResetComplete(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset the password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Forgot Password
        </Typography>

        <Stepper activeStep={1} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {info && <Alert severity="info">{info}</Alert>}
        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}

        {!linkIsValid ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              This page can only be opened from the password recovery email. Request a new link to
              continue.
            </Typography>
            <Typography component="span" variant="body2" align="center" sx={{ display: "block" }}>
              <Link href="/admin/forgot-password">
                <Typography component="span" color="primary" sx={{ fontWeight: 600 }}>
                  Request a new link
                </Typography>
              </Link>
            </Typography>
          </Stack>
        ) : resetComplete ? (
          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            onClick={() => router.push("/admin/login")}
          >
            BACK TO LOGIN
          </Button>
        ) : (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {email ? `Choose a new password for ${email}.` : "Choose a new password."}
              </Typography>

              <TextField
                label="New Password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                fullWidth
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={password.length > 0 && policyViolation !== null}
                helperText={PASSWORD_POLICY_MESSAGE}
                inputProps={{ "aria-label": "New password" }}
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

              <TextField
                label="Confirm Password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                fullWidth
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={passwordsMismatch}
                helperText={passwordsMismatch ? "The two passwords do not match." : " "}
                inputProps={{ "aria-label": "Confirm new password" }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          showConfirm
                            ? "Hide password confirmation"
                            : "Show password confirmation"
                        }
                        onClick={() => setShowConfirm((v) => !v)}
                        edge="end"
                      >
                        {showConfirm ? <VisibilityOff /> : <Visibility />}
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
                disabled={submitting || policyViolation !== null || password !== confirm}
              >
                {submitting ? "Resetting…" : "RESET PASSWORD"}
              </Button>
            </Stack>
          </Box>
        )}

        {!resetComplete && (
          <Typography
            component="span"
            variant="body2"
            align="center"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            <Link href="/admin/login">
              <Typography component="span" color="primary" sx={{ fontWeight: 600 }}>
                Back to login
              </Typography>
            </Link>
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
