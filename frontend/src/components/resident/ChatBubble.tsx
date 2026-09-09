"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { formatDateTime } from "@/lib/resident";

interface ChatBubbleProps {
  /** Message text. */
  message: string;
  /** ISO timestamp shown under the bubble. */
  timestamp?: string;
  /** `true` = the signed-in resident's own message (right-aligned). */
  isUser: boolean;
  /** Whether to render the "Urgent" marker (mirrors the admin thread). */
  urgency?: boolean;
}

/**
 * Chat message bubble — styled identically to the admin Live Chat thread so a
 * conversation looks the same from both sides. The viewer's own messages sit
 * on the right (primary tone) and the other party's on the left (light tone),
 * with only the timestamp underneath (no sender label).
 */
export function ChatBubble({
  message,
  timestamp,
  isUser,
  urgency = false,
}: ChatBubbleProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        width: "100%",
        mb: 1.5,
      }}
    >
      <Box
        sx={{
          maxWidth: { xs: "85%", sm: "75%" },
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: isUser ? "primary.main" : "action.hover",
          color: isUser ? "primary.contrastText" : "text.primary",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
          {message}
        </Typography>
        {urgency && (
          <Chip label="Urgent" size="small" color="error" sx={{ mt: 0.5 }} />
        )}
      </Box>
      {timestamp && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
          {formatDateTime(timestamp)}
        </Typography>
      )}
    </Box>
  );
}
