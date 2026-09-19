"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CloudOffIcon from "@mui/icons-material/CloudOff";

interface WebSocketStatusProps {
  /** False when the device itself has lost its network connection. */
  browserOnline: boolean;
  /** True only while the notification WebSocket is open and healthy. */
  socketConnected: boolean;
}

/**
 * Notification-delivery status chip.
 *
 * Deliberately NOT a plain "Online"/"Offline" indicator. The admin console
 * stays fully usable without the push channel — it is only *instant*
 * notifications that are affected, and the polling fallback still surfaces new
 * alerts a few seconds later. Calling that state "Offline" told admins the app
 * was broken when it was working, and it let a genuinely dead push channel pass
 * for an ordinary network blip for weeks (the 2026-09-20 WebSocket incident).
 *
 * A subdued green chip while connected — kept visible rather than hidden, so
 * the two states stay comparable at a glance — and amber otherwise:
 * - push channel down: alerts still arrive, just not instantly;
 * - device offline: nothing can be delivered at all, which is a different
 *   problem and gets its own wording.
 */
export function WebSocketStatus({
  browserOnline,
  socketConnected,
}: WebSocketStatusProps) {
  const live = browserOnline && socketConnected;

  const label = live
    ? "Live alerts"
    : browserOnline
      ? "No live alerts"
      : "Device offline";

  const tooltip = live
    ? "Connected — new alerts arrive instantly."
    : browserOnline
      ? "Not receiving live alerts. New ones still arrive, but they can take a few seconds — everything else works normally."
      : "This device is offline — no alerts can be delivered until the connection returns.";

  return (
    <Tooltip title={tooltip}>
      <Box role="status" aria-live="polite">
        <Chip
          icon={live ? <CloudDoneIcon /> : <CloudOffIcon />}
          label={label}
          size="small"
          color={live ? "success" : "warning"}
          variant="outlined"
          aria-label={`Notification delivery: ${label}`}
        />
      </Box>
    </Tooltip>
  );
}
