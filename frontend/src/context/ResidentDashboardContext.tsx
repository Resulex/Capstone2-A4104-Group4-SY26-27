"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ResidentDashboardData,
  fetchResidentDashboardData,
} from "@/lib/resident";
import type { DocumentQueueRecord, NotificationRecord } from "@/lib/admin";

interface ResidentDashboardContextValue {
  /** Aggregated resident dashboard data (empty arrays while loading). */
  data: ResidentDashboardData;
  /** True while the initial fetch is in flight. */
  isLoading: boolean;
  /** Non-null only when the fetch fails outright (per-endpoint errors are swallowed). */
  error: string | null;
  /** Re-run the initial fetch (e.g. after submitting a new request). */
  reload: () => void;
  /** Optimistically prepend a newly created document request to shared state. */
  addDocumentRequestLocal: (record: DocumentQueueRecord) => void;
  /** Optimistically set a notification's read state in shared state. */
  setNotificationReadLocal: (id: string, isRead: boolean) => void;
  /** Optimistically prepend a real-time notification to shared state. */
  addNotificationLocal: (notification: NotificationRecord) => void;
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

  const addDocumentRequestLocal = (record: DocumentQueueRecord) => {
    setData((prev) => {
      // Avoid duplicating a record that already exists in the snapshot (e.g.
      // if the refetch in `reload()` has already populated it).
      const exists = prev.documentRequests.some(
        (r) => r.requestId === record.requestId,
      );
      if (exists) return prev;
      return { ...prev, documentRequests: [record, ...prev.documentRequests] };
    });
  };

  const setNotificationReadLocal = (id: string, isRead: boolean) => {
    setData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.notificationId === id || n._id === id ? { ...n, isRead } : n,
      ),
    }));
  };

  const addNotificationLocal = useCallback((notification: NotificationRecord) => {
    setData((prev) => {
      // Avoid duplicating a notification that already arrived via the poll/WS.
      const exists = prev.notifications.some(
        (n) =>
          n.notificationId === notification.notificationId ||
          n._id === notification._id,
      );
      if (exists) return prev;
      return { ...prev, notifications: [notification, ...prev.notifications] };
    });
  }, []);

  const value: ResidentDashboardContextValue = {
    data,
    isLoading,
    error,
    reload: () => setVersion((v) => v + 1),
    addDocumentRequestLocal,
    setNotificationReadLocal,
    addNotificationLocal,
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
