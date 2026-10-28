/**
 * Data-free structural grammar checks (tier-2, opt-in via validate options).
 *
 * Implementation:
 *  - validate-structure-layers.ts — geom channels, rule/ribbon/computed-y forms, M2 layer rules
 *  - validate-structure-scales.ts — named color/fill scheme vs family
 *  - validate-structure-style-bins.ts — binned style breaks/domain well-formedness
 *  - validate-structure-facet.ts — wrap XOR grid form
 *
 * Used only by validate() — not public surface.
 */

export { layerStructuralErrors } from "./validate-structure-layers.js";
export {
  colorScaleStructuralErrors,
  guideStructuralErrors,
  positionLabelsStructuralErrors,
} from "./validate-structure-scales.js";
export { binnedStyleScaleStructuralErrors } from "./validate-structure-style-bins.js";
export {
  coordFacetStructuralErrors,
  facetSpaceStructuralErrors,
  facetStructuralErrors,
} from "./validate-structure-facet.js";
