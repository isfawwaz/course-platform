"use client";

import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

/**
 * hls.js player streaming via the token proxy. Reports clamped watched-time deltas
 * (RFC-001 §9) every ~4s of playback and on pause/ended, plus a baseline ping on load
 * so the first real delta isn't clamped against a zero wall-clock. The progress bar is
 * driven live from currentTime for smoothness; the server owns the `completed` verdict.
 */
export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [percent, setPercent] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: Hls | null = null;
    let cancelled = false;
    let lastPos = 0;

    const report = async (delta: number, pos: number) => {
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lessonId,
            lastPositionSec: pos,
            watchedDeltaSec: delta,
          }),
        });
        if (res.ok) {
          const j = await res.json();
          if (j.completed) setCompleted(true);
        }
      } catch {
        // best-effort
      }
    };

    const flush = () => {
      const cur = video.currentTime;
      const delta = Math.max(0, cur - lastPos);
      if (delta > 0) {
        lastPos = cur;
        report(delta, cur);
      }
    };
    const onTimeUpdate = () => {
      if (video.duration > 0) {
        setPercent(Math.min(100, Math.round((video.currentTime / video.duration) * 100)));
      }
      if (video.currentTime - lastPos >= 4) flush();
    };

    void (async () => {
      try {
        const res = await fetch(`/api/lessons/${lessonId}/playback`);
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const { src } = await res.json();
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(video);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        } else {
          setStatus("error");
          return;
        }
        setStatus("ready");
        // Baseline ping establishes the progress row's timestamp.
        report(0, 0);
        video.addEventListener("timeupdate", onTimeUpdate);
        video.addEventListener("ended", flush);
        video.addEventListener("pause", flush);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", flush);
      video.removeEventListener("pause", flush);
      hls?.destroy();
    };
  }, [lessonId]);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border bg-black">
        <video ref={videoRef} controls playsInline className="aspect-video w-full" />
      </div>
      {status === "error" ? (
        <p className="text-sm text-danger">Couldn&apos;t load this lesson.</p>
      ) : null}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="w-32 text-right text-sm text-muted-foreground">
          {percent}%{completed ? " · complete ✓" : ""}
        </span>
      </div>
    </div>
  );
}
