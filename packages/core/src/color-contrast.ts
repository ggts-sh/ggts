/**
 * WCAG 2.1 relative-luminance contrast helpers for resolved theme color roles.
 */

interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const HEX_COLOR_RE = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

const NAMED_RGB: Readonly<Record<string, readonly [number, number, number]>> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  silver: [192, 192, 192],
  darkgray: [169, 169, 169],
  darkgrey: [169, 169, 169],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  lightgray: [211, 211, 211],
  lightgrey: [211, 211, 211],
  gainsboro: [220, 220, 220],
  whitesmoke: [245, 245, 245],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  navy: [0, 0, 128],
  teal: [0, 128, 128],
  orange: [255, 165, 0],
  yellow: [255, 255, 0],
  purple: [128, 0, 128],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseScaledNumber(token: string, max: number, requirePercent = false): number | null {
  const trimmed = token.trim();
  if (trimmed === "") return null;
  if (trimmed.endsWith("%")) {
    const numText = trimmed.slice(0, -1).trim();
    if (numText === "") return null;
    const pct = Number(numText);
    return Number.isFinite(pct) ? clamp((pct / 100) * max, 0, max) : null;
  }
  if (requirePercent) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? clamp(n, 0, max) : null;
}

function parseHexColor(raw: string): Rgba | null {
  if (!HEX_COLOR_RE.test(raw)) return null;
  const digits = raw.slice(1);
  if (digits.length === 3 || digits.length === 4) {
    return {
      r: Number.parseInt(digits[0]! + digits[0]!, 16),
      g: Number.parseInt(digits[1]! + digits[1]!, 16),
      b: Number.parseInt(digits[2]! + digits[2]!, 16),
      a: digits.length === 4 ? Number.parseInt(digits[3]! + digits[3]!, 16) / 255 : 1,
    };
  }
  return {
    r: Number.parseInt(digits.slice(0, 2), 16),
    g: Number.parseInt(digits.slice(2, 4), 16),
    b: Number.parseInt(digits.slice(4, 6), 16),
    a: digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1,
  };
}

function splitCssFunctionArgs(
  body: string,
): { channels: readonly [string, string, string]; alpha: string | undefined } | null {
  let rgbPart = body.trim();
  let alpha: string | undefined;
  if (rgbPart.includes("/")) {
    const parts = rgbPart.split("/");
    if (parts.length !== 2) return null;
    rgbPart = parts[0]!.trim();
    alpha = parts[1]!.trim();
    if (alpha === "") return null;
  }
  const tokens = rgbPart.includes(",")
    ? rgbPart.split(",").map((part) => part.trim())
    : rgbPart.split(/\s+/);
  if (alpha === undefined && tokens.length === 4) {
    alpha = tokens[3];
  } else if (tokens.length !== 3) {
    return null;
  }
  return { channels: [tokens[0]!, tokens[1]!, tokens[2]!], alpha };
}

function parseRgbFunction(raw: string): Rgba | null {
  const match = /^rgba?\(([^)]+)\)$/i.exec(raw);
  if (match === null) return null;
  const parsed = splitCssFunctionArgs(match[1]!);
  if (parsed === null) return null;
  const r = parseScaledNumber(parsed.channels[0], 255);
  const g = parseScaledNumber(parsed.channels[1], 255);
  const b = parseScaledNumber(parsed.channels[2], 255);
  const a = parsed.alpha === undefined ? 1 : parseScaledNumber(parsed.alpha, 1);
  if (r === null || g === null || b === null || a === null) return null;
  return { r, g, b, a };
}

function parseHueDegrees(token: string): number | null {
  const trimmed = token.trim();
  if (trimmed === "") return null;
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))(deg|rad|grad|turn)?$/i.exec(trimmed);
  if (match === null) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[2]?.toLowerCase() ?? "deg";
  const degrees =
    unit === "rad"
      ? (value * 180) / Math.PI
      : unit === "grad"
        ? value * 0.9
        : unit === "turn"
          ? value * 360
          : value;
  return ((degrees % 360) + 360) % 360;
}

function parseHslFunction(raw: string): Rgba | null {
  const match = /^hsla?\(([^)]+)\)$/i.exec(raw);
  if (match === null) return null;
  const parsed = splitCssFunctionArgs(match[1]!);
  if (parsed === null) return null;
  const h = parseHueDegrees(parsed.channels[0]);
  const s = parseScaledNumber(parsed.channels[1], 1, true);
  const l = parseScaledNumber(parsed.channels[2], 1, true);
  const a = parsed.alpha === undefined ? 1 : parseScaledNumber(parsed.alpha, 1);
  if (h === null || s === null || l === null || a === null) return null;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255, a };
}

function parseCssColor(color: string): Rgba | null {
  const trimmed = color.trim().toLowerCase();
  if (trimmed === "" || trimmed === "none" || trimmed === "transparent") return null;
  if (trimmed.startsWith("#")) return parseHexColor(trimmed);
  if (trimmed.startsWith("rgb")) return parseRgbFunction(trimmed);
  if (trimmed.startsWith("hsl")) return parseHslFunction(trimmed);
  const named = NAMED_RGB[trimmed];
  return named === undefined ? null : { r: named[0], g: named[1], b: named[2], a: 1 };
}

function compositeOver(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

function linearizeSrgbChannel(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: Rgba): number {
  return (
    0.2126 * linearizeSrgbChannel(color.r) +
    0.7152 * linearizeSrgbChannel(color.g) +
    0.0722 * linearizeSrgbChannel(color.b)
  );
}

/**
 * WCAG 2.1 contrast ratio in [1, 21] for two CSS colors, or null when either
 * color cannot be resolved statically (e.g. `currentColor`, CSS var, or
 * translucent without an opaque backdrop).
 */
export function contrastRatio(
  foreground: string,
  background: string,
  options?: { backdrop?: string },
): number | null {
  const parsedFg = parseCssColor(foreground);
  const parsedBg = parseCssColor(background);
  if (parsedFg === null || parsedBg === null) return null;

  let opaqueBg = parsedBg;
  if (parsedBg.a < 1) {
    const backdrop = options?.backdrop === undefined ? null : parseCssColor(options.backdrop);
    if (backdrop === null || backdrop.a < 1) return null;
    opaqueBg = compositeOver(parsedBg, backdrop);
  }
  const opaqueFg = parsedFg.a < 1 ? compositeOver(parsedFg, opaqueBg) : parsedFg;

  const l1 = relativeLuminance(opaqueFg);
  const l2 = relativeLuminance(opaqueBg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function isTransparentToken(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "none" || normalized === "transparent";
}
