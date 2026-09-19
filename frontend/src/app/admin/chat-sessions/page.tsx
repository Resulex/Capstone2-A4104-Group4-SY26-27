"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ForumIcon from "@mui/icons-material/Forum";
import SendIcon from "@mui/icons-material/Send";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useAuth } from "@/context/AuthContext";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useAdminNotifications } from "@/context/AdminNotificationsContext";
import { useOnlineStatus } from "@/context/OnlineStatusContext";
import {
  ChatMessageRecord,
  ChatSessionRecord,
  IncidentRecord,
  ResidentRecord,
  chatSessionReferenceKeys,
  fetchIncidentReports,
  fetchResidents,
  hasUnreadReference,
  needsReply,
  searchMessages,
  sendMessage,
  updateChatSession,
  createChatSession,
} from "@/lib/admin";

function formatTime(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Route entry point.
 *
 * `useSearchParams()` must be read inside a `<Suspense>` boundary, otherwise
 * the static prerender of this route fails the production build with
 * "useSearchParams() should be wrapped in a suspense boundary". The inner
 * component owns the hook; this wrapper supplies the boundary.
 */
export default function ChatSessionsPage() {
  return (
    <Suspense fallback={null}>
      <ChatSessionsPageContent />
    </Suspense>
  );
}

/**
 * Admin Live Chat page — a two-panel chat: sessions on the left, the selected
 * session's message thread (with a reply box) on the right.
 */
function ChatSessionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const incidentParam = searchParams.get("incident");
  const sessionParam = searchParams.get("session");
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const isOnline = useOnlineStatus();
  const { profile } = useAdminProfile();
  /**
   * The name stamped on a reply this admin sends, matching how the backend's
   * `actorIdentity()` builds it. Only used for the optimistic echo — the server's
   * broadcast carries the authoritative name a moment later.
   */
  const adminDisplayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    profile?.userName ||
    "Staff";
  /**
   * The whole chat queue lives in the shared admin notifications context, not in
   * this page: the sidebar badge counts the same sessions, and only the context
   * receives the real-time push telling it a teammate answered.
   *
   * `sessions` is a local alias for that shared list, `markRecordsRead` still
   * clears this admin's own bell rows — seeing a reply is personal, answering it
   * is shared.
   */
  const {
    unreadChatKeys,
    chatSessions: sessions,
    awaitingReplyCount,
    refreshChatSessions,
    upsertChatSession,
    markRecordsRead,
  } = useAdminNotifications();

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [residentNames, setResidentNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [incidentLabels, setIncidentLabels] = useState<Map<string, string>>(
    new Map(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const sessionsRef = useRef<ChatSessionRecord[]>([]);
  // Guards against duplicate auto-creation when arriving from an incident row.
  const creatingIncidentRef = useRef<string | null>(null);
  // Guards against re-opening the same deep-linked session on every render.
  const openedSessionParamRef = useRef<string | null>(null);
  /**
   * The `?incident=` equivalent of `openedSessionParamRef`.
   *
   * The effect below now re-runs on every queue update — which real-time pushes
   * make frequent — so without this it would re-select the session and refetch its
   * thread on each one.
   */
  const openedIncidentParamRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  // The queue itself is seeded by the shared provider; this page only loads the
  // lookup tables that turn ids into names, and nudges a fresh read on arrival so
  // the list is authoritative when an admin opens Live Chat.
  useEffect(() => {
    let cancelled = false;
    void refreshChatSessions();
    (async () => {
      try {
        const [residentData, incidentData] = await Promise.all([
          fetchResidents(),
          fetchIncidentReports(),
        ]);
        if (!cancelled) {
          setIncidents(incidentData);
          setResidentNames(buildResidentMap(residentData));
          setIncidentLabels(buildIncidentMap(incidentData));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load chat sessions.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshChatSessions]);

  // Keep a ref of sessions so the polling effect doesn't reset on every send.
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // A thread that is open on screen is read: clear its unread reply as soon as
  // the notification arrives, rather than waiting for another row click. Guarded
  // by the unread set itself, so it fires once per reply instead of every poll.
  useEffect(() => {
    if (!selectedId) return;
    const session = sessions.find((s) => s.sessionId === selectedId);
    if (!session) return;
    const keys = chatSessionReferenceKeys(session);
    if (hasUnreadReference(unreadChatKeys, keys)) markRecordsRead(keys);
  }, [selectedId, sessions, unreadChatKeys, markRecordsRead]);

  // Poll the selected thread every few seconds for new messages. A failed poll
  // is ignored on purpose: it must never blank a thread that already loaded.
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(async () => {
      const current = sessionsRef.current.find(
        (s) => s.sessionId === selectedId,
      );
      if (!current) return;
      try {
        const msgs = await searchMessages(current._id ?? current.sessionId);
        setMessages(msgs);
      } catch {
        // Transient failure — keep showing the last good thread.
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const selectedSession =
    sessions.find((s) => s.sessionId === selectedId) ?? null;

  /**
   * A session is awaiting a reply while no staff member has answered the
   * resident's last message — the SHARED rule the sidebar badge uses.
   *
   * Deliberately not this admin's unread notifications: that flag cannot tell a
   * teammate somebody else answered, so a session could be read by all staff and
   * answered by none.
   */
  const visibleSessions = unreadOnly ? sessions.filter(needsReply) : sessions;
  /**
   * This admin's own unread chat notifications, which only the bell-clearing
   * action below uses. It can stay above zero on a session that is already
   * answered — seeing a reply and owing one are different things.
   */
  const personallyUnreadCount = sessions.filter((session) =>
    hasUnreadReference(unreadChatKeys, chatSessionReferenceKeys(session)),
  ).length;

  const loadMessages = async (session: ChatSessionRecord) => {
    setThreadLoading(true);
    setThreadError(null);
    try {
      const msgs = await searchMessages(session._id ?? session.sessionId);
      setMessages(msgs);
    } catch (err) {
      // Surface the backend's reason instead of an empty-looking thread — an
      // authorization problem must not read as "No messages yet."
      setMessages([]);
      setThreadError(
        err instanceof Error ? err.message : "Failed to load messages.",
      );
    } finally {
      setThreadLoading(false);
    }
  };

  const selectSession = (session: ChatSessionRecord) => {
    setSelectedId(session.sessionId);
    // Opening a thread clears this admin's own bell rows, exactly like opening an
    // incident or document. It deliberately does NOT un-bold the shared row: the
    // session still has no answer, and a teammate still owes one.
    markRecordsRead(chatSessionReferenceKeys(session));
    void loadMessages(session);
  };

  // When arriving from an incident's "Open Triage Chat", auto-open that
  // incident's session so the admin drops straight into the thread. Sessions
  // store the incident's Mongo _id (not the custom INC-… id), so resolve the
  // incident's _id first. If the incident has no session yet, auto-create one
  // (responder-initiated triage) and open it.
  //
  // A notification click-through arrives with `?session=<id>` instead, where the
  // id is the session's own `chat-…` id — or, for notifications written before
  // that reference was standardised, the session's Mongo `_id` or the linked
  // incident's `_id`. All three are matched below.
  useEffect(() => {
    if (isLoading) return;

    if (sessionParam) {
      if (openedSessionParamRef.current === sessionParam) return;
      const match = sessions.find(
        (session) =>
          session.sessionId === sessionParam ||
          session._id === sessionParam ||
          String(session.incidentId) === sessionParam,
      );
      if (!match) return;
      openedSessionParamRef.current = sessionParam;
      selectSession(match);
      return;
    }

    if (!incidentParam) return;
    if (openedIncidentParamRef.current === incidentParam) return;

    const incident = incidents.find((i) => i.incidentId === incidentParam);
    const incidentKey = incident?._id ?? incidentParam;
    const match = sessions.find(
      (s) =>
        s.incidentId === incidentKey ||
        String(s.incidentId).endsWith(incidentKey),
    );
    if (match) {
      creatingIncidentRef.current = null;
      openedIncidentParamRef.current = incidentParam;
      selectSession(match);
      return;
    }

    // No session for this incident yet — open one if we can resolve the
    // reporting resident. Guard against double submissions.
    if (!incident || !incident.residentId) return;
    if (creatingIncidentRef.current === incidentParam) return;
    creatingIncidentRef.current = incidentParam;
    setActionError(null);

    const deviceInfo = detectDeviceInfo();
    (async () => {
      try {
        const created = await createChatSession({
          sessionId: `chat-${Date.now()}`,
          incidentId: incident._id ?? incident.incidentId,
          residentId: incident.residentId,
          deviceInfo,
          ipAddress: "0.0.0.0",
        });
        creatingIncidentRef.current = null;
        openedIncidentParamRef.current = incidentParam;
        upsertChatSession(created);
        setSelectedId(created.sessionId);
        setMessages([]);
        setThreadError(null);
        setNotice(
          `Opened a triage chat for ${incident.incidentId} (${created.sessionId}).`,
        );
      } catch (err) {
        creatingIncidentRef.current = null;
        setActionError(
          err instanceof Error
            ? err.message
            : "Failed to open a chat for this incident.",
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, incidents, isLoading, incidentParam, sessionParam]);

  const handleSend = async () => {
    const session = selectedSession;
    const text = replyText.trim();
    if (!session || !text) return;
    setSending(true);
    setActionError(null);
    try {
      const messageId = `msg-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const sent = await sendMessage({
        messageId,
        sessionId: session._id ?? session.sessionId,
        messageText: text,
      });
      setMessages((prev) => [...prev, sent]);
      setThreadError(null);
      setReplyText("");
      // Answering is what settles the session for the whole team, so stamp the
      // shared reply time locally: the row un-bolds and the badge drops without
      // waiting for the server's broadcast, which arrives as confirmation.
      const repliedAt = new Date().toISOString();
      upsertChatSession({
        ...session,
        messageCount: session.messageCount + 1,
        lastActivity: repliedAt,
        lastStaffReplyAt: repliedAt,
        lastStaffReplyByName: adminDisplayName,
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to send message.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleToggleActive = async (session: ChatSessionRecord) => {
    setPendingSessionId(session.sessionId);
    setActionError(null);
    try {
      const updated = await updateChatSession(session.sessionId, {
        isActive: !session.isActive,
      });
      upsertChatSession(updated);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update session.",
      );
    } finally {
      setPendingSessionId(null);
    }
  };

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Live Chat
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage resident chat sessions and respond to reports in real time.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Sessions list */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
            <CardContent sx={{ p: 0 }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ px: 3, pt: 3, pb: 1 }}
              >
                <ForumIcon color="primary" />
                <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
                  Sessions
                </Typography>
                <Button
                  size="small"
                  variant={unreadOnly ? "contained" : "outlined"}
                  disabled={awaitingReplyCount === 0}
                  onClick={() => setUnreadOnly((prev) => !prev)}
                >
                  Awaiting reply ({awaitingReplyCount})
                </Button>
                {/*
                  Bell-only. Clearing notification rows cannot un-badge the sidebar
                  any more, so the tooltip says so rather than letting the label
                  imply it does.
                */}
                <Tooltip title="Clears your own notifications for these sessions. The Live Chat badge counts sessions nobody has answered yet.">
                  <span>
                    <Button
                      size="small"
                      disabled={personallyUnreadCount === 0}
                      onClick={() =>
                        markRecordsRead(
                          visibleSessions.flatMap(chatSessionReferenceKeys),
                        )
                      }
                    >
                      Mark all as read
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
              {isLoading ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: 200,
                  }}
                >
                  <CircularProgress aria-label="Loading chat sessions" />
                </Box>
              ) : visibleSessions.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ px: 3, pb: 3 }}
                >
                  {unreadOnly
                    ? "No sessions awaiting a reply."
                    : "No chat sessions found."}
                </Typography>
              ) : (
                <List sx={{ pb: 2 }}>
                  {visibleSessions.map((session) => (
                    <ListItemButton
                      key={session.sessionId}
                      selected={selectedId === session.sessionId}
                      onClick={() => selectSession(session)}
                    >
                      <Box sx={{ width: "100%" }}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={1}
                        >
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              fontWeight: needsReply(session) ? 700 : 400,
                            }}
                          >
                            {residentNames.get(session.residentId) ??
                              session.sessionId}
                          </Typography>
                          {needsReply(session) && (
                            <Chip
                              label="Awaiting reply"
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                          <Chip
                            label={session.isActive ? "Active" : "Closed"}
                            size="small"
                            color={session.isActive ? "success" : "default"}
                            variant="outlined"
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {incidentLabels.get(session.incidentId) ?? "—"} ·{" "}
                          {formatTime(session.lastActivity)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          component="div"
                        >
                          {[session.deviceInfo?.os, session.deviceInfo?.browser]
                            .filter(Boolean)
                            .join(" · ") || "Unknown device"}{" "}
                          · {session.messageCount} messages
                        </Typography>
                      </Box>
                    </ListItemButton>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Message thread */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
            <CardContent sx={{ p: 0 }}>
              {!selectedSession ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: 320,
                    px: 3,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Select a conversation to view messages.
                  </Typography>
                </Box>
              ) : (
                <>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ px: 3, pt: 3, pb: 2, flexWrap: "wrap" }}
                  >
                    <Box>
                      <Typography variant="h6" component="h3">
                        {residentNames.get(selectedSession.residentId) ??
                          selectedSession.sessionId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Session {selectedSession.sessionId} ·{" "}
                        {incidentLabels.get(selectedSession.incidentId) ?? "—"}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {selectedSession.lastStaffReplyAt
                          ? `Answered by ${
                              selectedSession.lastStaffReplyByName ?? "staff"
                            } · ${formatTime(selectedSession.lastStaffReplyAt)}`
                          : "No reply from the barangay yet"}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => void loadMessages(selectedSession)}
                      >
                        Refresh
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color={selectedSession.isActive ? "inherit" : "primary"}
                        disabled={pendingSessionId === selectedSession.sessionId}
                        onClick={() => handleToggleActive(selectedSession)}
                      >
                        {selectedSession.isActive ? "Close" : "Reopen"}
                      </Button>
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.5,
                      p: 3,
                      maxHeight: 440,
                      overflowY: "auto",
                      bgcolor: "background.default",
                    }}
                  >
                    {threadLoading ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          minHeight: 160,
                        }}
                      >
                        <CircularProgress aria-label="Loading messages" />
                      </Box>
                    ) : threadError ? (
                      <Alert
                        severity="error"
                        action={
                          <Button
                            color="inherit"
                            size="small"
                            onClick={() => void loadMessages(selectedSession)}
                          >
                            Retry
                          </Button>
                        }
                      >
                        {threadError}
                      </Alert>
                    ) : messages.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {selectedSession.messageCount > 0
                          ? `${selectedSession.messageCount} message(s) are recorded for this session but could not be loaded.`
                          : "No messages yet."}
                      </Typography>
                    ) : (
                      messages.map((message) => (
                        <Box
                          key={message.messageId}
                          sx={{
                            alignSelf: message.isUser
                              ? "flex-start"
                              : "flex-end",
                            maxWidth: "75%",
                          }}
                        >
                          <Box
                            sx={{
                              px: 2,
                              py: 1,
                              borderRadius: 2,
                              bgcolor: message.isUser
                                ? "action.hover"
                                : "primary.main",
                              color: message.isUser
                                ? "text.primary"
                                : "primary.contrastText",
                            }}
                          >
                            <Typography variant="body2">
                              {message.messageText}
                            </Typography>
                            {message.urgencyFlag && (
                              <Chip
                                label="Urgent"
                                size="small"
                                color="error"
                                sx={{ mt: 0.5 }}
                              />
                            )}
                          </Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "block",
                              mt: 0.25,
                              textAlign: message.isUser ? "left" : "right",
                            }}
                          >
                            {formatTime(message.sentTimestamp ?? message.createdAt)}
                          </Typography>
                        </Box>
                      ))
                    )}
                  </Box>

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ px: 3, py: 2, alignItems: "center" }}
                  >
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Type a reply…"
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      endIcon={<SendIcon />}
                      disabled={sending || !replyText.trim() || !isOnline}
                      onClick={() => void handleSend()}
                    >
                      Send
                    </Button>
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setNotice(null)}
        >
          {notice}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(actionError)}
        autoHideDuration={6000}
        onClose={() => setActionError(null)}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setActionError(null)}
        >
          {actionError}
        </Alert>
      </Snackbar>
    </Box>
  );
}

/** Lightweight UA-derived device summary for responder-opened sessions. */
function detectDeviceInfo(): { os: string; browser: string } {
  const ua = navigator.userAgent || "";
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Mac/i.test(ua)
        ? "macOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Unknown";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "Unknown";
  return { os, browser };
}

/** Build a map of resident ObjectId → full name. */
function buildResidentMap(residents: ResidentRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of residents) {
    const key = r._id ?? r.residentId;
    const name =
      [r.firstName, r.lastName].filter(Boolean).join(" ") || r.residentId;
    map.set(key, name);
  }
  return map;
}

/** Build a map of incident ObjectId → incidentId label. */
function buildIncidentMap(incidents: IncidentRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const i of incidents) {
    if (i._id) map.set(i._id, i.incidentId);
  }
  return map;
}
