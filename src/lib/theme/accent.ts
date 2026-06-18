/**
 * Derive the per-org theme CSS variables from a single brand accent hex
 * (design system §2). Applied on the `[orgSlug]` wrapper to override `--primary`
 * and its derived states; everything else stays slate.
 */

type Rgb = { r: number; g: number; b: number };

const SLATE_900 = "#0F172A";
const NEAR_WHITE = "#F8FAFC";

function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrast(a: number, b: number): number {
  const hi = Math.max(a, b) + 0.05;
  const lo = Math.min(a, b) + 0.05;
  return hi / lo;
}

/** Pick white or slate-900 for text on the brand colour — whichever hits AA. */
function pickForeground(brand: Rgb): string {
  const brandLum = luminance(brand);
  const white = contrast(brandLum, luminance(hexToRgb(NEAR_WHITE)!));
  const dark = contrast(brandLum, luminance(hexToRgb(SLATE_900)!));
  return white >= dark ? NEAR_WHITE : SLATE_900;
}

function darken({ r, g, b }: Rgb, amount: number): string {
  const f = 1 - amount;
  return toHex({ r: r * f, g: g * f, b: b * f });
}

/**
 * CSS custom properties for the org accent, or `{}` if the hex is missing/invalid
 * (falls back to the default slate `:root` values).
 */
export function deriveAccentVars(
  accent: string | null | undefined,
): Record<string, string> {
  if (!accent) return {};
  const rgb = hexToRgb(accent);
  if (!rgb) return {};

  return {
    "--primary": toHex(rgb),
    "--primary-foreground": pickForeground(rgb),
    "--primary-hover": darken(rgb, 0.08),
    "--primary-active": darken(rgb, 0.16),
    "--ring": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
  };
}
