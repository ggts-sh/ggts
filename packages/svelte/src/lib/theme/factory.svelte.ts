/**
 * Factory for declaration-only theme components (#659 slice 2).
 *
 * Every <Theme*> component is a thin shell: it passes its live `$props()`
 * proxy (and optional fixed theme name) here, and this factory registers a
 * `kind: "theme"` plot layer whose value getter reads the proxy — so prop
 * updates flow into the plot's derived spec without re-registration
 * (ADR 0001).
 *
 * Canonical PortableSpec form (D3): no role overrides → ThemeName string;
 * any role override → ThemeSpec object with only defined keys (never
 * `undefined` values — ThemeSpec is additionalProperties:false).
 */
import type { ThemeName, ThemeSpec } from "@ggts-sh/spec";

import { registerPlotLayer } from "../geoms/registry.svelte.js";

/** Role keys that make a ThemeSpec object (everything except `name`). */
const THEME_ROLE_KEYS = [
  "ink",
  "paper",
  "accent",
  "grid",
  "panel",
  "letterboxFill",
  "axisText",
  "axisLine",
  "tickColor",
  "panelBorder",
  "interactionInk",
  "interactionMuted",
  "focusRing",
  "crosshair",
  "selectionFill",
  "selectionStroke",
  "tooltipPaper",
  "tooltipInk",
  "tooltipBorder",
  "toolActive",
  "fontFamily",
  "fontSize",
  "axisTextSize",
  "fontWeight",
  "titleSize",
  "titleWeight",
  "subtitleSize",
  "subtitleWeight",
  "axisTitleSize",
  "axisTitleWeight",
  "guideTitleSize",
  "legendKeySize",
  "legendKeyGap",
  "legendRowGap",
  "guideBlockGap",
  "colorbarThickness",
  "colorbarLengthMin",
  "captionSize",
  "stripSize",
  "stripWeight",
  "axisLineWidth",
  "tickWidth",
  "tickLength",
  "gridWidth",
  "panelBorderWidth",
  "gridDasharray",
  "axisLineX",
  "axisLineY",
  "ticksX",
  "ticksY",
  "labelsX",
  "labelsY",
  "gridX",
  "gridY",
  "showPanelBorder",
] as const satisfies readonly (keyof ThemeSpec)[];

type ThemeRoleKey = (typeof THEME_ROLE_KEYS)[number];
export type { ThemeRoleKey };

/** Props accepted by <Theme> (generic escape hatch). */
export type ThemeLayerProps = {
  readonly name?: ThemeName | undefined;
} & {
  readonly [K in ThemeRoleKey]?: ThemeSpec[K];
};

/** Props accepted by named <ThemeDark/> shells (name is fixed by the shell). */
export type NamedThemeLayerProps = {
  readonly [K in ThemeRoleKey]?: ThemeSpec[K];
};

/** Build the canonical theme value for PortableSpec (D3). */
function themeValueFromProps(
  props: ThemeLayerProps | NamedThemeLayerProps,
  fixedName?: ThemeName,
): ThemeName | ThemeSpec {
  const resolvedName: ThemeName | undefined =
    fixedName ?? ("name" in props ? props.name : undefined);
  const roles: Partial<ThemeSpec> = {};
  for (const key of THEME_ROLE_KEYS) {
    const value = props[key];
    if (value !== undefined) {
      // ExactOptionalPropertyTypes: only assign defined values.
      (roles as Record<string, unknown>)[key] = value;
    }
  }
  if (Object.keys(roles).length === 0) {
    return resolvedName ?? "default";
  }
  return {
    ...(resolvedName !== undefined && { name: resolvedName }),
    ...roles,
  };
}

/**
 * Register a generic <Theme> layer from a component's live props proxy.
 */
export function createThemeLayer(getProps: () => ThemeLayerProps): void {
  registerPlotLayer({
    kind: "theme",
    get value() {
      return themeValueFromProps(getProps());
    },
  });
}

/**
 * Register a named theme shell (e.g. <ThemeDark/>) with optional role overrides.
 */
export function createNamedThemeLayer(name: ThemeName, getProps: () => NamedThemeLayerProps): void {
  registerPlotLayer({
    kind: "theme",
    get value() {
      return themeValueFromProps(getProps(), name);
    },
  });
}
