/**
 * Transcode worker (RFC-001 §6). Local Node process for the spike — `bun run worker`.
 * Pulls `transcode` jobs from pg-boss, runs ffmpeg → single 720p HLS rendition + poster,
 * uploads the tree to S3/MinIO, and calls back to mark the video ready/failed.
 *
 * Same code is the basis for the Fly.io worker in P1 (just containerised with ffmpeg).
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import {
  getBoss,
  TRANSCODE_QUEUE,
  type TranscodeJob,
} from "../src/lib/queue/boss";
import {
  videoHlsPrefix,
  videoMasterKey,
  videoPosterKey,
} from "../src/lib/storage/keys";
import { mediaBucket, s3 } from "../src/lib/storage/s3";

const APP_URL = process.env.APP_INTERNAL_URL ?? "http://localhost:3000";
const CALLBACK_SECRET = process.env.TRANSCODE_CALLBACK_SECRET ?? "";
const bucket = mediaBucket();

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`)),
    );
  });
}

function probeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", [
      "-v", "quiet", "-print_format", "json", "-show_format", file,
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("error", reject);
    p.on("close", () => {
      try {
        resolve(Math.round(parseFloat(JSON.parse(out).format.duration)));
      } catch {
        resolve(0);
      }
    });
  });
}

function contentType(name: string): string {
  if (name.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (name.endsWith(".ts")) return "video/mp2t";
  if (name.endsWith(".jpg")) return "image/jpeg";
  return "application/octet-stream";
}

async function put(key: string, file: string) {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: await readFile(file),
      ContentType: contentType(key),
    }),
  );
}

async function callback(payload: Record<string, unknown>) {
  const res = await fetch(`${APP_URL}/api/internal/transcode-callback`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-transcode-secret": CALLBACK_SECRET,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`callback ${res.status}: ${await res.text()}`);
}

async function transcode(job: TranscodeJob) {
  const { videoId, orgId, sourceKey } = job;
  const scratch = join(tmpdir(), `cp-transcode-${videoId}`);
  const variantDir = join(scratch, "hls", "720p");
  console.log(`[transcode] ${videoId} start`);

  try {
    await mkdir(variantDir, { recursive: true });

    // 1. download source
    const src = join(scratch, "source");
    const obj = await s3().send(
      new GetObjectCommand({ Bucket: bucket, Key: sourceKey }),
    );
    await writeFile(src, await obj.Body!.transformToByteArray());

    // 2. probe duration
    const durationSec = await probeDuration(src);

    // 3. ffmpeg → 720p HLS
    await run("ffmpeg", [
      "-y", "-i", src,
      "-vf", "scale=-2:720",
      "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p",
      "-crf", "21", "-preset", "veryfast",
      "-c:a", "aac", "-b:a", "128k",
      "-hls_time", "6", "-hls_playlist_type", "vod",
      "-hls_segment_filename", join(variantDir, "segment_%03d.ts"),
      join(variantDir, "index.m3u8"),
    ]);

    // 4. master playlist (single rendition) + poster
    const master = join(scratch, "hls", "master.m3u8");
    await writeFile(
      master,
      "#EXTM3U\n#EXT-X-VERSION:3\n" +
        "#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720\n" +
        "720p/index.m3u8\n",
    );
    const poster = join(scratch, "poster.jpg");
    await run("ffmpeg", [
      "-y", "-ss", "1", "-i", src, "-frames:v", "1", "-q:v", "3", poster,
    ]);

    // 5. upload HLS tree + poster
    const prefix = videoHlsPrefix(orgId, videoId);
    await put(videoMasterKey(orgId, videoId), master);
    await put(`${prefix}/720p/index.m3u8`, join(variantDir, "index.m3u8"));
    for (const f of await readdir(variantDir)) {
      if (f.endsWith(".ts")) await put(`${prefix}/720p/${f}`, join(variantDir, f));
    }
    await put(videoPosterKey(orgId, videoId), poster);

    // 6. callback ready
    await callback({
      videoId,
      status: "ready",
      hlsManifestKey: videoMasterKey(orgId, videoId),
      durationSec,
      thumbnailKey: videoPosterKey(orgId, videoId),
    });
    console.log(`[transcode] ${videoId} ready (${durationSec}s)`);
  } catch (err) {
    console.error(`[transcode] ${videoId} failed:`, err);
    await callback({
      videoId,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => {});
    throw err;
  } finally {
    await rm(scratch, { recursive: true, force: true }).catch(() => {});
  }
}

const boss = await getBoss();
await boss.work<TranscodeJob>(TRANSCODE_QUEUE, async (jobs) => {
  for (const job of jobs) await transcode(job.data);
});
console.log(`[worker] listening on "${TRANSCODE_QUEUE}"`);
