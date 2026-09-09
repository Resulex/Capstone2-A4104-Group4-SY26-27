"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { ApiError, fetchJson } from "@/lib/api";

export default function AdminForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestReset = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setSubmitting(true);
    try {
      await fetchJson("/api/auth/admin/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setInfo("If an account exists, a 6-digit reset code has been sent to your email.");
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not request a reset.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReset = async () => {
    setError(null);
    if (!code.trim() || !password || password !== confirm) {
      setError("Enter the code, a new password, and matching confirmation.");
      return;
    }
    setSubmitting(true);
    try {
      await fetchJson("/api/auth/admin/forgot-password/confirm", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword: password }),
      });
      setInfo("Password reset successfully. You can now log in.");
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

        {info && <Alert severity="success">{info}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

        {step === 1 ? (
          <Stack spacing={2}>
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button variant="contained" color="primary" size="large" fullWidth onClick={requestReset} disabled={submitting}>
              {submitting ? "Sending…" : "Send Reset Code"}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField
              label="6-digit Code"
              fullWidth
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              label="Confirm Password"
              type="password"
              fullWidth
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button variant="contained" color="primary" size="large" fullWidth onClick={confirmReset} disabled={submitting}>
              {submitting ? "Resetting…" : "Reset Password"}
            </Button>
          </Stack>
        )}

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
