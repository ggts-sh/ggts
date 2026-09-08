/**
 * Resolve color/fill ChannelValue into a ColorBinding.
 */
import type { ChannelValue, StatName } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import { checkField } from "./bind-layer-check-field.js";
import { STAT_COLOR_COLUMNS } from "./bind-layer-stat-columns.js";
import type { ColorBinding, PipelineWarning } from "./types.js";

export function colorBinding(
  channel: ChannelValue | undefined,
  channelName: string,
  stat: StatName,
  layerIndex: number,
  table: ColumnTable,
  warnings: PipelineWarning[],
): ColorBinding {
  const out: ColorBinding = {
    field: null,
    statColumn: null,
    constant: null,
    scaledConstant: null,
  };
  if (channel === undefined || channel === null) return out;
  if ("field" in channel) {
    out.field = checkField(channel, channelName, layerIndex, table, warnings);
  } else if ("stat" in channel) {
    // after_stat columns (e.g. density_2d_filled fill → level; #802 phase 2;
    // bin_hex fill → count; #800). Only frames that resolve after_stat into
    // colour values honor these; warn rather than drop the mapping in silence
    // (#915). This stays a warning, not a PipelineError as on style channels,
    // because the layer still renders and after_stat colour is a mapping we
    // may yet support for more stats.
    if (!(STAT_COLOR_COLUMNS[stat] ?? []).includes(channel.stat)) {
      warnings.push({
        code: "stat-channel-unsupported",
        message: `Layer ${layerIndex}: the ${stat} stat does not publish after-stat column "${channel.stat}" for aes.${channelName}; the mapping is ignored.`,
      });
    }
    out.statColumn = channel.stat;
  } else if ("value" in channel) {
    if (channel.scale === true) out.scaledConstant = channel.value;
    else out.constant = String(channel.value);
  } else {
    warnings.push({
      code: "stat-channel-unsupported",
      message: `Layer ${layerIndex}: unsupported mapping form on the "${channelName}" channel; the mapping is ignored.`,
    });
  }
  return out;
}
