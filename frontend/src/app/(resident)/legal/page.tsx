"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import { PageHeader } from "@/components/resident/PageHeader";
import { useResident } from "@/context/ResidentContext";
import { acceptResidentTerms } from "@/lib/resident";
import {
  TERMS_SECTIONS,
  PRIVACY_SECTIONS,
} from "@/components/shared/LegalDialog";

/** Format a consent timestamp for display (e.g. "September 6, 2026"). */
function formatConsentDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Data Privacy & Terms of Service (`/legal`).
 *
 * New residents are routed here until they accept. Once agreed, it shows a
 * confirmation with the accepted date instead of the consent checkbox, and
 * records the consent on the backend resident record.
 */
export default function PrivacyTermsPage() {
  const router = useRouter();
  const { profile, setProfile } = useResident();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasConsented = Boolean(profile?.termsAcceptedAt);

  const handleAccept = async () => {
    const id = profile?.residentId ?? profile?._id;
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await acceptResidentTerms(id);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => router.push("/"), 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not record your consent. Please try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <PageHeader
        backHref={hasConsented ? "/" : undefined}
        title="Privacy & Terms"
        subtitle="Data Privacy Policy and Terms of Service"
      />

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {hasConsented && (
            <Alert severity="success" icon={false} sx={{ mb: 3 }}>
              You have agreed to the Terms of Service and Data Privacy Policy on{" "}
              <strong>{formatConsentDate(profile?.termsAcceptedAt)}</strong>.
            </Alert>
          )}

          <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
            Terms of Service
          </Typography>
          {TERMS_SECTIONS.map((section) => (
            <Box key={section.title} sx={{ mb: 3 }}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mb: 0.75 }}>
                {section.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {section.body}
              </Typography>
            </Box>
          ))}

          <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
            Data Privacy Policy
          </Typography>
          {PRIVACY_SECTIONS.map((section) => (
            <Box key={section.title} sx={{ mb: 3 }}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mb: 0.75 }}>
                {section.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {section.body}
              </Typography>
            </Box>
          ))}

          {hasConsented ? (
            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              onClick={() => router.push("/")}
              sx={{ mt: 2 }}
            >
              Back to Dashboard
            </Button>
          ) : (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    color="primary"
                    inputProps={{
                      "aria-label":
                        "I have read and agree to the Terms of Service and Data Privacy Policy",
                    }}
                  />
                }
                label={
                  <Typography component="span" variant="body2">
                    I have read and agree to the{" "}
                    <Link href="/legal">
                      <Typography component="span" color="primary" sx={{ fontWeight: 600 }}>
                        Terms of Service
                      </Typography>
                    </Link>{" "}
                    and{" "}
                    <Link href="/legal">
                      <Typography component="span" color="primary" sx={{ fontWeight: 600 }}>
                        Data Privacy Policy
                      </Typography>
                    </Link>
                    .
                  </Typography>
                }
              />

              <Button
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={!agreed || submitting}
                onClick={handleAccept}
                sx={{ mt: 2 }}
              >
                {submitting ? "Recording…" : "Accept & Continue"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={saved}
        autoHideDuration={2000}
        message="Thank you — your consent has been recorded."
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
