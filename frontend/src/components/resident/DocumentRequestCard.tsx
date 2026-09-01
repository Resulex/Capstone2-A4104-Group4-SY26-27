"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import DescriptionIcon from "@mui/icons-material/Description";
import { DocumentQueueRecord } from "@/lib/admin";
import { formatDisplayDate } from "@/lib/resident";
import { StatusChip } from "@/components/resident/StatusChip";

interface DocumentRequestCardProps {
  /** The document request to display. */
  request: DocumentQueueRecord;
  /** Detail route, e.g. `/documents/{requestId}`. */
  href: string;
}

/**
 * Reusable document-request card: document type, current status chip and the
 * expected completion date. Used on the dashboard and the requests list.
 */
export function DocumentRequestCard({ request, href }: DocumentRequestCardProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
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
              <Typography
                variant="subtitle1"
                component="h3"
                sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.5 }}
              >
                {request.documentType}
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
    </Card>
  );
}
