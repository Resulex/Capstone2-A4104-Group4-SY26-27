import { deleteApi, fetchJson, getApi, patchApi, postApi } from "@/lib/api";
import type { AssignedAdminRole } from "@/lib/rbac";

/**
 * Data types + fetch helpers for the admin residents and document-request
 * management pages. These are derived from the backend's list endpoints.
 */

/**
 * Which slice of a record set a queue page is showing.
 *
 * `active` is the default everywhere. Archived records are hidden from every
 * normal list — including the owning resident's own view — and the backend
 * answers `archived` with a 403 unless the caller is a SUPER_ADMIN, so the
 * toggle that produces this value is only ever rendered for one role.
 */
export type ArchiveScope = "active" | "archived";

/** The archive columns the four newer collections expose. */
export interface ArchiveMetadata {
  /** True while the record is retired from every queue. */
  isArchived?: boolean;
  /** When it was archived. */
  archivedAt?: string;
  /** Admin id of the super admin who archived it (audit only). */
  archivedBy?: string;
  /** Optional note the archiver supplied. */
  archivedReason?: string;
}

/**
 * The collections that support archive / restore. Used as the path segment, so
 * the union is what stops a typo from reaching the backend as a silent 404.
 */
export type ArchivableResource =
  | "incident-reports"
  | "document-requests"
  | "announcements"
  | "chat-sessions"
  | "residents"
  | "officials";

/**
 * Whether a record is archived, whichever column carries the flag.
 *
 * Residents and officials predate the archive feature and store the flag as
 * `isDeleted`/`deletedAt`; everything else uses `isArchived`/`archivedAt`. One
 * accessor keeps the six queue pages from each re-deriving that rule (and from
 * getting it wrong for exactly one of them).
 */
export function isRecordArchived(record: {
  isArchived?: boolean;
  isDeleted?: boolean;
}): boolean {
  return record.isArchived === true || record.isDeleted === true;
}

/** When a record was archived, whichever column carries the date. */
export function recordArchivedAt(record: {
  archivedAt?: string;
  deletedAt?: string;
}): string | undefined {
  return record.archivedAt ?? record.deletedAt;
}

/** Appends the archive scope to a collection path for `getApi`. */
function withScope(path: string, scope: ArchiveScope): string {
  return `${path}?scope=${scope}`;
}

/** Resident account states the backend can store. */
export type ResidentAccountStatus = "active" | "suspended" | "deactivated";

/**
 * Chip colours per account status. Deliberately local (rather than the shared
 * `StatusChip`) so admin-only status colours do not change resident-facing
 * screens; mirrors the mapping used by the staff page.
 */
export const RESIDENT_STATUS_COLORS: Record<
  ResidentAccountStatus,
  "success" | "warning" | "error"
> = {
  active: "success",
  suspended: "warning",
  deactivated: "error",
};

/**
 * Deletion states a RESIDENT can put their own account into, derived from the
 * three backend timestamps. Distinct from `isDeleted`, which is the admin
 * soft-delete that hides the row from this list entirely.
 */
export type ResidentDeletionState = "none" | "pending" | "deleted";

/** Chip colours for the resident-initiated deletion state. */
export const RESIDENT_DELETION_COLORS: Record<
  ResidentDeletionState,
  "default" | "warning" | "error"
> = {
  none: "default",
  pending: "warning",
  deleted: "error",
};

/** Which resident-initiated deletion state a record is in. */
export function residentDeletionState(
  resident: Pick<
    ResidentRecord,
    "deletionRequestedAt" | "deletionFinalizedAt"
  >,
): ResidentDeletionState {
  if (resident.deletionFinalizedAt) return "deleted";
  return resident.deletionRequestedAt ? "pending" : "none";
}

