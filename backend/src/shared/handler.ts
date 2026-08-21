import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { AppError } from './errors';
import { serverError } from './responses';

export type Handler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

/**
 * Wraps a use-case handler so that:
 * - AppError is mapped to its HTTP response with the proper status code.
 * - Unknown errors are logged and mapped to a 500 response (avoid leaking
 *   internal details to clients).
 */
export function withErrorHandling(
  fn: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
): Handler {
  return async (event, context) => {
    try {
      return await fn(event, context);
    } catch (error) {
      if (error instanceof AppError) {
        const body = {
          success: false,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        };
        return {
          statusCode: error.statusCode,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
          },
          body: JSON.stringify(body),
        };
      }

      console.error('[Handler Error]', error);
      return serverError();
    }
  };
}

/**
 * Parses the JSON body from an API Gateway event.
 * Throws a 400 AppError when the body is missing or invalid.
 */
export function parseBody(event: APIGatewayProxyEvent): Record<string, unknown> {
  if (!event.body) {
    throw new AppError(400, 'Request body is required.');
  }

  try {
    const parsed = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Body must be a JSON object.');
    }
    return parsed;
  } catch {
    throw new AppError(400, 'Invalid JSON body.');
  }
}

/**
 * Parses a single path parameter (e.g. `{id}`) from an API Gateway event.
 * Returns the decoded value or throws a 400 AppError when it is missing.
 */
export function parsePathParam(event: APIGatewayProxyEvent, name: string): string {
  const value = event.pathParameters?.[name];
  if (!value) {
    throw new AppError(400, `Path parameter "${name}" is required.`);
  }
  return decodeURIComponent(value);
}
