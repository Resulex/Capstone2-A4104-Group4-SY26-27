"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import type { WebSocketStatus as WebSocketStatusValue } from "@/hooks/useWebSocket";

interface WebSocketStatusProps {
  /** Current lifecycle state of the WebSocket connection. */
  status: WebSocketStatusValue;
}

/**
 * Non-intrusive WebSocket connection warning.
 *
 * Renders nothing while the connection is healthy (`connected` or still
 * `connecting`), and only surfaces a compact warning when the connection is
 * `disconnected` or has entered an `error` state — reducing cognitive load
 * under normal operation.
 */
export function WebSocketStatus({ status }: WebSocketStatusProps) {
  if (status === "connected" || status === "connecting") {
    return null;
  }

  const label = status === "error" ? "Live updates unavailable" : "Offline";

  return (
    <Tooltip title="Real-time updates are currently unavailable.">
      <Box role="status" aria-live="polite">
        <Chip
          icon={<CloudOffIcon />}
          label={label}
          size="small"
          color="warning"
          variant="outlined"
          aria-label={`Connection status: ${label}`}
        />
      </Box>
    </Tooltip>
  );
}
