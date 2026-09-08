import type { ReactNode } from "react";
import {
  coordFixed,
  coordPolar,
  coordRadial,
  coordSf,
  guideAxis,
  guideColorbar,
  guideColorsteps,
  guideLegend,
  guideNone,
  type CoordFixedOptions,
  type CoordPolarOptions,
  type CoordRadialOptions,
  type CoordSfOptions,
  type FacetFieldInput,
  type FacetInput,
  type GuidesSpec,
  type Labs as LabsSpec,
  type LegendGuideOptions,
  type LegendSpec,
  type Scales,
  type ThemeName,
  type ThemeSpec,
} from "@ggts-sh/spec";

import { definedProps } from "./defined-props.js";
import { usePlotLayerValue } from "./geom-factory.js";
import type { InspectOptions } from "./interaction.js";
import { useRegisterCapability } from "./registry.js";

export function Labs(props: LabsSpec): ReactNode {
  usePlotLayerValue("labs", () => definedProps(props));
  return null;
}

export function Theme(props: { name?: ThemeName } & Partial<ThemeSpec>): ReactNode {
  usePlotLayerValue("theme", () => {
    const defined = definedProps(props);
    const { name, ...roles } = defined;
    if (Object.keys(roles).length === 0) return name ?? "default";
    return { ...(name !== undefined && { name }), ...roles };
  });
  return null;
}

export function Scale(props: { value: Scales }): ReactNode {
  usePlotLayerValue("scale", () => props.value);
  return null;
}

export function Facet(props: FacetInput): ReactNode {
  usePlotLayerValue("facet", () => definedProps(props));
  return null;
}

export function FacetWrap(props: {
  field: FacetFieldInput;
  ncol?: number;
  scales?: FacetInput["scales"];
  strip?: FacetInput["strip"];
}): ReactNode {
  usePlotLayerValue("facet", () => {
    const defined = definedProps(props);
    return {
      wrap: defined.field,
      ...(defined.ncol !== undefined && { ncol: defined.ncol }),
      ...(defined.scales !== undefined && { scales: defined.scales }),
      ...(defined.strip !== undefined && { strip: defined.strip }),
    };
  });
  return null;
}

export function FacetGrid(props: FacetInput): ReactNode {
  usePlotLayerValue("facet", () => definedProps(props));
  return null;
}

export function Coord(props: { value: "flip" | { type: string } }): ReactNode {
  usePlotLayerValue("coord", () => props.value as "flip");
  return null;
}

export function CoordFlip(): ReactNode {
  usePlotLayerValue("coord", () => ({ type: "flip" as const }));
  return null;
}

export function CoordFixed(props: CoordFixedOptions = {}): ReactNode {
  usePlotLayerValue("coord", () => coordFixed(definedProps(props)));
  return null;
}

export function CoordPolar(props: CoordPolarOptions = {}): ReactNode {
  usePlotLayerValue("coord", () => coordPolar(definedProps(props)));
  return null;
}

export function CoordRadial(props: CoordRadialOptions = {}): ReactNode {
  usePlotLayerValue("coord", () => coordRadial(definedProps(props)));
  return null;
}

export function CoordSf(props: CoordSfOptions = {}): ReactNode {
  usePlotLayerValue("coord", () => coordSf(definedProps(props)));
  return null;
}

export function Legend(props: LegendSpec): ReactNode {
  usePlotLayerValue("legend", () => definedProps(props));
  return null;
}

export function Guides(props: { value: GuidesSpec }): ReactNode {
  usePlotLayerValue("guides", () => props.value);
  return null;
}

type GuideChannel = keyof GuidesSpec;
type NonPositionGuideChannel = Exclude<GuideChannel, "x" | "y">;

export function GuideLegend(
  props: LegendGuideOptions & {
    channel: NonPositionGuideChannel;
    focus?: boolean | { preview?: boolean };
    filter?: boolean | { mode?: string; multiple?: boolean };
  },
): ReactNode {
  usePlotLayerValue("guides", () => {
    const defined = definedProps(props);
    const { focus: _f, filter: _fi, channel, ...options } = defined;
    if (
      Object.keys(options).length === 0 &&
      (_f === true || typeof _f === "object" || _fi === true || typeof _fi === "object")
    ) {
      return {};
    }
    return { [channel]: guideLegend(options) };
  });
  usePlotLayerValue("legendFocus", () => {
    const defined = definedProps(props);
    if (defined.focus !== true && typeof defined.focus !== "object") return null;
    return {
      channel: defined.channel,
      input: defined.focus === true ? true : defined.focus,
    };
  });
  usePlotLayerValue("legendFilter", () => {
    const defined = definedProps(props);
    if (defined.filter !== true && typeof defined.filter !== "object") return null;
    return {
      channel: defined.channel,
      input: defined.filter === true ? true : defined.filter,
    };
  });
  return null;
}

export function GuideAxis(props: { channel: "x" | "y" } & Record<string, unknown>): ReactNode {
  usePlotLayerValue("guides", () => {
    const { channel, ...options } = definedProps(props);
    return { [channel]: guideAxis(options) };
  });
  return null;
}

export function GuideColorbar(
  props: { channel: NonPositionGuideChannel } & Record<string, unknown>,
): ReactNode {
  usePlotLayerValue("guides", () => {
    const { channel, ...options } = definedProps(props);
    return { [channel]: guideColorbar(options) };
  });
  return null;
}

export function GuideColorsteps(
  props: { channel: NonPositionGuideChannel } & Record<string, unknown>,
): ReactNode {
  usePlotLayerValue("guides", () => {
    const { channel, ...options } = definedProps(props);
    return { [channel]: guideColorsteps(options) };
  });
  return null;
}

export function GuideNone(props: { channel: GuideChannel }): ReactNode {
  usePlotLayerValue("guides", () => ({ [props.channel]: guideNone() }));
  return null;
}

export function Inspect(props: InspectOptions): ReactNode {
  useRegisterCapability("inspect", () => definedProps(props) as Record<string, unknown>);
  return null;
}
