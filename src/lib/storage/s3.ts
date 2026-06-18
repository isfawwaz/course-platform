import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3 client for media storage. Points at local MinIO in dev (S3-compatible); the same
 * code targets Cloudflare R2 in production by swapping AWS_ENDPOINT.
 *
 * Used by Route Handlers and the transcode worker (both server-side) — never the client,
 * so the credentials (non-NEXT_PUBLIC env) never reach the browser.
 */
let client: S3Client | null = null;

export function s3(): S3Client {
  if (client) return client;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.");
  }

  client = new S3Client({
    region: process.env.AWS_DEFAULT_REGION ?? "us-east-1",
    endpoint: process.env.AWS_ENDPOINT,
    forcePathStyle: process.env.AWS_USE_PATH_STYLE_ENDPOINT === "true",
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export function mediaBucket(): string {
  const bucket = process.env.AWS_BUCKET;
  if (!bucket) throw new Error("Missing AWS_BUCKET.");
  return bucket;
}
