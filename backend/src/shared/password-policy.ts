/**
 * Cognito user-pool password policy, mirrored locally.
 *
 * Cognito stays the authoritative enforcer; this local copy only lets a
 * handler reject an obviously invalid password with a precise 400 instead of
 * round-tripping and then surfacing Cognito's opaque `InvalidPasswordException`
 * — which the forgot-password flow would otherwise report as a bad
 * verification code, pointing the user at the wrong field.
 *
 * Keep in sync with the pool's policy in the AWS console
 * (docs/COGNITO_AWS_CONSOLE.md §1, step 2).
 */

/** Message shown (and thrown) whenever {@link passwordPolicyViolation} fails. */
export const PASSWORD_POLICY_MESSAGE =
  'The new password must be at least 8 characters and include upper-case, lower-case, and numeric characters.';

/**
 * Returns the policy violation message, or `null` when the password is
 * acceptable. Callers decide how to surface it (400, form error, …).
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
