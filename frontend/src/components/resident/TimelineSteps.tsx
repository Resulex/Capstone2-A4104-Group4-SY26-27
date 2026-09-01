"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import { formatDisplayDate } from "@/lib/resident";

export interface TimelineStep {
  step?: string;
  date?: string;
  status?: string;
}

interface TimelineStepsProps {
  /** Ordered timeline steps (oldest first). */
  steps: TimelineStep[];
}

function StepIcon({ status }: { status?: string }) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "completed" || normalized === "done" || normalized === "released") {
    return <CheckCircleIcon sx={{ fontSize: 22, color: "success.main" }} />;
  }
  if (
    normalized === "in-progress" ||
    normalized === "processing" ||
    normalized === "under review" ||
    normalized === "ready"
  ) {
    return <HourglassTopIcon sx={{ fontSize: 22, color: "warning.main" }} />;
  }
  return <RadioButtonUncheckedIcon sx={{ fontSize: 22, color: "text.disabled" }} />;
}

/**
 * Reusable vertical timeline used on detail pages (e.g. document request
 * progress): each step with a status icon, label and date, joined by a
 * connector line.
 */
export function TimelineSteps({ steps }: TimelineStepsProps) {
  if (steps.length === 0) return null;

  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <Box component="li" key={`${step.step}-${index}`} sx={{ display: "flex", gap: 1.5 }}>
            {/* Icon + connector. */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "background.paper",
                  border: 1,
                  borderColor: "divider",
                }}
              >
                <StepIcon status={step.status} />
              </Box>
              {!isLast && (
                <Box
                  aria-hidden
                  sx={{
                    width: 2,
                    flexGrow: 1,
                    minHeight: 20,
                    bgcolor: "divider",
                    my: 0.5,
                  }}
                />
              )}
            </Box>
            {/* Step content. */}
            <Box sx={{ pb: isLast ? 0 : 2.5, minWidth: 0 }}>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {step.step ?? "Step"}
              </Typography>
              {step.date && (
                <Typography variant="body2" color="text.secondary">
                  {formatDisplayDate(step.date)}
                </Typography>
              )}
              {step.status && (
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
                  {step.status}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
