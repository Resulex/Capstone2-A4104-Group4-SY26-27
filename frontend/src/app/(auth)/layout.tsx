"use client";

import { ReactNode } from "react";
import Box from "@mui/material/Box";
import { AccessibilityControls } from "@/components/AccessibilityControls";

/**
 * Shared shell for all authentication routes. Provides a mobile-first,
 * vertically-centered layout with the floating accessibility controls
 * (typographic scaling + high-contrast toggle).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 4 },
        py: 4,
      }}
    >
      <Box
        sx={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: (theme) => theme.zIndex.snackbar,
        }}
      >
        <AccessibilityControls />
      </Box>
      <Box sx={{ width: "100%", maxWidth: { xs: 480, sm: 520, md: 560 } }}>
        {children}
      </Box>
    </Box>
  );
}