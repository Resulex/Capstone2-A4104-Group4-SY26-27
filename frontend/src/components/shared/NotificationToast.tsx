"use client";

import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

/**
 * How long a notification toast stays on screen — and how much time it gets
 * back once the pointer (or keyboard focus) leaves it.
 */
const TOAST_DURATION_MS = 10_000;
/** Progress-bar refresh step: smooth for a 4px bar without a rAF loop. */
const TICK_MS = 100;

interface ShownNotification {
  /** Identity of the notification whose copy is currently rendered. */
  key: string | null;
  title?: string;
  body: string;
  /**
   * Click-through for the currently rendered notification, cached alongside the
   * copy so the exit animation keeps pointing at the same record.
   */
  onOpen?: () => void;
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
  /**
   * Open the record this notification points at. Omit when the notification has
   * no destination — the toast is then not clickable and shows no affordance.
   */
  onOpen?: () => void;
  /** Alert max width in px. */
  maxWidth?: number;
}

/**
 * Transient toast for a real-time notification.
 *
 * Shared by the admin and resident shells so the behaviour cannot drift between
 * the two. A progress bar along the bottom edge shows how much of the display
 * time is left, so the toast never disappears without warning, and clicking it
 * opens the record it is about.
 *
 * The countdown is driven HERE rather than by MUI's `autoHideDuration`: the bar
 * has to show the very same clock that closes the toast, and MUI's internal
 * pause-on-hover is invisible from the outside, so delegating the timer would
 * let the two drift apart. `autoHideDuration={null}` stops MUI from starting a
 * second, competing timer, while Escape and click-away still arrive through
 * `onClose`. Hovering (or focusing) the toast holds the countdown and leaving it
 * grants a fresh full duration — the behaviour this toast had when MUI owned
 * the timer.
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
  onOpen,
  maxWidth = 400,
}: NotificationToastProps) {
  const open = notificationKey !== null;
  const [shown, setShown] = useState<ShownNotification>({
    key: null,
    body: "",
  });
  const [remainingMs, setRemainingMs] = useState(TOAST_DURATION_MS);
  const [paused, setPaused] = useState(false);

  // Refs, so exactly one interval runs per notification even though both shells
  // pass freshly created callbacks on every render.
  const remainingRef = useRef(TOAST_DURATION_MS);
  const pausedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  if (open && shown.key !== notificationKey) {
    setShown({ key: notificationKey, title, body, onOpen });
  }

  useEffect(() => {
    if (!open) return;

    remainingRef.current = TOAST_DURATION_MS;
    setRemainingMs(TOAST_DURATION_MS);
    pausedRef.current = false;
    setPaused(false);

    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      remainingRef.current -= TICK_MS;
      if (remainingRef.current <= 0) {
        remainingRef.current = 0;
        setRemainingMs(0);
        window.clearInterval(timer);
        onCloseRef.current();
        return;
      }
      setRemainingMs(remainingRef.current);
    }, TICK_MS);

    return () => window.clearInterval(timer);
    // Keyed on `shown.key` rather than `notificationKey`: the countdown restarts
    // once the new copy is committed, the same signal that remounts the Snackbar.
  }, [open, shown.key]);

  const handlePause = () => {
    pausedRef.current = true;
    setPaused(true);
  };

  const handleResume = () => {
    pausedRef.current = false;
    setPaused(false);
    remainingRef.current = TOAST_DURATION_MS;
    setRemainingMs(TOAST_DURATION_MS);
  };

  const handleActivate = (event: React.MouseEvent | React.KeyboardEvent) => {
    // The dismiss button lives inside the Alert: closing must not navigate.
    if ((event.target as HTMLElement).closest(".MuiAlert-action")) return;
    if (!shown.onOpen) return;
    shown.onOpen();
    onClose();
  };

  return (
    <Snackbar
      key={shown.key ?? "empty"}
      open={open}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      // The toast owns the countdown (see the component docs above).
      autoHideDuration={null}
      onClose={onClose}
    >
      {/* The Alert keeps its own `role="alert"`, so the notification is still
          announced — the click-through is exposed as a real button inside it,
          and the whole toast is clickable as a convenience for mouse users. */}
      <Alert
        severity="info"
        variant="filled"
        onClose={onClose}
        onMouseEnter={handlePause}
        onMouseLeave={handleResume}
        onFocus={handlePause}
        onBlur={handleResume}
        onClick={handleActivate}
        sx={{
          width: "100%",
          maxWidth,
          position: "relative",
          overflow: "hidden",
          pb: 2,
          cursor: shown.onOpen ? "pointer" : "default",
        }}
      >
        {shown.title ? (
          <>
            <strong>{shown.title}</strong> — {shown.body}
          </>
        ) : (
          shown.body
        )}
        {shown.onOpen && (
          <Box
            role="button"
            tabIndex={0}
            aria-label={`${shown.title ?? "Notification"} — open the record`}
            onClick={(event) => {
              // Without this the click would bubble into the Alert's own
              // handler and navigate twice.
              event.stopPropagation();
              handleActivate(event);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              handleActivate(event);
            }}
            sx={{
              mt: 0.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontWeight: 700,
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            {/* View
            <ArrowForwardIcon sx={{ fontSize: 16 }} /> */}
          </Box>
        )}
        {/* Time left before this toast closes itself. Decorative for screen
            readers: the toast is announced once, and the bar only re-states the
            same window. */}
        <LinearProgress
          variant="determinate"
          value={(remainingMs / TOAST_DURATION_MS) * 100}
          aria-hidden
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 4,
            bgcolor: "rgba(255, 255, 255, 0.25)",
            "& .MuiLinearProgress-bar": {
              bgcolor: "common.white",
              // Dimmed while held, so a paused toast is obvious.
              opacity: paused ? 0.45 : 0.85,
              transition: "opacity 150ms linear",
            },
          }}
        />
      </Alert>
    </Snackbar>
  );
}
