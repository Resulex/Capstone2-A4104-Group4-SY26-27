"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWebSocket, type WebSocketStatus } from "@/hooks/useWebSocket";
import {
  NotificationRecord,
  applyReadState,
  collectUnreadReferences,
  fetchAdminWsToken,
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationsByReference,
  playNotificationSound,
  updateNotification,
} from "@/lib/admin";

interface AdminNotificationsContextValue {
  /** Every notification the signed-in admin owns, newest first. */
  notifications: NotificationRecord[];
  /** Unread notifications across all categories (the header bell). */
  unreadCount: number;
  /**
   * Unread *records* per queue, keyed by the notification's `referenceUrlId`.
   * A record with several unread notifications is counted once, so each set's
   * `size` is exactly the number of rows the matching queue should show bold.
   */
  unreadIncidentIds: Set<string>;
  unreadDocumentIds: Set<string>;
  unreadChatKeys: Set<string>;
  /** The notification currently raised as a toast, or null. */
  toast: NotificationRecord | null;
  dismissToast: () => void;
  /** Live socket state, surfaced by the header's online indicator. */
  connectionStatus: WebSocketStatus;
  /** Mark one notification read (the bell popover's per-row action). */
  markNotificationRead: (notificationId: string) => void;
  /** Mark every notification read (the bell's "Read all"). */
  markAllRead: () => void;
  /** Mark every notification behind the given records read/unread. */
  markRecordsRead: (referenceUrlIds: string[]) => void;
  markRecordsUnread: (referenceUrlIds: string[]) => void;
}

const AdminNotificationsContext =
  createContext<AdminNotificationsContextValue | null>(null);

/**
 * Owns the admin console's real-time notification state.
 *
 * Lives above both the shell and the routed pages because the shell renders the
 * bell/sidebar counters while the queue pages render the per-row unread styling —
 * they must read one shared list, or a row and its badge would disagree.
 *
 * "Unread" is derived from the per-admin `Notification` rows the backend already
 * writes (grouped by `referenceUrlId`), so it is per-admin by construction,
 * persists across reloads, and needs no extra schema. A record whose
 * notifications are all read — or that never had one — simply shows as read.
 *
 * Marking is optimistic: local state flips first and one request follows. A
 * failed write therefore stays wrong until the next load re-syncs, which matches
 * the existing single-notification behaviour.
 */
