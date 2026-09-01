"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Image from "next/image";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import GoogleIcon from "@mui/icons-material/Google";
import { useAuth } from "@/context/AuthContext";
import { useResident } from "@/context/ResidentContext";
import { ResidentProfile } from "@/lib/resident";
import { ApiError, fetchJson, getJwt, postApi } from "@/lib/api";

export default function ResidentLoginPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const { setProfile } = useResident();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const popupRef = useRef<Window | null>(null);

  // If the user just created an account via /signup, welcome them back with a
  // success message (query param `/login?registered=1`).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      setSuccess("Account created successfully! You can now log in.");
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!consent) {
      setError(
        "You must agree to the Terms of Service and Data Privacy Policy before logging in.",
      );
      return;
    }

    if (!identifier.trim() || !password) {
      setError("Please enter your email address or mobile number and password.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await postApi<{
        token?: string;
        user?: {
          role?: string;
          firstName?: string;
          lastName?: string;
          _id?: string;
        };
        resident?: ResidentProfile;
      }>("/auth/login", { email: identifier.trim(), password });

      const token = getJwt(data) ?? data.token;
      if (!token) {
        throw new ApiError(
          0,
          "Login succeeded but no session token was returned.",
        );
      }

      const role = data.user?.role === "admin" ? "admin" : "resident";
      await setToken(token, role);
      // Prefer the linked resident profile; fall back to the user payload.
      if (data.resident) setProfile(data.resident);
      else if (data.user) setProfile(data.user as unknown as ResidentProfile);
      setSuccess("Signed in successfully. Redirecting…");
      router.push(role === "admin" ? "/admin" : "/");
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
   * Complete the login once the Google OAuth popup postMessages the backend
   * JWT. Listens for the popup's message, stores the token, redirects home.
   */
  const handleGoogleMessage = useCallback(
    async (event: MessageEvent) => {
      // Only accept messages from the exact popup window we opened. The popup
      // navigates Google → backend callback, so its origin changes across the
      // redirect chain; matching on `event.source` (the window object) is the
      // reliable check instead of an origin allowlist.
      if (!popupRef.current || event.source !== popupRef.current) return;

      const data = event.data as {
        token?: string;
        user?: ResidentProfile;
        isNewUser?: boolean;
      };
      if (!data || typeof data.token !== "string") return;

      setSubmitting(true);
      try {
        await setToken(data.token, "resident");
        // Persist the resident profile returned by the SSO callback so the
        // resident shell (sidebar avatar, header) can display it across reloads.
        if (data.user) setProfile(data.user);
        setSuccess("Signed in successfully. Redirecting…");
        router.push("/");
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Google sign-in succeeded but the session could not be stored. Please try again.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [router, setToken, setProfile],
  );

  useEffect(() => {
    window.addEventListener("message", handleGoogleMessage);
    return () => window.removeEventListener("message", handleGoogleMessage);
  }, [handleGoogleMessage]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const { data } = await fetchJson<{
        data: { authUrl: string };
      }>("/api/auth/resident/google");
      const popup = window.open(data.authUrl, "google-oauth", "width=520,height=640");
      if (!popup) {
        setError(
          "Your browser blocked the Google sign-in popup. Please allow pop-ups and try again.",
        );
        return;
      }
      popupRef.current = popup;

      // If the popup closes without ever delivering a token (e.g. the user
      // cancelled), surface a failure toast on the login page.
      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          popupRef.current = null;
          setError("Google sign-in was cancelled. Please try again.");
          setSubmitting(false);
        }
      }, 500);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not start Google sign-in. Please try again.",
      );
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 3, sm: 4 },
        borderRadius: 3,
      }}
    >
      <Stack spacing={3}>
        {/* Branding */}
        <Stack spacing={1.5} alignItems="center" textAlign="center">
          <Box
            sx={{
              width: 120,
              height: 120,
              position: "relative",
            }}
            aria-label="KaBarangayConnect logo"
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
              Resident Portal
            </Typography>
          </Box>
        </Stack>

        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" role="status">
            {success}
          </Alert>
        )}

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2}>
            <TextField
              label="Email Address or Mobile Number"
              type="text"
              autoComplete="username"
              fullWidth
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              inputProps={{ "aria-label": "Email address or mobile number" }}
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
              <Link
                href="/forgot-password"
                aria-label="Forgot password"
              >
                <Typography
                  component="span"
                  variant="body2"
                  color="primary"
                  sx={{ fontWeight: 600 }}
                >
                  Forgot password?
                </Typography>
              </Link>
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  color="primary"
                  inputProps={{
                    "aria-label":
                      "I have read and agree to the Terms of Service and Data Privacy Policy",
                  }}
                />
              }
              label={
                <Typography component="span" variant="body2">
                  I have read and agree to the{" "}
                  <Link href="/terms">
                    <Typography
                      component="span"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    >
                      Terms of Service
                    </Typography>
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy">
                    <Typography
                      component="span"
                      color="primary"
                      sx={{ fontWeight: 600 }}
                    >
                      Data Privacy Policy
                    </Typography>
                  </Link>{" "}
                  under RA 10173.
                </Typography>
              }
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={submitting}
            >
              LOG IN
            </Button>
          </Stack>
        </Box>

        <Divider>or</Divider>

        <Button
          variant="outlined"
          color="inherit"
          size="large"
          fullWidth
          startIcon={<GoogleIcon />}
          onClick={handleGoogleSignIn}
          disabled={submitting}
        >
          Continue with Google
        </Button>

        <Typography
          component="span"
          variant="body2"
          align="center"
          color="text.secondary"
          sx={{ display: "block" }}
        >
          Don&apos;t have an account?{" "}
          <Link href="/signup">
            <Typography
              component="span"
              color="primary"
              sx={{ fontWeight: 600 }}
            >
              Sign Up
            </Typography>
          </Link>
        </Typography>
      </Stack>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      </Snackbar>
    </Paper>
  );
}