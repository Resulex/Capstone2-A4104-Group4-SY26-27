"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { NotificationRecord } from "@/lib/admin";
import { notificationPriority } from "@/lib/resident";
import { StatusChip } from "@/components/resident/StatusChip";

interface NotificationCardProps {
  /** The notification to display. */
  notification: NotificationRecord;
  /** Toggle the read state (persists via the backend + shared context). */
  onToggleRead: (id: string, isRead: boolean) => void;
}

/**
 * Derive a deep-link route from a notification's `referenceUrlId` when the
 * prefix identifies the record type (e.g. `INC-…` → incident detail).
 */
export function notificationReferenceHref(referenceUrlId?: string): string | null {
  if (!referenceUrlId) return null;
  const id = referenceUrlId;
  if (/^(INC|incident)/i.test(id)) return `/incidents/${encodeURIComponent(id)}`;
  if (/^(REQ|DOC|request|document)/i.test(id)) {
    return `/documents/${encodeURIComponent(id)}`;
  }
  return null;
}

/**
 * Reusable notification card: read toggle, priority badge (derived from the
 * backend category), title, message, and a deep link to the referenced record.
 */
export function NotificationCard({ notification, onToggleRead }: NotificationCardProps) {
  const href = notificationReferenceHref(notification.referenceUrlId);
  const read = Boolean(notification.isRead);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        bgcolor: read ? "background.paper" : "primary.light",
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
