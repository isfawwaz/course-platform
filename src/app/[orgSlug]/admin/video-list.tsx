"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type VideoRow = {
  id: string;
  title: string;
  status: string;
  duration_sec: number | null;
};

const STATUS_STYLE: Record<string, string> = {
  uploading: "bg-muted text-muted-foreground",
  processing: "bg-warning-subtle text-warning",
  ready: "bg-success-subtle text-success",
  failed: "bg-danger-subtle text-danger",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLE[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

/** Live-ish video library: polls while anything is uploading/processing (spike — Realtime in P1). */
export function VideoList({
  orgId,
  initial,
}: {
  orgId: string;
  initial: VideoRow[];
}) {
  const [videos, setVideos] = useState<VideoRow[]>(initial);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const tick = async () => {
      const { data } = await supabase
        .from("videos")
        .select("id, title, status, duration_sec")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (active && data) setVideos(data);
    };
    const interval = setInterval(tick, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orgId]);

  if (videos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No videos yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {videos.map((v) => (
        <li
          key={v.id}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <span className="truncate text-sm text-foreground">{v.title}</span>
          <span className="flex items-center gap-3">
            {v.duration_sec ? (
              <span className="text-xs text-muted-foreground">
                {Math.round(v.duration_sec)}s
              </span>
            ) : null}
            <StatusBadge status={v.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}
