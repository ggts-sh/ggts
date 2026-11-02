/**
 * Value-stable categorical color scale (decision 0002 semantics): first-seen
 * assignment keyed by value; removing a series changes nothing else; a
 * returning series gets its old color back via `prevState`. Config wires the
 * spec surface through trainDiscrete: explicit domain = pinned mode
 * (suspends stored assignments), domainMode, scheme/range, onExhaust.
 *
 * Continuous-family schemes (viridis/inferno/… and Crameri scientific maps)
 * sample k evenly spaced colors across the ramp for the trained domain size
 * (#828 scale_*_viridis_d), matching the ggplot2 discrete-viridis contract
 * rather than taking the first k dark stops of a fixed table.
 */
import { rampColor } from "./color.js";
import { continuousSchemeRamp, resolveOrdinalPaletteStops } from "./engine.js";
import type { ScaleState, TrainResult } from "./state.js";
import { trainDiscrete } from "./state.js";
import type { ColorScale } from "./train-types.js";

export interface OrdinalColorConfig {
  domain?: readonly unknown[];
  domainMode?: "grow" | "data";
  range?: readonly string[];
  scheme?: string;
  reverse?: boolean;
  onExhaust?: "cycle" | "error";
}

/** Evenly spaced samples across a continuous ramp (k categories). */
export function sampleSequentialPalette(stops: readonly string[], k: number): string[] {
  if (k <= 0) return [];
  if (k === 1) return [rampColor(stops, 0.5)];
  return Array.from({ length: k }, (_, i) => rampColor(stops, i / (k - 1)));
}

export function trainColor(
  values: Iterable<unknown>,
  prevState?: ScaleState | null,
  config: OrdinalColorConfig = {},
): ColorScale {
  const sequentialRamp =
    config.range === undefined ? continuousSchemeRamp(config.scheme) : undefined;
  const baseRange = resolveOrdinalPaletteStops({
    ...(config.range !== undefined && { range: config.range }),
    ...(config.scheme !== undefined && { scheme: config.scheme }),
  });
  // Placeholder range for trainDiscrete fingerprint/assignment; sequential
  // schemes re-sample after domain length is known. Do not forward onExhaust:
  // the 10-stop ramp is not the final palette, so exhaustion against it is
  // spurious (sampleSequentialPalette always yields exactly k colors).
  const range = config.reverse === true ? baseRange.toReversed() : baseRange;
  const scheme =
    config.range === undefined
      ? config.reverse === true
        ? `${config.scheme ?? "observable10"}-reversed`
        : (config.scheme ?? "observable10")
      : undefined;
  const result: TrainResult = trainDiscrete(
    values,
    {
      type: "ordinal",
      range,
      ...(scheme !== undefined && { scheme }),
      ...(config.domain !== undefined && { domain: config.domain }),
      ...(config.domainMode !== undefined && { domainMode: config.domainMode }),
      ...(sequentialRamp === undefined &&
        config.onExhaust !== undefined && { onExhaust: config.onExhaust }),
    },
    prevState ?? null,
  );

  if (sequentialRamp !== undefined) {
    const k = Math.max(1, result.domain.length);
    let colors = sampleSequentialPalette(sequentialRamp, k);
    if (config.reverse === true) colors = colors.toReversed();
    return {
      type: "ordinal",
      domain: result.domain,
      indexOf: (value: unknown) => result.indexOf(value),
      colorOf: (value: unknown) => {
        const i = result.indexOf(value);
        return i === undefined ? undefined : colors[i % colors.length];
      },
      state: result.state,
      warnings: result.warnings.filter((w) => w.code !== "palette-exhausted"),
    };
  }

  return {
    type: "ordinal",
    domain: result.domain,
    indexOf: (value: unknown) => result.indexOf(value),
    colorOf: (value: unknown) => result.rangeValueOf(value) as string | undefined,
    state: result.state,
    warnings: result.warnings,
  };
}
