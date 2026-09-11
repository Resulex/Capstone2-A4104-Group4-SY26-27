"use client";

import {
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { PageHeader } from "@/components/resident/PageHeader";
import { useAuth } from "@/context/AuthContext";
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
 * Scroll the requested section into view and move keyboard focus to its
 * heading, so keyboard and screen-reader users land on the right text.
 */
function focusSection(id: string) {
  const heading = document.getElementById(id);
  if (!heading) return;
  heading.scrollIntoView({ behavior: "smooth", block: "start" });
  heading.focus({ preventScroll: true });
}

/**
 * In-page "jump to section" control.
 *
 * Rendered as an inline `<span role="button">` rather than a real `<button>`:
 * an inline-block button inflates the line box it sits in, which pushes the
 * label text off-centre from the checkbox. An inline element flows with the
 * sentence exactly like the plain text it replaces, so the checkbox and text
 * stay aligned. Keyboard activation (Enter / Space) is wired up manually.
 */
function SectionJumpButton({
  targetId,
  children,
}: {
  targetId: string;
  children: ReactNode;
}) {
  const jump = () => focusSection(targetId);

  const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
    // Don't let the click reach the surrounding FormControlLabel and toggle it.
    event.preventDefault();
    event.stopPropagation();
    jump();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    // Space would otherwise scroll the page.
    event.preventDefault();
    event.stopPropagation();
    jump();
  };

  return (
    <Typography
      component="span"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      sx={{
        // `font: inherit` keeps the type identical to the surrounding label
        // text, so the line box (and therefore the baseline) is unchanged.
        font: "inherit",
        color: "primary.main",
        fontWeight: 600,
        cursor: "pointer",
        textDecoration: "none",
        "&:hover": { textDecoration: "underline" },
        "&:focus-visible": {
          outline: (theme) => `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
          borderRadius: 0.5,
        },
      }}
    >
      {children}
    </Typography>
  );
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
  const { user, refreshSession } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server-verified consent; the cached profile is only used for display.
  const hasConsented = Boolean(user?.termsAcceptedAt);

  const handleAccept = async () => {
    const id = profile?.residentId ?? profile?._id;
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await acceptResidentTerms(id);
      setProfile(updated);
      // Re-read the session so the portal gate lifts without a reload.
      const session = await refreshSession();
      if (!session?.termsAcceptedAt) {
        // The backend saved the consent but the portal could not confirm it.
        // This almost always means the backend is not serving
        // `GET /residents/me/consent` yet — restart `npm run offline` so the
        // new route is registered. Fail loudly rather than silently returning
        // the resident to this page.
        throw new Error(
          "Your consent was saved, but the portal could not confirm it. Reload the page, or restart the backend if this keeps happening.",
        );
      }
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
              <strong>
                {formatConsentDate(
                  user?.termsAcceptedAt ?? profile?.termsAcceptedAt,
                )}
              </strong>
              .
            </Alert>
          )}

          <Typography
            id="terms-of-service"
            variant="h6"
            component="h2"
            tabIndex={-1}
            sx={{ fontWeight: 700, mt: 2, mb: 1, scrollMarginTop: 96 }}
          >
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
          <hr />
          <Typography
            id="data-privacy-policy"
            variant="h6"
            component="h2"
            tabIndex={-1}
            sx={{ fontWeight: 700, mt: 2, mb: 1, scrollMarginTop: 96 }}
          >
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
              sx={{
    alignItems: "center",
    "& .MuiFormControlLabel-label": {
      lineHeight: 1.5,
    },
  }}
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
                  <Typography component="span" variant="body2" sx={{
        lineHeight: 1.5,
      }}>
                    I have read and agree to the{" "}
                    <SectionJumpButton targetId="terms-of-service">
                      Terms of Service
                    </SectionJumpButton>{" "}
                    and{" "}
                    <SectionJumpButton targetId="data-privacy-policy">
                      Data Privacy Policy
                    </SectionJumpButton>
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
