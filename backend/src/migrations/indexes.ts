import type { Db, IndexDescription } from 'mongodb';

type IndexSpec = IndexDescription;

/**
 * Shared index definitions for the KaBarangayConnect collections.
 * `up` creates them; `down` drops them.
 */
export const SEEDED_INDEXES: Record<string, IndexSpec[]> = {
  residents: [
    { name: 'unique_residentId', key: { residentId: 1 }, unique: true },
    { name: 'unique_emailAddress', key: { emailAddress: 1 }, unique: true },
    { name: 'idx_residents_barangay', key: { barangay: 1 } },
    { name: 'idx_residents_name', key: { lastName: 1, firstName: 1 } },
    { name: 'idx_residents_purok', key: { streetPurokName: 1 } },
    { name: 'idx_residents_status', key: { accountStatus: 1 } },
  ],
  admins: [
    { name: 'unique_adminId', key: { adminId: 1 }, unique: true },
    { name: 'unique_adminUserName', key: { userName: 1 }, unique: true },
    { name: 'unique_adminEmail', key: { emailAddress: 1 }, unique: true },
    { name: 'idx_admins_role', key: { assignedRole: 1 } },
    { name: 'idx_admins_status', key: { accountStatus: 1 } },
  ],
  announcements: [
    { name: 'unique_announcementId', key: { announcementId: 1 }, unique: true },
    { name: 'idx_announcements_author', key: { authorId: 1 } },
    { name: 'idx_announcements_priority', key: { priorityLevel: 1, createdAt: -1 } },
    { name: 'idx_announcements_hidden', key: { isHidden: 1 } },
  ],
  officials: [
    { name: 'unique_officialId', key: { officialId: 1 }, unique: true },
    { name: 'unique_officialEmail', key: { emailAddress: 1 }, unique: true },
    { name: 'idx_officials_position', key: { designatedPosition: 1 } },
    { name: 'idx_officials_deleted', key: { isDeleted: 1 } },
  ],
  documentrequests: [
    { name: 'unique_requestId', key: { requestId: 1 }, unique: true },
    { name: 'idx_docreq_resident', key: { residentId: 1 } },
    { name: 'idx_docreq_status', key: { currentStatus: 1 } },
    { name: 'idx_docreq_type_date', key: { documentType: 1, dateRequested: -1 } },
    { name: 'idx_docreq_verifiedBy', key: { verifiedBy: 1 } },
    { name: 'idx_docreq_payment', key: { paymentStatus: 1 } },
  ],
  incidentreports: [
    { name: 'unique_incidentId', key: { incidentId: 1 }, unique: true },
    { name: 'idx_incident_resident', key: { residentId: 1 } },
    { name: 'idx_incident_status_priority', key: { incidentStatus: 1, triagePriority: 1 } },
    { name: 'idx_incident_category', key: { incidentCategory: 1 } },
    { name: 'idx_incident_reportedAt', key: { reportedAt: -1 } },
  ],
  chatsessions: [
    { name: 'unique_sessionId', key: { sessionId: 1 }, unique: true },
    { name: 'idx_session_incident', key: { incidentId: 1 } },
    { name: 'idx_session_resident', key: { residentId: 1 } },
    { name: 'idx_session_admin', key: { adminId: 1 } },
    { name: 'idx_session_active', key: { incidentId: 1, isActive: 1 } },
    { name: 'idx_session_lastActivity', key: { lastActivity: -1 } },
  ],
  messages: [
    { name: 'unique_messageId', key: { messageId: 1 }, unique: true },
    { name: 'idx_message_session', key: { sessionId: 1 } },
    { name: 'idx_message_sender', key: { senderId: 1 } },
    { name: 'idx_message_session_time', key: { sessionId: 1, sentTimestamp: 1 } },
    { name: 'idx_message_urgency', key: { urgencyFlag: 1 } },
  ],
  notifications: [
    { name: 'unique_notificationId', key: { notificationId: 1 }, unique: true },
    { name: 'idx_notification_recipient', key: { recipientId: 1 } },
    { name: 'idx_notification_unread', key: { recipientId: 1, isRead: 1 } },
    { name: 'idx_notification_createdAt', key: { createdAt: -1 } },
  ],
};

/**
 * Creates all indexes for every seeded collection.
 */
export async function createSeededIndexes(db: Db): Promise<void> {
  for (const [collection, indexes] of Object.entries(SEEDED_INDEXES)) {
    await db.collection(collection).createIndexes(indexes);
  }
}

/**
 * Drops all indexes that were created by createSeededIndexes.
 */
export async function dropSeededIndexes(db: Db): Promise<void> {
  for (const [collection, indexes] of Object.entries(SEEDED_INDEXES)) {
    for (const index of indexes) {
      if (!index.name) continue;
      try {
        await db.collection(collection).dropIndex(index.name);
      } catch {
        // Index may not exist; safe to ignore.
      }
    }
  }
}