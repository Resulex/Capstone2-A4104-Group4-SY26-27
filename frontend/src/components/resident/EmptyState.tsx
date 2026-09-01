"use client";

import { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InboxIcon from "@mui/icons-material/Inbox";

interface EmptyStateProps {
  /** Short headline, e.g. "No announcements yet". */
  title: string;
  /** Optional supporting text. */
  description?: string;
  /** Optional icon override (defaults to an inbox icon). */
  icon?: ReactNode;
  /** Optional action (button/link) rendered under the text. */
  action?: ReactNode;
}

/**
 * Reusable empty-state placeholder shown when a list has no items. Centralizes
 * the icon + message + action layout so every resident page stays consistent.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 1,
        py: { xs: 4, sm: 6 },
        px: 2,
      }}
    >
      <Box
        aria-hidden
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: "50%",
          bgcolor: "action.hover",
          color: "text.secondary",
          mb: 1,
        }}
      >
        {icon ?? <InboxIcon />}
      </Box>
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Box>
  );
}
