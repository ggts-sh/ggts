/**
 * performance.mark instrumentation (plan: "Benchmarks — instrumented from the
 * walking skeleton"). Guarded so the pipeline stays pure and runs in
 * environments without the performance API (older workers, exotic runtimes).
 */

interface PerfLike {
  mark(name: string): unknown;
  measure(name: string, startMark: string, endMark: string): unknown;
}

function perfOrNull(): PerfLike | null {
  const p = (globalThis as { performance?: unknown }).performance;
  if (
    typeof p === "object" &&
    p !== null &&
    typeof (p as PerfLike).mark === "function" &&
    typeof (p as PerfLike).measure === "function"
  ) {
    return p as PerfLike;
  }
  return null;
}

const perf = perfOrNull();

export function perfMark(name: string): void {
  perf?.mark(name);
}

/** measure `ggts:<stage>` between two prior marks; never throws. */
export function perfMeasure(name: string, startMark: string, endMark: string): void {
  try {
    perf?.measure(name, startMark, endMark);
  } catch {
    // a mark was cleared or never set — instrumentation must never break a render
  }
}
