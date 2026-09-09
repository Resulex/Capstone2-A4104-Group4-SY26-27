"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

/** Terms of Service content sections. */
export const TERMS_SECTIONS = [
  {
    title: "Acceptance of Terms",
    body: "By accessing or using KaBarangayConnect, you agree to be bound by these Terms of Service. The platform is provided by the barangay to facilitate document requests, incident reports, and community communication.",
  },
  {
    title: "Eligibility & Account Use",
    body: "You must provide accurate information when creating your account and keep your login credentials secure. You agree not to use the platform for unlawful, fraudulent, or harmful purposes.",
  },
  {
    title: "Community Conduct",
    body: "When using live chat, announcements, and other services, you agree to interact respectfully and refrain from sharing false, offensive, or unlawful content.",
  },
  {
    title: "Service Modifications",
    body: "The barangay may update, suspend, or discontinue features as needed. Continued use of the platform after changes are published constitutes acceptance of the updated terms.",
  },
];

/** Data Privacy Policy content sections. */
export const PRIVACY_SECTIONS = [
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

interface LegalDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Header title (e.g. "Terms of Service"). */
  title: string;
  /** Which legal document to display. Defaults to the Data Privacy Policy. */
  kind?: "terms" | "privacy";
  /** Close the dialog. */
  onClose: () => void;
}

/**
 * Scrollable dialog presenting the Terms of Service or Data Privacy Policy for
 * inline viewing (e.g. on the login and signup forms) without navigating away.
 */
export function LegalDialog({
  open,
  title,
  kind = "privacy",
  onClose,
}: LegalDialogProps) {
  const sections = kind === "terms" ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: 420, overflowY: "auto" }}>
        {sections.map((section) => (
          <Box key={section.title} sx={{ mb: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              {section.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {section.body}
            </Typography>
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
