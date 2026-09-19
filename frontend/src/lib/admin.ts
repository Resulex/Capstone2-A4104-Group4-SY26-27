import { deleteApi, fetchJson, getApi, patchApi, postApi } from "@/lib/api";

/**
 * Data types + fetch helpers for the admin residents and document-request
 * management pages. These are derived from the backend's list endpoints.
 */

/** A resident record (fields exposed by the backend's public JSON). */
export interface ResidentRecord {
  _id?: string;
  residentId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  emailAddress: string;
  contactNumber?: string;
  houseUnitNumber?: string;
  streetPurokName?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  profileImageUrl?: string;
  accountStatus: string;
  isProvisioned: boolean;
  createdAt: string;
}

/** The admin/official who made a status change (captured at change time). */
export interface TimelineActor {
  userId: string;
  fullName: string;
}

/** One entry of a record's status-change history (oldest first). */
export interface TimelineEntry {
  step?: string;
  date?: string;
  status?: string;
  /** Admin note recorded with this transition. */
  remarks?: string;
  /** Who made the change — shown to admins only. */
  changedBy?: TimelineActor;
  /** Original report (`INC-...`) when the entry marks a duplicate. */
  duplicateOfIncidentId?: string;
}

/** A document request record for the queue page. */
export interface DocumentQueueRecord {
  /**
   * Mongo id. The list endpoint returns the whole document, so this is present
   * at runtime; it is also accepted when a notification deep-links here.
   */
  _id?: string;
  requestId: string;
  applicantDetails?: {
    fullName?: string;
    contactNumber?: string;
    emailAddress?: string;
  };
  documentType: string;
  purpose: string;
  currentStatus: string;
  expectedCompletionDate?: string;
  dateRequested: string;
  verificationIdUrl?: string;
  remarks?: string;
  /** Processing history (oldest first) with remarks per status. */
  timeline?: TimelineEntry[];
}

