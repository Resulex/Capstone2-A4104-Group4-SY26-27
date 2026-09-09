import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { connectToDatabase } from '../../../config/db';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok, badRequest } from '../../../shared/responses';
import { AppError } from '../../../shared/errors';
import { getCognitoGateway, cognitoReady } from '../../../shared/cognito';

/**
 * Auth — Admin Forgot Password
 * Use-case: let an admin reset their password via AWS Cognito's built-in
 * forgot-password flow (Cognito emails a 6-digit recovery code).
 */

/** POST /auth/admin/forgot-password — request a reset code (emailed by Cognito). */
async function requestReset(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as { email?: string };
  const email = (body.email || '').trim().toLowerCase();
  if (!email) return badRequest('Email is required.');

  await connectToDatabase();
  if (cognitoReady()) {
    try {
      await getCognitoGateway().forgotPassword(email);
    } catch (err) {
      if (err instanceof AppError) {
        // Avoid user enumeration — always report the same generic outcome.
        console.warn('[admin-forgot] reset request failed:', err.message);
      } else {
        throw err;
      }
    }
  }
  return ok(
    { message: 'If an account exists, a reset code has been sent.' },
    'Reset requested.'
  );
}

/** POST /auth/admin/forgot-password/confirm — set the new password. */
async function confirmReset(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  const body = parseBody(event) as { email?: string; code?: string; newPassword?: string };
  const email = (body.email || '').trim().toLowerCase();
  const code = (body.code || '').trim();
  const newPassword = body.newPassword || '';
  if (!email || !code || !newPassword) {
    return badRequest('email, code, and newPassword are required.');
  }

  await connectToDatabase();
  if (cognitoReady()) {
    await getCognitoGateway().confirmForgotPassword(email, code, newPassword);
  }
  return ok({ message: 'Password reset successfully.' }, 'Password reset.');
}

export const forgotPasswordHandler = withErrorHandling(requestReset);
export const confirmPasswordResetHandler = withErrorHandling(confirmReset);
