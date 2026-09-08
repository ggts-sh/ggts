import type { CoordRadialSpec, CoordTransformAxisSpec } from "@ggts-sh/spec";

import { buildPolarProjector, type PolarProjector } from "./coord-polar.js";
import type { PipelineErrorCode } from "./diagnostics-error-catalog.js";
import { PipelineError } from "./pipeline/types.js";
import type { ContinuousScale, PositionScale } from "./scales/train.js";
import { scaleTransform } from "./scales/transform.js";

export interface CoordAxisProjector {
  readonly axis: "x" | "y";
  readonly transform: CoordTransformAxisSpec["transform"];
  readonly active: boolean;
  readonly coordinateDomain: readonly [number, number];
  /** Existing scale-normalized fraction -> post-stat coordinate fraction. */
  projectFraction(fraction: number): number;
  /** Coordinate fraction -> existing scale-normalized fraction. */
  invertFraction(fraction: number): number;
}

function docs(code: PipelineErrorCode): string {
  return `https://ggts.sh/guide/errors#${code}`;
}

function failure(
  code: PipelineErrorCode,
  axis: "x" | "y",
  problem: string,
  cause: string,
  fixes: readonly { description: string; portable?: unknown }[],
): never {
  throw new PipelineError(code, `/coord/${axis}`, cause, {
    code,
    severity: "error",
    path: `/coord/${axis}`,
    problem,
    cause,
    fixes,
    documentationUrl: docs(code),
  });
}

function identityProjector(axis: "x" | "y", reverse: boolean): CoordAxisProjector {
  return {
    axis,
    transform: "identity",
    active: reverse,
    coordinateDomain: [0, 1],
    projectFraction: reverse ? (fraction) => 1 - fraction : (fraction) => fraction,
    invertFraction: reverse ? (fraction) => 1 - fraction : (fraction) => fraction,
  };
}

function buildBandAxisProjector(
  axis: "x" | "y",
  transformName: CoordTransformAxisSpec["transform"],
  reverse: boolean,
  hasLimits: boolean,
): CoordAxisProjector {
  if (transformName !== "identity") {
    failure(
      "coord-transform-continuous",
      axis,
      `The ${axis} coordinate transform requires a continuous scale.`,
      `The ${axis} scale is discrete/banded, so ${transformName} has no quantitative coordinate domain.`,
      [
        { description: `Use transform: "identity" for the ${axis} coordinate.` },
        { description: `Use a continuous or binned quantitative ${axis} scale.` },
      ],
    );
  }
  if (hasLimits) {
    failure(
      "coord-transform-continuous",
      axis,
      `Numeric coordinate limits require a continuous ${axis} scale.`,
      `The ${axis} scale is discrete/banded, so numeric limits cannot identify category boundaries.`,
      [{ description: `Remove coord ${axis}.limits or configure a continuous scale.` }],
    );
  }
  return identityProjector(axis, reverse);
}

function resolveScaleDomain(
  axis: "x" | "y",
  scale: ContinuousScale,
  config: CoordTransformAxisSpec | undefined,
  scaleTx: ReturnType<typeof scaleTransform>,
  coordTx: ReturnType<typeof scaleTransform>,
  transformName: CoordTransformAxisSpec["transform"],
): readonly [number, number] {
  let [scaleLo, scaleHi] = scale.transformedDomain;
  if (config?.limits !== undefined) {
    const lo = config.limits[0]!;
    const hi = config.limits[1]!;
    if (
      !Number.isFinite(lo) ||
      !Number.isFinite(hi) ||
      lo === hi ||
      !scaleTx.valid(lo) ||
      !scaleTx.valid(hi)
    ) {
      failure(
        "coord-transform-domain",
        axis,
        `The ${axis} coordinate limits are invalid for the trained scale transform.`,
        `Expected two distinct finite semantic values inside the ${scale.transform} scale domain; received [${lo}, ${hi}].`,
        [{ description: `Choose finite ${axis} limits accepted by the scale transform.` }],
      );
    }
    scaleLo = scaleTx.forward(lo);
    scaleHi = scaleTx.forward(hi);
  }
  if (config?.limits === undefined && (!coordTx.valid(scaleLo) || !coordTx.valid(scaleHi))) {
    // Scale nice/expansion may cross a coordinate transform's boundary even
    // when every trained value is valid. Coordinate projection owns its raw
    // finite evidence domain in this case.
    [scaleLo, scaleHi] = scale.evidenceTransformedDomain;
  }
  if (!coordTx.valid(scaleLo) || !coordTx.valid(scaleHi)) {
    failure(
      "coord-transform-domain",
      axis,
      `The trained ${axis} coordinate domain is invalid for ${transformName}.`,
      `${transformName} cannot project scale-space endpoints [${scaleLo}, ${scaleHi}].`,
      [
        { description: `Choose coordinate limits inside the ${transformName} domain.` },
        { description: `Use transform: "identity" for this coordinate axis.` },
      ],
    );
  }
  return [scaleLo, scaleHi];
}

