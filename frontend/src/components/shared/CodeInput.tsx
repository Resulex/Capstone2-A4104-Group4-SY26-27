"use client";

import {
  ChangeEvent,
  ClipboardEvent,
  FocusEvent,
  KeyboardEvent,
  Ref,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/** Imperative handle exposed so a parent can move focus onto the first box. */
export interface CodeInputHandle {
  /** Focus the first box (e.g. after a rejected code). */
  focus: () => void;
}

interface CodeInputProps {
  /** Accepted digits in entry order. Gaps from a cleared box are omitted. */
  value: string;
  /** Called with the joined digits of every filled box. */
  onChange: (value: string) => void;
  /** Forwarded to the box row so a parent can refocus the input. */
  ref?: Ref<CodeInputHandle>;
  /** Number of boxes to render. */
  length?: number;
  /** Visible label rendered above the boxes. */
  label?: string;
  /** Supporting line rendered below the boxes (e.g. `3/6 digits entered`). */
  helperText?: string;
  /** Accessible name for the box group when no visible `label` is given. */
  ariaLabel?: string;
  /** Draw the boxes in the error state. */
  error?: boolean;
  /** Disable every box (e.g. while the form is submitting). */
  disabled?: boolean;
  /** Mark the boxes as required (renders the label asterisk). */
  required?: boolean;
  /** Focus the first box on mount. */
  autoFocus?: boolean;
}

const DEFAULT_LENGTH = 6;

/** Splits a digit string into one slot per box, preserving position gaps. */
function toSlots(digits: string, length: number): string[] {
  const clean = digits.replace(/\D/g, "").slice(0, length);
  return Array.from({ length }, (_, index) => clean[index] ?? "");
}

/**
 * Segmented one-time-code input: one box per digit, a single character each.
 *
 * Typing a digit fills the focused box and advances; typing into a box that
 * already holds a digit replaces it. Once every box is filled further digits
 * are ignored until one is removed (Backspace/Delete leaves a gap, so later
 * digits keep their positions). Pasting — or a mobile `one-time-code`
 * autofill — spreads the digits across the boxes from the focused box,
 * restarting at the first box when the run would not fit.
 *
 * The parent owns the accepted digits as a single string, so a gap yields a
 * shorter string and a `length !== N` submit guard disables submission
 * naturally.
 */
export function CodeInput({
  value,
  onChange,
  ref,
  length = DEFAULT_LENGTH,
  label,
  helperText,
  ariaLabel,
  error = false,
  disabled = false,
  required = false,
  autoFocus = false,
}: CodeInputProps) {
  const labelId = useId();
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [slots, setSlots] = useState<string[]>(() => toSlots(value, length));
  const isComplete = slots.every((digit) => digit !== "");

  // Re-sync only when the parent changed `value` behind our back (a reset
  // after enrollment, or `handleBack`). Every edit we report keeps
  // `slots.join("") === value`, so our own onChange calls never feed back.
  useEffect(() => {
    setSlots((current) =>
      current.join("") === value ? current : toSlots(value, length),
    );
  }, [value, length]);

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus();
  }, [autoFocus]);

  const focusBox = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(index, 0), length - 1);
      inputsRef.current[clamped]?.focus();
    },
    [length],
  );

  useImperativeHandle(ref, () => ({ focus: () => focusBox(0) }), [focusBox]);

  const commit = useCallback(
    (next: string[]) => {
      setSlots(next);
      onChange(next.join(""));
    },
    [onChange],
  );

  /** Spreads a run of digits across the boxes, for paste and autofill. */
  const fillFrom = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;

    // A run that cannot fit from the drop position restarts at the first box,
    // so pasting a whole code over a partially filled one just works.
    const start = index + digits.length > length ? 0 : index;
    const next = [...slots];
    for (
      let offset = 0;
      offset < digits.length && start + offset < length;
      offset += 1
    ) {
      next[start + offset] = digits[offset];
    }
    commit(next);
    focusBox(start + digits.length);
  };

  const handleChange =
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, "");

      // Cleared via Backspace/Delete: keep the gap so later digits stay put.
      if (!digits) {
        const next = [...slots];
        next[index] = "";
        commit(next);
        return;
      }

      // Multi-character input — mobile `one-time-code` autofill, or a paste
      // the browser routed through `change`.
      if (digits.length > 1) {
        fillFrom(index, digits);
        return;
      }

      // Every box is filled: ignore extra digits until one is removed, and
      // put the overwritten DOM value back.
      if (isComplete) {
        event.target.value = slots[index];
        return;
      }

      const next = [...slots];
      next[index] = digits;
      commit(next);
      focusBox(index + 1);
    };

  const handlePaste =
    (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
      const pasted = event.clipboardData.getData("text");
      if (!pasted.replace(/\D/g, "")) return;

      event.preventDefault();
      fillFrom(index, pasted);
    };

  const handleKeyDown =
    (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
      // Enter deliberately falls through so the surrounding form submits.
      if (event.key === "Backspace") {
        event.preventDefault();
        const next = [...slots];
        if (next[index]) {
          // Clear this box but keep focus so the next digit refills it.
          next[index] = "";
          commit(next);
          return;
        }
        // Already empty → step back and clear the previous box.
        const previous = Math.max(index - 1, 0);
        next[previous] = "";
        commit(next);
        focusBox(previous);
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();
        const next = [...slots];
        next[index] = "";
        commit(next);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusBox(index - 1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        focusBox(index + 1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        focusBox(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        focusBox(length - 1);
      }
    };

  // Select on focus so retyping a box replaces its digit.
  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  return (
    <Box sx={{ width: "100%" }}>
      {label && (
        <Typography
          id={labelId}
          component="span"
          variant="body2"
          sx={{
            display: "block",
            mb: 1,
            fontWeight: 500,
            color: error ? "error.main" : "text.secondary",
          }}
        >
          {label}
          {required && (
            <Box component="span" sx={{ color: "error.main" }}>
              {" *"}
            </Box>
          )}
        </Typography>
      )}

      <Box
        role="group"
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 0.75, sm: 1 },
          width: "100%",
        }}
      >
        {slots.map((digit, index) => (
          <Box
            key={index}
            component="input"
            ref={(element: HTMLInputElement | null) => {
              inputsRef.current[index] = element;
            }}
            type="text"
            value={digit}
            onChange={handleChange(index)}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste(index)}
            onFocus={handleFocus}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            required={required}
            disabled={disabled}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-invalid={error || undefined}
            sx={{
              // The boxes share the row equally so together they span the full
              // field width. Heights and digits are rem-based so they keep
              // scaling with the accessibility font-scale setting, and the
              // basis may shrink so the row never overflows its card.
              flex: "1 1 0",
              minWidth: 0,
              height: { xs: "3.25rem", sm: "3.75rem" },
              p: 0,
              appearance: "none",
              WebkitAppearance: "none",
              textAlign: "center",
              fontSize: { xs: "1.5rem", sm: "1.75rem" },
              fontWeight: 700,
              fontFamily: "inherit",
              lineHeight: 1,
              color: error ? "error.main" : "text.primary",
              bgcolor: "background.paper",
              border: "2px solid",
              borderColor: error ? "error.main" : "divider",
              borderRadius: 1.5,
              transition: "border-color 120ms ease",
              "&:hover:not(:disabled)": {
                borderColor: error ? "error.main" : "primary.main",
              },
              "&:focus": {
                borderColor: error ? "error.main" : "primary.main",
              },
              "&:disabled": {
                cursor: "not-allowed",
                opacity: 0.6,
                bgcolor: "action.disabledBackground",
              },
            }}
          />
        ))}
      </Box>

      {helperText && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.75,
            color: error ? "error.main" : "text.secondary",
          }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
