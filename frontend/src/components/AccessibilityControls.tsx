"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ContrastIcon from "@mui/icons-material/Contrast";
import { useAccessibilityTheme } from "@/context/ThemeContext";
import { FONT_SCALE_OPTIONS, FontScale } from "@/theme/theme";

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  small: "Small",
  default: "Default",
  large: "Large",
  xl: "Extra Large",
  xxl: "Extra Extra Large",
};

/**
 * Floating accessibility toolbar exposing the typographic scaling selector
 * and the high-contrast mode toggle.
 */
export function AccessibilityControls() {
  const { fontScale, setFontScale, highContrast, toggleHighContrast } =
    useAccessibilityTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (scale: FontScale) => {
    setFontScale(scale);
    handleClose();
  };

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        p: 0.5,
        boxShadow: 2,
      }}
    >
      <Tooltip title="Text size">
        <Button
          aria-label={`Text size: ${FONT_SCALE_LABELS[fontScale]}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={handleOpen}
          startIcon={<TextFieldsIcon />}
          size="small"
          variant="text"
          color="inherit"
        >
          {FONT_SCALE_LABELS[fontScale]}
        </Button>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {FONT_SCALE_OPTIONS.map((scale) => (
          <MenuItem
            key={scale}
            selected={scale === fontScale}
            onClick={() => handleSelect(scale)}
          >
            <Typography variant="body2">{FONT_SCALE_LABELS[scale]}</Typography>
          </MenuItem>
        ))}
      </Menu>

      <Tooltip
        title={highContrast ? "Disable high contrast" : "Enable high contrast"}
      >
        <Button
          aria-pressed={highContrast}
          onClick={toggleHighContrast}
          startIcon={<ContrastIcon />}
          size="small"
          variant={highContrast ? "contained" : "text"}
          color="inherit"
        >
          High Contrast
        </Button>
      </Tooltip>
    </Box>
  );
}