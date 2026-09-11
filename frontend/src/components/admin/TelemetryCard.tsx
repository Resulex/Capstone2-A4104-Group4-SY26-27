"use client";

import { ReactNode } from "react";
import Link from "next/link";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useAccessibilityTheme } from "@/context/ThemeContext";
import { getTelemetryCardGradient } from "@/theme/theme";

interface TelemetryCardProps {
  /** Human-readable label for the metric (e.g. "Pending Incidents"). */
  title: string;
  /** Numeric value to display. */
  value: number;
  /** Icon rendered in the accent badge. */
  icon: ReactNode;
  /** Accent color key (used as the badge background). */
  color: string;
  /** Optional route opened when the card is clicked (acts as a quick link). */
  href?: string;
}

/**
 * Reusable telemetry card showing a single dashboard metric with an icon
 * badge, a large value, and a descriptive label. When `href` is provided, the
 * whole card is a clickable link to that route.
 *
 * The card surface is a top-down wash of the shell header tint fading to
 * white (high-contrast mode flattens it to white).
 */
export function TelemetryCard({
  title,
  value,
  icon,
  color,
  href,
}: TelemetryCardProps) {
  const { highContrast } = useAccessibilityTheme();

  const card = (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        backgroundImage: getTelemetryCardGradient(highContrast),
        transition: "box-shadow 0.2s ease",
        "&:hover": { boxShadow: 3 },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" component="h2">
            {title}
          </Typography>
          <Box
            aria-hidden
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: "12px",
              bgcolor: color,
              color: "common.white",
            }}
          >
            {icon}
          </Box>
        </Box>
        <Typography variant="h3" component="p" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      aria-label={`View ${title}`}
      style={{ display: "block", height: "100%", color: "inherit", textDecoration: "none" }}
    >
      {card}
    </Link>
  );
}
