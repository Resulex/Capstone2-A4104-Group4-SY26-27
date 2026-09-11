"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Link from "next/link";
import AddIcon from "@mui/icons-material/Add";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { PageHeader } from "@/components/resident/PageHeader";
import { DocumentRequestCard } from "@/components/resident/DocumentRequestCard";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { EmptyState } from "@/components/resident/EmptyState";

/**
 * My Document Requests (`/documents`).
 *
 * Lists the resident's document requests (own records, newest first) with
 * status chips and expected completion dates. Data is shared from the resident
 * shell's dashboard-data provider.
 */
export default function DocumentRequestsPage() {
  const {
    data,
    isLoading,
    unreadDocumentIds,
    markRecordsRead,
    markRecordsUnread,
  } = useResidentDashboard();
  const requests = data.documentRequests;
  /** When true the grid shows only requests with unseen updates. */
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Unread is counted per RECORD (a request can carry several notifications),
  // so this matches the number of cards showing the "New" chip.
  const unreadCount = unreadDocumentIds.size;
  const visible = unreadOnly
    ? requests.filter((r) => unreadDocumentIds.has(r.requestId))
    : requests;

  const handleToggleRead = (referenceUrlId: string, isRead: boolean) =>
    isRead
      ? markRecordsRead([referenceUrlId])
      : markRecordsUnread([referenceUrlId]);

  /** Mark every request currently on screen as read. */
  const markAllVisibleRead = () =>
    markRecordsRead(visible.map((r) => r.requestId));

  return (
    <Box>
      <PageHeader
        title="My Document Requests"
        subtitle="Track the status of your barangay document requests."
        action={
          <Button
            component={Link}
            href="/documents/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            Request Document
          </Button>
        }
      />

      {/* Unread controls appear only once there is something to act on, and are
          kept while filtering so the toggle can always be switched back. */}
      {!isLoading && requests.length > 0 && (
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
      ) : requests.length === 0 ? (
        <EmptyState
          title="No document requests yet"
          description="Apply for a barangay document such as a clearance or certificate to get started."
          action={
            <Button
              component={Link}
              href="/documents/new"
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
            >
              Request Document
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing unread"
          description="You're all caught up — there are no unread updates on your document requests."
        />
      ) : (
        <Grid container spacing={2}>
          {visible.map((request) => (
            <Grid item key={request.requestId} xs={12} sm={6} lg={4}>
              <DocumentRequestCard
                request={request}
                href={`/documents/${encodeURIComponent(request.requestId)}`}
                isUnread={unreadDocumentIds.has(request.requestId)}
                onToggleRead={handleToggleRead}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
