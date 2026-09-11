"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import DescriptionIcon from "@mui/icons-material/Description";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import { DocumentQueueRecord } from "@/lib/admin";
import { formatDisplayDate } from "@/lib/resident";
import { StatusChip } from "@/components/resident/StatusChip";

interface DocumentRequestCardProps {
  /** The document request to display. */
  request: DocumentQueueRecord;
  /** Detail route, e.g. `/documents/{requestId}`. */
  href: string;
  /** True while the barangay has updated this request and it is unseen. */
  isUnread?: boolean;
  /** Toggle the read state for this record (omitted on read-only surfaces). */
  onToggleRead?: (referenceUrlId: string, isRead: boolean) => void;
}

/**
 * Reusable document-request card: document type, current status chip and the
 * expected completion date. Used on the dashboard and the requests list.
 *
 * `isUnread`/`onToggleRead` stay optional so the dashboard can render it with
 * no notification state at all.
 */
export function DocumentRequestCard({
  request,
  href,
  isUnread = false,
  onToggleRead,
}: DocumentRequestCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        position: "relative",
        borderRadius: 3,
        // Unread records get the same tint the notification centre uses.
        bgcolor: isUnread ? "primary.light" : undefined,
      }}
    >
      <CardActionArea
        component={Link}
        href={href}
        aria-label={`${request.documentType} request`}
        sx={{ display: "block" }}
      >
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Box
              aria-hidden
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: "12px",
                bgcolor: "primary.main",
                color: "common.white",
                flexShrink: 0,
              }}
            >
              <DescriptionIcon />
            </Box>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 0.75,
                  mb: 0.25,
                  // Keep the title clear of the corner read toggle.
                  pr: onToggleRead ? 4 : 0,
                }}
              >
                <Typography
                  variant="subtitle1"
                  component="h3"
                  sx={{ fontWeight: 700, lineHeight: 1.3 }}
                >
                  {request.documentType}
                </Typography>
                {isUnread && <Chip label="New" size="small" color="primary" />}
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                Request ID: {request.requestId}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                <StatusChip status={request.currentStatus} />
              </Box>
            </Box>
          </Box>
          <Box
            sx={{
              mt: 1.5,
              pt: 1.5,
              borderTop: 1,
              borderColor: "divider",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Expected completion
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {formatDisplayDate(request.expectedCompletionDate) || "—"}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
      {onToggleRead && (
        // A sibling of the link, never a child: a button inside the
        // CardActionArea's anchor would be invalid and break keyboard use.
        <Tooltip title={isUnread ? "Mark as read" : "Mark as unread"}>
          <IconButton
            size="small"
            aria-label={
              isUnread
                ? `Mark ${request.requestId} as read`
                : `Mark ${request.requestId} as unread`
            }
            onClick={() => onToggleRead(request.requestId, !isUnread)}
            sx={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
          >
            {isUnread ? (
              <MarkEmailReadIcon fontSize="small" />
            ) : (
              <MarkEmailUnreadIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Card>
  );
}
