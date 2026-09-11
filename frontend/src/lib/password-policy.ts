/**
 * Cognito user-pool password policy, mirrored on the client.
 *
 * Canonical copy: `backend/src/shared/password-policy.ts`. Keep the two in
 * sync — the backend still rejects a violating password with a 400, so this
 * copy only exists to explain the rule up front and disable the submit button
 * instead of round-tripping for the same answer.
 */

/** Message shown (and returned by the backend) whenever the policy fails. */
export const PASSWORD_POLICY_MESSAGE =
  "The new password must be at least 8 characters and include upper-case, lower-case, and numeric characters.";

/**
 * Returns the policy violation message, or `null` when the password is
 * acceptable.
 */
export function passwordPolicyViolation(password: string): string | null {
  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return PASSWORD_POLICY_MESSAGE;
  }
  return null;
}
