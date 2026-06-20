"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

/**
 * Staff revoke control for an issued certificate. Prompts for an optional reason, calls the
 * revoke route handler, then refreshes. Revocation is one-way (RFC-003 §8).
 */
export function RevokeButton({ certificateId }: { certificateId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    if (busy || pending) return;
    setError(null);
    const reason = window.prompt(
      "Revoke this certificate? Optionally note a reason:",
      "",
    );
    if (reason === null) return; // cancelled

    setBusy(true);
    try {
      const res = await fetch(`/api/certificates/${certificateId}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to revoke.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={busy || pending}
        onClick={revoke}
      >
        {busy || pending ? "Revoking…" : "Revoke"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
