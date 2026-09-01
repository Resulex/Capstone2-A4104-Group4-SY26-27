"use client";

import { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface DetailRowProps {
  /** Field label. */
  label: string;
  /** Field value (text or custom node such as a StatusChip). */
  value?: ReactNode;
  /** Optional fallback shown when `value` is empty. */
  fallback?: string;
}

/**
 * Reusable label/value row used on detail pages (document request, incident).
 * Stacks on mobile and becomes a two-column row on larger screens.
 */
export function DetailRow({ label, value, fallback = "—" }: DetailRowProps) {
  const hasValue = value !== undefined && value !== null && value !== "";
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        gap: { xs: 0.25, sm: 2 },
        py: 1.25,
        "&:not(:last-of-type)": { borderBottom: 1, borderColor: "divider" },
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ width: { sm: 220 }, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          minWidth: 0,
          flexGrow: 1,
          // Let long unbroken values (emails, addresses, ids) wrap instead of
          // overflowing the card edge.
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        {hasValue ? (
          value
        ) : (
          <Typography variant="body2" color="text.secondary">
            {fallback}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
