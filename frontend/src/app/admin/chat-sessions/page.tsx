"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import Typography from "@mui/material/Typography";
import ForumIcon from "@mui/icons-material/Forum";
import SendIcon from "@mui/icons-material/Send";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useAuth } from "@/context/AuthContext";
import {
  ChatMessageRecord,
  ChatSessionRecord,
  IncidentRecord,
  ResidentRecord,
  fetchChatSessions,
  fetchIncidentReports,
  fetchResidents,
  searchMessages,
  sendMessage,
  updateChatSession,
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
 * Admin Live Chat page — a two-panel chat: sessions on the left, the selected
 * session's message thread (with a reply box) on the right.
 */
export default function ChatSessionsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const [sessions, setSessions] = useState<ChatSessionRecord[]>([]);
  const [residentNames, setResidentNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [incidentLabels, setIncidentLabels] = useState<Map<string, string>>(
    new Map(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const sessionsRef = useRef<ChatSessionRecord[]>([]);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sessionData, residentData, incidentData] = await Promise.all([
          fetchChatSessions(),
          fetchResidents(),
          fetchIncidentReports(),
        ]);
        if (!cancelled) {
          setSessions(sessionData);
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
  }, []);

  // Keep a ref of sessions so the polling effect doesn't reset on every send.
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Poll the selected thread every few seconds for new messages.
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(async () => {
      const current = sessionsRef.current.find(
        (s) => s.sessionId === selectedId,
      );
      if (!current) return;
      const msgs = await searchMessages(current._id ?? current.sessionId);
      setMessages(msgs);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const selectedSession =
    sessions.find((s) => s.sessionId === selectedId) ?? null;

  const loadMessages = async (session: ChatSessionRecord) => {
    setThreadLoading(true);
    setMessages([]);
    const msgs = await searchMessages(session._id ?? session.sessionId);
    setMessages(msgs);
    setThreadLoading(false);
  };

  const selectSession = (session: ChatSessionRecord) => {
    setSelectedId(session.sessionId);
    void loadMessages(session);
  };

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
      setReplyText("");
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === session.sessionId
            ? {
                ...s,
                messageCount: s.messageCount + 1,
                lastActivity: new Date().toISOString(),
              }
            : s,
        ),
      );
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
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === session.sessionId ? { ...s, ...updated } : s,
        ),
      );
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
                <Typography variant="h6" component="h3">
                  Sessions
                </Typography>
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
              ) : sessions.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ px: 3, pb: 3 }}
                >
                  No chat sessions found.
                </Typography>
              ) : (
                <List sx={{ pb: 2 }}>
                  {sessions.map((session) => (
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
                          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                            {residentNames.get(session.residentId) ??
                              session.sessionId}
                          </Typography>
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
                    ) : messages.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No messages yet.
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
                      disabled={sending || !replyText.trim()}
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
        open={Boolean(actionError)}
        autoHideDuration={6000}
        onClose={() => setActionError(null)}
        message={actionError ?? ""}
      />
    </Box>
  );
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
