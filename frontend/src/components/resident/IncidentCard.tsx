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
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import { IncidentRecord } from "@/lib/admin";
import { StatusChip } from "@/components/resident/StatusChip";

interface IncidentCardProps {
  /** The incident report to display. */
  incident: IncidentRecord;
  /** Detail route, e.g. `/incidents/{incidentId}`. */
  href: string;
  /** True while the barangay has updated this report and it is unseen. */
  isUnread?: boolean;
  /** Toggle the read state for this record (omitted on read-only surfaces). */
  onToggleRead?: (referenceUrlId: string, isRead: boolean) => void;
}

/**
 * Reusable incident-report card: the category as the title, a description
 * snippet, the incident status, and the triage-priority badge.
 *
 * `isUnread`/`onToggleRead` stay optional so the dashboard can render it with
 * no notification state at all.
 */
export function IncidentCard({
  incident,
  href,
  isUnread = false,
  onToggleRead,
}: IncidentCardProps) {
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
        aria-label={`${incident.incidentCategory} incident report`}
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
                bgcolor: "warning.main",
                color: "common.white",
                flexShrink: 0,
              }}
            >
              <WarningAmberIcon />
            </Box>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 0.75,
                  mb: 0.5,
                  // Keep the title clear of the corner read toggle.
                  pr: onToggleRead ? 4 : 0,
                }}
              >
                <Typography
                  variant="subtitle1"
                  component="h3"
                  sx={{ fontWeight: 700, lineHeight: 1.3 }}
                >
                  {incident.incidentCategory}
                </Typography>
                {isUnread && <Chip label="New" size="small" color="primary" />}
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {incident.descriptionText}
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
              gap: 0.75,
            }}
          >
            <StatusChip status={incident.incidentStatus} />
            <StatusChip status={incident.triagePriority} />
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
                ? `Mark ${incident.incidentId} as read`
                : `Mark ${incident.incidentId} as unread`
            }
            onClick={() => onToggleRead(incident.incidentId, !isUnread)}
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
