/**
 * Prompt construction for the NL→spec eval harness.
 *
 * The system prompt carries: the role, the emit-JSON-only contract, a compact
 * grammar cheat-sheet (canonical channel forms, geoms, stat/position
 * defaults, facet/coord/scales shapes), the graceful-refusal contract, and
 * the repair instruction. The full JSON Schema (packages/spec/schema/v0.json)
 * is deliberately NOT inlined — it is too large for an eval prompt; the
 * cheat-sheet plus validator repair round covers the same ground.
 *
 * The user prompt is the case's natural-language request plus the serialized
 * DataProfile on a single marked line (MockResponder parses that line back).
 */
import type { DataProfile, SpecError } from "@ggts-sh/spec";

export const PROFILE_MARKER = "DataProfile (JSON):";
export const REPAIR_MARKER = "VALIDATION ERRORS (SpecError JSON):";

export function buildSystemPrompt(): string {
  return `You are a chart-spec compiler. Turn the user's natural-language request plus a DataProfile into ONE ggts PortableSpec, as JSON.

OUTPUT CONTRACT
- Reply with a single JSON object and NOTHING else: no prose, no markdown fences.
- The spec is strict JSON. A JSON Schema for it exists (ggts spec v0), but this cheat-sheet is authoritative for you.
- Reference the caller's data with "data": {"name": "main"} — the harness supplies the rows out of band.

GRAMMAR CHEAT-SHEET
- Top level: { "data": {"name":"main"}, "layers": [...], "facet"?, "coord"?, "scales"?, "labs"? }.
- Channels use CANONICAL forms only — NEVER bare strings:
    {"field": "column"}   map a data column
    {"value": 3}          constant ({"value": "red"} for literal colors)
    {"stat": "count"}     a stat-computed column
    null                  unset an inherited channel
- Channel names: x, y, color, fill, size, linewidth, alpha, group, label, weight, ymin, ymax, xmin, xmax, xend, yend, angle, radius, width, height.
- Layers: { "geom": ..., "stat"?, "position"?, "aes": {...}, "params"?, "positionParams"? }.
- Geoms: point, line, path, col, bar, histogram, area, rule, text, smooth, boxplot, density, errorbar, rect, tile, raster, ribbon, segment, curve, map, blank, spoke.
- map (choropleth): aes.map_id + params.map ({values} or {columns} with long+lat or x+y and a region id column; params.mapId optional). Not a live geo API.
- Stat defaults per geom (omit to accept): bar→count, histogram→bin, smooth→smooth, boxplot→boxplot, density→density, everything else→identity.
- Position defaults: bar/histogram/col/area→stack, boxplot→dodge, else identity. Alternatives: fill (proportions), dodge (side by side), jitter (points; positionParams {width,height,seed}), nudge (text; positionParams {x,y}).
- bar COUNTS rows (never map aes.y); col draws pre-computed heights (map aes.y). histogram bins a continuous x (params: bins | binwidth).
- smooth params: {"method": "lm"|"loess", "se": bool, "span"?}. errorbar with "stat":"summary" maps x+y and computes mean±se (params fun/funMin/funMax); with identity stat map x+ymin+ymax.
- rect: map xmin/xmax/ymin/ymax (quantitative edges). tile: map x/y centers (+ optional width/height or params.width/height); works discrete or continuous. raster: equal-cell continuous grid from x/y (+ fill); no stroke. ribbon: filled band between ymin/ymax along x (or xmin/xmax along y).
- segment: finite line per row from (x,y) to (xend,yend) — both ends train scales; not panel-spanning (that is rule).
- spoke: finite segment per row from (x,y) in direction angle (radians) with length radius (data units); xend/yend derived; angle/radius via aes or params.
- blank: trains scales from mapped aesthetics with no marks (no paint / no hits).
- rule annotation form: params.xintercept / params.yintercept (numbers or ISO dates), NO aes.x/aes.y on that layer. text needs aes x, y, label.
- Facet: {"wrap": {"field": f}, "ncol"?, "scales"?: "fixed"|"free"|"free_x"|"free_y"} OR grid {"rows": {"field": f}, "cols": {"field": g}} — never both forms.
- Coord: {"type": "flip"} makes horizontal charts (still map x=category, y=value). A post-stat coordinate transform is {"type":"transform","x"?: {"transform":"identity"|"log10"|"sqrt","limits"?: [min,max],"reverse"?: bool,"expand"?: bool},"y"?: same,"clip"?: bool}. Fixed physical data-unit lengths use {"type":"fixed","ratio"?: positiveNumber}; omit ratio for equal x/y units and never combine fixed coordinates with free facet scales. Coordinate transforms preserve stat inputs; scale transforms do not.
- Position scales: {"x"|"y": {"type": "linear"|"log"|"time"|"band", "parse"?, "temporalKind"?: "date"|"datetime", "timezone"?, "dateBreaks"?, "dateMinorBreaks"?, "dateLabels"?, "locale"?, "weekStart"?, "domain"?, "nice"?, "zero"?}}. Ordinary ISO dates, four-digit year strings, year-months, and year-quarters infer time without an explicit scale. Calendar intervals are strings such as "2 weeks" or "10 years". Ambiguous ordered dates require a closed parse name such as "dmy" or "mdy". Use "band" when year-like strings are identifiers. Never preprocess dates into indexes.
- Color/fill scales: {"color"|"fill": {"type": "ordinal"|"sequential", "range"?}}. Use "log" only for positive quantitative fields and "sequential" only for quantitative color/fill.
- Labs: {"title", "subtitle", "caption", "x", "y", "color", "fill"} — plain strings.
- Only map fields that exist in the DataProfile, with their exact names.

REFUSAL CONTRACT
If the request needs a chart type outside the geoms above (live geographic APIs, 3D, networks, ...), or is unanswerable from the profile, reply instead with exactly:
  {"unsupported": "<one-sentence reason>", "closestAlternative": <a supported PortableSpec or null>}

REPAIR
If a follow-up message reports validation errors, each error may include fix.example — apply it. Return the corrected complete JSON spec only.`;
}

export function buildUserPrompt(prompt: string, profile: DataProfile): string {
  return `${prompt}\n\n${PROFILE_MARKER} ${JSON.stringify(profile)}`;
}

/** The one-round repair prompt: original request + the SpecError JSON. */
export function buildRepairPrompt(
  userPrompt: string,
  previousReply: string,
  errors: readonly SpecError[],
): string {
  return `${userPrompt}

Your previous spec failed validation.

PREVIOUS SPEC:
${previousReply}

${REPAIR_MARKER}
${JSON.stringify(errors, null, 2)}

Errors include fix.example — apply the fixes and reply with the corrected complete JSON spec only.`;
}
