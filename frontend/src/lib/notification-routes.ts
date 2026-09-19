import type { NotificationRecord } from "@/lib/admin";

/**
 * Which portal is rendering the link. The same notification is addressed by the
 * session's own id in the admin console, while the resident portal has a thread
 * route parameter for it.
 */
export type NotificationScope = "admin" | "resident";

/** A chat session's own id, e.g. `chat-1789270849578`. */
const SESSION_REF = /^chat[-_]/i;
/**
 * A Mongo `_id`. Chat notifications written before the switch to the session id
 * carry the referenced incident's `_id` instead, and the incident/document
 * ones can be addressed by `_id` too.
 */
const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Deep link for the record a notification points at.
 *
 * `referenceUrlId` is prefix-coded by the backend triggers (`INC-…`, `REQ-…`,
 * `chat-…`). The admin queues resolve whatever id they are handed — custom id,
 * Mongo `_id`, or the parent record's id — so the chat case can pass a legacy
 * reference straight through. The resident chat thread, by contrast, is a route
 * parameter, so only a real session id is safe to interpolate there; anything
 * else falls back to the session list instead of a URL that cannot resolve.
 *
 * Returns `null` only when there is nothing to open (never for the categories
 * the backend currently writes).
 */
export function notificationHref(
  notification: Pick<
    NotificationRecord,
    "notificationCategory" | "referenceUrlId"
  >,
  scope: NotificationScope,
): string | null {
  const id = notification.referenceUrlId?.trim();
  const admin = scope === "admin";

  switch (notification.notificationCategory) {
    case "chatMessage":
      if (admin) {
        return id
          ? `/admin/chat-sessions?session=${encodeURIComponent(id)}`
          : "/admin/chat-sessions";
      }
      return id && (SESSION_REF.test(id) || OBJECT_ID.test(id))
        ? `/chat/${encodeURIComponent(id)}`
        : "/chat";

    case "incidentAlert":
      if (!id) return admin ? "/admin/incidents" : "/incidents";
      return admin
        ? `/admin/incidents?incident=${encodeURIComponent(id)}`
        : `/incidents/${encodeURIComponent(id)}`;

    case "documentUpdate":
      if (!id) return admin ? "/admin/document-requests" : "/documents";
      return admin
        ? `/admin/document-requests?request=${encodeURIComponent(id)}`
        : `/documents/${encodeURIComponent(id)}`;

    case "systemMessage":
    default:
      // Nothing addressable — the notification centre IS the record here.
      return admin ? "/admin/notifications" : "/notifications";
  }
}
