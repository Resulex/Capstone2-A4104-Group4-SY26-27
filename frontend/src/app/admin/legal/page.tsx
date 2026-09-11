"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GavelIcon from "@mui/icons-material/Gavel";
import {
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
} from "@/components/shared/LegalDialog";

/**
 * Admin — Data Privacy & Terms.
 *
 * Read-only version of the resident `/legal` page: admins acknowledge the
 * policy but do not record consent, so there is no checkbox here. The copy is
 * the shared source (`LegalDialog`), keeping the admin and resident views in
 * sync.
 */
export default function AdminLegalPage() {
  return (
    <Box sx={{ maxWidth: 860 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
        <GavelIcon color="primary" />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          Data Privacy &amp; Terms
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        How KaBarangayConnect handles resident data, and the terms that govern
        use of the platform.
      </Typography>

      <Stack spacing={3}>
        <Section
          title="Data Privacy Policy"
          sections={PRIVACY_SECTIONS}
        />
        <Section title="Terms of Service" sections={TERMS_SECTIONS} />
      </Stack>
    </Box>
  );
}

/** A titled card holding one legal document's sections. */
function Section({
  title,
  sections,
}: {
  title: string;
  sections: { title: string; body: string }[];
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
          {title}
        </Typography>
        <Stack spacing={2}>
          {sections.map((section) => (
            <Box key={section.title}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {section.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {section.body}
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
