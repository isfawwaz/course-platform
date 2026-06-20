// App-level transactional email via Resend.
//
// Used by BOTH server actions and the pg-boss worker, so this module MUST NOT import
// "server-only" — the worker runtime throws on it (same constraint as the worker's
// service client). Supabase Auth still sends its own auth emails (invite/magic-link/
// recovery) via its configured SMTP; this module is only for app notifications that Auth
// can't send, e.g. "your certificate is ready".
import { Resend } from "resend";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let client: Resend | null = null;
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/**
 * Send a transactional email (best-effort).
 *
 * Returns `true` if dispatched, `false` if email isn't configured (`RESEND_API_KEY` /
 * `EMAIL_FROM` unset) — so local/dev flows work without a key. Callers must treat email
 * as non-blocking and never fail their primary work on it. Throws only on a real provider
 * error, which callers are expected to catch and log.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const from = process.env.EMAIL_FROM;
  const api = resend();
  if (!api || !from) {
    console.warn(
      `[email] skipped "${msg.subject}" → ${msg.to}: RESEND_API_KEY/EMAIL_FROM not set`,
    );
    return false;
  }
  const { error } = await api.emails.send({
    from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
  if (error) {
    throw new Error(`resend send failed: ${error.message}`);
  }
  return true;
}

/** Escape user-derived values before interpolating into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
