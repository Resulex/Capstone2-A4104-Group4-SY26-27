import { deleteApi, getApi, patchApi, postApi } from "@/lib/api";

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

/** A document request record for the queue page. */
export interface DocumentQueueRecord {
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
  paymentStatus?: string;
  dateRequested: string;
  verificationIdUrl?: string;
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
  body: { currentStatus?: string; paymentStatus?: string },
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
  body: { triagePriority?: string; incidentStatus?: string },
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

/** Load a session's message thread (oldest first) via POST /messages/search. */
export async function searchMessages(
  sessionId: string,
): Promise<ChatMessageRecord[]> {
  try {
    return await postApi<ChatMessageRecord[]>("messages/search", { sessionId });
  } catch {
    return [];
  }
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
