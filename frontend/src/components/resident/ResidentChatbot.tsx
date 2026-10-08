"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  ChatbotMessage,
  clearChatbotConversation,
  fetchChatbotConversation,
  sendChatbotMessage,
} from "@/lib/chatbot";

/** Suggested opening questions shown before the first exchange. */
const QUICK_REPLIES = [
  "How do I request a Barangay Clearance?",
  "How do I report an incident?",
  "Where do I see announcements?",
  "Sino ang kasalukuyang kapitan ng barangay?",
];

/** Panel width on screens wide enough for the full panel. */
const PANEL_WIDTH = 380;

/**
 * Resident AI assistant.
 *
 * A fixed circular button (bottom-right) that opens a chat panel. Answers come
 * from the backend, which keeps the exchange strictly to portal Q&A — it
 * explains how to do things and where to find them, but never changes data.
 * The conversation history is stored per resident on the backend.
 */
export function ResidentChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyLoadedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const history = await fetchChatbotConversation();
      setMessages(history);
    } catch {
      // History is best-effort; a failed send surfaces the real error.
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleToggle = () => {
    setOpen((prev) => !prev);
    if (!historyLoadedRef.current) {
      historyLoadedRef.current = true;
      void loadHistory();
    }
  };

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;
      setInput("");
      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setSending(true);
      try {
        const result = await sendChatbotMessage(text);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.reply },
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not get a reply.",
        );
      } finally {
        setSending(false);
      }
    },
    [sending],
  );

  const handleClear = async () => {
    setError(null);
    try {
      await clearChatbotConversation();
      setMessages([]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not clear the conversation.",
      );
    }
  };

  // Keep the newest message in view as the exchange grows.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  return (
    <>
      <Tooltip title={open ? "Close assistant" : "Chat with the assistant"}>
        <Fab
          color="primary"
          aria-label={open ? "Close assistant" : "Open assistant"}
          onClick={handleToggle}
          sx={{ position: "fixed", bottom: 24, right: 24, zIndex: 1200 }}
        >
          <SmartToyIcon />
        </Fab>
      </Tooltip>

      {open && (
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            bottom: 96,
            right: 24,
            zIndex: 1200,
            width: { xs: "calc(100vw - 48px)", sm: PANEL_WIDTH },
            maxWidth: PANEL_WIDTH,
            height: "min(560px, 70vh)",
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <SmartToyIcon />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                KaBarangay Assistant
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                Ask me anything about the portal
              </Typography>
            </Box>
            <Tooltip title="Clear conversation">
              <span>
                <IconButton
                  size="small"
                  color="inherit"
                  aria-label="Clear conversation"
                  onClick={() => void handleClear()}
                  disabled={messages.length === 0 && !sending}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              size="small"
              color="inherit"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              p: 2,
              bgcolor: "background.default",
            }}
          >
            {loadingHistory ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={24} aria-label="Loading conversation" />
              </Box>
            ) : messages.length === 0 ? (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  Hi! I can help you find your way around KaBarangayConnect. Try
                  one of these:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  {QUICK_REPLIES.map((quick) => (
                    <Chip
                      key={quick}
                      label={quick}
                      size="small"
                      clickable
                      onClick={() => void send(quick)}
                    />
                  ))}
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={1}>
                {messages.map((message, index) => (
                  <Box
                    key={index}
                    sx={{
                      alignSelf:
                        message.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor:
                        message.role === "user"
                          ? "primary.main"
                          : "background.paper",
                      color:
                        message.role === "user"
                          ? "primary.contrastText"
                          : "text.primary",
                      border:
                        message.role === "assistant" ? 1 : 0,
                      borderColor: "divider",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    <Typography variant="body2">{message.content}</Typography>
                  </Box>
                ))}
                {sending && (
                  <Box sx={{ alignSelf: "flex-start", px: 1.5, py: 1 }}>
                    <CircularProgress
                      size={16}
                      aria-label="Assistant is typing"
                    />
                  </Box>
                )}
                <div ref={messagesEndRef} />
              </Stack>
            )}
          </Box>

          {error && (
            <Typography variant="caption" color="error" sx={{ px: 2, pt: 1 }}>
              {error}
            </Typography>
          )}

          {/* Input */}
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            sx={{
              p: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
              borderTop: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Ask a question…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              inputProps={{ "aria-label": "Message the assistant" }}
            />
            <IconButton
              color="primary"
              aria-label="Send message"
              type="submit"
              disabled={!input.trim() || sending}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      )}
    </>
  );
}
