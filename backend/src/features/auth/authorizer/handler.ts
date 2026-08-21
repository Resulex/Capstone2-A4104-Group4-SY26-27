import type {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
  Context,
} from 'aws-lambda';
import { extractBearerToken, verifyToken } from '../../../shared/auth';

/**
 * Auth — JWT Authorizer
 * Use-case: validate the Authorization Bearer token for protected endpoints.
 *
 * This custom REQUEST authorizer runs before protected handlers. On success it
 * produces an IAM policy that allows the invoking API Gateway method; on
 * failure it returns an explicit deny policy.
 */
export async function authorize(
  event: APIGatewayRequestAuthorizerEvent,
  _context: Context
): Promise<APIGatewayAuthorizerResult> {
  const authorizationHeader = event.headers?.['Authorization'] ?? event.headers?.['authorization'];

  try {
    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw new Error('Missing or malformed Authorization header.');
    }

    const payload = verifyToken(token);

    return {
      principalId: payload.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn,
          },
        ],
      },
      context: {
        userId: payload.sub,
        role: payload.role,
      },
    };
  } catch (error) {
    console.error('[Authorizer] denied:', (error as Error).message);

    return {
      principalId: 'unauthorized',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: event.methodArn,
          },
        ],
      },
    };
  }
}

export const handler = authorize;