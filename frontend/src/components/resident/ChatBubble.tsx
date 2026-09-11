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
  /** Optimistic echo still awaiting the server's confirmation. */
  pending?: boolean;
  /** Optimistic echo whose send failed. */
  failed?: boolean;
  /** Retry a failed echo (only used when `failed` is true). */
  onRetry?: () => void;
}

/**
 * Chat message bubble — styled identically to the admin Live Chat thread so a
 * conversation looks the same from both sides. The viewer's own messages sit
 * on the right (primary tone) and the other party's on the left (light tone),
 * with only the timestamp underneath (no sender label).
 *
 * While the send is in flight the bubble renders dimmed with a "Sending…"
 * caption; a failed send is outlined and offers a tap-to-retry caption.
 */
export function ChatBubble({
  message,
  timestamp,
  isUser,
  urgency = false,
  pending = false,
  failed = false,
  onRetry,
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
          opacity: pending ? 0.6 : 1,
          ...(failed && { border: 1, borderColor: "error.main" }),
        }}
      >
        <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
          {message}
        </Typography>
        {urgency && (
          <Chip label="Urgent" size="small" color="error" sx={{ mt: 0.5 }} />
        )}
      </Box>
      {failed ? (
        <Typography
          variant="caption"
          color="error"
          onClick={onRetry}
          sx={{ mt: 0.25, cursor: onRetry ? "pointer" : "default" }}
        >
          Not sent — tap to retry
        </Typography>
      ) : pending ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
          Sending…
        </Typography>
      ) : (
        timestamp && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 0.25 }}
          >
            {formatDateTime(timestamp)}
          </Typography>
        )
      )}
    </Box>
  );
}