/** Human label for a deletion state (chip text and detail-page copy). */
export function residentDeletionLabel(state: ResidentDeletionState): string {
  if (state === "deleted") return "Account deleted";
  return state === "pending" ? "Deletion requested" : "Active";
}

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
  accountStatus: ResidentAccountStatus;
  /** Admin note recorded with the latest account action. */
  statusReason?: string;
  /** Soft-delete flag — deleted residents are hidden from the list. */
  isDeleted?: boolean;
  deletedAt?: string;
  /** Admin id of the super admin who archived the account (audit only). */
  archivedBy?: string;
  /** Optional note recorded when the account was archived. */
  archivedReason?: string;
  /**
   * Resident-INITIATED deletion. Unlike `isDeleted` the resident stays visible
   * here (and can still sign in); only their own view of the records they filed
   * before `deletionRequestedAt` is hidden, and only their own writes to those
   * records are blocked. Nothing is removed for staff.
   */
  deletionRequestedAt?: string;
  /** When the 30-day recovery window closes and the deletion becomes permanent. */
  deletionScheduledFor?: string;
  /** Set once the deletion is permanent and can no longer be restored. */
  deletionFinalizedAt?: string;
  /** The resident's own free-text reason, shown to staff. */
  deletionReason?: string;
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
export interface DocumentQueueRecord extends ArchiveMetadata {
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
export interface IncidentRecord extends ArchiveMetadata {
  _id?: string;
  incidentId: string;
  residentId: string;
  incidentCategory: string;
  descriptionText: string;
  /**
   * Legacy free-text address. Present on records filed before the validated
   * purok field existed; new reports are not given one, so render through
   * `formatIncidentLocation` rather than reading it directly.
   */
  locationDetails?: string;
  /**
   * Validated purok the incident is in (one of the barangay's puroks), and the
   * free-text landmark note that supplements it. Both absent on reports filed
   * before the purok field existed.
   */
  purok?: string | null;
  landmark?: string | null;
  /**
   * Contact number captured with the report (digits only). Absent on reports
   * filed before the field existed and when the reporter's profile had none.
   */
  contactNumber?: string | null;
  /**
   * Pinned location from the incident map picker (WGS84 decimal degrees).
   * Absent on reports filed before the picker existed, and on any record created
   * before the backend stored coordinates.
   */
  latitude?: number | null;
  longitude?: number | null;
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

/**
 * The location line for an incident, in one place so every surface agrees.
 *
 * Newer reports carry a validated `purok` plus an optional free-text `landmark`;
 * older ones carry only the legacy `locationDetails` prose. Falling back keeps
 * the pre-purok records rendering without a migration or a special case.
 */
export function formatIncidentLocation(
  record: Pick<IncidentRecord, "purok" | "landmark" | "locationDetails">,
): string {
  const structured = [record.purok, record.landmark]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(" — ");

  return structured || record.locationDetails?.trim() || "";
}

/** An announcement record. */
export interface AnnouncementRecord extends ArchiveMetadata {
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
  /** Soft-delete flag — archived officials are hidden from the directory. */
  isDeleted?: boolean;
  /** Set alongside `isDeleted` when the official was archived. */
  deletedAt?: string;
  /** Admin id of the super admin who archived the official (audit only). */
  archivedBy?: string;
  /** Optional note recorded when the official was archived. */
  archivedReason?: string;
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
export interface ChatSessionRecord extends ArchiveMetadata {
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
  /**
   * Shared queue state: when the resident last wrote, and when any staff member
   * (admin or official) last replied. Together these are the team-wide "awaiting
   * reply" fact — see `needsReply()`. `null` is what the WebSocket payload sends
   * for a missing timestamp, so accept both forms.
   */
  lastResidentMessageAt?: string | null;
  lastStaffReplyAt?: string | null;
  lastStaffReplyByName?: string | null;
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

/** Admin account states the backend can store. */
export type AdminAccountStatus = "active" | "suspended" | "deactivated";

/**
 * Chip colours per admin account status. Deliberately local, for the same
 * reason as `RESIDENT_STATUS_COLORS` — resident-facing screens must not change.
 */
export const ADMIN_STATUS_COLORS: Record<
  AdminAccountStatus,
  "success" | "warning" | "error"
> = {
  active: "success",
  suspended: "warning",
  deactivated: "error",
};

/** An admin account record (used for recipient resolution and settings). */
export interface AdminRecord {
  _id?: string;
  adminId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  userName: string;
  emailAddress: string;
  assignedRole: AssignedAdminRole;
  accountStatus: AdminAccountStatus;
  /** Optional contact number (stored in Mongo only — never used for MFA). */
  phoneNumber?: string;
  /** SUPER_ADMIN note recorded with the latest account action. */
  statusReason?: string;
  /** Last successful sign-in. */
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Fetch residents (admin sees all; backend scopes by role).
 *
 * `scope` must stay "active" for every caller except the SUPER_ADMIN Archived
 * toggle — the backend 403s any other role that asks for `archived`.
 */
export async function fetchResidents(
  scope: ArchiveScope = "active",
): Promise<ResidentRecord[]> {
  try {
    return await getApi<ResidentRecord[]>(withScope("residents", scope));
  } catch {
    return [];
  }
}

/** Fetch document requests, newest first. */
export async function fetchDocumentRequests(
  scope: ArchiveScope = "active",
): Promise<DocumentQueueRecord[]> {
  try {
    const records = await getApi<DocumentQueueRecord[]>(
      withScope("document-requests", scope),
    );
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

/** Update a resident's fields via PATCH. Staff/admin may also change
 * `accountStatus`, `statusReason`, and the `isDeleted` soft-delete flag. */
export async function updateResident(
  id: string,
  body: Partial<ResidentRecord>,
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

/** Fetch incident reports, newest first (admin sees all; backend scopes by role). */
export async function fetchIncidentReports(
  scope: ArchiveScope = "active",
): Promise<IncidentRecord[]> {
  try {
    const records = await getApi<IncidentRecord[]>(
      withScope("incident-reports", scope),
    );
    // Newest first, mirroring `fetchDocumentRequests`. `reportedAt` is the
    // backend's indexed sort key and is the one date every record carries, so a
    // freshly filed report lands at the top instead of wherever Mongo's natural
    // order happens to put it. `|| 0` keeps a record missing the date last
    // rather than poisoning the comparator with NaN.
    return records.sort(
      (a, b) =>
        new Date(b.reportedAt || 0).getTime() -
        new Date(a.reportedAt || 0).getTime(),
    );
  } catch {
    return [];
  }
}

/** Fetch announcements, newest first (backend already sorts). */
export async function fetchAnnouncements(
  scope: ArchiveScope = "active",
): Promise<AnnouncementRecord[]> {
  try {
    return await getApi<AnnouncementRecord[]>(
      withScope("announcements", scope),
    );
  } catch {
    return [];
  }
}

/** Fetch officials (backend excludes archived records unless asked). */
export async function fetchOfficials(
  scope: ArchiveScope = "active",
): Promise<OfficialRecord[]> {
  try {
    return await getApi<OfficialRecord[]>(withScope("officials", scope));
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

/**
 * Archive a record (SUPER_ADMIN only).
 *
 * The actor and timestamp are stamped by the backend from the session, so this
 * helper deliberately accepts neither — the client must not be able to claim who
 * performed a governance action.
 */
export async function archiveRecord(
  resource: ArchivableResource,
  id: string,
  reason?: string,
): Promise<void> {
  const note = reason?.trim();
  await postApi<unknown>(`${resource}/${encodeURIComponent(id)}/archive`, {
    ...(note ? { reason: note } : {}),
  });
}

/**
 * Restore an archived record (SUPER_ADMIN only).
 *
 * A body is sent even though the endpoint ignores it: `postApi` sets
 * `Content-Type` only when there is one, and the Lambda proxy expects a JSON
 * payload on this method.
 */
export async function restoreRecord(
  resource: ArchivableResource,
  id: string,
): Promise<void> {
  await postApi<unknown>(`${resource}/${encodeURIComponent(id)}/restore`, {});
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

/**
 * Every id a chat session's notifications may carry.
 *
 * Notifications written before the reference was standardised on the session id
 * store the session's Mongo `_id`, or the linked incident's `_id` — so accept
 * every id a session is addressable by rather than requiring a migration.
 */
export function chatSessionReferenceKeys(
  session: ChatSessionRecord,
): string[] {
  return [session.sessionId, session._id, session.incidentId].filter(
    (key): key is string => Boolean(key),
  );
}

/**
 * Every id an incident report's notifications may carry.
 *
 * Same reason as {@link chatSessionReferenceKeys}: notifications written before
 * `referenceUrlId` was standardised on the `INC-…` id store the report's Mongo
 * `_id` instead, and the `normalize-incident-ids` migration could only rewrite
 * the rows it could match. Accepting both keys keeps a queue page's
 * "Unread only (n)" equal to the sidebar badge — which counts the raw
 * references — without needing another migration.
 */
export function incidentReferenceKeys(incident: IncidentRecord): string[] {
  return [incident.incidentId, incident._id].filter(
    (key): key is string => Boolean(key),
  );
}

/** Every id a document request's notifications may carry (`REQ-…` / `_id`). */
export function documentReferenceKeys(doc: DocumentQueueRecord): string[] {
  return [doc.requestId, doc._id].filter(
    (key): key is string => Boolean(key),
  );
}

/**
 * True when a chat session is waiting for a staff reply.
 *
 * This is the SHARED queue fact, derived from the session's own timestamps: the
 * resident wrote, and nobody has written back since. It is deliberately not a
 * `Notification.isRead` check — that flag is per-admin, so it can never tell a
 * teammate that somebody else already answered, and a session could otherwise
 * end up read by everyone and answered by no one.
 *
 * A session with no timestamps (dev data written before the fields existed) has
 * no recorded resident message, so it reads as NOT awaiting rather than sitting
 * permanently bold; `npm run migrate` backfills the real values.
 */
export function needsReply(session: ChatSessionRecord): boolean {
  if (!session.lastResidentMessageAt) return false;
  if (!session.lastStaffReplyAt) return true;
  return (
    new Date(session.lastResidentMessageAt).getTime() >
    new Date(session.lastStaffReplyAt).getTime()
  );
}

/**
 * Newest activity first — mirrors the backend's `{ lastActivity: -1 }` sort, so a
 * session that just moved keeps its place in the queue without a refetch.
 */
export function compareChatSessionsByRecency(
  a: ChatSessionRecord,
  b: ChatSessionRecord,
): number {
  return (
    new Date(b.lastActivity ?? 0).getTime() -
    new Date(a.lastActivity ?? 0).getTime()
  );
}

/**
 * The page's single chime context, created on first use.
 *
 * Deliberately SHARED. Browsers cap how many concurrent `AudioContext`s one
 * document may hold (Chrome ~6, Safari ~4), and this used to build a fresh one
 * per notification and never close it — so after a handful of alerts the chime
 * silently stopped for the rest of the session, which is the "the toast appears
 * but there is no sound" report. One context also gives the autoplay policy a
 * single thing to resume, instead of a new context that is born suspended.
 */
let chimeContext: AudioContext | null = null;
/** Whether the first-gesture listener below has been installed. */
let chimeArmed = false;

/** Build a chime context, or null in a browser without Web Audio. */
function createChimeContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/**
 * Get the chime context, creating it on first use, and ask it to start if the
 * browser is holding it suspended.
 *
 * Safe to call at any time: autoplay policy leaves a context built before the
 * document has been interacted with `suspended`, and `resume()` is how it is
 * allowed to start. Without a user gesture the promise simply stays pending
 * until there is one.
 */
function resumeChimeContext(): AudioContext | null {
  if (!chimeContext) chimeContext = createChimeContext();
  const ctx = chimeContext;
  if (ctx && ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Bring the chime up on the first user gesture of the page.
 *
 * An alert arriving before the admin has clicked anything cannot be heard — the
 * context is suspended and `resume()` will not resolve yet. Listening once for a
 * gesture means the console starts chiming as soon as it is touched, rather than
 * staying mute until some later, unrelated resume happens to uncork it.
 */
function armChimeOnFirstGesture(): void {
  if (chimeArmed || typeof window === "undefined") return;
  chimeArmed = true;
  const arm = () => {
    resumeChimeContext();
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
  };
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);
}

/** Play a short notification chime via the Web Audio API (no asset file). */
export function playNotificationSound(): void {
  armChimeOnFirstGesture();
  const ctx = resumeChimeContext();
  if (!ctx) return;
  // A suspended context's clock is frozen, so a tone scheduled now would either
  // be inaudible or — once the admin finally clicks — fire long after the alert
  // it was meant to announce. Drop this one; the gesture listener arms the next.
  if (ctx.state === "suspended") return;
  // A hair ahead of `currentTime` rather than exactly on it: the clock can be
  // mid-block, which clips the 20ms attack into an inaudible click.
  const now = ctx.currentTime + 0.02;
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

/** Fetch chat sessions (admins see all), most recent activity first. */
export async function fetchChatSessions(
  scope: ArchiveScope = "active",
): Promise<ChatSessionRecord[]> {
  try {
    return await getApi<ChatSessionRecord[]>(
      withScope("chat-sessions", scope),
    );
  } catch {
    return [];
  }
}

/**
 * Fetch all chat sessions, PROPAGATING errors.
 *
 * `fetchChatSessions()` above collapses a failure into `[]`, which is fine for a
 * page that renders "No chat sessions found." but wrong for SHARED queue state:
 * a transient 401/502 would read as "nothing needs a reply" and silently clear
 * every Live Chat badge. Anything deriving a badge from this list must be able to
 * keep the last good copy instead.
 */
export async function fetchChatSessionsStrict(): Promise<ChatSessionRecord[]> {
  return getApi<ChatSessionRecord[]>("chat-sessions");
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

/**
 * Fetch a single admin account (SUPER_ADMIN-only on the backend). Returns null
 * when the record is missing, mirroring `fetchResident`.
 */
export async function fetchAdmin(id: string): Promise<AdminRecord | null> {
  try {
    return await getApi<AdminRecord>(`admins/${encodeURIComponent(id)}`);
  } catch {
    return null;
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
