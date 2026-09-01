"use client";

import { ReactNode } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface PageHeaderProps {
  /** Page heading text. */
  title: string;
  /** Optional supporting paragraph shown under the heading. */
  subtitle?: string;
  /** Optional action node rendered on the right (button/link). */
  action?: ReactNode;
  /** Optional route to go back to; renders a "Back" button above the title. */
  backHref?: string;
  /** Optional aria-label for the back button (defaults to "Back"). */
  backLabel?: string;
}

/**
 * Reusable page header used at the top of resident sub-pages: a title, an
 * optional subtitle, and an optional action aligned to the end. When `backHref`
 * is provided a "Back" button is shown above the title (used by form/detail
 * sub-pages).
 */
export function PageHeader({
  title,
  subtitle,
  action,
  backHref,
  backLabel,
}: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        flexDirection: { xs: "column", sm: "row" },
        gap: 2,
        mb: 3,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {backHref && (
          <Tooltip title="Back">
            <IconButton
              component={Link}
              href={backHref}
              aria-label={backLabel ?? "Back"}
              sx={{ mb: 0.5, ml: -1.25 }}
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
        )}
        <Typography variant="h5" component="h1" gutterBottom={!subtitle}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && (
        <Box sx={{ flexShrink: 0, width: { xs: "100%", sm: "auto" } }}>
          {action}
        </Box>
      )}
    </Box>
  );
}
