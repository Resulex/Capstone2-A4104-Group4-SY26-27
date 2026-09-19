"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { NotificationRecord } from "@/lib/admin";
import { notificationHref } from "@/lib/notification-routes";
import { notificationPriority } from "@/lib/resident";
import { StatusChip } from "@/components/resident/StatusChip";
import { useAccessibilityTheme } from "@/context/ThemeContext";
import { getUnreadCardSx } from "@/theme/theme";

interface NotificationCardProps {
  /** The notification to display. */
  notification: NotificationRecord;
  /** Toggle the read state (persists via the backend + shared context). */
  onToggleRead: (id: string, isRead: boolean) => void;
}

/**
 * Reusable notification card: read toggle, priority badge (derived from the
 * backend category), title, message, and a deep link to the referenced record.
 */
export function NotificationCard({ notification, onToggleRead }: NotificationCardProps) {
  // One shared resolver serves both portals, so a chat reply links to its
  // thread here too instead of only incidents and documents linking out.
  const href = notificationHref(notification, "resident");
  const read = Boolean(notification.isRead);
  const { highContrast } = useAccessibilityTheme();

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        // Unread notifications get the shared unread wash + left accent bar;
        // read cards fall back to the default `background.paper`.
        ...getUnreadCardSx(!read, highContrast),
        opacity: read ? 0.85 : 1,
        transition: "background-color 0.2s ease, opacity 0.2s ease",
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Checkbox
            checked={read}
            onChange={(e) => onToggleRead(notification.notificationId ?? notification._id ?? "", e.target.checked)}
            inputProps={{ "aria-label": `Mark "${notification.titleText}" as read` }}
            color="primary"
            sx={{ mt: -0.75, ml: -1 }}
          />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                {notification.titleText}
              </Typography>
              <StatusChip status={notificationPriority(notification)} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              {notification.messageBody}
            </Typography>
            {href && (
              <Link href={href} style={{ textDecoration: "none" }}>
                <Typography
                  component="span"
                  variant="body2"
                  color="primary"
                  sx={{
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    mt: 1,
                  }}
                >
                  {notification.referenceUrlId}
                  <ArrowForwardIcon sx={{ fontSize: 16 }} />
                </Typography>
              </Link>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
