"use client";

import { ReactNode } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
import Link from "next/link";

interface QuickActionCardProps {
  /** Action title, e.g. "Submit an Incident Report". */
  title: string;
  /** Short supporting description. */
  description: string;
  /** Destination: internal route (`/...`) or external (`tel:`, `https:`). */
  href: string;
  /** Action icon. */
  icon: ReactNode;
  /** Accent color key for the icon badge (e.g. "primary.main"). */
  color: string;
}

/**
 * Reusable quick-action card shown on the dashboard: an icon badge, a title and
 * a description, rendered as a full-tile link (internal routes via Next Link,
 * external schemes such as `tel:` via a plain anchor).
 */
export function QuickActionCard({
  title,
  description,
  href,
  icon,
  color,
}: QuickActionCardProps) {
  const isExternal = /^(https?:|tel:|mailto:)/.test(href);

  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}>
      <CardActionArea
        component={isExternal ? "a" : Link}
        href={href}
        aria-label={title}
        sx={{
          height: "100%",
          p: 2.5,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 1.25,
          textAlign: "left",
        }}
      >
        <Box
          aria-hidden
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: "14px",
            bgcolor: color,
            color: "common.white",
            mb: 0.5,
          }}
        >
          {icon}
        </Box>
        <Typography
          variant="subtitle1"
          component="h3"
          sx={{ fontWeight: 700, lineHeight: 1.3 }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ lineHeight: 1.5 }}
        >
          {description}
        </Typography>
      </CardActionArea>
    </Card>
  );
}
