"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
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
import { ApiError } from "@/lib/api";
import { requestAdminPasswordReset } from "@/lib/admin";

const STEPS = ["Email", "New password"];
/** How long before a recovery email may be sent to the same address again. */
const RESEND_COOLDOWN_SECONDS = 60;

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * Admin Forgot Password — step 1 of the link-based reset flow.
 *
 * Submitting does NOT advance: the page stays put, confirms that a recovery
 * email was sent, and offers a resend once the cooldown elapses. The password
 * is actually changed on /admin/reset-password, which is reachable only from
 * the link inside that email.
 */
export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  /** Address the recovery email was last sent to (null = nothing sent yet). */
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Epoch ms when a resend becomes allowed again (null = no cooldown). */
  const [resendDeadline, setResendDeadline] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailTrimmed = email.trim();
  const emailIsValid = isValidEmail(emailTrimmed);
  /** The address on screen is the one already sent to — editing it clears this. */
  const sent = sentTo !== null && sentTo === emailTrimmed;

  // Drive the resend countdown from a wall-clock deadline instead of counting
  // ticks: browsers throttle timers in background tabs, which would otherwise
  // stretch the "one minute" wait well past a minute.
  useEffect(() => {
    if (resendDeadline === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((resendDeadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) setResendDeadline(null);
    };
    tick();
    const timer = setInterval(tick, 250);
    // Hidden tabs throttle timers, so re-check the moment the tab is shown.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [resendDeadline]);

  const sendRecoveryEmail = async (): Promise<void> => {
    // Enter in the email field still submits the form — respect the cooldown.
    if (sent && resendDeadline !== null) return;
    setError(null);
    if (!emailIsValid) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await requestAdminPasswordReset(emailTrimmed);
      setSentTo(emailTrimmed);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setResendDeadline(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the recovery email.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendRecoveryEmail();
  };

  return (
    <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Forgot Password
        </Typography>

        <Stepper activeStep={0} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {sent && (
          <Alert severity="info">
            An email has been sent for password recovery. Open the link in it to choose a new
            password.
          </Alert>
        )}
        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2}>
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={email.length > 0 && !emailIsValid}
              helperText={
                email.length > 0 && !emailIsValid ? "Enter a valid email address." : " "
              }
              inputProps={{ "aria-label": "Admin email address" }}
            />

            {sent ? (
              <Button
                type="button"
                variant="text"
                color="primary"
                onClick={() => {
                  void sendRecoveryEmail();
                }}
                disabled={resendDeadline !== null || submitting}
                sx={{ fontWeight: 600, textTransform: "none" }}
              >
                {resendDeadline !== null ? `Resend code in ${secondsLeft}s` : "Resend code"}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={submitting}
              >
                {submitting ? "Sending…" : "SEND RESET CODE"}
              </Button>
            )}
          </Stack>
        </Box>

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
      </Stack>
    </Paper>
  );
}
