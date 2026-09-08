/**
 * Layer-frame construction: run per-panel stats to produce LayerFrames,
 * remap facet-local rows to source indices, and re-export candidate helpers.
 */
import type { ColumnTable } from "../table.js";

import type { Advisory, LayerBinding, LayerFrame, PipelineWarning } from "./types.js";
import { buildAnnotationFrame } from "./frame-annotation.js";
import { expandEdgeFrame } from "./frame-edge-expand.js";
import { deriveLayerGroups } from "./frame-helpers.js";
import { buildIdentityFrame } from "./frame-identity.js";
import { maybeStackAlignFrame } from "./frame-stats-align.js";
import { buildMapFrame } from "./frame-stats-map.js";
import { buildNonIdentityFrame } from "./frame-stats.js";

export { deriveLayerGroups } from "./frame-helpers.js";

/** Identity scatter never buckets by group at draw/position time. */
function layerDefersGroups(binding: LayerBinding): boolean {
  if ((binding.layer.stat ?? "identity") !== "identity") return false;
  if ((binding.layer.position ?? "identity") !== "identity") return false;
  return binding.layer.geom === "point";
}

function attachDeferredGroups(
  frame: LayerFrame,
  binding: LayerBinding,
  table: ColumnTable,
): LayerFrame {
  let resolved: number[] | undefined;
  const read = (): number[] => {
    resolved ??= deriveLayerGroups(binding, table);
    return resolved;
  };
  Object.defineProperty(frame, "groups", {
    configurable: true,
    enumerable: true,
    get: read,
  });
  Object.defineProperty(frame, "inputGroups", {
    configurable: true,
    enumerable: true,
    get: read,
  });
  return frame;
}

export function buildFrame(
  binding: LayerBinding,
  table: ColumnTable,
  warnings: PipelineWarning[],
  advisories: Advisory[],
  binRange?: [number, number],
  functionDomain?: [number, number],
  datasets?: import("@ggts-sh/spec").PortableSpec["datasets"],
  xDiscreteRisk = false,
): LayerFrame {
  // Annotation frames are rowless (n=0, empty inputGroups). Do not derive or
  // overwrite pre-stat groups — identity index would otherwise retain O(n)
  // source memberships for a layer with no source rows.
  if (binding.ruleForm === "annotation" || binding.layer.geom === "abline") {
    return buildAnnotationFrame(binding, table);
  }

  if (layerDefersGroups(binding)) {
    const frame = buildIdentityFrame(binding, table, []);
    expandEdgeFrame(frame, warnings);
    return attachDeferredGroups(frame, binding, table);
  }

  // Derive once per frame; identity index + bin lineage consume frame.inputGroups.
  const inputGroups = deriveLayerGroups(binding, table);

  if (binding.layer.geom === "map") {
    return { ...buildMapFrame(binding, table, inputGroups, warnings, datasets), inputGroups };
  }

  // geom_sf default stat is "sf" (geometry expand via buildNonIdentityFrame).
  const nonIdentity = buildNonIdentityFrame(
    binding,
    table,
    inputGroups,
    warnings,
    advisories,
    binRange,
    functionDomain,
  );
  if (nonIdentity !== null) return { ...nonIdentity, inputGroups };

  // Sparse stacked area rescue (#1268): align groups with interior x holes
  // that the identity path would chord across as floating polygons.
  const aligned = maybeStackAlignFrame(
    binding,
    table,
    inputGroups,
    warnings,
    advisories,
    xDiscreteRisk,
  );
  if (aligned !== null) return { ...aligned, inputGroups };

  const frame = { ...buildIdentityFrame(binding, table, inputGroups), inputGroups };
  expandEdgeFrame(frame, warnings);
  return frame;
}
