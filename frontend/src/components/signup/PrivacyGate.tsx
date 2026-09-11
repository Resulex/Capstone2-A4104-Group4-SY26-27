"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import Link from "next/link";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import {
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
} from "@/components/shared/LegalDialog";

interface PrivacyGateProps {
  /** Called when the user ticks the checkbox and presses "Agree & Continue". */
  onAgree: () => void;
}

/** A titled block of legal copy rendered inside the scrollable region. */
function LegalSection({ title, body }: { title: string; body: string }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography
        variant="subtitle1"
        component="h3"
        sx={{ fontWeight: 700, mb: 0.5 }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ lineHeight: 1.7 }}
      >
        {body}
      </Typography>
    </Box>
  );
}

/**
 * First screen of `/signup`. Shows the full Terms of Service and Data Privacy
 * Policy and blocks the resident from proceeding to the Create Account form
 * until they scroll to the end and agree.
 */
export function PrivacyGate({ onAgree }: PrivacyGateProps) {
  const [agreed, setAgreed] = useState(false);
  const [hasReadToEnd, setHasReadToEnd] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /**
   * Enable the agreement checkbox once the legal text has been scrolled to the
   * end. Sticky: once unlocked it never re-locks if the user scrolls back up.
   */
  const updateReadToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 8px tolerance for sub-pixel rounding / zoom.
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight <= 8;
    if (atEnd) setHasReadToEnd(true);
  }, []);

  // Evaluate on mount (the text may already fit without scrolling on a wide
  // viewport or at a small font scale) and again whenever the window resizes.
  useEffect(() => {
    updateReadToEnd();
    window.addEventListener("resize", updateReadToEnd);
    return () => window.removeEventListener("resize", updateReadToEnd);
  }, [updateReadToEnd]);

  return (
    <>
      <Box
        sx={{
          bgcolor: "common.black",
          color: "common.white",
          px: { xs: 2.5, sm: 3.5 },
          py: 2.25,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <ShieldOutlined fontSize="large" />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          Terms of Service &amp; Data Privacy Policy
        </Typography>
      </Box>

      <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Stack spacing={2.5}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ lineHeight: 1.6 }}
          >
            Please review the Terms of Service and Data Privacy Policy below.
            You must agree to both before creating your KaBarangayConnect
            account.
          </Typography>

          <Box
            ref={scrollRef}
            onScroll={updateReadToEnd}
            role="region"
            aria-label="Terms of Service and Data Privacy Policy"
            tabIndex={0}
            sx={{
              maxHeight: 320,
              overflowY: "auto",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              p: { xs: 2, sm: 2.5 },
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
              "&:focus-visible": {
                outline: (theme) =>
                  `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              },
            }}
          >
            <Typography
              variant="h6"
              component="h2"
              sx={{ fontWeight: 700, mb: 1.5 }}
            >
              Terms of Service
            </Typography>
            {TERMS_SECTIONS.map((section) => (
              <LegalSection key={section.title} {...section} />
            ))}
            <hr />
            <Typography
              variant="h6"
              component="h2"
              sx={{ fontWeight: 700, mt: 1, mb: 1.5 }}
            >
              Data Privacy Policy
            </Typography>
            {PRIVACY_SECTIONS.map((section) => (
              <LegalSection key={section.title} {...section} />
            ))}
          </Box>

          {!hasReadToEnd && (
            <Typography
              id="legal-scroll-hint"
              variant="caption"
              color="text.secondary"
              sx={{ display: "block" }}
            >
              Scroll to the bottom of the Terms of Service and Data Privacy
              Policy to enable the agreement checkbox.
            </Typography>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={!hasReadToEnd}
                color="primary"
                inputProps={{
                  "aria-label":
                    "I have read and agree to the Terms of Service and Data Privacy Policy",
                  "aria-describedby": hasReadToEnd
                    ? undefined
                    : "legal-scroll-hint",
                }}
              />
            }
            label={
              <Typography component="span" variant="body2">
                I have read and agree to the Terms of Service and Data Privacy
                Policy under RA 10173.
              </Typography>
            }
          />

          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={!agreed}
            onClick={onAgree}
            sx={{
              bgcolor: "common.black",
              color: "common.white",
              "&:hover": { bgcolor: "grey.900" },
            }}
          >
            Agree &amp; Continue
          </Button>

          <Typography
            component="span"
            variant="body2"
            align="center"
            color="text.secondary"
            sx={{ display: "block" }}
          >
            Already have an account?{" "}
            <Link href="/login">
              <Typography component="span" color="primary" sx={{ fontWeight: 600 }}>
                Log in
              </Typography>
            </Link>
          </Typography>
        </Stack>
      </Box>
    </>
  );
}
