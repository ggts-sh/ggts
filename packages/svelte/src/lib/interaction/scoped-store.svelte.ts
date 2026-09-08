/**
 * Channel state that lives either in the shared interaction controller or
 * locally in this plot. Callers never learn which. Subscribes to the
 * controller revision internally (#1079).
 */
import type { PlotInteractionController } from "./controller.svelte.js";
import type {
  InteractionSource,
  PlotInteractionInterval,
  PlotInteractionScope,
} from "./interaction.js";
import { nextLocalIntervalRecords } from "../interval/consumption.js";

/**
 * Successful write result. Wrapped so a committed `null` (e.g. cleared zoom)
 * is not confused with a no-op rejection.
 */
type ScopedStoreWrite<T> = { readonly value: T };

export interface ScopedStore<T> {
  readonly value: T;
  /**
   * Replace the value. Returns `{ value }` on commit, or `null` when the write
   * was a no-op (same local value, or controller rejected the transition).
   */
  set(next: T, source: InteractionSource): ScopedStoreWrite<T> | null;
  /**
   * Clear to the store's empty value. Returns `false` when already empty
   * (or the controller rejected a no-op clear).
   */
  clear(source: InteractionSource): boolean;
}

export type CreateScopedStoreInput<T> = {
  readonly initial: T;
  readonly controller: () => PlotInteractionController | undefined;
  readonly scope: () => PlotInteractionScope;
  /** Read channel state from a live controller. */
  readonly read: (controller: PlotInteractionController, scope: PlotInteractionScope) => T;
  /**
   * Write channel state to a live controller. Return `{ value }` on commit, or
   * `null` when the controller treated the write as a no-op.
   */
  readonly write: (
    controller: PlotInteractionController,
    next: T,
    scope: PlotInteractionScope,
    source: InteractionSource,
  ) => ScopedStoreWrite<T> | null;
  /**
   * Clear channel state on a live controller. Return `false` when the clear
   * was a no-op.
   */
  readonly clearShared: (
    controller: PlotInteractionController,
    scope: PlotInteractionScope,
    source: InteractionSource,
  ) => boolean;
  /** Equality for local no-op detection. Defaults to `Object.is`. */
  readonly same?: (a: T, b: T) => boolean;
  /**
   * Value after `clear` in local mode. Defaults to `initial`.
   * (e.g. zoom uses `null`; key lists use `[]`.)
   */
  readonly empty?: T;
};

/**
 * Create a scoped store. Construction registers a `$derived` that tracks the
 * controller revision when shared mode is active.
 */
export function createScopedStore<T>(input: CreateScopedStoreInput<T>): ScopedStore<T> {
  let local = $state.raw(input.initial);
  const same = input.same ?? ((a: T, b: T) => Object.is(a, b));
  // `empty` may be null (zoom); hasOwn keeps null distinct from "not provided".
  const empty = Object.hasOwn(input, "empty") ? (input.empty as T) : input.initial;

  const value: T = $derived.by(() => {
    const controller = input.controller();
    if (controller === undefined) return local;
    // Subscribe to revision so external controller writes invalidate readers.
    void controller.revision;
    return input.read(controller, input.scope());
  });

  function set(next: T, source: InteractionSource): ScopedStoreWrite<T> | null {
    const controller = input.controller();
    if (controller === undefined) {
      if (same(local, next)) return null;
      local = next;
      return { value: local };
    }
    return input.write(controller, next, input.scope(), source);
  }

  function clear(source: InteractionSource): boolean {
    const controller = input.controller();
    if (controller === undefined) {
      if (same(local, empty)) return false;
      local = empty;
      return true;
    }
    return input.clearShared(controller, input.scope(), source);
  }

  return {
    get value() {
      return value;
    },
    set,
    clear,
  };
}

/**
 * Interval channel store. The controller exposes upsert/remove/clear-all
 * rather than whole-array replace, so this surface mirrors those ops while
 * still hiding local vs shared storage.
 */
export interface IntervalScopedStore {
  readonly value: readonly PlotInteractionInterval<PropertyKey>[];
  upsert(record: PlotInteractionInterval<PropertyKey>, source: InteractionSource): void;
  remove(panelId: string, source: InteractionSource): boolean;
  clear(source: InteractionSource): boolean;
}

export type CreateIntervalScopedStoreInput = {
  readonly controller: () => PlotInteractionController | undefined;
  readonly scope: () => PlotInteractionScope;
};

export function createIntervalScopedStore(
  input: CreateIntervalScopedStoreInput,
): IntervalScopedStore {
  let local = $state.raw<readonly PlotInteractionInterval<PropertyKey>[]>([]);

  const value: readonly PlotInteractionInterval<PropertyKey>[] = $derived.by(() => {
    const controller = input.controller();
    if (controller === undefined) return local;
    void controller.revision;
    return controller.intervals(input.scope());
  });

  function upsert(record: PlotInteractionInterval<PropertyKey>, source: InteractionSource): void {
    const controller = input.controller();
    if (controller === undefined) {
      local = [...nextLocalIntervalRecords(local, record)];
      return;
    }
    controller.setInterval(record, { scope: input.scope(), source });
  }

  function remove(panelId: string, source: InteractionSource): boolean {
    const controller = input.controller();
    if (controller === undefined) {
      const next = local.filter((interval) => interval.panelId !== panelId);
      if (next.length === local.length) return false;
      local = next;
      return true;
    }
    return controller.clearInterval(panelId, { scope: input.scope(), source }) !== null;
  }

  function clear(source: InteractionSource): boolean {
    const controller = input.controller();
    if (controller === undefined) {
      if (local.length === 0) return false;
      local = [];
      return true;
    }
    return controller.clearIntervals({ scope: input.scope(), source }) !== null;
  }

  return {
    get value() {
      return value;
    },
    upsert,
    remove,
    clear,
  };
}
