/**
 * Contact-number rules shared by every phone input in the app.
 *
 * Product rule: a contact number must be a Philippine mobile number — exactly
 * 11 digits starting with `09` (e.g. `09171234567`) — and every form requires
 * it. {@link PH_MOBILE_RE} is the single accepted format.
 *
 * Older records store the country-code form (`+639181234567`) or spaced text.
 * Those are NOT migrated; {@link normalizeContactNumber} rewrites them to the
 * local `0…` digits-only form whenever a value passes through a prefill, a
 * keystroke, or a submit — and {@link contactNumberError} normalizes before it
 * validates, so a legacy value is accepted rather than rejected.
 */

/** Length of a PH mobile number. */
export const CONTACT_NUMBER_MAX_DIGITS = 11;

/** The one accepted format: PH mobile, `09` followed by 9 digits. */
export const PH_MOBILE_RE = /^09\d{9}$/;

/** Format hint shown under the field, and reused as a validation message. */
export const CONTACT_NUMBER_FORMAT_MESSAGE =
  "Enter a valid 11-digit mobile number starting with 09 (e.g., 09171234567).";

/** Empty-field message used when {@link contactNumberError} is told to require a value. */
export const CONTACT_NUMBER_REQUIRED_MESSAGE = "Contact number is required.";

/**
 * Normalizes any stored or typed contact number into the digits-only form.
 *
 * - strips everything that is not a digit (spaces, dashes, parentheses, `+`)
 * - rewrites a 12-digit country-code value to the local form
 *   (`639181234567` → `09181234567`, so `+639181234567` works too)
 * - caps the result at {@link CONTACT_NUMBER_MAX_DIGITS} digits
 *
 * Safe to call on every keystroke and on raw server values alike, which is why
 * the field, the prefills and the submit paths all share it.
 */
export function normalizeContactNumber(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  const local =
    digits.length >= 12 && digits.startsWith("63")
      ? `0${digits.slice(2)}`
      : digits;
  return local.slice(0, CONTACT_NUMBER_MAX_DIGITS);
}

export interface ContactNumberRules {
  /** Reject an empty value instead of treating it as "not provided". */
  required?: boolean;
}

/**
 * Returns the validation message for a contact number, or `null` when it is
 * acceptable. Callers decide where to surface it (form error, 400, …).
 *
 * The value is normalized before it is checked, so the country-code and spaced
 * forms pass; only the normalized result must match {@link PH_MOBILE_RE}.
 */
export function contactNumberError(
  value: string,
  rules: ContactNumberRules = {},
): string | null {
  const normalized = normalizeContactNumber(value ?? "");
  if (!normalized) {
    return rules.required ? CONTACT_NUMBER_REQUIRED_MESSAGE : null;
  }
  return PH_MOBILE_RE.test(normalized) ? null : CONTACT_NUMBER_FORMAT_MESSAGE;
}
