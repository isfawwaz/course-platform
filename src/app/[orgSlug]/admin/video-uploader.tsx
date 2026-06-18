"use client";

import AwsS3 from "@uppy/aws-s3";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/react/dashboard";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

/** Resumable multipart upload to S3/MinIO via our presigning routes (RFC-001 §5). */
export function VideoUploader({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles: 1,
        allowedFileTypes: ["video/*"],
      },
    }).use(AwsS3, {
      shouldUseMultipart: true,
      createMultipartUpload: (file) =>
        postJSON("/api/uploads/create", {
          orgSlug,
          filename: file.name,
          contentType: file.type,
          title: file.name,
        }),
      signPart: (_file, { key, uploadId, partNumber }) =>
        postJSON("/api/uploads/sign-part", { key, uploadId, partNumber }),
      listParts: (_file, { key, uploadId }) =>
        postJSON("/api/uploads/list-parts", { key, uploadId }),
      completeMultipartUpload: (_file, { key, uploadId, parts }) =>
        postJSON("/api/uploads/complete", { key, uploadId, parts }),
      abortMultipartUpload: (_file, { key, uploadId }) =>
        postJSON("/api/uploads/abort", { key, uploadId }),
    }),
  );

  useEffect(() => {
    const onComplete = () => router.refresh();
    uppy.on("complete", onComplete);
    return () => {
      uppy.off("complete", onComplete);
    };
  }, [uppy, router]);

  return (
    <Dashboard
      uppy={uppy}
      height={320}
      width="100%"
      note="One video file (MP4/MOV). It will transcode after upload."
      proudlyDisplayPoweredByUppy={false}
    />
  );
}
