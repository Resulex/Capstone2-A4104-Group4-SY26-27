"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { DashboardData, fetchDashboardData } from "@/lib/telemetry";

interface DashboardDataContextValue {
  /** Aggregated dashboard data (null while loading or on error). */
  dashboardData: DashboardData | null;
  /** True while the initial fetch is in flight. */
  isLoading: boolean;
  /** Non-null when the fetch fails outright (per-endpoint errors are swallowed). */
  error: string | null;
}

const DashboardDataContext = createContext<DashboardDataContextValue | null>(
  null,
);

/**
 * Fetches dashboard data once and shares it across the admin shell, so both
 * the header notification badge and the page's cards/tables read from a single
 * request rather than refetching independently.
 */
export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDashboardData();
        if (!cancelled) setDashboardData(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load dashboard data.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardDataContext.Provider value={{ dashboardData, isLoading, error }}>
      {children}
    </DashboardDataContext.Provider>
  );
}

/** Consume shared dashboard data. Throws if used outside the provider. */
export function useDashboardData(): DashboardDataContextValue {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error("useDashboardData must be used within a DashboardDataProvider");
  }
  return context;
}
