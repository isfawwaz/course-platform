import { randomBytes } from "node:crypto";

/**
 * Certificate code generation (RFC-003 §4, Decision DF).
 *
 * Format: `CP-XXXX-XXXX` where X is Crockford Base32 (no I/L/O/U — avoids ambiguity and
 * accidental words). 8 random symbols ≈ 40 bits — not guessable, not enumerable, not
 * sequential. Uniqueness is enforced by the DB `unique` constraint on `certificates.code`;
 * the rare collision is handled by generate-and-retry at the insert site.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32 (32 symbols)

/** Generate a fresh `CP-XXXX-XXXX` code. */
export function generateCertificateCode(): string {
  // 256 is an exact multiple of 32, so `byte % 32` is unbiased across the alphabet.
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 3) out += "-";
  }
  return `CP-${out}`;
}

const CODE_RE = /^CP-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/**
 * Normalise a user-supplied code (verification page input) to canonical form, mapping
 * Crockford's ambiguous look-alikes: I/L→1, O→0, U→V, then upper-casing. Returns null if
 * the result isn't a structurally valid code (so we never hit the DB with garbage).
 */
export function normalizeCertificateCode(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V")
    .replace(/[^0-9A-Z]/g, ""); // strip spaces, dashes, the CP prefix separators

  if (cleaned.length !== 10 || !cleaned.startsWith("CP")) return null;
  const body = cleaned.slice(2);
  const code = `CP-${body.slice(0, 4)}-${body.slice(4)}`;
  return CODE_RE.test(code) ? code : null;
}
