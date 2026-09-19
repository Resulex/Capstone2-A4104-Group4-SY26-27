"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import NotificationsIcon from "@mui/icons-material/Notifications";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAdminNotifications } from "@/context/AdminNotificationsContext";
import { useAuth } from "@/context/AuthContext";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import {
  AdminRecord,
  NotificationRecord,
  ResidentRecord,
  deleteNotification,
  fetchAdmins,
  fetchNotifications,
  fetchResidents,
  updateNotification,
} from "@/lib/admin";

/** Human-friendly category labels. */
const CATEGORY_LABELS: Record<string, string> = {
  incidentAlert: "Incident Alert",
  documentUpdate: "Document Update",
  systemMessage: "System Message",
  chatMessage: "Chat Reply",
};

/** Color mapping for a notification category. */
function categoryColor(category: string) {
  switch (category) {
    case "incidentAlert":
      return "error" as const;
    case "documentUpdate":
      return "info" as const;
    default:
      return "default" as const;
  }
}

/** Build a map of recipient ObjectId → display name from residents + admins. */
function buildRecipientMap(
  residents: ResidentRecord[],
  admins: AdminRecord[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of residents) {
    const key = r._id ?? r.residentId;
    const name =
      [r.firstName, r.lastName].filter(Boolean).join(" ") || r.residentId;
    map.set(key, name);
  }
  for (const a of admins) {
    const key = a._id ?? a.adminId;
    const name =
      [a.firstName, a.lastName].filter(Boolean).join(" ") ||
      a.userName ||
      a.emailAddress;
    map.set(key, name);
  }
  return map;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Admin Notifications page — lists all notifications and lets an admin mark
 * them read/unread or delete them.
 *
 * Unlike the bell (which only ever holds the caller's own notifications), this
 * table is an oversight view over EVERY recipient. The unread controls are
 * therefore deliberately caller-scoped: "Unread only" keeps rows whose
 * `recipientId` is this admin, and "Mark all as read" reuses the single-request
 * `notifications/read-all` — nothing here writes to another person's inbox.
 */
export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { profile } = useAdminProfile();
  // The caller's own notification list, shared with the shell's bell: the bulk
  // action updates both in one optimistic step.
  const { markAllRead } = useAdminNotifications();

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [recipientNames, setRecipientNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  /** When true the table shows only THIS admin's notifications that are unread. */
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && (!isAuthenticated || user?.role !== "admin")) {
      router.replace("/admin/login");
    }
  }, [isAuthLoading, isAuthenticated, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [notificationData, residentData, adminData] = await Promise.all([
          fetchNotifications(),
          fetchResidents(),
          fetchAdmins(),
        ]);
        if (!cancelled) {
          setNotifications(notificationData);
          setRecipientNames(buildRecipientMap(residentData, adminData));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load notifications.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleRead = async (notification: NotificationRecord) => {
    setPendingId(notification.notificationId);
    setActionError(null);
    try {
      const updated = await updateNotification(notification.notificationId, {
        isRead: !notification.isRead,
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notification.notificationId
            ? { ...n, ...updated }
            : n,
        ),
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update notification.",
      );
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (notification: NotificationRecord) => {
    setPendingId(notification.notificationId);
    setActionError(null);
    try {
      await deleteNotification(notification.notificationId);
      setNotifications((prev) =>
        prev.filter((n) => n.notificationId !== notification.notificationId),
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete notification.",
      );
    } finally {
      setPendingId(null);
    }
  };

  /**
   * The caller's own unread rows.
   *
   * A notification's `recipientId` is the recipient's Mongo `_id` — for an admin
   * that is the `_id` on `/api/admin/profile` — so this needs no extra fetch.
   */
  const myUnread = notifications.filter(
    (n) => n.recipientId === profile?._id && !n.isRead,
  );
  const unreadCount = myUnread.length;
  const visible = unreadOnly ? myUnread : notifications;

  /**
   * Clear every one of the caller's notifications.
   *
   * `markAllRead` covers the shell (bell, toasts, the shared sidebar badge) with
   * one `notifications/read-all` call; the page's own list is fetched separately,
   * so it is patched here as well or the rows would stay bold until a reload.
   */
  const handleMarkAllRead = () => {
    markAllRead();
    setNotifications((prev) =>
      prev.map((n) =>
        n.recipientId === profile?._id ? { ...n, isRead: true } : n,
      ),
    );
  };

  if (isAuthLoading || !isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Notifications
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review notifications sent to residents and administrators.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <NotificationsIcon color="primary" />
              <Typography variant="h6" component="h3">
                Notifications
              </Typography>
            </Stack>

            {/* Caller-scoped, unlike the table itself: see the component docs. */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ flexWrap: "wrap", rowGap: 1 }}
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
                onClick={handleMarkAllRead}
                sx={{ whiteSpace: "nowrap" }}
              >
                Mark all as read
              </Button>
            </Stack>
          </Stack>

          {isLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 200,
              }}
            >
              <CircularProgress aria-label="Loading notifications" />
            </Box>
          ) : visible.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {unreadOnly
                ? "No unread notifications for you."
                : "No notifications found."}
            </Typography>
          ) : (
            <TableContainer>
              <Table size="medium" aria-label="Notifications">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Recipient</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.map((notification) => (
                    <TableRow key={notification.notificationId} hover>
                      <TableCell>
                        <Chip
                          label={
                            CATEGORY_LABELS[notification.notificationCategory] ??
                            notification.notificationCategory
                          }
                          size="small"
                          color={categoryColor(
                            notification.notificationCategory,
                          )}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {notification.titleText}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ maxWidth: 240 }}
                        >
                          {notification.messageBody || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {recipientNames.get(notification.recipientId) ??
                          notification.recipientId}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={notification.isRead ? "Read" : "Unread"}
                          size="small"
                          color={notification.isRead ? "default" : "primary"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {formatDate(notification.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          <Button
                            size="small"
                            variant="outlined"
                            color={notification.isRead ? "inherit" : "primary"}
                            startIcon={
                              notification.isRead ? (
                                <MarkEmailUnreadIcon />
                              ) : (
                                <MarkEmailReadIcon />
                              )
                            }
                            disabled={pendingId === notification.notificationId}
                            onClick={() => handleToggleRead(notification)}
                          >
                            {notification.isRead ? "Mark unread" : "Mark read"}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            disabled={pendingId === notification.notificationId}
                            onClick={() => handleDelete(notification)}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={Boolean(actionError)}
        autoHideDuration={6000}
        onClose={() => setActionError(null)}
        message={actionError ?? ""}
      />
    </Box>
  );
}
