"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { formatDateTime } from "@/lib/resident";

interface ChatBubbleProps {
  /** Message text. */
  message: string;
  /** ISO timestamp shown under the bubble. */
  timestamp?: string;
  /** `true` = the signed-in resident's own message (right-aligned). */
  isUser: boolean;
  /** Sender label ("You" / "Responder"). */
  label: string;
}

/**
 * Reusable chat message bubble. Resident messages align right (primary tone),
 * responder messages align left (light tone), each with a sender label and
 * timestamp. Used on the Emergency Triage Chat thread.
 */
export function ChatBubble({ message, timestamp, isUser, label }: ChatBubbleProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        mb: 1.5,
      }}
    >
      <Box
        sx={{
          maxWidth: { xs: "85%", sm: "70%" },
          px: 1.75,
          py: 1.25,
          borderRadius: 2.5,
          borderTopRightRadius: isUser ? 0.5 : 2.5,
          borderTopLeftRadius: isUser ? 2.5 : 0.5,
          bgcolor: isUser ? "primary.main" : "action.hover",
          color: isUser ? "primary.contrastText" : "text.primary",
          boxShadow: 1,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
          {message}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, px: 0.5 }}>
        {label}
        {timestamp ? ` · ${formatDateTime(timestamp)}` : ""}
      </Typography>
    </Box>
  );
}
