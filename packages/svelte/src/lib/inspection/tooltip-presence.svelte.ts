import type { CellValue } from "@ggts-sh/core";

import type { PlotInspectionChange } from "../interaction/interaction.js";
import {
  TOOLTIP_MOTION_MS,
  prefersReducedMotion,
  resolveTooltipDismissReason,
  resolveTooltipMotion,
} from "./tooltip-motion.js";

/** Inspection snapshot shape owned by the plot engine. */
type AnyInspection = PlotInspectionChange<Record<string, CellValue>, PropertyKey>;

/**
 * Tooltip session/ghost/presence state, extracted from <GGPlot>.
 *
 * Owns three concerns that must stay in lockstep (GGPlan: "Tooltip presence"):
 * the hover session (whether enter/exit motion is allowed), the exit-motion
 * ghost (a frozen snapshot that keeps rendering while the real tooltip exits),
 * and the pointer/explicit-close flags the capture layer feeds in. The
 * inspection state itself stays with the engine — the factory reads it through
 * a LIVE getter so a sync always sees the current value, never a snapshot
 * taken at construction.
 *
 * SSR-safe: no `requestAnimationFrame` is touched on the server (a queued sync
 * degrades to a synchronous call), and reduced-motion detection guards for the
 * missing `matchMedia`.
 */
export type TooltipPresenceState = {
  /** Reactive exit-motion snapshot, `null` when no ghost should render. */
  readonly ghost: AnyInspection | null;
  /** Monotonic ghost generation; captured at ghost mount for safe clearing. */
  readonly ghostEpoch: number;
  /** Record whether the pointer is currently over the capture surface. */
  setPointerOnCapture(on: boolean): void;
  /** Flag the next dismissal as explicit (blur, Escape, close button). */
  markExplicitClose(): void;
  /** Session-active flag for enter-motion gating (read at tooltip mount). */
  sessionActive(): boolean;
  /** Whether the user prefers reduced motion (SSR-safe). */
  reducedMotion(): boolean;
  /** Schedule a presence sync on the next frame (server: synchronous). */
  queueSync(): void;
  /** Recompute session/ghost/presence from the live inspection. */
  sync(): void;
  /** Clear the ghost unless a newer generation has replaced it. */
  clearGhost(generation: number): void;
};

function reducedMotion(): boolean {
  if (typeof matchMedia !== "function") return false;
  return prefersReducedMotion(matchMedia("(prefers-reduced-motion: reduce)"));
}

/**
 * Create the tooltip presence state. Call synchronously during component
 * init: the cleanup effect and every later sync assume they run inside the
 * component's reactive context.
 */
export function createTooltipPresenceState(options: {
  /** LIVE getter into the engine's inspection state — never a snapshot. */
  getInspection: () => AnyInspection | null;
}): TooltipPresenceState {
  const { getInspection } = options;

  const session = { active: false };
  let pointerOnCapture = false;
  let pendingExplicitClose = false;
  let lastLiveInspection: AnyInspection | null = null;
  let hadLiveInspection = false;
  const ghostEpoch = { n: 0 };
  let ghostTimer: ReturnType<typeof setTimeout> | undefined;
  let ghost = $state<AnyInspection | null>(null);
  let syncFrame = 0;

  $effect(() => () => {
    clearTimeout(ghostTimer);
    cancelAnimationFrame(syncFrame);
  });

  function clearGhost(generation: number): void {
    if (generation !== ghostEpoch.n) return;
    ghost = null;
    if (ghostTimer !== undefined) {
      clearTimeout(ghostTimer);
      ghostTimer = undefined;
    }
  }

  function startGhost(snapshot: AnyInspection): void {
    ghostEpoch.n += 1;
    const generation = ghostEpoch.n;
    ghost = snapshot;
    clearTimeout(ghostTimer);
    ghostTimer = setTimeout(() => {
      clearGhost(generation);
    }, TOOLTIP_MOTION_MS + 50);
  }

  function sync(): void {
    const current = getInspection();
    const present = current !== null;
    if (current !== null) lastLiveInspection = current;
    if (present === hadLiveInspection) return;
    hadLiveInspection = present;
    if (present) {
      const next = resolveTooltipMotion({
        reason: "hit",
        sessionActive: session.active,
        reducedMotion: reducedMotion(),
      });
      session.active = next.sessionActive;
      clearGhost(ghostEpoch.n);
      return;
    }
    const reason = resolveTooltipDismissReason({
      explicitClose: pendingExplicitClose,
      pointerOnCapture,
    });
    pendingExplicitClose = false;
    const next = resolveTooltipMotion({
      reason,
      sessionActive: session.active,
      reducedMotion: reducedMotion(),
    });
    session.active = next.sessionActive;
    if (next.phase === "exit" && lastLiveInspection !== null) startGhost(lastLiveInspection);
  }

  function queueSync(): void {
    if (syncFrame !== 0) return;
    if (typeof requestAnimationFrame !== "function") {
      sync();
      return;
    }
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      sync();
    });
  }

  return {
    get ghost() {
      return ghost;
    },
    get ghostEpoch() {
      return ghostEpoch.n;
    },
    setPointerOnCapture(on: boolean): void {
      pointerOnCapture = on;
    },
    markExplicitClose(): void {
      pendingExplicitClose = true;
    },
    sessionActive(): boolean {
      return session.active;
    },
    reducedMotion,
    queueSync,
    sync,
    clearGhost,
  };
}
