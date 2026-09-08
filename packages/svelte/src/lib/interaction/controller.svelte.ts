import { createPlotInteraction as createController } from "@ggsvelte/core/interaction";
import type {
  CreatePlotInteractionOptions,
  PlotInteractionController,
} from "@ggsvelte/core/interaction";

export type {
  ControllerDatumIdentity,
  CreatePlotInteractionOptions,
  PlotInteractionController,
  PlotInteractionMutationOptions,
  PlotInteractionZoomOptions,
} from "@ggsvelte/core/interaction";

/** Svelte reactivity over the shared framework-independent controller. */
export function createPlotInteraction<Key extends PropertyKey = PropertyKey>(
  options: CreatePlotInteractionOptions<Key> = {},
): PlotInteractionController<Key> {
  let revision = $state(0);
  const controller = createController<Key>({
    ...options,
    onchange(transition) {
      revision = transition.revision;
      options.onchange?.(transition);
    },
  });
  const reactiveController: PlotInteractionController<Key> = {
    ...controller,
    get revision() {
      return revision;
    },
    get snapshot() {
      void revision;
      return controller.snapshot;
    },
    selected: (scope) => {
      void revision;
      return controller.selected(scope);
    },
    emphasized: (scope) => {
      void revision;
      return controller.emphasized(scope);
    },
    isSelected: (key, scope) => {
      void revision;
      return controller.isSelected(key, scope);
    },
    intervals: (scope) => {
      void revision;
      return controller.intervals(scope);
    },
    zoom: (scope) => {
      void revision;
      return controller.zoom(scope);
    },
  };
  return Object.freeze(reactiveController);
}
