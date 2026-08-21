import type { APIGatewayProxyResult } from 'aws-lambda';

const CORS_HEADERS: Record<string, string | boolean> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

interface Envelope {
  success: boolean;
  data?: unknown;
  message?: string;
  [key: string]: unknown;
}

function build(statusCode: number, body: Envelope): APIGatewayProxyResult {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

/** 200 OK */
export function ok(data: unknown = null, message = 'OK'): APIGatewayProxyResult {
  return build(200, { success: true, data, message });
}

/** 201 Created */
export function created(data: unknown = null, message = 'Created'): APIGatewayProxyResult {
  return build(201, { success: true, data, message });
}

/** 400 Bad Request */
export function badRequest(message = 'Bad Request', details?: unknown): APIGatewayProxyResult {
  return build(400, { success: false, message, details });
}

/** 401 Unauthorized */
export function unauthorized(message = 'Unauthorized'): APIGatewayProxyResult {
  return build(401, { success: false, message });
}

/** 403 Forbidden */
export function forbidden(message = 'Forbidden'): APIGatewayProxyResult {
  return build(403, { success: false, message });
}

/** 404 Not Found */
export function notFound(message = 'Not Found'): APIGatewayProxyResult {
  return build(404, { success: false, message });
}

/** 409 Conflict */
export function conflict(message = 'Conflict'): APIGatewayProxyResult {
  return build(409, { success: false, message });
}

/** 422 Unprocessable Entity */
export function unprocessable(message = 'Unprocessable Entity', details?: unknown): APIGatewayProxyResult {
  return build(422, { success: false, message, details });
}

/** 500 Internal Server Error */
export function serverError(message = 'Internal Server Error'): APIGatewayProxyResult {
  return build(500, { success: false, message });
}