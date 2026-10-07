"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CampaignIcon from "@mui/icons-material/Campaign";
import CarCrashIcon from "@mui/icons-material/CarCrash";
import ConstructionIcon from "@mui/icons-material/Construction";
import FamilyRestroomIcon from "@mui/icons-material/FamilyRestroom";
import GavelIcon from "@mui/icons-material/Gavel";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import WaterIcon from "@mui/icons-material/Water";
import type { SvgIconComponent } from "@mui/icons-material";
import { PageHeader } from "@/components/resident/PageHeader";
import { MediaUploader } from "@/components/shared/MediaUploader";
import { useResidentDashboard } from "@/context/ResidentDashboardContext";
import { useBarangay } from "@/hooks/useBarangay";
import type { Coordinates } from "@/lib/geo";
import {
  INCIDENT_CATEGORIES,
  createIncidentReport,
  reverseGeocode,
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
 * Deliberately low-friction for a panicking resident: only the incident
 * category is required. The category is a grid of icon buttons, the map
 * auto-pins to the resident's current location, and a free-text Location field
 * is auto-filled from the pin (reverse-geocoded) but remains editable. The note
 * ("Additional note / context"), the pin and the evidence are all optional.
 *
 * Submits via `POST /incident-reports` and routes to the new report's detail
 * page. The backend's rule-based triage engine assigns the priority.
 */

/** Icons for each incident category button. */
const CATEGORY_ICONS: Record<string, SvgIconComponent> = {
  Fire: LocalFireDepartmentIcon,
  Flood: WaterIcon,
  "Medical Emergency": MedicalServicesIcon,
  "Criminal Activity": GavelIcon,
  "Road Accident": CarCrashIcon,
  "Domestic Dispute": FamilyRestroomIcon,
  "Infrastructure Damage": ConstructionIcon,
  "Public Disturbance": CampaignIcon,
  Other: MoreHorizIcon,
};

/** Field-level problems, keyed by the input they belong to. */
type FieldErrors = Partial<Record<"incidentCategory", string>>;

export default function NewIncidentReportPage() {
  const router = useRouter();
  const { reload, addIncidentReportLocal } = useResidentDashboard();

  const [incidentCategory, setIncidentCategory] = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  const [locationText, setLocationText] = useState("");
  const [locationPin, setLocationPin] = useState<Coordinates | null>(null);
  const [evidenceMediaUrls, setEvidenceMediaUrls] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  // Frames and clamps the incident map to the resident's own barangay.
  const { area: mapArea } = useBarangay();

  // Once the resident types their own Location text, later pin moves must not
  // overwrite it: the auto-fill only applies while the field is untouched.
  const locationEditedRef = useRef(false);

  // Auto-fill the Location field from the pin (debounced). When the reverse
  // geocode fails the field simply stays blank and the resident can type it.
  useEffect(() => {
    if (!locationPin || locationEditedRef.current) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void reverseGeocode(locationPin.latitude, locationPin.longitude).then(
        (address) => {
          if (cancelled || !address || locationEditedRef.current) return;
          setLocationText(address);
        },
      );
    }, 900);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locationPin]);

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
        descriptionText: descriptionText.trim(),
        landmark: locationText.trim() || undefined,
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

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Stack spacing={2.5}>
              <Box>
                <Typography
                  variant="subtitle2"
                  component="h2"
                  sx={{ fontWeight: 700, mb: 1 }}
                >
                  Incident Category
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr" },
                    gap: 1,
                  }}
                >
                  {INCIDENT_CATEGORIES.map((category) => {
                    const Icon = CATEGORY_ICONS[category] ?? MoreHorizIcon;
                    const selected = incidentCategory === category;
                    return (
                      <Button
                        key={category}
                        type="button"
                        variant={selected ? "contained" : "outlined"}
                        color="primary"
                        startIcon={<Icon />}
                        aria-pressed={selected}
                        onClick={() => {
                          setIncidentCategory(category);
                          clearFieldError("incidentCategory");
                        }}
                        sx={{
                          justifyContent: "flex-start",
                          textAlign: "left",
                          textTransform: "none",
                          lineHeight: 1.3,
                        }}
                      >
                        {category}
                      </Button>
                    );
                  })}
                </Box>
                <Typography
                  variant="caption"
                  color={
                    fieldErrors.incidentCategory ? "error" : "text.secondary"
                  }
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {fieldErrors.incidentCategory ??
                    "Choose the category that best fits the incident."}
                </Typography>
              </Box>

              {/* Pin the exact spot. The map auto-pins to the resident's current
                  location and is clamped to the barangay; the pin is the precise
                  location responders navigate to. */}
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
                  autoLocate
                />
              </Box>

              {/* Auto-filled from the pin, but editable so the resident can add
                  the human detail (a street, house number or landmark). */}
              <TextField
                label="Location"
                fullWidth
                value={locationText}
                onChange={(e) => {
                  locationEditedRef.current = true;
                  setLocationText(e.target.value);
                }}
                inputProps={{ "aria-label": "Incident location" }}
                placeholder="e.g. 123 Rizal Street, near the covered court…"
                helperText="Auto-filled from the map pin. You can edit this to add a landmark or house number."
              />

              <TextField
                label="Additional Note / Context"
                fullWidth
                multiline
                minRows={4}
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
                inputProps={{ "aria-label": "Additional note or context" }}
                placeholder="Describe what happened (optional)…"
                helperText="Optional. Any extra detail that helps responders."
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
