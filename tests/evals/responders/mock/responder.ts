/**
 * MockResponder: deterministic, template-based Responder. It keyword-matches
 * the case prompt, parses the DataProfile line back out of the user prompt,
 * and synthesizes a spec over the profile's fields. It exercises EVERY
 * runner path: valid specs, the documented refusal shape (map/3D
 * requests), and one intentionally-invalid spec — any prompt mentioning a
 * "stepped" chart gets an unknown geom ("steps") on the first call, then
 * a fixed valid line spec on the repair call (detected via the repair
 * marker in the user prompt).
 *
 * Geom families live in the synthesize-*.ts siblings; the orchestrator calls
 * them in a fixed order and stops at the first match.
 */
import type { DataProfile } from "@ggts-sh/spec";

import { PROFILE_MARKER, REPAIR_MARKER } from "../../prompt.ts";
import type { Responder } from "../types.ts";
import { postprocess } from "./postprocess.ts";
import { FieldPicker, parseProfileLine } from "./profile.ts";
import { hasAestheticMapping } from "./style.ts";
import { synthesizeBasic } from "./synthesize-basic.ts";
import { synthesizeBins } from "./synthesize-bins.ts";
import { synthesizeSpecialty } from "./synthesize-specialty.ts";
import { synthesizeSurfaces } from "./synthesize-surfaces.ts";
import type { MockContext, MockSpec, MockScales } from "./types.ts";

export class MockResponder implements Responder {
  readonly name = "mock";

  complete(system: string, user: string): Promise<string> {
    void system;
    const markerAt = user.indexOf(PROFILE_MARKER);
    const prompt = (markerAt === -1 ? user : user.slice(0, markerAt)).toLowerCase();
    const repair = user.includes(REPAIR_MARKER);
    const profile = parseProfileLine(user);

    // Supported geom_map (#808) / geom_sf (#809) — do not refuse those.
    // Still refuse bare geographic "map" / choropleth without a geom.
    const supportedMapGeom = /\bgeom map\b|\bfortified\b/.test(prompt);
    const supportedSfGeom =
      /\bgeom[_\s]?sf\b|\bgeojson\b|\bsimple features?\b|\bsf (?:point|polygon|layer|choropleth)\b/.test(
        prompt,
      ) || profile.fields.some((field) => field.name === "geometry");
    if (
      /(?:\b3-?d\b|surface plot|network diagram)/.test(prompt) ||
      (prompt.includes("choropleth") && !supportedMapGeom && !supportedSfGeom) ||
      (/\bmap\b/.test(prompt) &&
        !hasAestheticMapping(prompt, profile) &&
        !/\bribbon\b/.test(prompt) &&
        !supportedMapGeom &&
        !supportedSfGeom)
    ) {
      return Promise.resolve(
        JSON.stringify({
          unsupported: "This chart type is outside the supported geoms.",
          closestAlternative: null,
        }),
      );
    }

    const spec = this.#synthesize(prompt, profile, repair);
    return Promise.resolve(JSON.stringify(spec));
  }

  #synthesize(prompt: string, profile: DataProfile, repair: boolean): MockSpec {
    const pick = new FieldPicker(prompt, profile);
    const spec: MockSpec = { data: { name: "main" }, layers: [] };
    const scales: MockScales = {};
    const ctx: MockContext = { prompt, profile, repair, pick, spec, scales };
    // Boring ordered calls: each family returns its layers, or undefined when
    // the prompt does not match — first match wins, exactly as the original
    // if-chain did.
    const layers =
      synthesizeSpecialty(ctx) ??
      synthesizeSurfaces(ctx) ??
      synthesizeBins(ctx) ??
      synthesizeBasic(ctx);
    if (layers !== undefined) spec.layers.push(...layers);
    postprocess(ctx);
    return spec;
  }
}
