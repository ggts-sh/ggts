import type { CellValue } from "./table.js";

import type {
  InteractionSource,
  PlotInteractionChange,
  PlotInteractionInterval,
  PlotInteractionScope,
  PlotInteractionSnapshot,
  PlotInteractionTransition,
  ReadonlyZoomDomains,
  ScopedInteractionInterval,
} from "./interaction-types.js";
import {
  assertKey,
  assertScope,
  canonicalDomain,
  canonicalIntervalDomains,
  canonicalKeys,
  equalDomain,
  equalInterval,
  equalKeys,
  keyScope,
  normalizedScope,
  scopedDomains,
  scopedKeys,
  sortedScopes,
  type KeyScope,
} from "./interaction-canonical.js";

export interface PlotInteractionMutationOptions {
  readonly scope: KeyScope;
  readonly source?: InteractionSource;
}

export interface PlotInteractionZoomOptions {
  readonly scope: PlotInteractionScope;
  readonly source?: InteractionSource;
}

/** Row identity override shared by plots bound to this controller. */
export type ControllerDatumIdentity<Key extends PropertyKey> =
  | PropertyKey
  | ((row: Record<string, CellValue>, index: number) => Key);

export interface CreatePlotInteractionOptions<Key extends PropertyKey = PropertyKey> {
  readonly onchange?: (transition: PlotInteractionTransition<Key>) => void;
  /**
   * Preferred durable row identity for plots that bind this controller.
   * Per-plot Inspect / Select `identity` overrides this. Prefer these
   * surfaces over the deprecated GGPlot `key` prop.
   */
  readonly identity?: ControllerDatumIdentity<Key>;
}

export interface PlotInteractionController<Key extends PropertyKey = PropertyKey> {
  subscribe(listener: () => void): () => void;
  readonly revision: number;
  readonly snapshot: PlotInteractionSnapshot<Key>;
  /**
   * Optional row identity from {@link createPlotInteraction} options.
   * Plots read this when resolving datum keys; never mutated after create.
   */
  readonly identity?: ControllerDatumIdentity<Key>;
  selected(scope: KeyScope): ReadonlyArray<Key>;
  emphasized(scope: KeyScope): ReadonlyArray<Key>;
  isSelected(key: Key, scope: KeyScope): boolean;
  setSelection(
    keys: ReadonlyArray<Key>,
    options: PlotInteractionMutationOptions,
  ): PlotInteractionTransition<Key> | null;
  toggleSelection(
    key: Key,
    options: PlotInteractionMutationOptions,
  ): PlotInteractionTransition<Key> | null;
  clearSelection(options: PlotInteractionMutationOptions): PlotInteractionTransition<Key> | null;
  setEmphasis(
    keys: ReadonlyArray<Key>,
    options: PlotInteractionMutationOptions,
  ): PlotInteractionTransition<Key> | null;
  clearEmphasis(options: PlotInteractionMutationOptions): PlotInteractionTransition<Key> | null;
  intervals(scope: KeyScope): ReadonlyArray<ScopedInteractionInterval<Key>>;
  setInterval(
    interval: PlotInteractionInterval<Key>,
    options: PlotInteractionMutationOptions,
  ): PlotInteractionTransition<Key> | null;
  clearInterval(
    panelId: string,
    options: PlotInteractionMutationOptions,
  ): PlotInteractionTransition<Key> | null;
  clearIntervals(options: PlotInteractionMutationOptions): PlotInteractionTransition<Key> | null;
  zoom(scope: PlotInteractionScope): ReadonlyZoomDomains;
  setZoom(
    domains: ReadonlyZoomDomains,
    options: PlotInteractionZoomOptions,
  ): PlotInteractionTransition<Key> | null;
  resetZoom(options: PlotInteractionZoomOptions): PlotInteractionTransition<Key> | null;
  reconcileKeys(
    validKeys: ReadonlyArray<Key>,
    options: PlotInteractionMutationOptions,
  ): PlotInteractionTransition<Key> | null;
}

