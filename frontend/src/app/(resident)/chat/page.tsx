"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import ForumIcon from "@mui/icons-material/Forum";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { PageHeader } from "@/components/resident/PageHeader";
import { StatusChip } from "@/components/resident/StatusChip";
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
  const { data, isLoading } = useResidentDashboard();
  const sessions = data.chatSessions;

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <PageHeader
        title="Live Chat"
        subtitle="Conversations that barangay responders start with you about your incidents."
      />

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No chat sessions yet"
          description="No chat sessions yet — a barangay responder will start a chat when they need to coordinate with you on an incident."
        />
      ) : (
        <Grid container spacing={2}>
          {sessions.map((session) => (
            <Grid item key={session.sessionId ?? session._id} xs={12} sm={6}>
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
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
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                          Incident Chat
                        </Typography>
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
                        <StatusChip status={session.isActive ? "Active" : "Inactive"} />
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
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