function resolveCoordinateDomain(
  axis: "x" | "y",
  scaleLo: number,
  scaleHi: number,
  config: CoordTransformAxisSpec | undefined,
  coordTx: ReturnType<typeof scaleTransform>,
  transformName: CoordTransformAxisSpec["transform"],
): readonly [number, number] {
  let coordLo = coordTx.forward(scaleLo);
  let coordHi = coordTx.forward(scaleHi);
  if (config?.limits === undefined && scaleLo === scaleHi && Number.isFinite(coordLo)) {
    coordLo -= 0.5;
    coordHi += 0.5;
    if (transformName === "sqrt") coordLo = Math.max(0, coordLo);
  }
  if (coordLo === coordHi || !Number.isFinite(coordLo) || !Number.isFinite(coordHi)) {
    failure(
      "coord-transform-domain",
      axis,
      `The ${axis} coordinate transform produced a degenerate domain.`,
      `${transformName} projected [${scaleLo}, ${scaleHi}] to [${coordLo}, ${coordHi}].`,
      [{ description: `Choose distinct limits or a different coordinate transform.` }],
    );
  }
  if (config?.limits !== undefined && config.expand !== false) {
    const padding = (coordHi - coordLo) * 0.05;
    coordLo -= padding;
    coordHi += padding;
    if (transformName === "sqrt") {
      coordLo = Math.max(0, coordLo);
      coordHi = Math.max(0, coordHi);
    }
  }
  return [coordLo, coordHi];
}

/**
 * Build one post-stat coordinate projector over an already-trained position
 * scale. The input fraction is the scale's affine output; reconstruction of
 * scale space means coordinate transforms never forward semantic values twice.
 */
