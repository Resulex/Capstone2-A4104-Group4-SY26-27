"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import CircleIcon from "@mui/icons-material/Circle";
import { formatDisplayDate } from "@/lib/resident";

export interface TimelineStep {
  step?: string;
  date?: string;
  status?: string;
  /** Admin note recorded with this transition. */
  remarks?: string;
  /** Who made the change — rendered only when `showActor` is set. */
  changedBy?: { userId?: string; fullName?: string };
  /** Original report id when this step marks a duplicate. */
  duplicateOfIncidentId?: string;
}

interface TimelineStepsProps {
  /** Ordered timeline steps (oldest first). */
  steps: TimelineStep[];
  /**
   * Render the officer who made each change. Left off for resident-facing
   * views, where the actors are intentionally hidden.
   */
  showActor?: boolean;
  /**
   * The record's status right now. The latest step whose label matches gets a
   * "Current status" marker instead of a completed check, so the history does
   * not read as if every step — including the present one — is already done.
   */
  currentStatus?: string;
}

/** Entry states that merely restate what the check icon already conveys. */
const DONE_STATUSES = new Set(["completed", "complete", "done", "released"]);

function StepIcon({ status, current }: { status?: string; current: boolean }) {
  // "You are here" rather than a finished milestone.
  if (current) {
    return <CircleIcon sx={{ fontSize: 13, color: "primary.main" }} />;
  }
  const normalized = (status ?? "").toLowerCase();
  if (DONE_STATUSES.has(normalized)) {
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
 * Reusable vertical timeline for record histories (document request progress
 * and incident report status changes): each step shows a status icon, label,
 * date, any remark recorded with the change, and — for staff views — the
 * officer behind it. The step matching `currentStatus` is marked as the
 * current state instead of a finished one.
 */
export function TimelineSteps({
  steps,
  showActor = false,
  currentStatus,
}: TimelineStepsProps) {
  if (steps.length === 0) return null;

  // Match on the label rather than assuming the last entry is current: seeded
  // histories can end with a step that no longer reflects the record.
  const target = currentStatus?.trim().toLowerCase();
  let currentIndex = -1;
  if (target) {
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      if ((steps[i]?.step ?? "").trim().toLowerCase() === target) {
        currentIndex = i;
        break;
      }
    }
  }

  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCurrent = index === currentIndex;
        const normalizedStatus = (step.status ?? "").trim().toLowerCase();
        // Skip captions like "Completed" — the green check already says it, and
        // repeating it on every row buried the information that matters.
        const showStatusCaption =
          Boolean(step.status) && !DONE_STATUSES.has(normalizedStatus);
        return (
          <Box component="li" key={`${step.step}-${index}`} sx={{ display: "flex", gap: 1.5 }}>
            {/* Icon + connector. */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Box
                sx={(theme) => ({
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "background.paper",
                  border: 1,
                  borderColor: isCurrent ? "primary.main" : "divider",
                  ...(isCurrent && {
                    boxShadow: `0 0 0 3px ${theme.palette.primary.main}1f`,
                  }),
                })}
              >
                <StepIcon status={step.status} current={isCurrent} />
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
              <Typography
                variant="body1"
                sx={{ fontWeight: 700, color: isCurrent ? "primary.main" : "text.primary" }}
              >
                {step.step ?? "Step"}
              </Typography>
              {step.date && (
                <Typography variant="body2" color="text.secondary">
                  {formatDisplayDate(step.date)}
                </Typography>
              )}
              {isCurrent ? (
                <Typography
                  variant="caption"
                  sx={{ display: "block", color: "primary.main", fontWeight: 700 }}
                >
                  Current status
                </Typography>
              ) : (
                showStatusCaption && (
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
                    {step.status}
                  </Typography>
                )
              )}
              {step.remarks && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.25, fontStyle: "italic" }}
                >
                  “{step.remarks}”
                </Typography>
              )}
              {step.duplicateOfIncidentId && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                  Duplicate of {step.duplicateOfIncidentId}
                </Typography>
              )}
              {showActor && step.changedBy?.fullName && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                  Changed by {step.changedBy.fullName}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
