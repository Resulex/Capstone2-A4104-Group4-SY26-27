import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { badRequestError } from './errors';

/**
 * S3 media-upload helpers for presigned-URL uploads.
 *
 * The client calls `POST /uploads/presign` to mint a short-lived presigned PUT
 * URL, then uploads the file directly to S3 (browser → S3), bypassing API
 * Gateway's ~10 MB payload limit. Only `uploadUrl`/`publicUrl` values we mint
 * here are ever stored in business records (`evidenceMediaUrls`,
 * `verificationIdUrl`, `imageUrl`, `profileImageUrl`).
 *
 * Credentials resolve via the AWS default credential chain: environment
 * variables (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` from `.env`) in local
 * `serverless offline`, and the Lambda execution role in deployed AWS.
 */

/** Folders clients are allowed to upload into (S3 key prefixes). */
export const ALLOWED_UPLOAD_FOLDERS = [
  'evidence',
  'verification',
  'announcements',
  'profile',
] as const;

export type UploadFolder = (typeof ALLOWED_UPLOAD_FOLDERS)[number];

/** MIME type → file extension map for validated uploads. */
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** Bucket + region resolved from env (defaults match `.env` / `seed.ts`). */
const S3_BUCKET = process.env.S3_BUCKET_NAME ?? 'kabarangayconnect-media';
const S3_REGION = process.env.S3_BUCKET_REGION ?? 'ap-southeast-1';

/** How long the presigned PUT URL stays valid (seconds). */
const PRESIGNED_URL_TTL_SECONDS = 60;

/** Lazy S3 client (credentials resolve via the default chain). */
let s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION,
      // Opt out of the SDK's default CRC32 checksums. With `WHEN_SUPPORTED`
      // (the SDK default), `getSignedUrl` embeds placeholder
      // `x-amz-checksum-crc32` + `x-amz-sdk-checksum-algorithm` params into
      // the presigned PUT URL. The browser never echoes that checksum back,
      // so S3 rejects every upload with `SignatureDoesNotMatch`. Setting
      // `WHEN_REQUIRED` only adds a checksum when a command explicitly asks
      // for one, leaving the presigned URL clean and browser PUTs working.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }
  return s3Client;
}

/** Public HTTPS URL for an object key (mirrors the `seed.ts` URL format). */
export function s3Url(key: string): string {
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

/** True if `folder` is a supported upload folder. */
export function isAllowedFolder(folder: string): folder is UploadFolder {
  return (ALLOWED_UPLOAD_FOLDERS as readonly string[]).includes(folder);
}

/**
 * Reduce a client-supplied file name to a safe, human-readable base segment
 * (no path separators, no reserved characters, capped length).
 */
function sanitizeBaseName(fileName: string): string {
  const base = fileName
    .replace(/[^\w.\-]+/g, '-')
    .replace(/^[\-.]+|[\-.]+$/g, '')
    .slice(0, 40);
  return base || 'file';
}

/**
 * Mint a short-lived presigned PUT URL for a new S3 object and return the
 * upload URL plus the stable public URL to persist. Rejects unknown folders
 * and disallowed content types.
 */
export async function createPresignedUploadUrl(params: {
  folder: string;
  fileName: string;
  contentType: string;
}): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string }> {
  const { folder, fileName, contentType } = params;

  if (!isAllowedFolder(folder)) {
    throw badRequestError(`Unsupported upload folder: ${folder}.`);
  }

  const extension = CONTENT_TYPE_EXTENSIONS[contentType];
  if (!extension) {
    throw badRequestError(
      `Unsupported content type: ${contentType}. Allowed: ${Object.keys(
        CONTENT_TYPE_EXTENSIONS
      ).join(', ')}.`
    );
  }

  const fileKey = `${folder}/${sanitizeBaseName(fileName)}-${randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: fileKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGNED_URL_TTL_SECONDS,
  });

  return { uploadUrl, fileKey, publicUrl: s3Url(fileKey) };
}
