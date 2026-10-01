/**
 * Contact-number rules shared by every handler that accepts one.
 *
 * Mirrors `frontend/src/lib/phone.ts` so the UI's field and the API agree: a
 * contact number must be a Philippine mobile number — exactly 11 digits
 * starting with `09` (e.g. `09171234567`) — and is required wherever it is
 * accepted. `PH_MOBILE_PATTERN` is the single accepted format.
 *
 * Validation is deliberately lenient about formatting: the raw value is
 * normalized first (spaces, dashes and `+63` prefixes are tolerated), so a
 * request carrying a legacy value is accepted rather than rejected. What is
 * stored is always the digits-only local form.
 *
 * The frontend already sanitizes its input; this module is the
 * defense-in-depth check for direct API calls and for scripts that write
 * straight to the models.
 */

/** Length of a PH mobile number. Keep in sync with the frontend. */
export const CONTACT_NUMBER_MAX_DIGITS = 11;

/** The one accepted format: PH mobile, `09` followed by 9 digits. */
export const PH_MOBILE_PATTERN = /^09\d{9}$/;

/** 400 message for a malformed contact number. */
export const CONTACT_NUMBER_FORMAT_MESSAGE =
  'contactNumber must be a valid 11-digit Philippine mobile number starting with 09 (e.g., 09171234567).';

/** 400 message for a missing contact number. */
export const CONTACT_NUMBER_REQUIRED_MESSAGE = 'contactNumber is required.';

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
}

/**
 * Returns the 400 message for a contact number, or `null` when it is
 * acceptable. Callers decide how to surface it (`return badRequest(msg)` for a
 * create route, `throw badRequestError(msg)` elsewhere).
 *
 * The value is normalized before it is checked, so the country-code and spaced
 * forms are accepted; only the normalized result must match
 * {@link PH_MOBILE_PATTERN}.
 */
export function contactNumberViolation(
  raw: string | undefined | null,
  rules: ContactNumberRules = {}
): string | null {
  const normalized = normalizeContactNumber(raw ?? '');
  if (!normalized) {
    return rules.required ? CONTACT_NUMBER_REQUIRED_MESSAGE : null;
  }
  return PH_MOBILE_PATTERN.test(normalized) ? null : CONTACT_NUMBER_FORMAT_MESSAGE;
}
