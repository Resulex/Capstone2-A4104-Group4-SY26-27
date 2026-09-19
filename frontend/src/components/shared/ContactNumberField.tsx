"use client";

import TextField from "@mui/material/TextField";
import {
  CONTACT_NUMBER_FORMAT_MESSAGE,
  normalizeContactNumber,
} from "@/lib/phone";

export interface ContactNumberFieldProps {
  /** Visible field label. */
  label?: string;
  /** Digits-only value owned by the parent. */
  value: string;
  /** Called with the sanitized value on every edit. */
  onChange: (value: string) => void;
  /** Draw the field in the error state. */
  error?: boolean;
  /** Supporting line under the field (defaults to the digits-only hint). */
  helperText?: React.ReactNode;
  /** Mark the field required (renders the label asterisk). */
  required?: boolean;
  /** Disable the field (e.g. while the form is submitting). */
  disabled?: boolean;
  /** Span the parent's width. Defaults to true, matching the other form rows. */
  fullWidth?: boolean;
  /** MUI field density. */
  size?: "small" | "medium";
  /** Forwarded to the underlying input (defaults to `tel`). */
  autoComplete?: string;
  /** Forwarded to the underlying input. */
  placeholder?: string;
  /** Forwarded to the underlying input. */
  name?: string;
  /** Forwarded to the underlying input. */
  id?: string;
  /** Accessible name for the input when no visible label is associated. */
  ariaLabel?: string;
}

/**
 * Digits-only contact-number input.
 *
 * Every edit passes through `normalizeContactNumber`, so letters and symbols
 * are dropped as they are typed, a pasted `+63 917 123 4567` becomes
 * `09171234567`, and the value never exceeds the 11-digit cap. Use this
 * instead of a plain `TextField` for any phone field so the rule cannot drift
 * between forms.
 *
 * Deliberately not `type="number"` (which admits `e`, `-` and spinner arrows)
 * and not `inputMode="tel"` (whose keypad includes `+`, `*` and `#`). There is
 * also no `maxLength` attribute: it would truncate the *raw* text before the
 * sanitizer sees it, so pasting a formatted number (`+63 917 123 4567`) lost
 * digits. The sanitizer's own cap is what enforces the limit.
 */
export function ContactNumberField({
  label = "Contact Number",
  value,
  onChange,
  error,
  helperText,
  required,
  disabled,
  fullWidth = true,
  size,
  autoComplete = "tel",
  placeholder = "09XX XXX XXXX",
  name,
  id,
  ariaLabel = "Contact number",
}: ContactNumberFieldProps) {
  return (
    <TextField
      label={label}
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
      value={value}
      onChange={(event) => onChange(normalizeContactNumber(event.target.value))}
      error={error}
      helperText={helperText ?? CONTACT_NUMBER_FORMAT_MESSAGE}
      autoComplete={autoComplete}
      placeholder={placeholder}
      inputProps={{
        "aria-label": ariaLabel,
        inputMode: "numeric",
        pattern: "[0-9]*",
      }}
    />
  );
}
