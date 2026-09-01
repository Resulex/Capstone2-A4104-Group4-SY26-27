"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
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
  const { data, isLoading, setNotificationReadLocal } = useResidentDashboard();
  const notifications = data.notifications;

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

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="When your document requests or incident reports are updated, you'll see them here."
        />
      ) : (
        <Stack spacing={1.5}>
          {notifications.map((notification) => (
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
