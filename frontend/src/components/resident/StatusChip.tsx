"use client";

import Chip from "@mui/material/Chip";

/**
 * Maps a status string to an MUI chip color so every resident page shows
 * statuses with a consistent semantic color. Falls back to `default` for
 * unknown values.
 */
const STATUS_COLORS: Record<string, "default" | "info" | "success" | "warning" | "error" | "primary" | "secondary"> = {
  // Document request lifecycle
  submitted: "info",
  processing: "warning",
  "ready for pickup": "primary",
  released: "success",
  rejected: "error",
  // Incident report lifecycle
  pending: "warning",
  responding: "info",
  resolved: "success",
  closed: "default",
  // Payment
  paid: "success",
  "paid offline": "success",
  unpaid: "default",
  // Priority
  high: "error",
  critical: "error",
  medium: "warning",
  low: "success",
  // Account
  active: "success",
  verified: "success",
  suspended: "error",
  // Chat
  active_session: "success",
  inactive: "default",
};

interface StatusChipProps {
  /** The status string to display (normalized to a color). */
  status: string;
}

/**
 * Reusable status chip with a semantic color derived from the status value.
 */
export function StatusChip({ status }: StatusChipProps) {
  const color = STATUS_COLORS[status.trim().toLowerCase()] ?? "default";
  return (
    <Chip
      label={status}
      size="small"
      color={color === "default" ? "default" : color}
      variant="outlined"
      sx={{ fontWeight: 600 }}
    />
  );
}
