// Shared pure behavior used by React and Svelte.
export {
  type ResolveInspectionInput,
  type InspectionSnapshotCompleteness,
  type ResolvedTarget,
  TRANSIENT_MEMBER_LIMIT,
  selectTransientMembers,
  resolvedTarget,
  resolveInspection,
  materializeInspection,
} from "@ggsvelte/core/interaction";
export { clearInspectionFingerprint } from "./coordinator.js";
export { createInspectionCoordinator } from "./coordinator.js";
