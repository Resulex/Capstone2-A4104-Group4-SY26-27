"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";

const SECTIONS = [
  {
    title: "Data Privacy Act of 2012 Compliance",
    body: "KaBarangayConnect collects your personal information to deliver barangay services. Your data is processed lawfully, fairly, and transparently in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173), used only for legitimate purposes, and never sold.",
  },
  {
    title: "Information We Collect",
    body: "We collect the details you provide during registration — your name, email address, contact number, and residential address — together with information you submit for barangay services such as document requests, incident reports, and chat messages with barangay responders.",
  },
  {
    title: "How We Use Your Data",
    body: "Your data is used to process requests, coordinate emergency and incident responses, keep you informed through notifications and announcements, and improve barangay services.",
  },
];

interface PrivacyGateProps {
  /** Called when the user ticks the checkbox and presses "Agree & Continue". */
  onAgree: () => void;
}

/**
 * First screen of `/signup`. Presents the Data Privacy & Agreements and blocks
 * the resident from proceeding to the Create Account form until they consent.
 */
export function PrivacyGate({ onAgree }: PrivacyGateProps) {
  const [agreed, setAgreed] = useState(false);

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
          Data Privacy &amp; Agreements
        </Typography>
      </Box>

      <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Before creating your account, please review and agree to how
            KaBarangayConnect handles your personal data.
          </Typography>

          {SECTIONS.map((section) => (
            <Box key={section.title}>
              <Typography
                variant="subtitle2"
                component="h2"
                sx={{ fontWeight: 700, mb: 0.5 }}
              >
                {section.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ lineHeight: 1.7 }}
              >
                {section.body}
              </Typography>
            </Box>
          ))}

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
                <Link href="/terms">
                  <Typography
                    component="span"
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  >
                    Terms of Service
                  </Typography>
                </Link>{" "}
                and{" "}
                <Link href="/privacy">
                  <Typography
                    component="span"
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  >
                    Data Privacy Policy
                  </Typography>
                </Link>{" "}
                under RA 10173.
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
