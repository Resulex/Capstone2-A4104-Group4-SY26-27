"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

interface StepHeaderProps {
  /** Current step number (1-based). */
  step: number;
  /** Total number of steps in the flow. */
  total?: number;
  /** Subtitle shown in the instruction banner, e.g. "Basic Information". */
  heading: string;
  /** Main title in the dark header band. */
  title?: string;
}

/**
 * Sign-up header: a dark "Create Account" band plus a light-blue instruction
 * banner reading "Step X of Y — <heading>". Matches the resident sign-up mock.
 */
export function StepHeader({
  step,
  total = 2,
  heading,
  title = "Create Account",
}: StepHeaderProps) {
  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          bgcolor: "common.black",
          color: "common.white",
          px: { xs: 2.5, sm: 3.5 },
          py: 2.25,
        }}
      >
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          px: { xs: 2.5, sm: 3.5 },
          py: 1.25,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography
          variant="body2"
          color="primary.main"
          sx={{ fontWeight: 600 }}
        >
          Step {step} of {total} — {heading}
        </Typography>
      </Box>
    </Box>
  );
}
