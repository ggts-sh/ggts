/**
 * Factory for declaration-only geom components (decision 0001, mechanism A).
 *
 * Every <GeomX> component is a thin shell: it destructures nothing, passes
 * its live `$props()` proxy here, and this factory registers a layer
 * descriptor whose getters read the proxy — so prop updates flow into the
 * plot's derived spec without re-registration. Param keys come from
 * `GEOM_PARAM_KEYS` (#1039), not a hand-copied third argument.
 *
 * Init-time registration only (never in $effect); inert without a <GGPlot>
 * ancestor; unregisters on destroy (all measured in the M0a-1 spike).
 */
import {
  GEOM_PARAM_KEYS,
  type AesInput,
  type DataInput,
  type GeomName,
  type PositionName,
  type PositionParams,
  type RenderBackend,
  type StatName,
} from "@ggts-sh/spec";

import { registerLayer } from "./registry.svelte.js";

export interface GeomProps {
  /** Layer-level aes (bare-string shorthand allowed); merges over plot aes. */
  aes?: AesInput;
  /** Optional layer-local data (#589); inherits plot data when omitted. */
  data?: DataInput | readonly Record<string, unknown>[];
  /** Stat override (geoms with more than one stat, e.g. errorbar summary). */
  stat?: StatName;
  /** Position override (per-geom subset; normalize/validate enforce it). */
  position?: PositionName;
  /** Jitter/nudge parameters (point/text layers). */
  positionParams?: PositionParams;
  /** Rendering backend hint ("svg" | "canvas" | "auto"). */
  render?: RenderBackend;
  /**
   * `false` excludes this layer from inspection (#1065): its marks never
   * become tooltip, hover, or keyboard candidates. For background bands and
   * other decoration, which otherwise capture the pointer everywhere they are
   * painted.
   */
  inspect?: false;
}

/**
 * Register a geom layer from a component's live props proxy (passed as an
 * accessor so the proxy is only ever read lazily, inside the descriptor's
 * getters). Param whitelist is `GEOM_PARAM_KEYS[geom]`; aes/stat/position/
 * positionParams travel structurally.
 */
export function createGeomLayer(geom: GeomName, getProps: () => GeomProps): void {
  const paramKeys = GEOM_PARAM_KEYS[geom];
  if (paramKeys === undefined) {
    throw new Error(`createGeomLayer: no GEOM_PARAM_KEYS entry for geom "${geom}"`);
  }
  registerLayer({
    geom,
    get stat() {
      return getProps().stat;
    },
    get aes() {
      return getProps().aes;
    },
    get data() {
      return getProps().data;
    },
    get position() {
      return getProps().position;
    },
    get positionParams() {
      return getProps().positionParams;
    },
    get render() {
      return getProps().render;
    },
    get inspect() {
      return getProps().inspect;
    },
    get params() {
      const props = getProps() as Record<string, unknown>;
      const params: Record<string, unknown> = {};
      for (const key of paramKeys) {
        const value = props[key];
        if (value !== undefined) params[key] = value;
      }
      return Object.keys(params).length > 0 ? params : undefined;
    },
  });
}
