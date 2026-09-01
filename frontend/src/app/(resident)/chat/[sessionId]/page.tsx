"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import SendIcon from "@mui/icons-material/Send";
import { ChatMessageRecord, searchMessages, sendMessage } from "@/lib/admin";
import { newId } from "@/lib/resident";
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
  const sessionId = params.sessionId;

  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await searchMessages(sessionId);
      setMessages((prev) => mergeMessages(prev, result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const created = await sendMessage({
        messageId: newId(),
        sessionId,
        messageText: trimmed,
      });
      setMessages((prev) => mergeMessages(prev, [created]));
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
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
              label={message.isUser ? "You" : "Responder"}
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
          disabled={sending || !text.trim()}
          sx={{ flexShrink: 0 }}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
}
