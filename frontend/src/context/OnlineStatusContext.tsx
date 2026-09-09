"use client";

import { createContext, ReactNode, useContext } from "react";

/**
 * Live connection status for the admin console.
 *
 * `true` means the browser has a network connection AND the real-time
 * WebSocket is connected. Consumers (e.g. the Document Queue or Triage Chat)
 * can read this via `useOnlineStatus()` to disable submit actions when the
 * network drops.
 */
const OnlineStatusContext = createContext<boolean>(true);

export function OnlineStatusProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return (
    <OnlineStatusContext.Provider value={value}>
      {children}
    </OnlineStatusContext.Provider>
  );
}

/** Returns whether the admin console is currently online. */
export function useOnlineStatus(): boolean {
  return useContext(OnlineStatusContext);
}