export function buildCoordAxisProjector(
  axis: "x" | "y",
  scale: PositionScale,
  config: CoordTransformAxisSpec | undefined,
): CoordAxisProjector {
  const transformName = config?.transform ?? "identity";
  const reverse = config?.reverse === true;
  const hasLimits = config?.limits !== undefined;

  if (scale.type === "band") {
    return buildBandAxisProjector(axis, transformName, reverse, hasLimits);
  }

  if (scale.type === "time" && transformName !== "identity") {
    failure(
      "coord-transform-temporal",
      axis,
      `Temporal ${axis} coordinates permit only the identity transform.`,
      `Applying ${transformName} to epoch magnitudes would destroy calendar meaning.`,
      [
        { description: `Remove the ${axis} coordinate transform.` },
        { description: `Use identity coordinate limits/reverse for a temporal viewport.` },
      ],
    );
  }

  const scaleTx = scaleTransform(scale.transform);
  const coordTx = scaleTransform(transformName);
  const scaleDomain = scale.transformedDomain;
  const [scaleLo, scaleHi] = resolveScaleDomain(
    axis,
    scale,
    config,
    scaleTx,
    coordTx,
    transformName,
  );
  const [coordLo, coordHi] = resolveCoordinateDomain(
    axis,
    scaleLo,
    scaleHi,
    config,
    coordTx,
    transformName,
  );

  const coordSpan = coordHi - coordLo;
  const scaleSpan = scaleDomain[1] - scaleDomain[0];
  const scaleReversed =
    scale.normalizeTransformed(scaleDomain[0]) > scale.normalizeTransformed(scaleDomain[1]);
  const scaleValueAt = (fraction: number): number => {
    const affine = scaleReversed ? 1 - fraction : fraction;
    return scaleDomain[0] + affine * scaleSpan;
  };
  const scaleFractionAt = (value: number): number => {
    const affine = scaleSpan === 0 ? 0.5 : (value - scaleDomain[0]) / scaleSpan;
    return scaleReversed ? 1 - affine : affine;
  };
  const outputReversed = scaleReversed !== reverse;
  const projectFraction = (fraction: number): number => {
    const scaleValue = scaleValueAt(fraction);
    if (!coordTx.valid(scaleValue)) return Number.NaN;
    const projected = (coordTx.forward(scaleValue) - coordLo) / coordSpan;
    return outputReversed ? 1 - projected : projected;
  };
  const invertFraction = (fraction: number): number => {
    const projected = outputReversed ? 1 - fraction : fraction;
    const coordValue = coordLo + projected * coordSpan;
    return scaleFractionAt(coordTx.inverse(coordValue));
  };

  const active = transformName !== "identity" || reverse || hasLimits || config?.expand === false;
  return {
    axis,
    transform: transformName,
    active,
    coordinateDomain: [coordLo, coordHi],
    projectFraction,
    invertFraction,
  };
}

export interface PanelCoordProjector {
  readonly x: CoordAxisProjector;
  readonly y: CoordAxisProjector;
  readonly clip: boolean;
  /** Present when the coordinate system is polar/radial (joint x/y map). */
  readonly polar?: PolarProjector;
  /**
   * When true, geometry must not use early axis-separable scale projection;
   * all vertices go through the post-batch polar projector.
   */
  readonly joint: boolean;
  /**
   * When polar expand is false, continuous scales should train geometry against
   * the evidence domain so pie/coxcomb fill the full arc.
   */
  readonly expand: boolean;
  /** Theta aesthetic when polar; used with limits for scale remapping. */
  readonly polarTheta?: "x" | "y";
  readonly thetaLimits?: readonly [number, number];
  readonly rLimits?: readonly [number, number];
}

export type CoordProjectorInput =
  | {
      type: "transform";
      x?: CoordTransformAxisSpec;
      y?: CoordTransformAxisSpec;
      clip?: boolean;
    }
  | CoordRadialSpec
  | undefined;

export function buildPanelCoordProjector(
  scales: { x: PositionScale; y: PositionScale },
  coord: CoordProjectorInput,
): PanelCoordProjector {
  if (coord?.type === "radial") {
    const polar = buildPolarProjector({
      ...(coord.theta !== undefined && { theta: coord.theta }),
      ...(coord.start !== undefined && { start: coord.start }),
      ...(coord.end !== undefined && { end: coord.end }),
      ...(coord.innerRadius !== undefined && { innerRadius: coord.innerRadius }),
      ...(coord.reverse !== undefined && { reverse: coord.reverse }),
    });
    // Identity axis projectors: geometry is built in unprojected panel space,
    // then polarProjectPanelPoint maps jointly. Mark active so path/segment
    // projection does not early-return.
    return {
      x: {
        axis: "x",
        transform: "identity",
        active: true,
        coordinateDomain: [0, 1],
        projectFraction: (f) => f,
        invertFraction: (f) => f,
      },
      y: {
        axis: "y",
        transform: "identity",
        active: true,
        coordinateDomain: [0, 1],
        projectFraction: (f) => f,
        invertFraction: (f) => f,
      },
      clip: coord.clip === true,
      polar,
      joint: true,
      expand: coord.expand !== false,
      polarTheta: coord.theta === "y" ? "y" : "x",
      ...(coord.thetaLimits !== undefined &&
        coord.thetaLimits.length === 2 && {
          thetaLimits: [coord.thetaLimits[0]!, coord.thetaLimits[1]!] as const,
        }),
      ...(coord.rLimits !== undefined &&
        coord.rLimits.length === 2 && {
          rLimits: [coord.rLimits[0]!, coord.rLimits[1]!] as const,
        }),
    };
  }
  return {
    x: buildCoordAxisProjector("x", scales.x, coord?.type === "transform" ? coord.x : undefined),
    y: buildCoordAxisProjector("y", scales.y, coord?.type === "transform" ? coord.y : undefined),
    clip: coord?.type === "transform" ? coord.clip !== false : true,
    joint: false,
    expand: true,
  };
}

