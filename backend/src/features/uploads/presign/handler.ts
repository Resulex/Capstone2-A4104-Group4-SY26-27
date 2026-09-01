import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withErrorHandling, parseBody } from '../../../shared/handler';
import { ok, badRequest } from '../../../shared/responses';
import { getAuthContext } from '../../../shared/authorization';
import { createPresignedUploadUrl } from '../../../shared/s3';

interface PresignUploadBody {
  folder?: string;
  fileName?: string;
  contentType?: string;
}

/**
 * Media — Presign Upload
 * Use-case: mint a short-lived S3 presigned PUT URL so the client can upload a
 * file directly to S3 (bypassing API Gateway's payload limit). The returned
 * `publicUrl` is stored on the business record (e.g. `evidenceMediaUrls`).
 * POST /uploads/presign (authenticated — residents, officials, admins)
 */
export async function presignUpload(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  // Require a valid session for all uploads.
  getAuthContext(event);

  const body = parseBody(event) as PresignUploadBody;
  const { folder, fileName, contentType } = body;

  if (!folder || !fileName || !contentType) {
    return badRequest('folder, fileName, and contentType are required.');
  }

  const result = await createPresignedUploadUrl({ folder, fileName, contentType });

  return ok(result, 'Presigned upload URL generated.');
}

export const handler = withErrorHandling(presignUpload);