export function AdminNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [wsToken, setWsToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [toast, setToast] = useState<NotificationRecord | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  // The seed fetch REPLACES the list, so polling must not merge before it lands.
  const seededNotifIdsRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Authenticate the socket and seed the list from the server.
      const token = await fetchAdminWsToken();
      if (!cancelled) setWsToken(token);
      const mine = await fetchMyNotifications();
      if (!cancelled) {
        setNotifications(mine);
        for (const n of mine) {
          const id = n.notificationId ?? n._id ?? "";
          if (id) seenNotifIdsRef.current.add(id);
        }
        seededNotifIdsRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Merge one server notification into state, deduped by id so a socket
   * redelivery or a polling overlap cannot double-count.
   *
   * Every newly-seen notification is surfaced with a toast + chime, whether it
   * arrived over the socket or was picked up by the polling fallback. An earlier
   * version raised them only for socket-delivered items, so that "a reconnect
   * never replays old alerts" — but the dedupe below (plus the seed fetch
   * marking every pre-existing id as seen) already guarantees each notification
   * is surfaced at most once per page load, so that protection was redundant.
   * Its real effect was to make a dead push path undetectable: badges and bold
   * rows still updated from the poll while members of staff waited for a toast
   * and a chime that could never come. The resident shell has always presented
   * polled items, which is why residents looked fine while admins did not.
   */
  const mergeNotification = useCallback((incoming: NotificationRecord) => {
    const key = incoming.notificationId ?? incoming._id ?? "";
    // Dedupe (a reconnect or a poll can redeliver an event we already surfaced).
    if (!key || seenNotifIdsRef.current.has(key)) return;
    seenNotifIdsRef.current.add(key);
    setNotifications((prev) => [incoming, ...prev]);
    setToast(incoming);
    playNotificationSound();
  }, []);

  const handleMessage = useCallback(
    (data: unknown) => {
      const message = data as {
        type?: string;
        notification?: NotificationRecord;
      };
      if (message?.type !== "notification" || !message.notification) return;
      mergeNotification(message.notification);
    },
    [mergeNotification],
  );

  const { connectionStatus } = useWebSocket({
    token: wsToken,
    onMessage: handleMessage,
  });

  /**
   * Polling fallback so the bell + queue badges still update when no WebSocket
   * is live: `serverless offline` without the `ws-*` routes, a dropped socket, or
   * a cold-start reconnect. The socket is the primary channel, so the cadence
   * relaxes while it is healthy but never stops — a push path that dies silently
   * (open socket, no messages) must still self-heal. A poll costs a full Lambda
   * invocation, so the relaxed interval matters in local dev. The shared dedupe
   * keeps any overlap harmless, and `mergeNotification` raises the same toast +
   * chime as a pushed item so this fallback is never the silent path it used to
   * be.
   */
  const pollIntervalMs = connectionStatus === "connected" ? 30_000 : 8_000;

  useEffect(() => {
    const tick = async () => {
      // Skip until the seed fetch has replaced the list at least once.
      if (!seededNotifIdsRef.current) return;
      const fresh = await fetchMyNotifications();
      for (const n of fresh) mergeNotification(n);
    };
    const timer = window.setInterval(() => void tick(), pollIntervalMs);
    return () => window.clearInterval(timer);
  }, [pollIntervalMs, mergeNotification]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === id ? { ...n, isRead: true } : n)),
    );
    void updateNotification(id, { isRead: true });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    void markAllNotificationsRead();
  }, []);

  const markRecordsRead = useCallback((referenceUrlIds: string[]) => {
    if (referenceUrlIds.length === 0) return;
    setNotifications((prev) => applyReadState(prev, referenceUrlIds, true));
    void markNotificationsByReference(referenceUrlIds, true);
  }, []);

  const markRecordsUnread = useCallback((referenceUrlIds: string[]) => {
    if (referenceUrlIds.length === 0) return;
    setNotifications((prev) => applyReadState(prev, referenceUrlIds, false));
    void markNotificationsByReference(referenceUrlIds, false);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );
  const unreadIncidentIds = useMemo(
    () => collectUnreadReferences(notifications, "incidentAlert"),
    [notifications],
  );
  const unreadDocumentIds = useMemo(
    () => collectUnreadReferences(notifications, "documentUpdate"),
    [notifications],
  );
  const unreadChatKeys = useMemo(
    () => collectUnreadReferences(notifications, "chatMessage"),
    [notifications],
  );

  const value = useMemo<AdminNotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      unreadIncidentIds,
      unreadDocumentIds,
      unreadChatKeys,
      toast,
      dismissToast,
      connectionStatus,
      markNotificationRead,
      markAllRead,
      markRecordsRead,
      markRecordsUnread,
    }),
    [
      notifications,
      unreadCount,
      unreadIncidentIds,
      unreadDocumentIds,
      unreadChatKeys,
      toast,
      dismissToast,
      connectionStatus,
      markNotificationRead,
      markAllRead,
      markRecordsRead,
      markRecordsUnread,
    ],
  );

  return (
    <AdminNotificationsContext.Provider value={value}>
      {children}
    </AdminNotificationsContext.Provider>
  );
}

/** Consume the admin notification state. Throws outside the provider. */
export function useAdminNotifications(): AdminNotificationsContextValue {
  const context = useContext(AdminNotificationsContext);
  if (!context) {
    throw new Error(
      "useAdminNotifications must be used within an AdminNotificationsProvider",
    );
  }
  return context;
}
