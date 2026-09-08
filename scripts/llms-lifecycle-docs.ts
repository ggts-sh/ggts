/**
 * Lifecycle guide markdown builder for gen-llms (lifecycle.json → prose).
 */
import { CURRENT_EDITION } from "@ggts-sh/spec";

/** Shape of the generated lifecycle.json document (scripts/gen-lifecycle.ts). */
export interface LifecycleDoc {
  tags: readonly string[];
  surfaces: readonly {
    package: string;
    entry: string;
    source: string;
    exports: Record<string, { kind: "value" | "type"; lifecycle: string }>;
  }[];
}

export function buildLifecycleMd(lifecycle: LifecycleDoc): string {
  const sections = lifecycle.surfaces.map((surface) => {
    const byTag = new Map<string, string[]>();
    for (const [name, meta] of Object.entries(surface.exports)) {
      const list = byTag.get(meta.lifecycle) ?? [];
      list.push(meta.kind === "type" ? `\`${name}\` (type)` : `\`${name}\``);
      byTag.set(meta.lifecycle, list);
    }
    const parts = [
      `## ${surface.package}${surface.entry === "." ? "" : ` (${surface.entry})`}`,
      "",
    ];
    for (const tag of lifecycle.tags) {
      const names = byTag.get(tag);
      if (names === undefined) continue;
      parts.push(`### ${tag} (${String(names.length)})`, "", names.join(", "), "");
    }
    return parts.join("\n");
  });
  return `# Lifecycle & editions

## Lifecycle tags

Every public export carries a lifecycle tag (generated into
\`lifecycle.json\` from the source annotations — regenerate with
\`bun run lifecycle:gen\`):

- **experimental** — may change or disappear in any 0.x release. The default
  for APIs not explicitly promoted.
- **stable-intent** — committed enough that changes pay the migration tax.
  Covers (1) the agent core path (PortableSpec, normalize, validate,
  renderToSVGString, GGPlot and their direct result contracts) and
  (2) the recommended Svelte composition children (\`Geom*\` shells and the
  theme/scale/coord/facet/labs/guides/legend grammar children). Not frozen
  pre-1.0, but changes here are treated as breaking: they get a changeset, a
  migration note, and a deprecation window where feasible. Registry and
  factory helpers stay experimental.
- **stable** — committed API under semver (none in v0.1).
- **superseded** — keeps working but stops being recommended; docs point to
  the replacement. Protects agent-generated code from silent breakage.

## Defaults editions

\`normalize()\` stamps \`edition: ${String(CURRENT_EDITION)}\` onto every spec that doesn't carry one,
freezing which generation of DEFAULT aesthetics (theme role tokens,
categorical palette, sequential ramp) the spec was authored against. When a
future edition ships better defaults, stamped specs keep their original look
— old charts never reshuffle. Explicit settings (\`theme\`,
\`scales.*.range\`, \`scales.*.scheme\`) always win over edition defaults, and
unknown editions degrade to the latest known with an \`unknown-edition\`
warning.

${sections.join("\n")}
`;
}
