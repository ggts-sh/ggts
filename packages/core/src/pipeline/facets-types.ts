/**
 * Facet layout result types.
 */
import { createFacetPanelIdentity } from "../facet-identity.js";
import type { FacetPanelIdentity } from "../facet-identity.js";

/** Resolved strip chrome for a facet layout (defaults applied). */
export interface FacetStripConfig {
  position: "top" | "bottom" | "left" | "right";
  show: boolean;
}

export const DEFAULT_FACET_STRIP: FacetStripConfig = Object.freeze({
  position: "top",
  show: true,
});

export interface FacetPanelDef {
  /** Stable facet field/value identity; independent of display position. */
  identity: FacetPanelIdentity;
  /** Alias for `identity.key`, retained for existing interaction consumers. */
  id: string;
  /** Strip label ("" = no strip; the unfaceted single panel). */
  label: string;
  row: number;
  col: number;
}

export interface FacetLayout {
  faceted: boolean;
  panels: FacetPanelDef[];
  nrow: number;
  ncol: number;
  freeX: boolean;
  freeY: boolean;
  /** Strip position/visibility (defaults: top + show). */
  strip: FacetStripConfig;
}

export function SINGLE_PANEL(): FacetLayout {
  const identity = createFacetPanelIdentity([]);
  return {
    faceted: false,
    panels: [{ identity, id: identity.key, label: "", row: 0, col: 0 }],
    nrow: 1,
    ncol: 1,
    freeX: false,
    freeY: false,
    strip: DEFAULT_FACET_STRIP,
  };
}
