import { assemblePortableSpec, isHostPlotLayer, toLayerInput } from "@ggts-sh/compose";
import type { PortableSpec } from "@ggts-sh/spec";

import type { GGPlotProps } from "./plot-props.js";
import type { LayerRegistry } from "./registry.js";

export function assembleFromProps(
  props: Pick<GGPlotProps, "spec" | "data" | "aes" | "layers" | "a11y">,
  registry: LayerRegistry,
): PortableSpec | null {
  if (props.spec !== undefined) {
    return assemblePortableSpec({ spec: props.spec, layers: [] });
  }
  return assemblePortableSpec({
    ...(props.data !== undefined && { data: props.data }),
    ...(props.aes !== undefined && { aes: props.aes }),
    layers: props.layers ?? registry.markLayers.map(toLayerInput),
    plotLayers: registry.layers.filter((layer) => layer.kind !== "mark" && !isHostPlotLayer(layer)),
    ...(props.a11y !== undefined && { a11y: props.a11y }),
  });
}
