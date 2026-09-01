"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ResidentDashboardData,
  fetchResidentDashboardData,
} from "@/lib/resident";

interface ResidentDashboardContextValue {
  /** Aggregated resident dashboard data (empty arrays while loading). */
  data: ResidentDashboardData;
  /** True while the initial fetch is in flight. */
  isLoading: boolean;
  /** Non-null only when the fetch fails outright (per-endpoint errors are swallowed). */
  error: string | null;
  /** Re-run the initial fetch (e.g. after submitting a new request). */
  reload: () => void;
  /** Optimistically set a notification's read state in shared state. */
  setNotificationReadLocal: (id: string, isRead: boolean) => void;
}

const ResidentDashboardContext = createContext<ResidentDashboardContextValue | null>(
  null,
);

const EMPTY_DATA: ResidentDashboardData = {
  announcements: [],
  notifications: [],
  documentRequests: [],
  incidentReports: [],
  chatSessions: [],
  officials: [],
};

/**
 * Fetches the resident's dashboard data once and shares it across the resident
 * shell, so the header notification badge and the dashboard page read from a
 * single request rather than refetching independently.
 */
export function ResidentDashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ResidentDashboardData>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const result = await fetchResidentDashboardData();
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load resident data.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  const setNotificationReadLocal = (id: string, isRead: boolean) => {
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.notificationId === id || n._id === id ? { ...n, isRead } : n,
      ),
    }));
  };

  const value: ResidentDashboardContextValue = {
    data,
    isLoading,
    error,
    reload: () => setVersion((v) => v + 1),
    setNotificationReadLocal,
  };

  return (
    <ResidentDashboardContext.Provider value={value}>
      {children}
    </ResidentDashboardContext.Provider>
  );
}

/** Consume shared resident dashboard data. Throws if used outside the provider. */
export function useResidentDashboard(): ResidentDashboardContextValue {
  const context = useContext(ResidentDashboardContext);
  if (!context) {
    throw new Error(
      "useResidentDashboard must be used within a ResidentDashboardProvider",
    );
  }
  return context;
}