/** An incident report record (fields exposed by the list endpoint). */
export interface IncidentRecord {
  _id?: string;
  incidentId: string;
  residentId: string;
  incidentCategory: string;
  descriptionText: string;
  locationDetails: string;
  triagePriority: string;
  evidenceMediaUrls?: string[];
  incidentStatus: string;
  /** Latest status-change remark. */
  remarks?: string;
  /** Status-change history (oldest first) with remarks per status. */
  timeline?: TimelineEntry[];
  /** Original report this one duplicates (`INC-...`) while status is Duplicate. */
  duplicateOfIncidentId?: string;
  reportedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

/** An announcement record. */
export interface AnnouncementRecord {
  _id?: string;
  announcementId: string;
  titleText: string;
  descriptionContent: string;
  priorityLevel: string;
  authorId: string;
  imageUrl?: string;
  eventDate?: string;
  isHidden: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** A barangay official record. */
export interface OfficialRecord {
  _id?: string;
  officialId: string;
  fullName: string;
  designatedPosition: string;
  contactNumber: string;
  emailAddress: string;
  officeLocation: string;
  coreResponsibilities?: string[];
  profileImageUrl?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** A notification record. */
export interface NotificationRecord {
  _id?: string;
  notificationId: string;
  recipientId: string;
  notificationCategory: string;
  titleText: string;
  messageBody: string;
  referenceUrlId?: string;
  isRead: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** A chat session record. */
export interface ChatSessionRecord {
  _id?: string;
  sessionId: string;
  incidentId: string;
  residentId: string;
  adminId: string;
  isActive: boolean;
  deviceInfo?: { os: string; browser: string; model?: string };
  ipAddress: string;
  messageCount: number;
  startedAt?: string;
  lastActivity?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** A chat message record. */
export interface ChatMessageRecord {
  _id?: string;
  messageId: string;
  sessionId: string;
  senderId: string;
  isUser: boolean;
  messageText: string;
  formattedContent?: string;
  urgencyFlag?: boolean;
  sentTimestamp?: string;
  createdAt?: string;
  updatedAt?: string;
  /**
   * Client-side only: an optimistic echo the server has not confirmed yet.
   * Never sent to the backend and never present on a server response.
   */
  pending?: boolean;
  /** Client-side only: an optimistic echo whose send failed. */
  failed?: boolean;
}

/** An admin account record (used for recipient resolution and settings). */
export interface AdminRecord {
  _id?: string;
  adminId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  userName: string;
  emailAddress: string;
  assignedRole: string;
  accountStatus: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Fetch all residents (admin sees all; backend scopes by role). */
export async function fetchResidents(): Promise<ResidentRecord[]> {
  try {
    return await getApi<ResidentRecord[]>("residents");
  } catch {
    return [];
  }
}

/** Fetch all document requests, newest first. */
export async function fetchDocumentRequests(): Promise<DocumentQueueRecord[]> {
  try {
    const records = await getApi<DocumentQueueRecord[]>("document-requests");
    return records.sort(
      (a, b) =>
        new Date(b.dateRequested).getTime() -
        new Date(a.dateRequested).getTime(),
    );
  } catch {
    return [];
  }
}

/** Fetch a single resident by id (for the edit form). */
export async function fetchResident(id: string): Promise<ResidentRecord | null> {
  try {
    return await getApi<ResidentRecord>(`residents/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

/** Update a resident's fields via PATCH. */
export async function updateResident(
  id: string,
  body: Partial<ResidentRecord> & { accountStatus?: string },
): Promise<ResidentRecord> {
  return patchApi<ResidentRecord>(`residents/${encodeURIComponent(id)}`, body);
}

/** Update a document request's status via PATCH. */
export async function updateDocumentRequest(
  id: string,
  body: { currentStatus?: string; remarks?: string },
): Promise<DocumentQueueRecord> {
  return patchApi<DocumentQueueRecord>(
    `document-requests/${encodeURIComponent(id)}`,
    body,
  );
}

/** Fetch all incident reports (admin sees all; backend scopes by role). */
export async function fetchIncidentReports(): Promise<IncidentRecord[]> {
  try {
    return await getApi<IncidentRecord[]>("incident-reports");
  } catch {
    return [];
  }
}

/** Fetch all announcements, newest first (backend already sorts). */
export async function fetchAnnouncements(): Promise<AnnouncementRecord[]> {
  try {
    return await getApi<AnnouncementRecord[]>("announcements");
  } catch {
    return [];
  }
}

/** Fetch all active officials (backend excludes archived records). */
export async function fetchOfficials(): Promise<OfficialRecord[]> {
  try {
    return await getApi<OfficialRecord[]>("officials");
  } catch {
    return [];
  }
}

/** Fetch a single official by id (for the edit form). */
export async function fetchOfficial(
  id: string,
): Promise<OfficialRecord | null> {
  try {
    return await getApi<OfficialRecord>(`officials/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

/** Update an incident report's status/priority via PATCH. */
export async function updateIncidentReport(
  id: string,
  body: {
    triagePriority?: string;
    incidentStatus?: string;
    remarks?: string;
    duplicateOfIncidentId?: string;
  },
): Promise<IncidentRecord> {
  return patchApi<IncidentRecord>(
    `incident-reports/${encodeURIComponent(id)}`,
    body,
  );
}

/** Update an announcement's fields via PATCH. */
export async function updateAnnouncement(
  id: string,
  body: {
    titleText?: string;
    descriptionContent?: string;
    priorityLevel?: string;
    imageUrl?: string;
    eventDate?: string;
    isHidden?: boolean;
  },
): Promise<AnnouncementRecord> {
  return patchApi<AnnouncementRecord>(
    `announcements/${encodeURIComponent(id)}`,
    body,
  );
}

/** Update an official's fields via PATCH. */
export async function updateOfficial(
  id: string,
  body: Partial<OfficialRecord>,
): Promise<OfficialRecord> {
  return patchApi<OfficialRecord>(
    `officials/${encodeURIComponent(id)}`,
    body,
  );
}

/** Fetch all notifications, newest first (backend already sorts). */
export async function fetchNotifications(): Promise<NotificationRecord[]> {
  try {
    return await getApi<NotificationRecord[]>("notifications");
  } catch {
    return [];
  }
}

/** Fetch only the caller's own notifications, newest first. */
export async function fetchMyNotifications(): Promise<NotificationRecord[]> {
  try {
    return await getApi<NotificationRecord[]>("notifications/mine");
  } catch {
    return [];
  }
}

/** Mark all of the caller's notifications as read. */
export async function markAllNotificationsRead(): Promise<number> {
  const data = await patchApi<{ updated?: number }>("notifications/read-all", {});
  return data?.updated ?? 0;
}

/**
 * Set the read state of every notification pointing at the given records
 * (`INC-…` / `REQ-…` / `chat-…`). Lets a record be marked seen — or unread
 * again — in one round trip instead of one PATCH per notification. The backend
 * scopes the update to the caller's own notifications, so the same call is
 * correct for an admin and for a resident.
 */
export async function markNotificationsByReference(
  referenceUrlIds: string[],
  isRead = true,
): Promise<number> {
  const data = await patchApi<{ updated?: number }>(
    "notifications/read-by-reference",
    { referenceUrlIds, isRead },
  );
  return data?.updated ?? 0;
}

/**
 * Distinct `referenceUrlId`s of the unread notifications in one category.
 *
 * Both portals model "unread" the same way — a *record* is unread while the
 * caller still has unread notifications pointing at it — and a record can carry
 * several (created, then one per status change), so badges and rows must count
 * references, not notification rows.
 */
export function collectUnreadReferences(
  notifications: NotificationRecord[],
  category: string,
): Set<string> {
  const references = new Set<string>();
  for (const n of notifications) {
    if (!n.isRead && n.notificationCategory === category && n.referenceUrlId) {
      references.add(n.referenceUrlId);
    }
  }
  return references;
}

/** Apply a read state to every notification behind a set of references. */
export function applyReadState(
  notifications: NotificationRecord[],
  referenceUrlIds: string[],
  isRead: boolean,
): NotificationRecord[] {
  const targets = new Set(referenceUrlIds);
  return notifications.map((n) =>
    n.referenceUrlId && targets.has(n.referenceUrlId) ? { ...n, isRead } : n,
  );
}

/**
 * True when any of the given keys has an unread notification.
 *
 * A record may be referenced by more than one key over time — chat sessions in
 * particular, where notifications written before the switch to the session id
 * carry the incident's Mongo `_id` instead.
 */
export function hasUnreadReference(
  unreadReferences: Set<string>,
  keys: (string | undefined)[],
): boolean {
  return keys.some((key) => (key ? unreadReferences.has(key) : false));
}

/** Play a short notification chime via the Web Audio API (no asset file). */
export function playNotificationSound(): void {
  if (typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(1174.66, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.45);
}

/** Fetch the admin session JWT for authenticating the WebSocket connection. */
export async function fetchAdminWsToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/admin/ws-token", {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { token?: string } };
    return body?.data?.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Request an admin password-reset email (sent by the backend via Amazon SES).
 * `/api/auth/admin/*` is proxied by a `next.config.ts` rewrite to the backend,
 * so — like `fetchAdminWsToken` — these deliberately bypass the `/api/backend`
 * helpers, which only wrap business endpoints.
 */
export async function requestAdminPasswordReset(email: string): Promise<void> {
  await fetchJson("/api/auth/admin/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Complete an admin password reset with the token from the emailed link. */
export async function confirmAdminPasswordReset(body: {
  token: string;
  newPassword: string;
}): Promise<void> {
  await fetchJson("/api/auth/admin/forgot-password/confirm", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Mark a notification read/unread via PATCH. */
export async function updateNotification(
  id: string,
  body: { isRead?: boolean },
): Promise<NotificationRecord> {
  return patchApi<NotificationRecord>(
    `notifications/${encodeURIComponent(id)}`,
    body,
  );
}

/** Delete a notification via DELETE. */
export async function deleteNotification(id: string): Promise<void> {
  await deleteApi<{ deleted?: string }>(
    `notifications/${encodeURIComponent(id)}`,
  );
}

/** Fetch all chat sessions (admins see all), most recent activity first. */
export async function fetchChatSessions(): Promise<ChatSessionRecord[]> {
  try {
    return await getApi<ChatSessionRecord[]>("chat-sessions");
  } catch {
    return [];
  }
}

/** Update a chat session's active status via PATCH. */
export async function updateChatSession(
  id: string,
  body: { isActive?: boolean },
): Promise<ChatSessionRecord> {
  return patchApi<ChatSessionRecord>(
    `chat-sessions/${encodeURIComponent(id)}`,
    body,
  );
}

/** Create a chat session for an incident (responder-initiated triage). */
export async function createChatSession(body: {
  sessionId: string;
  incidentId: string;
  residentId: string;
  deviceInfo: { os: string; browser: string; model?: string };
  ipAddress: string;
}): Promise<ChatSessionRecord> {
  return postApi<ChatSessionRecord>("chat-sessions", body);
}

/**
 * Load a session's message thread (oldest first) via POST /messages/search.
 *
 * Errors PROPAGATE on purpose. Swallowing them (the previous
 * `catch { return [] }`) made a rejected read — a 400/401/502 from the backend
 * — indistinguishable from a genuinely empty thread, so the UI reported
 * "No messages yet." for sessions that had history.
 */
export async function searchMessages(
  sessionId: string,
): Promise<ChatMessageRecord[]> {
  return postApi<ChatMessageRecord[]>("messages/search", { sessionId });
}

/** Send a chat message via POST /messages. */
export async function sendMessage(body: {
  messageId: string;
  sessionId: string;
  messageText: string;
  formattedContent?: string;
}): Promise<ChatMessageRecord> {
  return postApi<ChatMessageRecord>("messages", body);
}

/** Fetch all admin accounts (for notification recipient resolution). */
export async function fetchAdmins(): Promise<AdminRecord[]> {
  try {
    return await getApi<AdminRecord[]>("admins");
  } catch {
    return [];
  }
}

/** Update an admin account (profile/password) via PATCH. */
export async function updateAdmin(
  id: string,
  body: Partial<AdminRecord> & { password?: string },
): Promise<AdminRecord> {
  return patchApi<AdminRecord>(`admins/${encodeURIComponent(id)}`, body);
}

/**
 * Change the signed-in admin's OWN password via PATCH /auth/admin/password.
 * The endpoint is self-scoped to the session JWT, so no admin id is passed.
 * The backend verifies `currentPassword` against Cognito before applying
 * `newPassword` — unlike `updateAdmin`, which is the admin-management route a
 * SUPER_ADMIN uses to reset someone else (and so has no old password).
 */
export async function changeAdminPassword(body: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ message?: string }> {
  return patchApi<{ message?: string }>("auth/admin/password", body);
}

/**
 * Create a new admin account via POST /admins (top-tier 'Admin' role only).
 * The backend generates the admin id and emails a temporary password, so
 * neither `adminId` nor `password` is accepted here.
 *
 * `inviteDelivery` reports where the invitation came from — 'ses' (our branded
 * email), 'cognito' (fallback) or 'failed'. A delivery problem never fails the
 * request, so the UI must surface it.
 */
export async function createAdmin(body: {
  firstName: string;
  lastName: string;
  middleName?: string;
  userName: string;
  emailAddress: string;
  phoneNumber?: string;
  assignedRole?: "SUPER_ADMIN" | "OPERATIONS_CLERK" | "INFO_OFFICER";
  accountStatus?: "active" | "suspended" | "deactivated";
}): Promise<AdminRecord & { inviteDelivery?: "ses" | "cognito" | "failed" }> {
  return postApi<AdminRecord & { inviteDelivery?: "ses" | "cognito" | "failed" }>(
    "admins",
    body,
  );
}

/** Create an announcement via POST. */
export async function createAnnouncement(body: {
  announcementId: string;
  titleText: string;
  descriptionContent: string;
  priorityLevel?: string;
  imageUrl?: string;
  eventDate?: string;
  isHidden?: boolean;
}): Promise<AnnouncementRecord> {
  return postApi<AnnouncementRecord>("announcements", body);
}

/** Create a barangay official via POST. */
export async function createOfficial(body: {
  officialId: string;
  fullName: string;
  designatedPosition: string;
  contactNumber: string;
  emailAddress: string;
  officeLocation: string;
  coreResponsibilities?: string[];
  profileImageUrl?: string;
}): Promise<OfficialRecord> {
  return postApi<OfficialRecord>("officials", body);
}
