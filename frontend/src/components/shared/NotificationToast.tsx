"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";

/**
 * How long a notification toast stays on screen — and how much time it gets
 * back once the pointer (or keyboard focus) leaves it.
 */
const TOAST_DURATION_MS = 10_000;

interface ShownNotification {
  /** Identity of the notification whose copy is currently rendered. */
  key: string | null;
  title?: string;
  body: string;
}

interface NotificationToastProps {
  /**
   * Stable identity (`notificationId ?? _id`) of the notification on screen, or
   * `null` once it has been dismissed. A change means a NEW notification, which
   * remounts the Snackbar so it gets a full {@link TOAST_DURATION_MS} instead of
   * inheriting the remaining time of the previous one (MUI's auto-hide timer
   * effect keys on `[open, autoHideDuration]` and is otherwise left running).
   */
  notificationKey: string | null;
  /** Alert headline, rendered ahead of the body. Omit for a body-only toast. */
  title?: string;
  /** Alert message body. */
  body: string;
  /** Called on timeout, on the close button, on Escape, or on a click away. */
  onClose: () => void;
  /** Alert max width in px. */
  maxWidth?: number;
}

/**
 * Transient toast for a real-time notification.
 *
 * Shared by the admin and resident shells so the behaviour cannot drift between
 * the two. Hovering the toast pauses the auto-hide countdown and leaving it
 * resumes with another full duration — that pause/resume is MUI's own behaviour
 * (`useSnackbar` wires `onMouseEnter` to clear the timer and `onMouseLeave` to
 * restart it), so no custom timer is needed here.
 *
 * The last notification is cached while the toast plays its exit animation,
 * because both callers null their toast state as soon as it is dismissed: a key
 * change at that moment would unmount the Snackbar and skip the Grow exit, and
 * re-rendering from the caller's now-null state would blank the copy mid-exit.
 */
export function NotificationToast({
  notificationKey,
  title,
  body,
  onClose,
  maxWidth = 400,
}: NotificationToastProps) {
  const open = notificationKey !== null;
  const [shown, setShown] = useState<ShownNotification>({
    key: null,
    body: "",
  });

  if (open && shown.key !== notificationKey) {
    setShown({ key: notificationKey, title, body });
  }

  return (
    <Snackbar
      key={shown.key ?? "empty"}
      open={open}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      autoHideDuration={TOAST_DURATION_MS}
      // Restart at a full duration after the pointer leaves, rather than MUI's
      // default of half the auto-hide duration.
      resumeHideDuration={TOAST_DURATION_MS}
      onClose={onClose}
    >
      <Alert
        severity="info"
        variant="filled"
        onClose={onClose}
        sx={{ width: "100%", maxWidth }}
      >
        {shown.title ? (
          <>
            <strong>{shown.title}</strong> — {shown.body}
          </>
        ) : (
          shown.body
        )}
      </Alert>
    </Snackbar>
  );
}
