"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import SendIcon from "@mui/icons-material/Send";
import {
  chatSessionReferenceKeys,
  ChatMessageRecord,
  searchMessages,
  sendMessage,
} from "@/lib/admin";
import { newId } from "@/lib/resident";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { ChatBubble } from "@/components/resident/ChatBubble";
import { PageHeader } from "@/components/resident/PageHeader";
import { EmptyState } from "@/components/resident/EmptyState";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";

/** Merge + dedupe messages by id and sort oldest-first. */
function mergeMessages(
  current: ChatMessageRecord[],
  incoming: ChatMessageRecord[],
): ChatMessageRecord[] {
  const map = new Map<string, ChatMessageRecord>();
  for (const message of [...current, ...incoming]) {
    const key = message.messageId ?? message._id ?? JSON.stringify(message);
    map.set(key, message);
  }
  return [...map.values()].sort(
    (a, b) =>
      new Date(a.sentTimestamp ?? a.createdAt ?? 0).getTime() -
      new Date(b.sentTimestamp ?? b.createdAt ?? 0).getTime(),
  );
}

/**
 * Emergency Triage Chat (`/chat/{sessionId}`).
 *
 * REST-based chat thread: loads messages via `POST /messages/search`, polls
 * every 5 seconds, and sends via `POST /messages`. Resident messages render
 * right-aligned ("You"), responder messages left-aligned ("Responder").
 */
export default function ChatThreadPage() {
  const params = useParams<{ sessionId: string }>();
  const requestedId = params.sessionId;
  const router = useRouter();
  const { data, isLoading, unreadChatKeys, markRecordsRead } =
    useResidentDashboard();

  /**
   * The session this link actually names.
   *
   * `/chat/{id}` receives whatever `referenceUrlId` the notification carried.
   * Newer chat notifications store the session's own `chat-…` id, but ones
   * written before that was standardised store the session's Mongo `_id` — or
   * the linked INCIDENT's `_id`, which `POST /messages/search` cannot resolve at
   * all (it matches `sessionId`/`_id` only), so the first fetch was rejected and
   * the page showed a red "Invalid sessionId." instead of the thread. Matching
   * against every id a session is addressable by — the same keys the chat list
   * and the admin queue use — resolves all three shapes.
   */
  const session = data.chatSessions.find((candidate) =>
    chatSessionReferenceKeys(candidate).includes(requestedId),
  );
  /**
   * Canonical route id, used by every request. `undefined` while the shell is
   * still loading sessions, and after a link that names none of them — in both
   * cases there is nothing safe to fetch yet.
   */
  const sessionId = session?.sessionId;

  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await searchMessages(sessionId);
      setMessages((prev) => mergeMessages(prev, result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Nothing is fetched until the link resolves, so a legacy reference cannot
  // produce a doomed request and a spurious error banner.
  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load, sessionId]);

  // A link naming none of this resident's sessions is a dead end: go back to the
  // list rather than keep retrying an id that cannot resolve.
  useEffect(() => {
    if (!isLoading && !session) router.replace("/chat");
  }, [isLoading, session, router]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // The resident is looking at this thread, so anything unread for the session
  // clears — including replies that arrive while the page is open, because the
  // shell's push/poll adds the notification and changes `unreadChatKeys`. Every
  // id the session is addressable by is cleared, so a notification carrying a
  // legacy `_id` reference clears too.
  useEffect(() => {
    if (!session) return;
    const keys = chatSessionReferenceKeys(session).filter((key) =>
      unreadChatKeys.has(key),
    );
    if (keys.length > 0) markRecordsRead(keys);
  }, [session, unreadChatKeys, markRecordsRead]);

  /** POST the message and reconcile the optimistic echo with the server copy. */
  const deliver = useCallback(
    async (messageId: string, messageText: string) => {
      if (!sessionId) return;
      setSending(true);
      try {
        const created = await sendMessage({
          messageId,
          sessionId,
          messageText,
        });
        // Same `messageId`, so this replaces the echo instead of duplicating it.
        setMessages((prev) => mergeMessages(prev, [created]));
        setError(null);
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === messageId
              ? { ...m, pending: false, failed: true }
              : m,
          ),
        );
        setError(
          err instanceof Error ? err.message : "Could not send message.",
        );
      } finally {
        setSending(false);
      }
    },
    [sessionId],
  );

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !sessionId) return;
    const messageId = newId();
    // Render the bubble immediately; the response and the 5s poll both merge by
    // `messageId`, so the echo is replaced by the server record rather than
    // shown twice.
    setMessages((prev) =>
      mergeMessages(prev, [
        {
          messageId,
          sessionId,
          senderId: "",
          isUser: true,
          messageText: trimmed,
          sentTimestamp: new Date().toISOString(),
          pending: true,
        },
      ]),
    );
    setText("");
    await deliver(messageId, trimmed);
  };

  const handleRetry = (message: ChatMessageRecord) => {
    if (sending) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.messageId === message.messageId
          ? { ...m, pending: true, failed: false }
          : m,
      ),
    );
    void deliver(message.messageId, message.messageText);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: { xs: "calc(100dvh - 64px)", sm: "calc(100dvh - 112px)" },
        maxWidth: 760,
        mx: "auto",
      }}
    >
      <PageHeader
        backHref="/chat"
        title="Emergency Triage Chat"
        subtitle="Stay calm — a barangay responder is here to help."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          pr: 0.5,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          borderRadius: 3,
          p: { xs: 1.5, sm: 2.5 },
        }}
      >
        {loading && messages.length === 0 ? (
          <LoadingSkeleton rows={4} />
        ) : messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Say hello to start the conversation with the barangay responder."
          />
        ) : (
          messages.map((message) => (
            <ChatBubble
              key={message.messageId ?? message._id}
              message={message.messageText}
              timestamp={message.sentTimestamp ?? message.createdAt}
              isUser={Boolean(message.isUser)}
              urgency={Boolean(message.urgencyFlag)}
              pending={message.pending}
              failed={message.failed}
              onRetry={() => handleRetry(message)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Composer. */}
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          mt: 1.5,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          borderRadius: 3,
          p: 1,
        }}
      >
        <IconButton
          aria-label="Attach photo (coming soon)"
          disabled
          sx={{ flexShrink: 0 }}
        >
          <CameraAltIcon />
        </IconButton>
        <TextField
          fullWidth
          size="small"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(event) => {
            // Enter sends (as in the admin thread); Shift+Enter keeps the
            // newline, which is what the multiline composer is here for.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          inputProps={{ "aria-label": "Message" }}
          multiline
          maxRows={3}
          sx={{ flexGrow: 1 }}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          endIcon={<SendIcon />}
          disabled={sending || !text.trim() || !sessionId}
          sx={{ flexShrink: 0 }}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
}
