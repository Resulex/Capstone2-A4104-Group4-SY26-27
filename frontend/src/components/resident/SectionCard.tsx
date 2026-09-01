"use client";

import { ReactNode } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { SxProps, Theme } from "@mui/material/styles";

interface SectionCardProps {
  /** Section title shown in the card header. */
  title: string;
  /** Optional short description under the title. */
  subtitle?: string;
  /** Optional "See all"-style link (rendered on the right of the header). */
  actionHref?: string;
  /** Optional action label (defaults to "See All"). */
  actionLabel?: string;
  /** Card body. */
  children: ReactNode;
  /** Extra styling (spacing, width, etc.). */
  sx?: SxProps<Theme>;
}

/**
 * Reusable section card with a consistent header (title + optional "See All"
 * link) and a body. Used across resident pages to keep section framing uniform.
 */
export function SectionCard({
  title,
  subtitle,
  actionHref,
  actionLabel = "See All",
  children,
  sx,
}: SectionCardProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: "100%", ...sx }}>
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.25 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {actionHref && (
            <Link
              href={actionHref}
              aria-label={`${actionLabel} — ${title}`}
              style={{ textDecoration: "none" }}
            >
              <Typography
                component="span"
                variant="body2"
                color="primary"
                sx={{
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  whiteSpace: "nowrap",
                }}
              >
                {actionLabel}
                <ArrowForwardIcon sx={{ fontSize: 18 }} />
              </Typography>
            </Link>
          )}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}
