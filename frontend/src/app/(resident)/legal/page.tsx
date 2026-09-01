"use client";

import { useEffect, useState } from "react";
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
import { PageHeader } from "@/components/resident/PageHeader";

const LEGAL_STORAGE_KEY = "kbc_legal_accepted";

const SECTIONS = [
  {
    title: "Data Privacy Act of 2012 Compliance",
    body: "KaBarangayConnect is committed to protecting your personal data in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules and regulations. Your information is processed lawfully, fairly, and transparently, and is used only for the legitimate purposes of barangay service delivery.",
  },
  {
    title: "Information We Collect",
    body: "We collect the information you provide through your Google sign-in (such as your name, email address, and profile photo) together with the details you submit for barangay services — including document requests, incident reports, and chat messages with barangay responders.",
  },
  {
    title: "How We Use Your Data",
    body: "Your data is used to process document requests, coordinate emergency and incident responses, keep you informed through notifications and announcements, and improve barangay services. We do not sell your personal information.",
  },
  {
    title: "Data Retention (AWS S3)",
    body: "Submitted records and any attached media are stored securely in AWS S3 and retained only for as long as needed to fulfill the service and comply with applicable barangay and government record-keeping requirements.",
  },
];

/**
 * Data Privacy & Terms of Service (`/legal`).
 *
 * Presents the privacy policy and terms sections with a consent checkbox.
 * Accepting stores the consent locally and returns to the dashboard.
 */
export default function PrivacyTermsPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [checkedOnLoad, setCheckedOnLoad] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const accepted = window.localStorage.getItem(LEGAL_STORAGE_KEY) === "true";
      if (accepted) {
        setAgreed(true);
        setCheckedOnLoad(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleAccept = () => {
    try {
      window.localStorage.setItem(LEGAL_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setSaved(true);
    setTimeout(() => router.push("/"), 700);
  };

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <PageHeader
        backHref="/"
        title="Privacy & Terms"
        subtitle="Data Privacy Policy and Terms of Service"
      />

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {SECTIONS.map((section) => (
            <Box key={section.title} sx={{ mb: 3 }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 0.75 }}>
                {section.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
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
            disabled={!agreed}
            onClick={handleAccept}
            sx={{ mt: 2 }}
          >
            {checkedOnLoad ? "Continue" : "Accept & Continue"}
          </Button>
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
