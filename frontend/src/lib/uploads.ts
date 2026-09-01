import { postApi } from "@/lib/api";

/**
 * Client-side media-upload helpers backed by the backend's S3 presign
 * endpoint (`POST /uploads/presign`, proxied through `/api/backend/...` so the
 * JWT from the httpOnly cookie is attached automatically).
 *
 * Flow:
 *   1. Ask the backend to mint a short-lived presigned PUT URL.
 *   2. PUT the raw file bytes straight to S3 (browser → S3, no API Gateway
 *      payload limit involved). This requires the bucket CORS policy to allow
 *      PUT/GET from the frontend origin.
 *   3. Persist the returned public URL on the business record (e.g.
 *      `evidenceMediaUrls`, `verificationIdUrl`, `imageUrl`, `profileImageUrl`).
 */

/** S3 folders the backend presign endpoint allows (mirrors backend/src/shared/s3.ts). */
export type UploadFolder =
  | "evidence"
  | "verification"
  | "announcements"
  | "profile";

/** True if `url` looks like an image (used for previews). */
export function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|heic)$/i.test(url);
}

/** True if `url` looks like a video (used for previews). */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)$/i.test(url);
}

/** Last path segment of a URL — the S3 object name. */
export function fileNameOf(url: string): string {
  return url.split("/").pop() ?? url;
}

/** Response shape from `POST /uploads/presign`. */
export interface PresignedUpload {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

/** Default per-file size cap (MB) when a caller does not override it. */
const DEFAULT_MAX_SIZE_MB = 25;
const MB = 1024 * 1024;

/** Mint a presigned PUT URL from the backend for a given file. */
export async function requestPresignedUpload(params: {
  folder: UploadFolder;
  fileName: string;
  contentType: string;
}): Promise<PresignedUpload> {
  return postApi<PresignedUpload>("uploads/presign", params);
}

/** Upload raw file bytes to the presigned URL (browser → S3 directly). */
export async function putToS3(
  uploadUrl: string,
  file: File | Blob,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    // Must match the Content-Type the backend signed into the URL.
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload to S3 failed (${res.status}).`);
  }
}

/**
 * Upload a single file to S3 and return its public URL.
 * Throws if the file exceeds `maxSizeMB` or any step fails.
 */
export async function uploadMedia(
  file: File,
  folder: UploadFolder,
  options: { maxSizeMB?: number } = {},
): Promise<string> {
  const maxSizeMB = options.maxSizeMB ?? DEFAULT_MAX_SIZE_MB;
  if (file.size > maxSizeMB * MB) {
    throw new Error(`${file.name} is larger than the ${maxSizeMB} MB limit.`);
  }

  const { uploadUrl, publicUrl } = await requestPresignedUpload({
    folder,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
  });

  await putToS3(uploadUrl, file);
  return publicUrl;
}
