import { getApi, patchApi, postApi } from "@/lib/api";
import {
  AnnouncementRecord,
  ChatSessionRecord,
  DocumentQueueRecord,
  IncidentRecord,
  NotificationRecord,
  OfficialRecord,
  fetchAnnouncements,
  fetchChatSessions,
  fetchDocumentRequests,
  fetchIncidentReports,
  fetchNotifications,
  fetchOfficials,
} from "@/lib/admin";

/**
 * Resident-facing data types + fetch helpers.
 *
 * Reuses the typed record shapes from `admin.ts` (they mirror the backend list
 * endpoints) and adds the resident-specific helpers the resident UI needs:
 * submitting document requests / incident reports, marking notifications read,
 * and the aggregated dashboard snapshot shared by the resident shell.
 */

/** Resident public profile (the `user` payload from the Google-SSO callback). */
export interface ResidentProfile {
  _id?: string;
  residentId?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  suffix?: string;
  emailAddress?: string;
  contactNumber?: string;
  houseUnitNumber?: string;
  streetPurokName?: string;
  barangay?: string | null;
  city?: string;
  province?: string;
  zipCode?: string;
  profileImageUrl?: string;
  accountStatus?: string;
  googleEmail?: string;
  isProvisioned?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Aggregated snapshot fetched once for the resident shell. Both the header
 * (unread-notification badge) and the dashboard page read from this single
 * source instead of issuing their own requests.
 */
export interface ResidentDashboardData {
  announcements: AnnouncementRecord[];
  notifications: NotificationRecord[];
  documentRequests: DocumentQueueRecord[];
  incidentReports: IncidentRecord[];
  chatSessions: ChatSessionRecord[];
  officials: OfficialRecord[];
}

/**
 * Static placeholder barangay contact details shown on the dashboard hero and
 * quick actions. The backend Barangay model currently exposes no contact/address
 * fields, so these are display constants until a dedicated endpoint exists.
 */
export const BARANGAY_CONTACT = {
  /** Main barangay hall phone line shown in the hero. */
  hotline: "(049) 1234 567",
  /** Barangay hall address shown in the hero and location card. */
  address: "Purok 2 Barangay Labuin, Pila, Laguna",
  /** Emergency hotline dialed from the quick action. */
  emergencyHotline: "(02) 123-4567",
  /** Maps URL used by the "Get Directions" location card action. */
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Purok+2+Barangay+Labuin+Pila+Laguna",
};

/**
 * Static placeholder barangay office information shown on the Officials page
 * (office hours + main office + emergency contacts). The backend Barangay model
 * exposes no such fields, so these are display constants for now.
 */
export const BARANGAY_OFFICE_INFO = {
  officeHours: [
    "Monday–Friday: 8:00 AM – 5:00 PM",
    "Saturday: 8:00 AM – 12:00 PM",
    "Sunday: Closed",
  ],
  mainOffice: "Barangay Hall, Purok 2, Labuin, Pila, Laguna",
  emergencyHotline: "(049) 123-4567",
  emergencyMobile: "+63 912 123 4567",
};

/** LocalStorage key under which the resident profile is persisted. */
const PROFILE_STORAGE_KEY = "kbc_resident_profile";

/**
 * Aggregated dashboard fetch. Every underlying helper already swallows its own
 * errors (returning `[]`), so this never rejects — the shell always renders
 * with whatever data is available and empty states elsewhere.
 */
export async function fetchResidentDashboardData(): Promise<ResidentDashboardData> {
  const [announcements, notifications, documentRequests, incidentReports, chatSessions, officials] =
    await Promise.all([
      fetchAnnouncements(),
      fetchNotifications(),
      fetchDocumentRequests(),
      fetchIncidentReports(),
      fetchChatSessions(),
      fetchOfficials(),
    ]);

  return { announcements, notifications, documentRequests, incidentReports, chatSessions, officials };
}

/** Count of unread notifications (for the header badge). */
export function countUnread(notifications: NotificationRecord[]): number {
  return notifications.filter((n) => !n.isRead).length;
}

/** Latest N announcements, newest first. */
export function latestAnnouncements(
  announcements: AnnouncementRecord[],
  limit = 3,
): AnnouncementRecord[] {
  return [...announcements]
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? b.eventDate ?? 0).getTime() -
        new Date(a.createdAt ?? a.eventDate ?? 0).getTime(),
    )
    .slice(0, limit);
}

/** Mark a notification as read via PATCH (own record only). */
export async function markNotificationRead(id: string): Promise<NotificationRecord> {
  return patchApi<NotificationRecord>(`notifications/${encodeURIComponent(id)}`, {
    isRead: true,
  });
}

