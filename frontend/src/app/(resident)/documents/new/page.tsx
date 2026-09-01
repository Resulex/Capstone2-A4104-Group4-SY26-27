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
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { PageHeader } from "@/components/resident/PageHeader";
import { MediaUploader } from "@/components/shared/MediaUploader";
import {
  DOCUMENT_PURPOSES,
  DOCUMENT_TYPES,
  createDocumentRequest,
  newId,
} from "@/lib/resident";

const PROCESSING_INFO = [
  "Processing time: 2–3 business days.",
  "You will be contacted via phone or email.",
  "Please bring a valid ID when claiming documents at the barangay hall.",
  "Processing fees may apply as per barangay ordinance.",
];

/** Default completion date if the resident leaves the field blank. */
function defaultCompletionDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

/**
 * New Document Request (`/documents/new`).
 *
 * Collects the document type, purpose and an optional expected-completion date,
 * then submits via `POST /document-requests` and routes to the new request's
 * detail page. (Photo upload UI is shown but disabled — no backend upload
 * endpoint exists yet.)
 */
export default function NewDocumentRequestPage() {
  const router = useRouter();

  const [documentType, setDocumentType] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("");
  const [verificationIdUrl, setVerificationIdUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    setSubmitting(true);
    try {
      const created = await createDocumentRequest({
        requestId: newId(),
        documentType,
        purpose,
        expectedCompletionDate:
          expectedCompletionDate || defaultCompletionDate(),
        verificationIdUrl,
      });
      setSuccessOpen(true);
      setTimeout(() => {
        router.push(`/documents/${encodeURIComponent(created.requestId)}`);
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit your request.",
      );
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 680, mx: "auto" }}>
      <PageHeader
        backHref="/documents"
        title="New Document Request"
        subtitle="Apply for a barangay document online."
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
                label="Document Type"
                required
                fullWidth
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                inputProps={{ "aria-label": "Document type" }}
                helperText="Choose the document you need."
              >
                {DOCUMENT_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Purpose"
                required
                fullWidth
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                inputProps={{ "aria-label": "Purpose" }}
                helperText="Why do you need this document?"
              >
                {DOCUMENT_PURPOSES.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Expected Completion (optional)"
                type="date"
                fullWidth
                value={expectedCompletionDate}
                onChange={(e) => setExpectedCompletionDate(e.target.value)}
                inputProps={{ "aria-label": "Expected completion date" }}
                helperText="Leave blank to use the standard processing estimate."
                InputLabelProps={{ shrink: true }}
              />

              {/* Verification ID photo (uploaded via S3 presigned URL). */}
              <MediaUploader
                label="Verification ID Photo"
                value={verificationIdUrl ? [verificationIdUrl] : []}
                onChange={(urls) => setVerificationIdUrl(urls[0] ?? "")}
                folder="verification"
                multiple={false}
                maxFiles={1}
                accept="image/*"
                helperText="Tap to capture or upload a government-issued ID."
              />

              {/* Processing information. */}
              <Box
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2.5,
                  bgcolor: "background.default",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 20, color: "primary.main" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Processing Information
                  </Typography>
                </Box>
                <Stack spacing={0.5} component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {PROCESSING_INFO.map((line) => (
                    <Typography key={line} component="li" variant="body2" color="text.secondary">
                      {line}
                    </Typography>
                  ))}
                </Stack>
              </Box>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={successOpen}
        autoHideDuration={2000}
        message="Document request submitted successfully."
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
