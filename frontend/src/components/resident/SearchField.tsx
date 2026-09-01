"use client";

import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";

interface SearchFieldProps {
  /** Current search text (controlled). */
  value: string;
  /** Update callback. */
  onChange: (value: string) => void;
  /** Placeholder shown in the empty input. */
  placeholder?: string;
  /** Accessible label (also used as the floating label). */
  label?: string;
}

/**
 * Reusable search input with a leading search icon. Used on the announcements
 * and help pages.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label = "Search",
}: SearchFieldProps) {
  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{ "aria-label": label }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon color="action" />
          </InputAdornment>
        ),
      }}
    />
  );
}
