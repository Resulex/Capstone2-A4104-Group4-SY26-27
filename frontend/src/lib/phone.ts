/**
 * Contact-number rules shared by every phone input in the app.
 *
 * Product rule: the field accepts digits only and holds at most
 * {@link CONTACT_NUMBER_MAX_DIGITS} digits. There is deliberately no minimum,
 * so a short landline number stays submittable — the account sign-up step is
 * the single exception and additionally requires a PH mobile number, because
 * that value doubles as a login identifier.
 *
 * Older records store the country-code form (`+639181234567`). Those are NOT
 * migrated; {@link normalizeContactNumber} rewrites them to the local `0…`
 * form whenever a value passes through a prefill, a keystroke, or a submit.
 */

/** Hard cap on the stored/typed contact number. */
export const CONTACT_NUMBER_MAX_DIGITS = 11;

/** PH mobile: `09` followed by 9 digits, e.g. `09171234567`. */
export const PH_MOBILE_RE = /^09\d{9}$/;

/** Format hint shown under the field, and reused as a validation message. */
export const CONTACT_NUMBER_FORMAT_MESSAGE = `Use digits only, up to ${CONTACT_NUMBER_MAX_DIGITS} digits.`;

/** Message for the sign-up step, which accepts a mobile number only. */
export const CONTACT_NUMBER_MOBILE_MESSAGE =
  "Enter a valid Philippine mobile number (e.g., 09171234567).";

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
  /** Require the PH mobile form (`09XXXXXXXXX`) rather than any ≤11-digit value. */
  mobileOnly?: boolean;
}

/**
 * Returns the validation message for a contact number, or `null` when it is
 * acceptable. Callers decide where to surface it (form error, 400, …).
 *
 * Validates the raw value, so only digits pass — the shared
 * {@link normalizeContactNumber} makes that the natural state of the field.
 */
export function contactNumberError(
  value: string,
  rules: ContactNumberRules = {},
): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return rules.required ? CONTACT_NUMBER_REQUIRED_MESSAGE : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits !== trimmed || digits.length > CONTACT_NUMBER_MAX_DIGITS) {
    return CONTACT_NUMBER_FORMAT_MESSAGE;
  }
  if (rules.mobileOnly && !PH_MOBILE_RE.test(digits)) {
    return CONTACT_NUMBER_MOBILE_MESSAGE;
  }
  return null;
}
