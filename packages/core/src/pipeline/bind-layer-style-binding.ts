/** Resolve mapped numeric/symbol style channels and enforce geom capability. */
import {
  LINETYPE_NAMES,
  POINT_SHAPE_NAMES,
  STYLE_AESTHETIC_GEOMS,
  type Aes,
  type NormalizedGeomName,
  type StatName,
  type StyleAesthetic,
} from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import { checkField } from "./bind-layer-check-field.js";
import type { PipelineWarning, StyleBinding } from "./types.js";
import { PipelineError } from "./types.js";

export function styleBinding(
  channel: Aes[StyleAesthetic] | undefined,
  channelName: StyleAesthetic,
  geom: NormalizedGeomName,
  stat: StatName,
  layerIndex: number,
  table: ColumnTable,
  warnings: PipelineWarning[],
): StyleBinding {
  const out: StyleBinding = {
    field: null,
    statColumn: null,
    constant: null,
    scaledConstant: null,
  };
  if (channel === undefined || channel === null) return out;
  const compatible = STYLE_AESTHETIC_GEOMS[channelName] as readonly string[];
  if (!compatible.includes(geom)) {
    const path = `/layers/${String(layerIndex)}/aes/${channelName}`;
    throw new PipelineError(
      "unsupported-geom-aesthetic",
      path,
      `The ${geom} geom does not consume aes.${channelName}. Supported geoms: ${compatible.join(", ")}.`,
      {
        code: "unsupported-geom-aesthetic",
        severity: "error",
        path,
        problem: `aes.${channelName} would not change the rendered ${geom} marks.`,
        cause: `The ${channelName} style is implemented only for ${compatible.join(", ")}.`,
        fixes: [
          { description: `Move the mapping to a compatible ${compatible[0]} layer.` },
          { description: `Remove aes.${channelName} from this ${geom} layer.` },
        ],
        documentationUrl: "/guide/aesthetic-scales#geom-capabilities",
      },
    );
  }
  if ("field" in channel) {
    out.field = checkField(channel, channelName, layerIndex, table, warnings);
  } else if ("stat" in channel) {
    const outputs: Record<string, readonly string[]> = {
      identity: [],
      count: ["count"],
      bin: ["count", "density", "ncount", "ndensity"],
      bin_2d: ["count", "density", "ncount", "ndensity"],
      bin_hex: ["count", "density", "ncount", "ndensity"],
      density: ["density", "count", "scaled", "ndensity"],
      bindot: ["stackpos"],
      smooth: ["y", "ymin", "ymax", "se"],
      summary: ["y", "ymin", "ymax"],
      summary_bin: ["y", "ymin", "ymax"],
      // One measure output per (group, x): the rolling summary itself.
      summary_rolling: ["y"],
      boxplot: ["ymin", "lower", "middle", "upper", "ymax"],
      sum: ["n", "prop"],
      ecdf: ["ecdf"],
      qq: ["sample", "theoretical"],
      qq_line: ["sample", "theoretical"],
    };
    if (!(outputs[stat] ?? []).includes(channel.stat)) {
      throw new PipelineError(
        "stat-channel-unsupported",
        `/layers/${String(layerIndex)}/aes/${channelName}`,
        `The ${stat} stat does not publish after-stat column "${channel.stat}" for aes.${channelName}.`,
      );
    }
    out.statColumn = channel.stat;
  } else if (channel.scale === true) {
    out.scaledConstant = channel.value;
  } else {
    const value = channel.value;
    const valid =
      channelName === "shape"
        ? typeof value === "string" && (POINT_SHAPE_NAMES as readonly string[]).includes(value)
        : channelName === "linetype"
          ? typeof value === "string" && (LINETYPE_NAMES as readonly string[]).includes(value)
          : typeof value === "number" &&
            Number.isFinite(value) &&
            (channelName === "alpha" ? value >= 0 && value <= 1 : value > 0);
    if (!valid) {
      throw new PipelineError(
        "invalid-aesthetic-constant",
        `/layers/${String(layerIndex)}/aes/${channelName}/value`,
        `The literal aes.${channelName} value is outside its supported style domain.`,
      );
    }
    out.constant = value;
  }
  return out;
}
