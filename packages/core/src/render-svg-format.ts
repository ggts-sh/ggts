/**
 * Deterministic SVG number formatting and XML escaping for the pure renderer.
 * Internal helpers — not part of the package public API.
 */

/** Deterministic pixel formatting: 2 decimals, no trailing zeros, no -0. */
export function px(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
}

/**
 * Document-scoped id namespace for one rendered SVG (#1902): `""` or
 * `<prefix>-`, where `prefix` keeps only `[A-Za-z0-9_-]`.
 *
 * `url(#id)` and `href="#id"` resolve against the whole document, so two
 * renders inlined in one page share every unprefixed id. Callers that emit an
 * id or a reference to one pass the scope from their `idPrefix` option; the
 * empty default keeps single-plot output byte-identical.
 */
export function svgIdScope(prefix: string | undefined): string {
  const safe = (prefix ?? "").replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  return safe === "" ? "" : `${safe}-`;
}

export function escapeXML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
