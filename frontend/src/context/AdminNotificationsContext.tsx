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
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { canViewNavItem } from "@/lib/rbac";
import {
  ChatSessionRecord,
  NotificationRecord,
  applyReadState,
  collectUnreadReferences,
  compareChatSessionsByRecency,
  fetchAdminWsToken,
  fetchChatSessionsStrict,
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationsByReference,
  needsReply,
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
  /**
   * Unread *chat records* for the signed-in admin — the PERSONAL half of chat
   * unread, used to guard clearing the caller's own bell rows.
   *
   * It is deliberately no longer what bolds a queue row or drives the badge: see
   * `chatSessions` / `awaitingReplyCount` for that. Note this means the Live Chat
   * badge and `markRecordsRead` move independently, which is intended — seeing a
   * reply is personal, answering it is shared.
   */
  unreadChatKeys: Set<string>;
  /**
   * The SHARED chat queue, newest activity first.
   *
   * Chat is the one queue whose outstanding work is a team fact rather than a
   * personal one: any staff member may answer, so "does this still need a reply"
   * cannot be derived from per-admin `notifications`. The shell needs this list to
   * badge the sidebar, which is why it lives here instead of in the chat page.
   */
  chatSessions: ChatSessionRecord[];
  /** Sessions no staff member has answered yet (the sidebar's Live Chat badge). */
  awaitingReplyCount: number;
  /** Re-read the shared queue, keeping the last good list if the call fails. */
  refreshChatSessions: () => Promise<void>;
  /** Merge a full session record (a REST result) into the shared queue. */
  upsertChatSession: (session: ChatSessionRecord) => void;
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
 * Chat is the exception, and it is why this provider also owns the session list.
 * A chat session is answered by whoever gets to it first, so the question its
 * queue must answer is "does this still need a reply?" — a fact about the
 * SESSION, not about one admin's inbox. Keeping that in per-admin `isRead` flags
 * let a session be read by every admin and answered by none. So the two are kept
 * apart on purpose: notifications still drive the bell (personal), while
 * `chatSessions` drives the awaiting-reply badge and row styling (shared).
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

  /**
   * The shared chat queue.
   *
   * Seeded once for roles that can open Live Chat, then kept current by
   * `chatSessionUpdated` pushes, plus a re-read whenever a chat notification
   * arrives — the self-healing path for when the socket is down but the
   * notification poll still works.
   */
  const [chatSessions, setChatSessions] = useState<ChatSessionRecord[]>([]);
  const chatFetchInFlightRef = useRef(false);
  const { profile } = useAdminProfile();
  // Fails closed on an unresolved role: no chat entry in the sidebar means no
  // badge to compute, and INFO_OFFICER must not address the queue at all.
  const canUseChatQueue = canViewNavItem(
    profile?.assignedRole,
    "/admin/chat-sessions",
  );

  /**
   * Re-read the shared queue.
   *
   * Overlapping calls are dropped: a burst of chat alerts would otherwise fan out
   * into a burst of Lambda invocations, and the call already in flight carries the
   * newest state. A failure KEEPS the last good list rather than clearing the
   * badge (see `fetchChatSessionsStrict`).
   */
  const refreshChatSessions = useCallback(async () => {
    if (!canUseChatQueue || chatFetchInFlightRef.current) return;
    chatFetchInFlightRef.current = true;
    try {
      const sessions = await fetchChatSessionsStrict();
      setChatSessions(sessions.sort(compareChatSessionsByRecency));
    } catch {
      // Transient failure — keep showing the queue we already have.
    } finally {
      chatFetchInFlightRef.current = false;
    }
  }, [canUseChatQueue]);

  useEffect(() => {
    void refreshChatSessions();
  }, [refreshChatSessions]);

  /**
   * Apply a pushed patch to one queue row.
   *
   * Merge-only: a session we do not hold yet is left to the next list read,
   * because the pushed payload carries just the queue-relevant fields — inserting
   * it would render a row with no resident and no incident to name it by.
   */
  const applyChatSessionPatch = useCallback(
    (patch: Partial<ChatSessionRecord> & { sessionId: string }) => {
      setChatSessions((prev) => {
        const index = prev.findIndex((s) => s.sessionId === patch.sessionId);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next.sort(compareChatSessionsByRecency);
      });
    },
    [],
  );

  /**
   * Merge a FULL session record into the queue.
   *
   * The REST results (create/update) carry every field, so an unknown session is
   * appended here — that is the difference from `applyChatSessionPatch`.
   */
  const upsertChatSession = useCallback((session: ChatSessionRecord) => {
    setChatSessions((prev) => {
      const index = prev.findIndex((s) => s.sessionId === session.sessionId);
      const next =
        index === -1
          ? [session, ...prev]
          : prev.map((s, i) => (i === index ? { ...s, ...session } : s));
      return next.sort(compareChatSessionsByRecency);
    });
  }, []);

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
        session?: Partial<ChatSessionRecord> & { sessionId?: string };
      };
      if (message?.type === "notification" && message.notification) {
        mergeNotification(message.notification);
        // A chat notification means the shared queue moved too. Re-read it rather
        // than guessing at the timestamps from the notification: the push below is
        // the instant path, and this is what heals a dead socket.
        if (message.notification.notificationCategory === "chatMessage") {
          void refreshChatSessions();
        }
        return;
      }
      if (message?.type === "chatSessionUpdated" && message.session?.sessionId) {
        applyChatSessionPatch(
          message.session as Partial<ChatSessionRecord> & { sessionId: string },
        );
      }
    },
    [mergeNotification, refreshChatSessions, applyChatSessionPatch],
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
  /**
   * The sidebar's Live Chat badge: outstanding WORK, not unread mail. Dropping to
   * zero the moment any teammate answers is the whole point — so this reads the
   * session list, never `unreadChatKeys`.
   */
  const awaitingReplyCount = useMemo(
    () => (canUseChatQueue ? chatSessions.filter(needsReply).length : 0),
    [canUseChatQueue, chatSessions],
  );

  const value = useMemo<AdminNotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      unreadIncidentIds,
      unreadDocumentIds,
      unreadChatKeys,
      chatSessions,
      awaitingReplyCount,
      refreshChatSessions,
      upsertChatSession,
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
      chatSessions,
      awaitingReplyCount,
      refreshChatSessions,
      upsertChatSession,
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
