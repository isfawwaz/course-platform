"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

/**
 * Confirm / reject buttons for a pending-review completion. Calls the staff route handlers
 * (`/api/completions/:id/confirm|reject`) and refreshes the list. Confirming a
 * certificate-enabled course kicks off async PDF issuance server-side.
 */
export function ReviewActions({ completionId }: { completionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function act(action: "confirm" | "reject") {
    setError(null);
    const res = await fetch(`/api/completions/${completionId}/${action}`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Failed to ${action}.`);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => act("reject")}
        >
          Reject
        </Button>
        <Button type="button" disabled={pending} onClick={() => act("confirm")}>
          {pending ? "Working…" : "Confirm"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
