"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Link from "next/link";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PhoneIcon from "@mui/icons-material/Phone";
import ForumIcon from "@mui/icons-material/Forum";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { PageHeader } from "@/components/resident/PageHeader";
import { SearchField } from "@/components/resident/SearchField";
import { EmptyState } from "@/components/resident/EmptyState";
import { BARANGAY_CONTACT } from "@/lib/resident";

const FAQS = [
  {
    question: "How do I request a Barangay Clearance?",
    answer:
      "Open My Document Requests from the menu, tap “Request Document”, choose Barangay Clearance, fill in the purpose, and submit. You'll be notified when it's ready for pickup.",
  },
  {
    question: "How do I report an incident?",
    answer:
      "Go to Incident Reports → “New Incident Report”, choose the category, describe what happened, and provide the location. A triage engine assigns the priority and responders can open a chat to coordinate.",
  },
  {
    question: "How can I track my document request?",
    answer:
      "Open My Document Requests and select the request to see its current status and timeline progress, from Submitted to Ready for Pickup.",
  },
  {
    question: "How do I update my profile or contact number?",
    answer:
      "Your profile details are shared from your Google sign-in. For corrections, contact the barangay office or use the message support option below.",
  },
  {
    question: "How is my data protected?",
    answer:
      "We comply with the Data Privacy Act of 2012 (RA 10173). See the Privacy & Terms page for details on what we collect and how it's used.",
  },
];

/** Human-friendly emergency hotline, e.g. "(02) 123-4567". */
const HOTLINE_DISPLAY = BARANGAY_CONTACT.emergencyHotline;
/** Digits-only number used for the `tel:` link. */
const HOTLINE_TEL = BARANGAY_CONTACT.emergencyHotline.replace(/[^\d+]/g, "");

/** True when the device can reasonably place calls (phone / tablet). */
function detectCallDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) return true;
  return (
    navigator.maxTouchPoints > 0 &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * Help & Support Center (`/help`).
 *
 * Searchable FAQ accordion plus quick contact actions for the barangay admin.
 */
export default function HelpSupportPage() {
  const [query, setQuery] = useState("");
  const [hotlineOpen, setHotlineOpen] = useState(false);
  const [callDevice, setCallDevice] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCallDevice(detectCallDevice());
  }, []);

  const faqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter((f) =>
      `${f.question} ${f.answer}`.toLowerCase().includes(q),
    );
  }, [query]);

  /** Open the phone dialer (call-capable devices only). */
  const handleHotlineCall = () => {
    if (callDevice) {
      window.location.href = `tel:${HOTLINE_TEL}`;
    }
    setHotlineOpen(false);
  };

  const handleHotlineCopy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(HOTLINE_DISPLAY);
      ok = true;
    } catch {
      // Fall back to the legacy path for restricted/non-secure contexts.
      try {
        const textarea = document.createElement("textarea");
        textarea.value = HOTLINE_DISPLAY;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        ok = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        ok = false;
      }
    }
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  const handleHotlineClose = () => {
    setHotlineOpen(false);
    setCopied(false);
  };

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <PageHeader
        backHref="/"
        title="Help & Support"
        subtitle="Answers to common questions and ways to reach the barangay."
      />

      <Box sx={{ mb: 3, maxWidth: 480 }}>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search for help..."
          label="Search for help"
        />
      </Box>

      <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Frequently Asked Questions (FAQ)
      </Typography>

      {faqs.length === 0 ? (
        <EmptyState
          title="No results"
          description="Try a different search term."
        />
      ) : (
        <Stack spacing={1}>
          {faqs.map((faq) => (
            <Accordion key={faq.question} variant="outlined" sx={{ borderRadius: 2 }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-label={`FAQ: ${faq.question}`}
                sx={{ minHeight: 48 }}
              >
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3, mt: 4 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
            Contact Barangay Admin
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              variant="outlined"
              color="error"
              size="large"
              fullWidth
              startIcon={<PhoneIcon />}
              onClick={() => setHotlineOpen(true)}
            >
              Call Emergency Hotline
            </Button>
            <Button
              component={Link}
              href="/chat"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              startIcon={<ForumIcon />}
            >
              Message Support
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={hotlineOpen}
        onClose={handleHotlineClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {callDevice ? "Call Emergency Hotline?" : "Emergency Hotline"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>Barangay Emergency Hotline</DialogContentText>
          <Typography variant="h5" sx={{ fontWeight: 700, my: 1 }}>
            {HOTLINE_DISPLAY}
          </Typography>
          <DialogContentText>
            {callDevice
              ? "This will open your phone's dialer with the number ready to call."
              : "This feature is best used on a mobile phone. You can call this number using your phone."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          {callDevice ? (
            <>
              <Button onClick={handleHotlineClose} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<PhoneIcon />}
                onClick={handleHotlineCall}
              >
                Call Now
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleHotlineClose} color="inherit">
                Close
              </Button>
              <Button
                variant="contained"
                startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                onClick={handleHotlineCopy}
              >
                {copied ? "Copied!" : "Copy Number"}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
