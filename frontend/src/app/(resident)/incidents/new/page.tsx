"use client";

import { FormEvent, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { PageHeader } from "@/components/resident/PageHeader";
import { MediaUploader } from "@/components/shared/MediaUploader";
import { ContactNumberField } from "@/components/shared/ContactNumberField";
import { useResident } from "@/context/ResidentContext";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { useBarangay } from "@/hooks/useBarangay";
import type { Coordinates } from "@/lib/geo";
import { contactNumberError, normalizeContactNumber } from "@/lib/phone";
import {
  INCIDENT_CATEGORIES,
  createIncidentReport,
} from "@/lib/resident";

/**
 * Leaflet reads `window` while its module is evaluated, so the picker must be
 * kept out of the server render. `ssr: false` is allowed here because this page
 * is already a client component.
 */
const LocationPicker = dynamic(
  () => import("@/components/shared/LocationPicker"),
  {
    ssr: false,
    loading: () => <Skeleton variant="rounded" height={300} />,
  },
);

/**
 * New Incident Report (`/incidents/new`).
 *
 * Collects the incident category, description, a contact number and the
 * location, then submits via `POST /incident-reports` and routes to the new
 * report's detail page. The backend's rule-based triage engine assigns the
 * priority on submission.
 *
 * The location is captured two ways. The `purok` is a required selection from
 * the resident's own barangay vocabulary, and is what the backend validates — so
 * a report cannot claim a location the barangay does not cover. The optional
 * `landmark` is free text (`behind the chapel`, `house 12`) and carries the
 * human detail a purok name cannot. A map pin is captured too (stored as
 * `latitude`/`longitude`, and what responders navigate to), but it stays
 * optional so a resident can still file when the map cannot load.
 */

/** Field-level problems, keyed by the input they belong to. */
type FieldErrors = Partial<
  Record<
    "incidentCategory" | "descriptionText" | "purok" | "contactNumber",
    string
  >
>;

export default function NewIncidentReportPage() {
  const router = useRouter();
  const { profile } = useResident();
  const { reload, addIncidentReportLocal } = useResidentDashboard();

  const [incidentCategory, setIncidentCategory] = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  // Older profiles store the `+63…` country-code form, which the digits-only
  // field would reject — normalize it into the local `09…` form up front, the
  // same way the document request form does.
  const [contactNumber, setContactNumber] = useState(() =>
    normalizeContactNumber(profile?.contactNumber ?? ""),
  );
  const [purok, setPurok] = useState("");
  const [landmark, setLandmark] = useState("");
  const [locationPin, setLocationPin] = useState<Coordinates | null>(null);
  const [evidenceMediaUrls, setEvidenceMediaUrls] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  // Frames and clamps the incident map to the resident's own barangay, and
  // supplies the purok vocabulary the location is chosen from.
  const { area: mapArea, puroks, loading: barangayLoading } = useBarangay();
  const puroksUnavailable = !barangayLoading && puroks.length === 0;

  const purokHelp = barangayLoading
    ? "Loading the purok list…"
    : puroksUnavailable
      ? "The purok list for this barangay is unavailable, so the location cannot be validated. Please try again later."
      : (fieldErrors.purok ?? "Choose the purok where the incident happened.");

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  /**
   * The form is `noValidate`, so the browser does not enforce the `required`
   * props. Without this the resident only learns a field is missing from a
   * generic server 400 after the whole request has been sent.
   */
  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!incidentCategory) {
      next.incidentCategory = "Choose the incident category.";
    }
    if (!descriptionText.trim()) {
      next.descriptionText = "Describe what happened.";
    }
    if (!purok) {
      next.purok = "Choose the purok where this happened.";
    }
    // Required: responders need a number to call. The shared field already
    // sanitizes as you type, so this only catches a blank/malformed value at
    // the submit boundary.
    const contactProblem = contactNumberError(contactNumber, { required: true });
    if (contactProblem) {
      next.contactNumber = contactProblem;
    }
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const problems = validate();
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setSubmitting(true);
    try {
      const created = await createIncidentReport({
        incidentCategory,
        descriptionText,
        purok,
        landmark: landmark.trim() || undefined,
        // Blank means "use the number on my profile" — the backend fills the
        // gap from the resident record.
        contactNumber: normalizeContactNumber(contactNumber) || undefined,
        latitude: locationPin?.latitude,
        longitude: locationPin?.longitude,
        evidenceMediaUrls,
      });
      // Show the new report immediately in the shared list state, then refetch
      // the dashboard snapshot so other surfaces stay consistent.
      addIncidentReportLocal(created);
      reload();
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

          {puroksUnavailable && (
            <Alert severity="warning" sx={{ mb: 2.5 }}>
              {"We could not load the purok list for this barangay, so the incident location cannot be validated right now. Please reload the page or try again later."}
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
                onChange={(e) => {
                  setIncidentCategory(e.target.value);
                  clearFieldError("incidentCategory");
                }}
                error={!!fieldErrors.incidentCategory}
                inputProps={{ "aria-label": "Incident category" }}
                helperText={
                  fieldErrors.incidentCategory ??
                  "Choose the category that best fits the incident."
                }
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
                onChange={(e) => {
                  setDescriptionText(e.target.value);
                  clearFieldError("descriptionText");
                }}
                error={!!fieldErrors.descriptionText}
                inputProps={{ "aria-label": "Incident description" }}
                placeholder="Describe what happened…"
                helperText={fieldErrors.descriptionText}
              />

              {/* Carried on the report so responders can call the reporter
                  without leaving the record. Required — a valid 11-digit PH
                  mobile starting with 09. */}
              <ContactNumberField
                value={contactNumber}
                onChange={(next) => {
                  setContactNumber(next);
                  clearFieldError("contactNumber");
                }}
                required
                error={!!fieldErrors.contactNumber}
                helperText={fieldErrors.contactNumber}
              />

              {/* Pin the exact spot. The map is clamped to the barangay, and
                  the pin is the precise location responders navigate to. */}
              <Box>
                <Typography
                  variant="subtitle2"
                  component="h2"
                  sx={{ fontWeight: 700, mb: 1 }}
                >
                  Pin the Location on the Map
                </Typography>
                <LocationPicker
                  value={locationPin}
                  onChange={setLocationPin}
                  area={mapArea}
                />
              </Box>

              {/* The validated half of the location. The purok must be one the
                  resident's barangay recognises, which is what makes the
                  location enforceable instead of free text. */}
              <TextField
                select
                label="Purok"
                required
                fullWidth
                value={purok}
                disabled={barangayLoading || puroksUnavailable}
                onChange={(e) => {
                  setPurok(e.target.value);
                  clearFieldError("purok");
                }}
                error={!!fieldErrors.purok || puroksUnavailable}
                inputProps={{ "aria-label": "Purok" }}
                helperText={purokHelp}
              >
                {puroks.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>

              {/* The human half: a purok name alone rarely pinpoints a spot. */}
              <TextField
                label="Landmark / House No."
                fullWidth
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                inputProps={{ "aria-label": "Landmark or house number" }}
                placeholder="House 12, near the covered court…"
                helperText="Optional. Add a street, house number or nearby landmark so responders can find the exact spot."
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
                disabled={submitting || barangayLoading || puroksUnavailable}
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
