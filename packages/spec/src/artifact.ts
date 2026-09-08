/**
 * JSON Schema artifact builder (decision 0004: TypeBox `Type.Module`
 * named-defs form is the shippable schema).
 *
 * Publish-time transforms applied here, exactly as the decision record
 * prescribes:
 *  1. `$ref: "Name"` (TypeBox $id-anchored refs) -> `#/$defs/Name`
 *     (standard JSON Pointer form; strict provider subsets need it).
 *  2. `patternProperties: { "^(.*)$": S }` (TypeBox `Type.Record` emission)
 *     -> `additionalProperties: S` (semantically identical for that pattern,
 *     and inside the portable keyword set).
 *  3. Per-def `$id` markers removed (the artifact anchors defs under $defs).
 *
 * `scripts/emit-schema.ts` writes the result to `schema/v0.json`; a test
 * asserts the committed artifact matches a fresh build (staleness guard).
 */
import { PlotSpecSchema } from "./schema.js";

// TypeBox 0.x emitted `^(.*)$`; TypeBox 1.x emits `^.*$`. Both are
// "match any property name" records and rewrite to additionalProperties.
const RECORD_PATTERNS = new Set(["^(.*)$", "^.*$"]);

function transform(node: unknown, defNames: ReadonlySet<string>): unknown {
  if (Array.isArray(node)) return node.map((n) => transform(n, defNames));
  if (typeof node !== "object" || node === null) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "$id" && typeof value === "string" && defNames.has(value)) continue;
    if (key === "$ref" && typeof value === "string" && defNames.has(value)) {
      out[key] = `#/$defs/${value}`;
      continue;
    }
    if (
      key === "patternProperties" &&
      typeof value === "object" &&
      value !== null &&
      Object.keys(value).length === 1
    ) {
      const pattern = Object.keys(value)[0]!;
      if (RECORD_PATTERNS.has(pattern)) {
        out["additionalProperties"] = transform(
          (value as Record<string, unknown>)[pattern],
          defNames,
        );
        continue;
      }
    }
    out[key] = transform(value, defNames);
  }
  return out;
}

/** Version tag of the published schema artifact (`schema/v0.json`). */
export const SCHEMA_VERSION = "v0";

/**
 * Build the publishable JSON Schema document (plain data, deterministic).
 * The v0 schema remains explicitly unstable; served from the repo until
 * hosting infrastructure exists (no $id URL is claimed yet).
 */
export function buildSchemaArtifact(): Record<string, unknown> {
  // JSON round-trip drops TypeBox's symbol keys and proves JSON-plainness.
  const raw = JSON.parse(JSON.stringify(PlotSpecSchema)) as {
    $defs: Record<string, unknown>;
    $ref: string;
  };
  const defNames = new Set(Object.keys(raw.$defs));
  const transformed = transform(raw, defNames) as Record<string, unknown>;
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "ggts PortableSpec",
    description:
      "A ggts plot specification (schema v0 — UNSTABLE; served from the repo until schema hosting exists).",
    ...transformed,
  };
}

/** The artifact serialized exactly as `schema/v0.json` is committed. */
export function schemaArtifactJSON(): string {
  return JSON.stringify(buildSchemaArtifact(), null, 2) + "\n";
}
