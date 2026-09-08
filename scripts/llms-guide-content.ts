/**
 * Guide section markdown — single source for docs pages AND llms surfaces.
 * Content lives in scripts/llms-guide/*; this facade keeps the import surface
 * stable for gen-llms and docs consumers.
 */
export { GETTING_STARTED_MD } from "./llms-guide/getting-started";
export { STATISTICS_POSITIONS_MD } from "./llms-guide/statistics-positions";
export { SCALES_GUIDES_MD } from "./llms-guide/scales-guides";
export { FACETS_COORDINATES_MD } from "./llms-guide/facets-coordinates";
export { PRODUCTION_MD } from "./llms-guide/production";
export { TEMPORAL_SCALES_MD } from "./llms-guide/temporal-scales";
export { INTERACTIONS_MD } from "./llms-guide/interactions";
export { INTERACTION_REFERENCE_MD } from "./llms-guide/interaction-reference";
export type { InteractionReferenceEntry } from "./llms-guide/interactions";
export { INTERACTION_REFERENCE_INDEX } from "./llms-guide/interactions";
export { UPGRADING_MD } from "./llms-guide/upgrading";
export { AGENTS_MD } from "./llms-guide/agents";
