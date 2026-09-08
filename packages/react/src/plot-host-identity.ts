import type { LayerRegistry } from "./registry.js";
import {
  identityFromInspectInput,
  identityFromSelectInput,
  pickExplicitDatumKey,
  resolveDatumKey,
  type DatumKey,
} from "./datum-key.js";
import type { GGPlotProps } from "./plot-props.js";

function childInspectIdentity(registry: LayerRegistry): DatumKey | undefined {
  const inspectChild = registry.capabilities("inspect").at(-1);
  const identity = inspectChild?.["identity"];
  if (
    typeof identity === "function" ||
    typeof identity === "string" ||
    typeof identity === "number" ||
    typeof identity === "symbol"
  ) {
    return identity as DatumKey;
  }
  return undefined;
}

export function hostDatumKey(
  props: Pick<GGPlotProps, "inspect" | "select" | "interaction" | "identity" | "data">,
  registry: LayerRegistry,
  identityKey: GGPlotProps["key"],
  assembledData: unknown,
): DatumKey {
  const inspectIdentity =
    registry.capabilities("inspect").length > 0
      ? childInspectIdentity(registry)
      : identityFromInspectInput(props.inspect);
  const selectIdentity = identityFromSelectInput(props.select);
  const explicitKey = pickExplicitDatumKey({
    ...(inspectIdentity !== undefined && { inspect: inspectIdentity }),
    ...(selectIdentity !== undefined && { select: selectIdentity }),
    ...(props.interaction?.identity !== undefined && { controller: props.interaction.identity }),
    ...(props.identity !== undefined && { plot: props.identity }),
    ...(identityKey !== undefined && { legacy: identityKey }),
  });
  return resolveDatumKey({
    ...(explicitKey !== undefined && { explicit: explicitKey }),
    data: props.data ?? assembledData,
  });
}