/**
 * Continuous scales for polar: expand:false remaps evidence domain to [0, 1];
 * optional theta/r limits remap the assigned axis domain. Band scales pass
 * through unless limits are set (limits require continuous).
 */
export function scalesForCoordExpand(
  scales: { x: PositionScale; y: PositionScale },
  expand: boolean,
  radial?: {
    theta?: "x" | "y";
    thetaLimits?: readonly [number, number];
    rLimits?: readonly [number, number];
  },
): { x: PositionScale; y: PositionScale } {
  const thetaAxis = radial?.theta === "y" ? "y" : "x";
  const rAxis = thetaAxis === "x" ? "y" : "x";
  let x = scales.x;
  let y = scales.y;
  if (!expand) {
    x = unexpandedPositionScale(x);
    y = unexpandedPositionScale(y);
  }
  if (radial?.thetaLimits !== undefined) {
    if (thetaAxis === "x") x = limitedPositionScale(x, radial.thetaLimits);
    else y = limitedPositionScale(y, radial.thetaLimits);
  }
  if (radial?.rLimits !== undefined) {
    if (rAxis === "x") x = limitedPositionScale(x, radial.rLimits);
    else y = limitedPositionScale(y, radial.rLimits);
  }
  return { x, y };
}

function unexpandedPositionScale(scale: PositionScale): PositionScale {
  if (scale.type === "band") return scale;
  return remapContinuousDomain(scale, scale.evidenceTransformedDomain);
}

function limitedPositionScale(
  scale: PositionScale,
  limits: readonly [number, number],
): PositionScale {
  if (scale.type === "band") return scale;
  const tx = scaleTransform(scale.transform);
  if (!tx.valid(limits[0]) || !tx.valid(limits[1])) return scale;
  const lo = tx.forward(limits[0]);
  const hi = tx.forward(limits[1]);
  if (!(Number.isFinite(lo) && Number.isFinite(hi)) || lo === hi) return scale;
  return remapContinuousDomain(scale, [Math.min(lo, hi), Math.max(lo, hi)]);
}

function remapContinuousDomain(
  scale: Extract<PositionScale, { type: "linear" | "time" }>,
  transformedDomain: readonly [number, number],
): PositionScale {
  const [lo, hi] = transformedDomain;
  const span = hi - lo;
  if (!(span > 0) || !Number.isFinite(span)) return scale;
  const tx = scaleTransform(scale.transform);
  const reversed =
    scale.normalizeTransformed(scale.transformedDomain[0]) >
    scale.normalizeTransformed(scale.transformedDomain[1]);
  const toFrac = (t: number): number => {
    const affine = (t - lo) / span;
    return reversed ? 1 - affine : affine;
  };
  return {
    ...scale,
    transformedDomain: [lo, hi],
    domain: [tx.inverse(lo), tx.inverse(hi)],
    normalize(value: number) {
      if (!tx.valid(value)) return Number.NaN;
      return toFrac(tx.forward(value));
    },
    normalizeTransformed(value: number) {
      return toFrac(value);
    },
    invert(fraction: number) {
      const affine = reversed ? 1 - fraction : fraction;
      return tx.inverse(lo + affine * span);
    },
  };
}
