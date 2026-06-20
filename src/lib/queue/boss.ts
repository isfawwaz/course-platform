import { PgBoss } from "pg-boss";

/**
 * pg-boss queue, backed by the Supabase Postgres (RFC-001 D1 — transactional enqueue
 * in the same DB as app data). Shared by the app (enqueue side) and the worker (consume
 * side); each process keeps one started instance in its own `pgboss` schema.
 *
 * Needs a session-mode/direct connection string in DATABASE_URL (LISTEN/NOTIFY), not the
 * Supabase transaction pooler.
 */
export const TRANSCODE_QUEUE = "transcode";
export const CERTIFICATE_QUEUE = "certificate";

export type TranscodeJob = {
  videoId: string;
  orgId: string;
  sourceKey: string;
};

/** Certificate issuance job (RFC-003 §6). Keyed by certificateId for idempotent re-render. */
export type CertificateJob = {
  certificateId: string;
};

const QUEUES = [TRANSCODE_QUEUE, CERTIFICATE_QUEUE];

let bossPromise: Promise<PgBoss> | null = null;

export function getBoss(): Promise<PgBoss> {
  if (bossPromise) return bossPromise;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — required for pg-boss.");
  }
  const boss = new PgBoss({ connectionString, schema: "pgboss" });
  bossPromise = boss
    .start()
    .then(async () => {
      // createQueue is idempotent in pg-boss v12 (no-op if it already exists).
      for (const q of QUEUES) await boss.createQueue(q);
      return boss;
    })
    .catch((err) => {
      // Don't cache a rejected promise — let the next call retry initialization.
      bossPromise = null;
      throw err;
    });
  return bossPromise;
}

/** Enqueue a transcode job (called from /api/videos/:id/complete). */
export async function enqueueTranscode(job: TranscodeJob): Promise<void> {
  const boss = await getBoss();
  await boss.send(TRANSCODE_QUEUE, job);
}

/** Enqueue a certificate-issue job (called from the confirm-completion handler). */
export async function enqueueCertificate(job: CertificateJob): Promise<void> {
  const boss = await getBoss();
  await boss.send(CERTIFICATE_QUEUE, job);
}
