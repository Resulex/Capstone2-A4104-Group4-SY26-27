"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

interface PageLoaderProps {
  /** Caption shown under the spinner and announced to assistive tech. */
  label?: string;
}

/**
 * Full-viewport loading state.
 *
 * The admin console uses this as its initial gate: it replaces the entire shell
 * (sidebar + header + page content) until the session and the admin profile are
 * resolved, so RBAC-filtered navigation is never painted in an unfiltered state.
 */
export function PageLoader({ label = "Loading…" }: PageLoaderProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label={label}
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        bgcolor: "background.default",
      }}
    >
      <CircularProgress size={40} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
