/**
 * Ensure the media bucket exists in the configured S3/MinIO backend.
 * Run with: bun run scripts/ensure-bucket.ts   (bun auto-loads .env.local)
 */
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

import { mediaBucket, s3 } from "../src/lib/storage/s3";

const bucket = mediaBucket();
const client = s3();

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`✓ bucket "${bucket}" already exists`);
} catch (err) {
  // Only "missing bucket" (404) should trigger creation — surface auth/network/etc.
  const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode;
  if (status !== 404) throw err;
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`✓ created bucket "${bucket}"`);
}
