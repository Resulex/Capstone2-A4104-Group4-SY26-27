import type { Db, IndexDescription } from 'mongodb';

type IndexSpec = IndexDescription;

/**
 * Shared index definitions for the KaBarangayConnect collections.
 * `up` creates them; `down` drops them.
 */
export const SEEDED_INDEXES: Record<string, IndexSpec[]> = {
  residents: [
    // `sparse: true` so Google-SSO residents (which have no `residentId`)
    // are not subject to the unique constraint — otherwise only one resident
    // without a `residentId` could ever be inserted.
    { name: 'unique_residentId', key: { residentId: 1 }, unique: true, sparse: true },
    { name: 'unique_emailAddress', key: { emailAddress: 1 }, unique: true },
    { name: 'idx_residents_barangay', key: { barangay: 1 } },
    { name: 'idx_residents_name', key: { lastName: 1, firstName: 1 } },
    { name: 'idx_residents_purok', key: { streetPurokName: 1 } },
    { name: 'idx_residents_status', key: { accountStatus: 1 } },
    // Serves the Residents page's Active/Archived (SUPER_ADMIN) scopes; the
    // residents collection had no index on its soft-delete flag before.
    { name: 'idx_residents_deleted', key: { isDeleted: 1 } },
    // Sparse: only resident-initiated deletions carry a date, and the daily
    // finalization sweep looks up exactly the records that do.
    { name: 'idx_residents_deletionScheduled', key: { deletionScheduledFor: 1 }, sparse: true },
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
    { name: 'idx_announcements_archived', key: { isArchived: 1 } },
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
    // Archived view sorts by the request date, so the compound key matches the
    // one query that scans the whole archived set.
    { name: 'idx_docreq_archived', key: { isArchived: 1, dateRequested: -1 } },
  ],
  incidentreports: [
    { name: 'unique_incidentId', key: { incidentId: 1 }, unique: true },
    { name: 'idx_incident_resident', key: { residentId: 1 } },
    { name: 'idx_incident_status_priority', key: { incidentStatus: 1, triagePriority: 1 } },
    { name: 'idx_incident_category', key: { incidentCategory: 1 } },
    { name: 'idx_incident_reportedAt', key: { reportedAt: -1 } },
    // Matches the list handler's sort, so the archived scope is a covering scan.
    { name: 'idx_incident_archived', key: { isArchived: 1, reportedAt: -1 } },
  ],
  chatsessions: [
    { name: 'unique_sessionId', key: { sessionId: 1 }, unique: true },
    { name: 'idx_session_incident', key: { incidentId: 1 } },
    { name: 'idx_session_resident', key: { residentId: 1 } },
    { name: 'idx_session_admin', key: { adminId: 1 } },
    { name: 'idx_session_active', key: { incidentId: 1, isActive: 1 } },
    { name: 'idx_session_lastActivity', key: { lastActivity: -1 } },
    // Matches the chat list handler's sort for the archived scope.
    { name: 'idx_session_archived', key: { isArchived: 1, lastActivity: -1 } },
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
 * Mongo error codes that mean "an EQUIVALENT index already exists under a
 * different name" (85 IndexOptionsConflict / 86 IndexKeySpecsConflict).
 */
const EQUIVALENT_INDEX_EXISTS = new Set([85, 86]);

/**
 * Creates all indexes for every seeded collection.
 *
 * Each index is created INDIVIDUALLY and a clash with an already-equivalent
 * index is tolerated, for two reasons:
 *
 * 1. `createIndexes` fails the whole batch on the first conflict, so one shadowed
 *    name used to abort every migration that reused this helper.
 * 2. The clash is expected. The Mongoose models declare `unique`/`sparse` fields
 *    whose auto-generated names (`residentId_1`) legitimately shadow the
 *    registry's (`unique_residentId`) — `verify-migrations.ts` matches on key +
 *    options rather than name for exactly this reason, so treating a name
 *    difference as fatal would contradict the project's own rule.
 */
export async function createSeededIndexes(db: Db): Promise<void> {
  for (const [collection, indexes] of Object.entries(SEEDED_INDEXES)) {
    for (const index of indexes) {
      try {
        await db.collection(collection).createIndex(index.key, {
          name: index.name,
          ...(index.unique ? { unique: true } : {}),
          ...(index.sparse ? { sparse: true } : {}),
        });
      } catch (error) {
        const code = (error as { code?: number } | null)?.code;
        if (code !== undefined && EQUIVALENT_INDEX_EXISTS.has(code)) {
          console.log(
            `  note: ${collection}.${index.name} matches an existing index under another name; skipped.`
          );
          continue;
        }
        throw error;
      }
    }
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