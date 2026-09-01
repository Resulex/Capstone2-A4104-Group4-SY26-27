import { getApi } from "@/lib/api";

/**
 * Dashboard data derived from the backend's list endpoints.
 *
 * Because the backend exposes no aggregate/stats endpoint yet, the counters and
 * table rows are computed client-side by fetching the (admin-unscoped) lists
 * and filtering/sorting on their status fields.
 */

/** A single incident report row (fields needed by the dashboard tables). */
export interface IncidentReportRecord {
  incidentId: string;
  incidentCategory: string;
  descriptionText: string;
  locationDetails: string;
  triagePriority: string;
  incidentStatus: string;
  reportedAt: string;
}

/** A single document request row (fields needed by the recent-documents queue). */
export interface DocumentRequestRecord {
  requestId: string;
  applicantDetails?: { fullName?: string };
  documentType: string;
  purpose: string;
  currentStatus: string;
  dateRequested: string;
}

interface UserRecord {
  isActive?: boolean;
}

/** Aggregated snapshot powering the whole dashboard (all camelCase). */
export interface DashboardData {
  /** Incidents with `incidentStatus === "Pending"`. */
  pendingIncidents: number;
  /** Document requests with `currentStatus === "Submitted"`. */
  pendingDocuments: number;
  /** Users with `isActive === true`. */
  activeUsers: number;
  /** Incidents currently open (`Pending` or `Responding`), newest first. */
  activeIncidents: IncidentReportRecord[];
  /** Most recently requested documents, newest first (capped). */
  recentDocuments: DocumentRequestRecord[];
}

/** Maximum number of rows to show in the recent-documents queue. */
const RECENT_DOCUMENTS_LIMIT = 6;

/**
 * Fetch and aggregate all dashboard data in parallel.
 *
 * Each list is fetched independently so a single failing endpoint degrades
 * gracefully (that section reports empty) rather than failing the whole page.
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  const [incidents, documents, users] = await Promise.all([
    fetchIncidents(),
    fetchDocuments(),
    fetchUsers(),
  ]);

  const activeIncidents = incidents
    .filter(
      (r) => r.incidentStatus === "Pending" || r.incidentStatus === "Responding",
    )
    .sort(
      (a, b) =>
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
    );

  const recentDocuments = documents
    .slice()
    .sort(
      (a, b) =>
        new Date(b.dateRequested).getTime() -
        new Date(a.dateRequested).getTime(),
    )
    .slice(0, RECENT_DOCUMENTS_LIMIT);

  return {
    pendingIncidents: incidents.filter((r) => r.incidentStatus === "Pending")
      .length,
    pendingDocuments: documents.filter((r) => r.currentStatus === "Submitted")
      .length,
    activeUsers: users.filter((r) => r.isActive === true).length,
    activeIncidents,
    recentDocuments,
  };
}

async function fetchIncidents(): Promise<IncidentReportRecord[]> {
  try {
    return await getApi<IncidentReportRecord[]>("incident-reports");
  } catch {
    return [];
  }
}

async function fetchDocuments(): Promise<DocumentRequestRecord[]> {
  try {
    return await getApi<DocumentRequestRecord[]>("document-requests");
  } catch {
    return [];
  }
}

async function fetchUsers(): Promise<UserRecord[]> {
  try {
    return await getApi<UserRecord[]>("users");
  } catch {
    return [];
  }
}