/**
 * Submit a new document request. `requestId` is client-generated (the backend
 * does not mint one); the resident owner is derived from the JWT by the
 * backend, so no `residentId` is required.
 */
export async function createDocumentRequest(body: {
  requestId: string;
  documentType: string;
  purpose: string;
  expectedCompletionDate?: string;
  verificationIdUrl?: string;
}): Promise<DocumentQueueRecord> {
  return postApi<DocumentQueueRecord>("document-requests", body);
}

/**
 * Submit a new incident report. Self-reporting only — the backend derives the
 * resident owner from the JWT, so no `residentId` is required.
 */
export async function createIncidentReport(body: {
  incidentId: string;
  incidentCategory: string;
  descriptionText: string;
  locationDetails: string;
  evidenceMediaUrls?: string[];
}): Promise<IncidentRecord> {
  return postApi<IncidentRecord>("incident-reports", body);
}

/**
 * A document request as returned by `GET /document-requests/{id}` — the list
 * records omit the `timeline` and reviewer details.
 */
export interface DocumentRequestDetail extends DocumentQueueRecord {
  residentId?: string;
  timeline?: { step?: string; date?: string; status?: string }[];
  verifiedBy?: string;
  verifiedAt?: string;
  officialReceiptNumber?: string;
}

/** Fetch a single document request (own record only). */
export async function fetchDocumentRequest(
  id: string,
): Promise<DocumentRequestDetail | null> {
  try {
    return await getApi<DocumentRequestDetail>(
      `document-requests/${encodeURIComponent(id)}`,
    );
  } catch {
    return null;
  }
}

/** Fetch a single incident report (own record only). */
export async function fetchIncidentReport(
  id: string,
): Promise<IncidentRecord | null> {
  try {
    return await getApi<IncidentRecord>(
      `incident-reports/${encodeURIComponent(id)}`,
    );
  } catch {
    return null;
  }
}

/** Fetch a single announcement by custom `announcementId` or `_id`. */
export async function fetchAnnouncement(
  id: string,
): Promise<AnnouncementRecord | null> {
  try {
    return await getApi<AnnouncementRecord>(
      `announcements/${encodeURIComponent(id)}`,
    );
  } catch {
    return null;
  }
}

/** Document types offered on the "New Document Request" form. */
export const DOCUMENT_TYPES = [
  "Barangay Clearance",
  "Certificate of Residency",
  "Certificate of Indigency",
  "Barangay Business Permit",
  "Certificate of Good Moral Character",
  "Barangay ID",
  "Other",
];

/** Purposes offered on the "New Document Request" form. */
export const DOCUMENT_PURPOSES = [
  "Employment / Job Application",
  "Business / Permit Application",
  "School Requirement",
  "Financial / Government Assistance",
  "Legal / Court Requirement",
  "Other",
];

/** Incident categories supported by the backend incident-report model. */
export const INCIDENT_CATEGORIES = [
  "Fire",
  "Flood",
  "Medical Emergency",
  "Criminal Activity",
  "Road Accident",
  "Domestic Dispute",
  "Infrastructure Damage",
  "Public Disturbance",
  "Other",
];

/**
 * Derive a display priority (HIGH / MEDIUM / LOW) from a notification's
 * category, since the backend notification model has no priority field.
 */
export function notificationPriority(
  notification: NotificationRecord,
): string {
  switch (notification.notificationCategory) {
    case "incidentAlert":
      return "HIGH";
    case "systemMessage":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

/** RFC4122 v4 UUID (client-generated resource IDs for new records). */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Format an ISO timestamp as a short readable date, e.g. "September 11, 2025". */
export function formatDisplayDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Format an ISO timestamp as a compact relative-ish label (date + time). */
export function formatDateTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Derive display initials from a resident profile (falls back to "R"). */
export function getResidentInitials(profile: ResidentProfile | null): string {
  const first = profile?.firstName?.trim();
  const last = profile?.lastName?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  return "R";
}

/** Persist the resident profile (PII is kept client-side; backend GET is broken). */
export function saveResidentProfile(profile: ResidentProfile | null): void {
  try {
    if (typeof window === "undefined") return;
    if (profile) {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } else {
      window.localStorage.removeItem(PROFILE_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode); the profile just won't persist.
  }
}

/** Read the persisted resident profile, or null. */
export function loadResidentProfile(): ResidentProfile | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ResidentProfile) : null;
  } catch {
    return null;
  }
}
