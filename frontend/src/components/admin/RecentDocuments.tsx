"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DescriptionIcon from "@mui/icons-material/Description";
import { DocumentRequestRecord } from "@/lib/telemetry";

interface RecentDocumentsProps {
  /** Most recently requested documents, newest first. */
  documents: DocumentRequestRecord[];
}

/** Color mapping for a document request's current status. */
function statusColor(status: string) {
  switch (status) {
    case "Ready for Pickup":
    case "Released":
      return "success" as const;
    case "Rejected":
      return "error" as const;
    case "Processing":
      return "info" as const;
    default:
      return "warning" as const;
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Recent Documents queue — a compact list of the latest document requests.
 */
export function RecentDocuments({ documents }: RecentDocumentsProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <DescriptionIcon color="primary" />
          <Typography variant="h6" component="h2">
            Recent Documents
          </Typography>
        </Stack>

        {documents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No document requests yet.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1.5}>
            {documents.map((doc) => (
              <Stack key={doc.requestId} direction="row" alignItems="center" spacing={2}>
                <Avatar
                  sx={{ width: 36, height: 36, bgcolor: "secondary.main", fontSize: 14 }}
                >
                  {doc.documentType.slice(0, 1).toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {doc.applicantDetails?.fullName ?? "Applicant"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {doc.documentType}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Chip
                    label={doc.currentStatus}
                    size="small"
                    color={statusColor(doc.currentStatus)}
                    variant="outlined"
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {formatDate(doc.dateRequested)}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
