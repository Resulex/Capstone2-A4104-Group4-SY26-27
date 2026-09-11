"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { PageHeader } from "@/components/resident/PageHeader";
import { NotificationCard } from "@/components/resident/NotificationCard";
import { LoadingSkeleton } from "@/components/resident/LoadingSkeleton";
import { EmptyState } from "@/components/resident/EmptyState";
import { updateNotification } from "@/lib/admin";

/**
 * Notification Center (`/notifications`).
 *
 * Lists the resident's notifications (own records, newest first) with a
 * priority badge derived from the category, a deep link to the referenced
 * record, and a read toggle that persists via `PATCH /notifications/{id}` and
 * updates the shared shell state so the header badge stays in sync.
 */
export default function NotificationsPage() {
  const { data, isLoading, setNotificationReadLocal, markAllRead } =
    useResidentDashboard();
  const notifications = data.notifications;
  /** When true the list shows only unread notifications. */
  const [unreadOnly, setUnreadOnly] = useState(false);

  // This page lists NOTIFICATIONS, so it counts notification rows rather than
  // records — unlike the record pages, whose toggles count cards.
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const visible = unreadOnly
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const handleToggleRead = async (id: string, isRead: boolean) => {
    if (!id) return;
    // Optimistic local update keeps the UI + header badge responsive.
    setNotificationReadLocal(id, isRead);
    try {
      await updateNotification(id, { isRead });
    } catch {
      // Revert on failure so the badge doesn't lie about server state.
      setNotificationReadLocal(id, !isRead);
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <PageHeader
        title="Notifications"
        subtitle="Updates about your requests, reports, and barangay alerts."
      />

      {/* Unread controls appear only once there is something to act on, and are
          kept while filtering so the toggle can always be switched back. */}
      {!isLoading && notifications.length > 0 && (
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
            // Clears every unread notification, not just the filtered ones —
            // this is the list's "inbox" action, backed by read-all.
            onClick={markAllRead}
            sx={{ whiteSpace: "nowrap" }}
          >
            Mark all as read
          </Button>
        </Stack>
      )}

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="When your document requests or incident reports are updated, you'll see them here."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing unread"
          description="You're all caught up — there are no unread notifications."
        />
      ) : (
        <Stack spacing={1.5}>
          {visible.map((notification) => (
            <NotificationCard
              key={notification.notificationId ?? notification._id}
              notification={notification}
              onToggleRead={handleToggleRead}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
