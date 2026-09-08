import { useMemo, useRef, useState } from "react";
import { planStrata, runPipeline } from "@ggsvelte/core";
import type { RenderModel, RuntimeRowFilterClause, ScaleState } from "@ggsvelte/core";
import type { PortableSpec } from "@ggsvelte/spec";

import { useHostLayoutEffect } from "./host-effect.js";

/** The pipeline is memoized by chart inputs, never by transient UI state. */
export function usePlotModel(input: {
  spec: PortableSpec | null;
  baselineSpec: PortableSpec | null;
  width: number;
  height: number;
  rowFilters: readonly RuntimeRowFilterClause[];
}) {
  const scales = useRef<Record<string, ScaleState> | null>(null);
  const [epoch, setEpoch] = useState(0);
  const model = useMemo(() => {
    if (input.spec === null) return null;
    let previous = scales.current ?? undefined;
    let baselineDomains: RenderModel["domains"]["effective"] | undefined;
    if (input.baselineSpec !== null && input.baselineSpec !== input.spec) {
      const baseline = runPipeline(input.baselineSpec, {
        width: input.width,
        height: input.height,
        ...(previous !== undefined && { prevScales: previous }),
        ...(input.rowFilters.length > 0 && { rowFilters: input.rowFilters }),
      });
      baselineDomains = baseline.domains.effective;
      previous = baseline.scales.state;
      baseline.dispose();
    }
    return runPipeline(input.spec, {
      width: input.width,
      height: input.height,
      ...(previous !== undefined && { prevScales: previous }),
      ...(baselineDomains !== undefined && { baselineDomains }),
      ...(input.rowFilters.length > 0 && { rowFilters: input.rowFilters }),
    });
  }, [input.spec, input.baselineSpec, input.width, input.height, input.rowFilters, epoch]);
  const strata = useMemo(
    () => (model === null ? [] : planStrata(model.scene, model.layerBackends)),
    [model],
  );
  const pendingDisposal = useRef(new Set<RenderModel>());
  useHostLayoutEffect(() => {
    if (model === null) return () => {};
    pendingDisposal.current.delete(model);
    scales.current = model.scales.state;
    return () => {
      const pending = pendingDisposal.current;
      pending.add(model);
      // StrictMode replays effect setup without remounting the memoized model.
      // The second setup cancels disposal; a replaced/unmounted model is released.
      queueMicrotask(() => {
        if (pending.delete(model)) model.dispose();
      });
    };
  }, [model]);
  return {
    model,
    strata,
    resetScales() {
      scales.current = null;
      setEpoch((value) => value + 1);
    },
  };
}