const EMPTY_KEYS = Object.freeze([]) as readonly never[];

/** Keep ordered key lists and parallel membership Sets in sync. */
function writeKeyList<Key extends PropertyKey>(
  values: Map<string, ReadonlyArray<Key>>,
  sets: Map<string, Set<Key>>,
  scopeKeys: string,
  next: ReadonlyArray<Key>,
): void {
  if (next.length === 0) {
    values.delete(scopeKeys);
    sets.delete(scopeKeys);
  } else {
    values.set(scopeKeys, next);
    sets.set(scopeKeys, new Set(next));
  }
}

/** Create chart-independent, semantic interaction state for framework adapters.
 *
 * The controller owns stable keys and scoped data domains only. A chart is
 * responsible for translating those semantics to its current render model;
 * passive consumption must never publish the state back to the controller.
 */
export function createPlotInteraction<Key extends PropertyKey = PropertyKey>(
  options: CreatePlotInteractionOptions<Key> = {},
): PlotInteractionController<Key> {
  let revision = 0;
  const listeners = new Set<() => void>();
  const selections = new Map<string, ReadonlyArray<Key>>();
  const emphases = new Map<string, ReadonlyArray<Key>>();
  // Parallel membership sets for O(1) isSelected / toggleSelection (not O(K)
  // Array#includes). Set uses SameValueZero so NaN keys work without the
  // Number.isNaN special-case used when filtering arrays.
  const selectionSets = new Map<string, Set<Key>>();
  const emphasisSets = new Map<string, Set<Key>>();
  const intervals = new Map<string, Map<string, ScopedInteractionInterval<Key>>>();
  const zoomX = new Map<string, readonly [number, number]>();
  const zoomY = new Map<string, readonly [number, number]>();
  let notifying = false;

  const assertMutationAllowed = (): void => {
    if (notifying)
      throw new TypeError(
        "PlotInteractionController must not be mutated from its onchange callback. Schedule a later application update instead.",
      );
  };

  const scopedIntervals = (): ReadonlyArray<ScopedInteractionInterval<Key>> =>
    Object.freeze(
      sortedScopes(intervals).flatMap(([, panels]) =>
        sortedScopes(panels).map(([, interval]) => interval),
      ),
    );

  const currentSnapshot = (): PlotInteractionSnapshot<Key> =>
    Object.freeze({
      revision,
      selections: scopedKeys(selections),
      emphases: scopedKeys(emphases),
      intervals: scopedIntervals(),
      zoom: Object.freeze({
        x: scopedDomains(zoomX),
        y: scopedDomains(zoomY),
      }),
    });

  const commit = (
    kind: PlotInteractionTransition<Key>["kind"],
    changes: ReadonlyArray<PlotInteractionChange>,
    scope: PlotInteractionScope,
    source: InteractionSource,
  ): PlotInteractionTransition<Key> => {
    revision += 1;
    const transition = Object.freeze({
      revision,
      kind,
      changes: Object.freeze([...changes]),
      source,
      scope,
      snapshot: currentSnapshot(),
    });
    if (options.onchange !== undefined) {
      notifying = true;
      try {
        options.onchange(transition);
      } finally {
        notifying = false;
      }
    }
    for (const listener of listeners) listener();
    return transition;
  };

  const replaceKeys = (
    values: Map<string, ReadonlyArray<Key>>,
    sets: Map<string, Set<Key>>,
    nextKeys: ReadonlyArray<Key>,
    mutation: PlotInteractionMutationOptions,
    kind: "selection" | "emphasis",
  ): PlotInteractionTransition<Key> | null => {
    const scope = normalizedScope(mutation.scope);
    const next = canonicalKeys(nextKeys);
    const prior = values.get(scope.keys) ?? EMPTY_KEYS;
    if (equalKeys(prior, next)) return null;
    writeKeyList(values, sets, scope.keys, next);
    return commit(kind, [kind], scope, mutation.source ?? "programmatic");
  };

  const controller: PlotInteractionController<Key> = {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get revision() {
      return revision;
    },
    get snapshot() {
      return currentSnapshot();
    },
    ...(options.identity !== undefined && { identity: options.identity }),
    selected(scope) {
      void revision;
      return selections.get(keyScope(scope)) ?? EMPTY_KEYS;
    },
    emphasized(scope) {
      void revision;
      return emphases.get(keyScope(scope)) ?? EMPTY_KEYS;
    },
    isSelected(key, scope) {
      assertKey(key);
      // Track revision so $derived/template consumers invalidate on mutation
      // (selectionSets itself is not $state — Codex #278 P2).
      void revision;
      return selectionSets.get(keyScope(scope))?.has(key) ?? false;
    },
    setSelection(keys, mutation) {
      assertMutationAllowed();
      return replaceKeys(selections, selectionSets, keys, mutation, "selection");
    },
    toggleSelection(key, mutation) {
      assertKey(key);
      const scopeKey = keyScope(mutation.scope);
      const current = controller.selected(mutation.scope);
      const selected = selectionSets.get(scopeKey)?.has(key) ?? false;
      return controller.setSelection(
        selected
          ? current.filter((value) => value !== key && !(Number.isNaN(value) && Number.isNaN(key)))
          : [...current, key],
        mutation,
      );
    },
    clearSelection(mutation) {
      return controller.setSelection([], mutation);
    },
    setEmphasis(keys, mutation) {
      assertMutationAllowed();
      return replaceKeys(emphases, emphasisSets, keys, mutation, "emphasis");
    },
    clearEmphasis(mutation) {
      return controller.setEmphasis([], mutation);
    },
    intervals(inputScope) {
      void revision;
      const scope = normalizedScope(inputScope);
      const intervalScope = scope.intervals ?? scope.keys;
      const panels = intervals.get(intervalScope);
      if (panels === undefined) return EMPTY_KEYS;
      return Object.freeze(sortedScopes(panels).map(([, interval]) => interval));
    },
    setInterval(input, mutation) {
      assertMutationAllowed();
      const scope = normalizedScope(mutation.scope);
      const intervalScope = scope.intervals ?? scope.keys;
      assertScope(input.panelId, "interval panel");
      if (
        input.preset !== "independent" &&
        input.preset !== "union" &&
        input.preset !== "cross-panel"
      )
        throw new TypeError(
          "Interaction interval preset must be independent, union, or cross-panel.",
        );
      const next = Object.freeze({
        scope: intervalScope,
        panelId: input.panelId,
        preset: input.preset,
        domains: canonicalIntervalDomains(input.domains),
        keys: canonicalKeys(input.keys),
      });
      const priorPanels = intervals.get(intervalScope);
      const priorPreset = priorPanels?.values().next().value?.preset;
      const replacesScope =
        priorPanels !== undefined &&
        priorPreset !== undefined &&
        (priorPreset !== next.preset ||
          (next.preset === "cross-panel" &&
            (priorPanels.size !== 1 || !priorPanels.has(next.panelId))));
      const prior = replacesScope ? undefined : priorPanels?.get(next.panelId);
      if (!replacesScope && equalInterval(prior, next)) return null;
      const panels =
        replacesScope || priorPanels === undefined
          ? new Map<string, ScopedInteractionInterval<Key>>()
          : priorPanels;
      panels.set(next.panelId, next);
      intervals.set(intervalScope, panels);
      return commit("interval", ["interval"], scope, mutation.source ?? "programmatic");
    },
    clearInterval(panelId, mutation) {
      assertMutationAllowed();
      const scope = normalizedScope(mutation.scope);
      const intervalScope = scope.intervals ?? scope.keys;
      assertScope(panelId, "interval panel");
      const panels = intervals.get(intervalScope);
      if (panels === undefined || !panels.has(panelId)) return null;
      panels.delete(panelId);
      if (panels.size === 0) intervals.delete(intervalScope);
      return commit("interval", ["interval"], scope, mutation.source ?? "programmatic");
    },
    clearIntervals(mutation) {
      assertMutationAllowed();
      const scope = normalizedScope(mutation.scope);
      const intervalScope = scope.intervals ?? scope.keys;
      if (!intervals.delete(intervalScope)) return null;
      return commit("interval", ["interval"], scope, mutation.source ?? "programmatic");
    },
    zoom(inputScope) {
      void revision;
      const scope = normalizedScope(inputScope);
      const x = scope.x === undefined ? undefined : zoomX.get(scope.x);
      const y = scope.y === undefined ? undefined : zoomY.get(scope.y);
      return Object.freeze({
        ...(x !== undefined && { x }),
        ...(y !== undefined && { y }),
      });
    },
    setZoom(domains, mutation) {
      assertMutationAllowed();
      const scope = normalizedScope(mutation.scope);
      const x = domains.x === undefined ? undefined : canonicalDomain(domains.x);
      const y = domains.y === undefined ? undefined : canonicalDomain(domains.y);
      const changesX =
        scope.x !== undefined && x !== undefined && !equalDomain(zoomX.get(scope.x), x);
      const changesY =
        scope.y !== undefined && y !== undefined && !equalDomain(zoomY.get(scope.y), y);
      if (!changesX && !changesY) return null;
      if (changesX && scope.x !== undefined && x !== undefined) zoomX.set(scope.x, x);
      if (changesY && scope.y !== undefined && y !== undefined) zoomY.set(scope.y, y);
      return commit("zoom", ["zoom"], scope, mutation.source ?? "programmatic");
    },
    resetZoom(mutation) {
      assertMutationAllowed();
      const scope = normalizedScope(mutation.scope);
      const changesX = scope.x !== undefined && zoomX.has(scope.x);
      const changesY = scope.y !== undefined && zoomY.has(scope.y);
      if (!changesX && !changesY) return null;
      if (changesX && scope.x !== undefined) zoomX.delete(scope.x);
      if (changesY && scope.y !== undefined) zoomY.delete(scope.y);
      return commit("zoom", ["zoom"], scope, mutation.source ?? "programmatic");
    },
    reconcileKeys(validKeys, mutation) {
      assertMutationAllowed();
      const scope = normalizedScope(mutation.scope);
      const valid = new Set(canonicalKeys(validKeys));
      const priorSelection = selections.get(scope.keys) ?? EMPTY_KEYS;
      const priorEmphasis = emphases.get(scope.keys) ?? EMPTY_KEYS;
      const nextSelection = Object.freeze(priorSelection.filter((key) => valid.has(key)));
      const nextEmphasis = Object.freeze(priorEmphasis.filter((key) => valid.has(key)));
      const selectionChanged = !equalKeys(priorSelection, nextSelection);
      const emphasisChanged = !equalKeys(priorEmphasis, nextEmphasis);
      // Interval records in the same key scope carry captured keys too;
      // reconciliation must prune them or union consumption keeps
      // publishing keys the owner declared invalid.
      const intervalScope = scope.intervals ?? scope.keys;
      const priorPanels = intervals.get(intervalScope);
      let intervalChanged = false;
      if (priorPanels !== undefined) {
        for (const [panelId, interval] of priorPanels) {
          const nextKeys = Object.freeze(interval.keys.filter((key) => valid.has(key)));
          if (equalKeys(interval.keys, nextKeys)) continue;
          intervalChanged = true;
          priorPanels.set(panelId, Object.freeze({ ...interval, keys: nextKeys }));
        }
      }
      if (!selectionChanged && !emphasisChanged && !intervalChanged) return null;
      if (selectionChanged) writeKeyList(selections, selectionSets, scope.keys, nextSelection);
      if (emphasisChanged) writeKeyList(emphases, emphasisSets, scope.keys, nextEmphasis);
      const changes = Object.freeze([
        ...(selectionChanged ? (["selection"] as const) : []),
        ...(emphasisChanged ? (["emphasis"] as const) : []),
        ...(intervalChanged ? (["interval"] as const) : []),
      ]);
      return commit("reconcile", changes, scope, mutation.source ?? "programmatic");
    },
  };
  return Object.freeze(controller);
}
