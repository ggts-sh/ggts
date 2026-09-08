import { useEffect, useMemo, useState } from "react";
import { encodeKey } from "@ggts-sh/core";
import {
  buildInteractiveLegendEntries,
  buildLegendEntryKeyIndexForPlot,
  isLegendValueVisible,
  legendIdentityKey,
  nextLegendFilterValues,
  samePropertyKeySet,
} from "@ggts-sh/core/interaction";
import type { CellValue, RenderModel } from "@ggts-sh/core";
import type {
  InteractiveLegendEntry,
  InteractionSource,
  LegendFilterClause,
  LegendFocusEvent,
  PlotInteractionScope,
} from "@ggts-sh/core/interaction";
import type { GGPlotProps } from "./plot-props.js";
import type { LayerRegistry } from "./registry.js";

type LegendState = { scale: string; value: string; keys: readonly PropertyKey[] } | null;
const same = (state: LegendState, entry: InteractiveLegendEntry) =>
  state !== null &&
  state.scale === entry.legend.scale &&
  state.value === encodeKey(entry.entry.value);

export function usePlotLegends(input: {
  model: RenderModel | null;
  registry: LayerRegistry;
  revision: number;
  props: GGPlotProps;
  scope: PlotInteractionScope;
  keyForRow: (index: number) => PropertyKey | null;
  filters: readonly LegendFilterClause[];
  setFilters: (filters: readonly LegendFilterClause[]) => void;
}) {
  const { model, registry, revision, props, scope, keyForRow, filters } = input;
  const [committed, setCommitted] = useState<LegendState>(null);
  const [preview, setPreview] = useState<LegendState>(null);
  const capability = useMemo(() => {
    const focus = new Map<string, boolean>();
    const filter = new Map<string, { mode: "include" | "exclude"; multiple: boolean }>();
    for (const layer of registry.layers) {
      if (layer.kind === "legendFocus" && layer.value !== null) {
        focus.set(
          layer.value.channel,
          layer.value.input === true || layer.value.input.preview !== false,
        );
      }
      if (layer.kind === "legendFilter" && layer.value !== null) {
        const options = layer.value.input === true ? {} : layer.value.input;
        if (options.mode !== undefined && options.mode !== "include" && options.mode !== "exclude")
          throw new TypeError("Legend filter mode must be include or exclude");
        filter.set(layer.value.channel, {
          mode: options.mode ?? "exclude",
          multiple: options.multiple ?? true,
        });
      }
    }
    return { focus, filter };
  }, [registry, revision]);
  const allEntries = useMemo(
    () => (model === null ? [] : buildInteractiveLegendEntries(model.scene.legends)),
    [model],
  );
  const entries = allEntries.filter(
    (entry) =>
      capability.focus.has(entry.legend.scale) ||
      capability.filter.has(entry.legend.scale) ||
      Boolean(props.legendFocus) ||
      Boolean(props.legendFilter),
  );
  const index = useMemo(
    () =>
      buildLegendEntryKeyIndexForPlot({
        model: entries.length === 0 ? null : model,
        semanticKey: keyForRow,
      }),
    [model, keyForRow, entries.length],
  );
  const focusEnabled = capability.focus.size > 0 || Boolean(props.legendFocus);
  const selectedEntry = entries.find((entry) => same(preview, entry));
  const controllerKeys = props.interaction?.emphasized(scope);
  const localKeys = committed?.keys ?? [];
  const previewKeys =
    selectedEntry === undefined
      ? null
      : (index.get(legendIdentityKey(selectedEntry.identity)) ?? []);
  const emphasis = focusEnabled
    ? (previewKeys ?? controllerKeys ?? localKeys)
    : (controllerKeys ?? []);
  const isPressed = (entry: InteractiveLegendEntry) => {
    const keys = controllerKeys ?? localKeys;
    return (
      keys.length > 0 &&
      samePropertyKeySet(keys, index.get(legendIdentityKey(entry.identity)) ?? [])
    );
  };
  const emit = (event: LegendFocusEvent) => {
    props.onlegendfocus?.(event);
    props.oninteraction?.(event);
  };
  const focusEntry = (
    entry: InteractiveLegendEntry,
    source: InteractionSource,
    commit: boolean,
  ) => {
    if (
      !capability.focus.has(entry.legend.scale) &&
      (props.legendFocus === undefined || props.legendFocus === false)
    )
      return;
    const previewAllowed =
      capability.focus.get(entry.legend.scale) ??
      (typeof props.legendFocus === "object" ? (props.legendFocus.preview ?? true) : true);
    if (!commit && !previewAllowed) return;
    const clear = commit && isPressed(entry);
    const keys = clear ? [] : (index.get(legendIdentityKey(entry.identity)) ?? []);
    const state = clear
      ? null
      : { scale: entry.legend.scale, value: encodeKey(entry.entry.value), keys };
    if (commit) {
      setCommitted(state);
      setPreview(null);
    } else setPreview(state);
    if (commit) props.interaction?.setEmphasis(keys, { scope, source });
    emit(
      clear
        ? { type: "legend-focus", phase: "clear", source }
        : {
            type: "legend-focus",
            phase: "change",
            state: commit ? "committed" : "transient",
            source,
            scale: entry.legend.scale,
            value: entry.entry.value as CellValue,
            label: entry.entry.fullLabel ?? entry.entry.label,
            keys,
          },
    );
  };
  const clearPreview = (source: InteractionSource) => {
    if (preview === null) return;
    setPreview(null);
    if (committed === null) emit({ type: "legend-focus", phase: "clear", source });
  };
  const clearFocus = (source: InteractionSource = "programmatic") => {
    setPreview(null);
    setCommitted(null);
    props.interaction?.clearEmphasis({ scope, source });
    emit({ type: "legend-focus", phase: "clear", source });
  };
  const fieldFor = (entry: InteractiveLegendEntry): string | undefined =>
    model?.layerFields
      .flat()
      .find((field) => field.channel === entry.legend.scale && field.source !== "stat")?.field;
  const filterEntry = (entry: InteractiveLegendEntry, source: InteractionSource) => {
    const field = fieldFor(entry);
    if (field === undefined) return;
    const options =
      capability.filter.get(entry.legend.scale) ??
      (typeof props.legendFilter === "object" ? props.legendFilter : {});
    const mode = options.mode ?? "exclude";
    const prior = filters.find(
      (clause) => clause.scale === entry.legend.scale && clause.field === field,
    );
    const catalog = entry.legend.entries.map((value) => value.value as CellValue);
    const values = nextLegendFilterValues(
      prior?.values ?? (mode === "include" ? catalog : []),
      entry.entry.value as CellValue,
      catalog,
      mode,
      options.multiple ?? true,
    );
    const clause = { scale: entry.legend.scale, field, values, mode };
    input.setFilters([
      ...filters.filter((value) => value.scale !== clause.scale || value.field !== field),
      clause,
    ]);
    const event = { type: "legend-filter" as const, phase: "change" as const, source, clause };
    props.onlegendfilter?.(event);
    props.oninteraction?.(event);
  };
  useEffect(() => {
    if (committed === null) return;
    const entry = entries.find((item) => same(committed, item));
    const keys = entry === undefined ? [] : (index.get(legendIdentityKey(entry.identity)) ?? []);
    if (!samePropertyKeySet(keys, committed.keys)) {
      setCommitted(null);
      if (props.interaction === undefined)
        emit({ type: "legend-focus", phase: "clear", source: "programmatic" });
    }
  }, [model, index]);
  useEffect(() => {
    if (focusEnabled) return;
    setPreview(null);
    setCommitted(null);
  }, [focusEnabled]);
  useEffect(() => {
    if (
      filters.every((clause) => capability.filter.has(clause.scale) || Boolean(props.legendFilter))
    )
      return;
    // Reset atomically, matching the Svelte host: removed controls cannot
    // leave hidden row filters behind, including when another guide remains.
    input.setFilters([]);
    const event = {
      type: "legend-filter" as const,
      phase: "clear" as const,
      source: "programmatic" as const,
      clause: null,
    };
    props.onlegendfilter?.(event);
    props.oninteraction?.(event);
  }, [capability.filter, props.legendFilter, filters]);
  return {
    emphasis,
    entries,
    clearFocus,
    controls:
      entries.length === 0 ? null : (
        <div
          className="gg-legend-controls"
          aria-label="Legend controls"
          style={{ display: "flex", flexWrap: "wrap", gap: 8, lineHeight: 1.4 }}
        >
          {entries.map((entry) => {
            const identity = legendIdentityKey(entry.identity);
            const filter = capability.filter.has(entry.legend.scale) || Boolean(props.legendFilter);
            const focus = capability.focus.has(entry.legend.scale) || Boolean(props.legendFocus);
            const field = fieldFor(entry);
            const clause = filters.find(
              (value) => value.scale === entry.legend.scale && value.field === field,
            );
            const visible =
              clause === undefined ||
              isLegendValueVisible(clause.values, entry.entry.value as CellValue, clause.mode);
            return (
              <div key={identity}>
                {focus && (
                  <button
                    type="button"
                    aria-pressed={isPressed(entry)}
                    onPointerEnter={() => {
                      focusEntry(entry, "pointer", false);
                    }}
                    onPointerLeave={() => {
                      clearPreview("pointer");
                    }}
                    onFocus={() => {
                      focusEntry(entry, "keyboard", false);
                    }}
                    onBlur={() => {
                      clearPreview("keyboard");
                    }}
                    onClick={(event) => {
                      focusEntry(entry, event.detail === 0 ? "keyboard" : "pointer", true);
                    }}
                    style={{ minHeight: 44, minWidth: 44 }}
                  >
                    Focus {entry.entry.fullLabel ?? entry.entry.label}
                  </button>
                )}
                {filter && field !== undefined && (
                  <label
                    style={{ display: "inline-flex", alignItems: "center", minHeight: 44, gap: 6 }}
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(event) => {
                        filterEntry(
                          entry,
                          event.nativeEvent instanceof PointerEvent ? "pointer" : "keyboard",
                        );
                      }}
                    />
                    Show {entry.entry.fullLabel ?? entry.entry.label}
                  </label>
                )}
              </div>
            );
          })}
          {committed !== null && (
            <button
              type="button"
              onClick={() => {
                clearFocus("pointer");
              }}
            >
              Clear legend focus
            </button>
          )}
          {filters.length > 0 && (
            <button
              type="button"
              onClick={() => {
                input.setFilters([]);
                const event = {
                  type: "legend-filter" as const,
                  phase: "clear" as const,
                  source: "pointer" as const,
                  clause: null,
                };
                props.onlegendfilter?.(event);
                props.oninteraction?.(event);
              }}
            >
              Reset legend filters
            </button>
          )}
        </div>
      ),
  };
}
