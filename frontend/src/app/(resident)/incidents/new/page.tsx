"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { PageHeader } from "@/components/resident/PageHeader";
import { MediaUploader } from "@/components/shared/MediaUploader";
import {
  INCIDENT_CATEGORIES,
  createIncidentReport,
  newId,
} from "@/lib/resident";

/**
 * New Incident Report (`/incidents/new`).
 *
 * Collects the incident category, description and location, then submits via
 * `POST /incident-reports` and routes to the new report's detail page. The
 * backend's rule-based triage engine assigns the priority on submission.
 * (Photo/video upload UI is shown but disabled — no backend upload endpoint
 * exists yet.)
 */
export default function NewIncidentReportPage() {
  const router = useRouter();

  const [incidentCategory, setIncidentCategory] = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  const [locationDetails, setLocationDetails] = useState("");
  const [evidenceMediaUrls, setEvidenceMediaUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    setSubmitting(true);
    try {
      const created = await createIncidentReport({
        incidentId: newId(),
        incidentCategory,
        descriptionText,
        locationDetails,
        evidenceMediaUrls,
      });
      setSuccessOpen(true);
      const target = created.incidentId ?? created._id;
      setTimeout(() => {
        router.push(
          target ? `/incidents/${encodeURIComponent(target)}` : "/incidents",
        );
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit your report.",
      );
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 680, mx: "auto" }}>
      <PageHeader
        backHref="/incidents"
        title="New Incident Report"
        subtitle="Tell us what happened so the barangay can respond."
      />

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2.5}>
              <TextField
                select
                label="Incident Category"
                required
                fullWidth
                value={incidentCategory}
                onChange={(e) => setIncidentCategory(e.target.value)}
                inputProps={{ "aria-label": "Incident category" }}
                helperText="Choose the category that best fits the incident."
              >
                {INCIDENT_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Description"
                required
                fullWidth
                multiline
                minRows={4}
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
                inputProps={{ "aria-label": "Incident description" }}
                placeholder="Describe what happened…"
              />

              <TextField
                label="Location Details"
                required
                fullWidth
                value={locationDetails}
                onChange={(e) => setLocationDetails(e.target.value)}
                inputProps={{ "aria-label": "Incident location" }}
                placeholder="Street, Landmark, Purok…"
              />

              {/* Evidence media (uploaded via S3 presigned URLs). */}
              <MediaUploader
                label="Photos / Videos"
                value={evidenceMediaUrls}
                onChange={setEvidenceMediaUrls}
                folder="evidence"
                multiple
                accept="image/*,video/*"
                maxFiles={6}
                helperText="Attach photos or videos as evidence."
              />

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  bgcolor: "background.default",
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  px: 2,
                  py: 1.5,
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 20, color: "primary.main" }} />
                <Typography variant="body2" color="text.secondary">
                  A rule-based triage engine will auto-assign the priority level
                  upon submission.
                </Typography>
              </Box>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit Report"}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={successOpen}
        autoHideDuration={2000}
        message="Incident report submitted successfully."
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
