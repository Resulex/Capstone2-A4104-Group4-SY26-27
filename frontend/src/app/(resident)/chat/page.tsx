"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import ForumIcon from "@mui/icons-material/Forum";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import { hasUnreadReference, type ChatSessionRecord } from "@/lib/admin";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { PageHeader } from "@/components/resident/PageHeader";
// Hidden: chat-session status badge has no use case for now. Uncomment to restore.
// import { StatusChip } from "@/components/resident/StatusChip";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { EmptyState } from "@/components/resident/EmptyState";
import { formatDateTime } from "@/lib/resident";

/**
 * Live Chat (`/chat`).
 *
 * Lists the resident's chat sessions with barangay responders. Selecting a
 * session opens the thread page (`/chat/{sessionId}`).
 */
export default function ChatSessionsPage() {
  const {
    data,
    isLoading,
    unreadChatKeys,
    markRecordsRead,
    markRecordsUnread,
  } = useResidentDashboard();
  const sessions = data.chatSessions;
  /** When true the grid shows only sessions with unseen replies. */
  const [unreadOnly, setUnreadOnly] = useState(false);

  /**
   * Keys a session's notifications may carry. Chat notifications written before
   * the switch to the session id store the incident's Mongo `_id`, so accept
   * every id a session is addressable by.
   */
  const referenceKeysFor = (session: ChatSessionRecord): string[] =>
    [session.sessionId, session._id, session.incidentId].filter(
      (key): key is string => Boolean(key),
    );

  const isUnread = (session: ChatSessionRecord) =>
    hasUnreadReference(unreadChatKeys, referenceKeysFor(session));

  // Counted per SESSION (not per reference key), so it matches the number of
  // cards showing the "New" chip.
  const unreadCount = sessions.filter(isUnread).length;
  const visible = unreadOnly ? sessions.filter(isUnread) : sessions;

  const handleToggleRead = (session: ChatSessionRecord, isRead: boolean) =>
    isRead
      ? markRecordsRead(referenceKeysFor(session))
      : markRecordsUnread(referenceKeysFor(session));

  /** Mark every session currently on screen as read. */
  const markAllVisibleRead = () =>
    markRecordsRead(visible.flatMap(referenceKeysFor));

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <PageHeader
        title="Live Chat"
        subtitle="Conversations that barangay responders start with you about your incidents."
      />

      {/* Unread controls appear only once there is something to act on, and are
          kept while filtering so the toggle can always be switched back. */}
      {!isLoading && sessions.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ mb: 2, flexWrap: "wrap" }}
        >
          <Button
            size="small"
            variant={unreadOnly ? "contained" : "outlined"}
            color={unreadOnly ? "primary" : "inherit"}
            startIcon={<MarkEmailUnreadIcon />}
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly((prev) => !prev)}
            sx={{ whiteSpace: "nowrap" }}
          >
            Unread only{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </Button>
          <Button
            size="small"
            variant="text"
            startIcon={<MarkEmailReadIcon />}
            disabled={unreadCount === 0}
            onClick={markAllVisibleRead}
            sx={{ whiteSpace: "nowrap" }}
          >
            Mark all as read
          </Button>
        </Stack>
      )}

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No chat sessions yet"
          description="No chat sessions yet — a barangay responder will start a chat when they need to coordinate with you on an incident."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing unread"
          description="You're all caught up — no unread replies from the barangay."
        />
      ) : (
        <Grid container spacing={2}>
          {visible.map((session) => (
            <Grid item key={session.sessionId ?? session._id} xs={12} sm={6}>
              <Card
                variant="outlined"
                sx={{
                  position: "relative",
                  borderRadius: 3,
                  // Unread sessions get the same tint the notification centre uses.
                  bgcolor: isUnread(session) ? "primary.light" : undefined,
                }}
              >
                <CardActionArea
                  component={Link}
                  href={`/chat/${encodeURIComponent(session.sessionId ?? session._id ?? "")}`}
                  sx={{ display: "block" }}
                >
                  <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        aria-hidden
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 44,
                          height: 44,
                          borderRadius: "12px",
                          bgcolor: "secondary.main",
                          color: "common.white",
                          flexShrink: 0,
                        }}
                      >
                        <ForumIcon />
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1, pr: 4 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 0.75,
                          }}
                        >
                          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                            Incident Chat
                          </Typography>
                          {isUnread(session) && (
                            <Chip label="New" size="small" color="primary" />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {session.incidentId}
                        </Typography>
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        mt: 1.5,
                        pt: 1.5,
                        borderTop: 1,
                        borderColor: "divider",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                      }}
                    >
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                        {/* Hidden: chat-session status badge has no use case
                            for now. Uncomment to restore.
                        <StatusChip status={session.isActive ? "Active" : "Inactive"} />
                        */}
                        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                          {session.messageCount} message{session.messageCount === 1 ? "" : "s"}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(session.lastActivity)}
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
                {
                  // A sibling of the link, never a child: a button inside the
                  // CardActionArea's anchor would be invalid and break keyboard use.
                }
                <Tooltip
                  title={isUnread(session) ? "Mark as read" : "Mark as unread"}
                >
                  <IconButton
                    size="small"
                    aria-label={
                      isUnread(session)
                        ? `Mark chat ${session.sessionId} as read`
                        : `Mark chat ${session.sessionId} as unread`
                    }
                    onClick={() =>
                      handleToggleRead(session, !isUnread(session))
                    }
                    sx={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
                  >
                    {isUnread(session) ? (
                      <MarkEmailReadIcon fontSize="small" />
                    ) : (
                      <MarkEmailUnreadIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
