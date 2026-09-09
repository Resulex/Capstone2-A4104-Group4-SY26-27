"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSessionConfig,
  readLastActive,
  touchLastActive,
  type SessionRole,
} from "@/lib/session";

/** How often the idle check runs. */
const TICK_MS = 1000;
/** High-frequency activity (mousemove/scroll) is flushed to storage at most this often. */
const PERSIST_THROTTLE_MS = 5000;

interface UseIdleSessionOptions {
  /** Which role's inactivity window applies (admin vs resident). */
  role: SessionRole;
  /** Arm tracking only while true (e.g. the user is authenticated as the role). */
  enabled: boolean;
  /** Called exactly once when the session has been idle for the full window. */
  onExpire: () => void;
}

export interface UseIdleSessionResult {
  /** Whether the "session expiring" countdown dialog should be visible. */
  warningVisible: boolean;
  /** Whole seconds remaining until forced sign-out (meaningful while warningVisible). */
  secondsRemaining: number;
  /** Reset the inactivity window (used by the "Stay signed in" action). */
  staySignedIn: () => void;
}

/**
 * Enforces a role-based inactivity timeout.
 *
 * The idle clock is stored in localStorage (see `lib/session`) so the window
 * is preserved across page reloads and synchronized across tabs of the same
 * role. It resets only on real user gestures — mouse, keyboard, scroll,
 * touch, or returning to the tab — never on background traffic (polling,
 * websockets). Shortly before the limit a warning is surfaced, and when the
 * limit is reached `onExpire` fires once.
 */
export function useIdleSession({
  role,
  enabled,
  onExpire,
}: UseIdleSessionOptions): UseIdleSessionResult {
  const config = getSessionConfig(role);
  const [warningVisible, setWarningVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // Latest known activity for this mount, mirrored to localStorage.
  const lastActiveRef = useRef<number | null>(null);
  const lastPersistedRef = useRef(0);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const fireExpire = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    setWarningVisible(false);
    onExpireRef.current();
  }, []);

  const staySignedIn = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;
    lastPersistedRef.current = now;
    expiredRef.current = false;
    setWarningVisible(false);
    touchLastActive(role, now);
  }, [role]);

  useEffect(() => {
    if (!enabled) {
      setWarningVisible(false);
      return;
    }

    // Seed the window from storage on (re)mount, or start it fresh.
    const now = Date.now();
    const stored = readLastActive(role);
    lastActiveRef.current = stored ?? now;
    lastPersistedRef.current = now;
    if (stored === null) {
      touchLastActive(role, now);
    }

    // Already idle past the limit (e.g. the app was reopened hours later):
    // sign out before any listener can reset the clock.
    if (now - lastActiveRef.current >= config.idleMs) {
      fireExpire();
      return;
    }
    expiredRef.current = false;
    setWarningVisible(false);

    const recordActivity = (forcePersist: boolean) => {
      const t = Date.now();
      lastActiveRef.current = t;
      expiredRef.current = false;
      setWarningVisible(false);
      if (forcePersist || t - lastPersistedRef.current >= PERSIST_THROTTLE_MS) {
        lastPersistedRef.current = t;
        touchLastActive(role, t);
      }
    };

    // Discrete user gestures reset the window immediately and persist it.
    const discreteNames = [
      "pointerdown",
      "keydown",
      "click",
      "wheel",
      "touchstart",
    ] as const;
    const handleDiscrete = () => recordActivity(true);

    // Continuous input (mouse movement / scrolling) also counts, but storage
    // writes are throttled to avoid churn.
    const handleContinuous = () => recordActivity(false);

    // Another same-role tab updated the timestamp.
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== config.storageKey || !event.newValue) return;
      const parsed = Number(event.newValue);
      if (Number.isFinite(parsed)) {
        lastActiveRef.current = parsed;
        expiredRef.current = false;
        setWarningVisible(false);
      }
    };

    // Returning to a visible/focused tab: if it sat idle past the limit,
    // sign out before the first input can reset it; otherwise resume.
    const resumeIfFresh = () => {
      const idleSince = Date.now() - (lastActiveRef.current ?? Date.now());
      if (idleSince >= config.idleMs) {
        fireExpire();
      } else {
        recordActivity(true);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") resumeIfFresh();
    };

    discreteNames.forEach((name) =>
      window.addEventListener(name, handleDiscrete, true),
    );
    window.addEventListener("mousemove", handleContinuous, true);
    window.addEventListener("scroll", handleContinuous, true);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", resumeIfFresh);
    document.addEventListener("visibilitychange", handleVisibility);

    const timer = window.setInterval(() => {
      const idle = Date.now() - (lastActiveRef.current ?? Date.now());
      if (idle >= config.idleMs) {
        fireExpire();
        return;
      }
      if (idle >= config.warnMs) {
        setWarningVisible(true);
        setSecondsRemaining(Math.ceil((config.idleMs - idle) / 1000));
      } else {
        setWarningVisible(false);
      }
    }, TICK_MS);

    return () => {
      discreteNames.forEach((name) =>
        window.removeEventListener(name, handleDiscrete, true),
      );
      window.removeEventListener("mousemove", handleContinuous, true);
      window.removeEventListener("scroll", handleContinuous, true);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", resumeIfFresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(timer);
      setWarningVisible(false);
    };
  }, [enabled, role, config, fireExpire]);

  return { warningVisible, secondsRemaining, staySignedIn };
}
