"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { IncidentRecord } from "@/lib/admin";
import { StatusChip } from "@/components/resident/StatusChip";

interface IncidentCardProps {
  /** The incident report to display. */
  incident: IncidentRecord;
  /** Detail route, e.g. `/incidents/{incidentId}`. */
  href: string;
}

/**
 * Reusable incident-report card: the category as the title, a description
 * snippet, the incident status, and the triage-priority badge.
 */
export function IncidentCard({ incident, href }: IncidentCardProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
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
              <Typography
                variant="subtitle1"
                component="h3"
                sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.5 }}
              >
                {incident.incidentCategory}
              </Typography>
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
    </Card>
  );
}
