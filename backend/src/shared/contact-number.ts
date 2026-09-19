/**
 * Contact-number rules shared by every handler that accepts one.
 *
 * Mirrors `frontend/src/lib/phone.ts` so the UI's digits-only field and the
 * API agree: a contact number is digits only, at most
 * {@link CONTACT_NUMBER_MAX_DIGITS} digits, with no minimum (short landline
 * numbers are legitimate). `mobileOnly` is reserved for `POST /auth/register`,
 * where the number doubles as a login identifier.
 *
 * The frontend already sanitizes its input; this module is the
 * defense-in-depth check for direct API calls and for scripts that write
 * straight to the models.
 */

/** Hard cap on a stored contact number. Keep in sync with the frontend. */
export const CONTACT_NUMBER_MAX_DIGITS = 11;

/** Digits only, at most {@link CONTACT_NUMBER_MAX_DIGITS} long. */
export const CONTACT_NUMBER_PATTERN = /^\d{1,11}$/;

/** PH mobile: `09` followed by 9 digits, e.g. `09171234567`. */
export const PH_MOBILE_PATTERN = /^09\d{9}$/;

/** 400 message for a malformed contact number. */
export const CONTACT_NUMBER_FORMAT_MESSAGE = `contactNumber must contain digits only (up to ${CONTACT_NUMBER_MAX_DIGITS} digits).`;

/** 400 message for the sign-up route, which accepts a mobile number only. */
export const CONTACT_NUMBER_MOBILE_MESSAGE =
  'contactNumber must be a valid Philippine mobile number (e.g., 09171234567).';

/**
 * Normalizes a stored or incoming contact number into the digits-only form.
 *
 * - strips everything that is not a digit (spaces, dashes, parentheses, `+`)
 * - rewrites a 12-digit country-code value to the local form
 *   (`+639181234567` → `09181234567`)
 * - caps the result at {@link CONTACT_NUMBER_MAX_DIGITS} digits
 *
 * Apply this before persisting so records written through the API converge on
 * the digits-only form even though legacy rows keep their old format.
 */
export function normalizeContactNumber(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  const local =
    digits.length >= 12 && digits.startsWith('63')
      ? `0${digits.slice(2)}`
      : digits;
  return local.slice(0, CONTACT_NUMBER_MAX_DIGITS);
}

export interface ContactNumberRules {
  /** Reject a missing value instead of treating it as "not provided". */
  required?: boolean;
  /** Require the PH mobile form (`09XXXXXXXXX`) rather than any ≤11-digit value. */
  mobileOnly?: boolean;
}

/**
 * Returns the 400 message for a contact number, or `null` when it is
 * acceptable. Callers decide how to surface it (`return badRequest(msg)` for a
 * create route, `throw badRequestError(msg)` elsewhere).
 */
export function contactNumberViolation(
  raw: string | undefined | null,
  rules: ContactNumberRules = {}
): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return rules.required ? 'contactNumber is required.' : null;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits !== trimmed || !CONTACT_NUMBER_PATTERN.test(digits)) {
    return CONTACT_NUMBER_FORMAT_MESSAGE;
  }
  if (rules.mobileOnly && !PH_MOBILE_PATTERN.test(digits)) {
    return CONTACT_NUMBER_MOBILE_MESSAGE;
  }
  return null;
}
