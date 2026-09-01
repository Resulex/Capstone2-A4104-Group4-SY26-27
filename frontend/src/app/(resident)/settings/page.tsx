"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ContrastIcon from "@mui/icons-material/Contrast";
import LanguageIcon from "@mui/icons-material/Language";
import { useAccessibilityTheme } from "@/context/ThemeContext";
import { FontScale } from "@/theme/theme";
import { PageHeader } from "@/components/resident/PageHeader";

const FONT_SCALE_OPTIONS: { value: FontScale; label: string }[] = [
  { value: "small", label: "Aa (Small)" },
  { value: "default", label: "Aa (Default)" },
  { value: "large", label: "Aa (Large)" },
  { value: "xl", label: "Aa (Extra Large)" },
  { value: "xxl", label: "Aa (Extra Extra Large)" },
];

const LANGUAGE_STORAGE_KEY = "kbc_language";

/**
 * Display & Accessibility Settings (`/settings`).
 *
 * Text size selection, high-contrast mode, and interface language preference.
 * Font scale and high contrast apply live (and persist via ThemeContext);
 * the language preference is stored for future localization.
 */
export default function SettingsPage() {
  const { fontScale, setFontScale, highContrast, toggleHighContrast } =
    useAccessibilityTheme();

  const [language, setLanguage] = useState<string>(() => {
    if (typeof window === "undefined") return "English";
    try {
      return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "English";
    } catch {
      return "English";
    }
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore
    }
    setSaved(true);
  };

  return (
    <Box sx={{ maxWidth: 680, mx: "auto" }}>
      <PageHeader
        title="Accessibility"
        subtitle="Adjust the display to make the app easier to read and use."
      />

      {/* Text size. */}
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <TextFieldsIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Text Size
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Adjust text size
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {FONT_SCALE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={fontScale === option.value ? "contained" : "outlined"}
                color={fontScale === option.value ? "primary" : "inherit"}
                onClick={() => setFontScale(option.value)}
                aria-pressed={fontScale === option.value}
                sx={{ minWidth: 132 }}
              >
                {option.label}
              </Button>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Visual adjustments. */}
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <ContrastIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Visual Adjustments
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Contrast &amp; visibility
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              px: 2,
              py: 1.5,
            }}
          >
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                High Contrast Mode
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Increases border thickness and text darkness for easier reading.
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={highContrast}
                  onChange={toggleHighContrast}
                  color="primary"
                  inputProps={{ "aria-label": "High contrast mode" }}
                />
              }
              label={highContrast ? "ON" : "OFF"}
              labelPlacement="end"
              sx={{ m: 0 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Language. */}
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <LanguageIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Language
            </Typography>
          </Box>
          <TextField
            select
            size="small"
            label="Interface Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            fullWidth
            inputProps={{ "aria-label": "Interface language" }}
            helperText="Tagalog localization is coming soon."
          >
            <MenuItem value="English">English</MenuItem>
            <MenuItem value="Tagalog">Tagalog</MenuItem>
          </TextField>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        color="primary"
        size="large"
        fullWidth
        onClick={handleSave}
      >
        Save Changes
      </Button>

      <Snackbar
        open={saved}
        autoHideDuration={2000}
        message="Settings saved."
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
