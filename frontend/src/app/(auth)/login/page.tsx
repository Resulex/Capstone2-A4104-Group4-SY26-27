"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import Snackbar from "@mui/material/Snackbar";
import Image from "next/image";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { GoogleLogo } from "@/components/shared/GoogleLogo";
import { useAuth, type AuthUser } from "@/context/AuthContext";
import { useAccessibilityTheme } from "@/context/ThemeContext";
import { useResident } from "@/context/ResidentContext";
import { ResidentProfile } from "@/lib/resident";
import { ApiError, fetchJson, getJwt, postApi } from "@/lib/api";
import { getAuthCardSurface } from "@/theme/theme";

/**
 * Map the backend's `user.role` onto a shell role.
 *
 * `official` is passed through so it is no longer mistaken for a resident;
 * anything unexpected falls back to "resident", which is the portal this page
 * belongs to.
 */
function toLoginRole(value: unknown): AuthUser["role"] {
  return value === "admin" || value === "official" ? value : "resident";
}

export default function ResidentLoginPage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const { highContrast } = useAccessibilityTheme();
  const { setProfile } = useResident();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const popupRef = useRef<Window | null>(null);
  // Watcher that reports a popup closed without a result. It is cleared the
  // moment the popup delivers a token, so it can never fire a second (error)
  // toast alongside the success toast.
  const popupWatchRef = useRef<number | null>(null);
  const popupCompletedRef = useRef(false);
  /**
   * Signed OAuth `state` minted by the backend when the Google popup is opened.
   * The callback echoes it back and we reject any payload whose state does not
   * match, which binds the result to the attempt THIS page started.
   */
  const googleStateRef = useRef<string | null>(null);

  const stopWatchingPopup = useCallback(() => {
    if (popupWatchRef.current !== null) {
      window.clearInterval(popupWatchRef.current);
      popupWatchRef.current = null;
    }
  }, []);

  // Stop the watcher if the user navigates away while the popup is open.
  useEffect(() => stopWatchingPopup, [stopWatchingPopup]);

  // Two query flags can land here:
  // - `registered=1`: the user just created an account via /signup.
  // - `role=unsupported`: the shell guard sent an authenticated user whose role
  //   has no portal (e.g. `official`) back here — explain why.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      setSuccess("Account created successfully! You can now log in.");
    }
    if (params.get("role") === "unsupported") {
      setError(
        "Your account role does not have a portal yet. Please contact the barangay office.",
      );
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

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

      const role = toLoginRole(data.user?.role);
      await setToken(token, role);
      // Never inherit a previously stored resident profile: when the payload
      // carries no resident we still overwrite (falling back to the user
      // payload, which has no `termsAcceptedAt`) so a deleted or re-created
      // account cannot keep the old consent and skip the legal gate.
      if (data.resident) setProfile(data.resident);
      else if (data.user) setProfile(data.user as unknown as ResidentProfile);
      else setProfile(null);

      // Residents must accept the Terms + Data Privacy Policy before using the
      // portal: send unconsented accounts straight to the legal page instead of
      // bouncing through `/`. The resident layout enforces this as a backstop.
      const needsConsent = !data.resident?.termsAcceptedAt;

      // `official` accounts authenticate but have no portal to land in.
      if (role === "official") {
        setError(
          "Your account role does not have a portal yet. Please contact the barangay office.",
        );
        return;
      }

      setSuccess("Signed in successfully. Redirecting…");
      router.push(role === "admin" ? "/admin" : needsConsent ? "/legal" : "/");
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
        /** Signed OAuth state, echoed back by the backend callback. */
        state?: string;
        isNewUser?: boolean;
        isNewResident?: boolean;
        /** Backend-computed: has this resident already recorded consent? */
        termsAccepted?: boolean;
      };
      if (!data || typeof data.token !== "string") return;

      // The popup posts its result and immediately closes itself — stop the
      // watcher before it can report a spurious "cancelled" error toast.
      popupCompletedRef.current = true;
      stopWatchingPopup();
      popupRef.current = null;

      // Bind the result to the attempt this page started. Without this check the
      // popup could be navigated to a callback carrying someone else's account,
      // and the token would be accepted verbatim.
      const expectedState = googleStateRef.current;
      googleStateRef.current = null;
      if (!expectedState || data.state !== expectedState) {
        setSubmitting(false);
        setError("Google sign-in could not be verified. Please try again.");
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        await setToken(data.token, "resident");
        // Persist the resident profile returned by the SSO callback so the
        // resident shell (sidebar avatar, header) can display it across
        // reloads. Passing null clears any stale stored profile.
        const profile = data.user ?? null;
        setProfile(profile);

        // A brand-new SSO resident has no `termsAcceptedAt`, so they must be
        // taken to the legal page to agree before the portal unlocks. Prefer
        // the backend's flag, fall back to the returned profile field.
        const needsConsent =
          typeof data.termsAccepted === "boolean"
            ? !data.termsAccepted
            : !profile?.termsAcceptedAt;

        setSuccess("Signed in successfully. Redirecting…");
        router.push(needsConsent ? "/legal" : "/");
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
    [router, setToken, setProfile, stopWatchingPopup],
  );

  useEffect(() => {
    window.addEventListener("message", handleGoogleMessage);
    return () => window.removeEventListener("message", handleGoogleMessage);
  }, [handleGoogleMessage]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    // Drop any watcher left over from a previous attempt.
    stopWatchingPopup();
    popupCompletedRef.current = false;
    googleStateRef.current = null;
    try {
      const { data } = await fetchJson<{
        data: { authUrl: string; state: string };
      }>("/api/auth/resident/google");
      // Remember the signed state so the callback result can be matched to this
      // attempt (see `handleGoogleMessage`).
      googleStateRef.current = data.state;
      const popup = window.open(data.authUrl, "google-oauth", "width=520,height=640");
      if (!popup) {
        setError(
          "Your browser blocked the Google sign-in popup. Please allow pop-ups and try again.",
        );
        setSubmitting(false);
        return;
      }
      popupRef.current = popup;

      // If the popup closes without EVER delivering a token (e.g. the user
      // cancelled), surface a failure toast. `popupRef` is intentionally left
      // intact so a message that lands just after the close is still accepted.
      popupWatchRef.current = window.setInterval(() => {
        if (!popup.closed) return;
        stopWatchingPopup();
        if (popupCompletedRef.current) return;
        setError("Google sign-in was cancelled. Please try again.");
        setSubmitting(false);
      }, 500);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not start Google sign-in. Please try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 3, sm: 4 },
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
              label="Email Address"
              type="text"
              autoComplete="username"
              fullWidth
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              inputProps={{ "aria-label": "Email address" }}
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
          startIcon={<GoogleLogo />}
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