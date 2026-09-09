"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CloudOffIcon from "@mui/icons-material/CloudOff";

interface WebSocketStatusProps {
  /** True when the browser is online AND the WebSocket is connected. */
  isOnline: boolean;
}

/**
 * Connection status chip: a subdued green "Online" chip while connected, an
 * amber "Offline" chip otherwise. Keeping the green chip visible when online
 * (rather than hiding it) gives admins continuous feedback.
 */
export function WebSocketStatus({ isOnline }: WebSocketStatusProps) {
  const label = isOnline ? "Online" : "Offline";
  return (
    <Tooltip
      title={
        isOnline
          ? "Connected — real-time updates active."
          : "You are offline — real-time updates paused."
      }
    >
      <Box role="status" aria-live="polite">
        <Chip
          icon={isOnline ? <CloudDoneIcon /> : <CloudOffIcon />}
          label={label}
          size="small"
          color={isOnline ? "success" : "warning"}
          variant="outlined"
          aria-label={`Connection status: ${label}`}
        />
      </Box>
    </Tooltip>
  );
}
