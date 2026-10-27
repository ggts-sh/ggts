/** Runtime contracts for non-sequential color/fill scale families. */
export interface BinnedColorScale {
  type: "binned";
  domain: [number, number];
  transformedDomain: [number, number];
  transform: "identity" | "log10" | "sqrt";
  reverse: boolean;
  breaks: readonly number[];
  transformedBreaks: readonly number[];
  colors: readonly string[];
  naValue: string;
  unknownValue: string;
  temporalKind?: "date" | "datetime";
  colorOf(value: unknown): string | undefined;
}

export interface ManualColorScale {
  type: "manual";
  domain: readonly unknown[];
  colors: readonly string[];
  naValue: string;
  unknownValue: string;
  indexOf(value: unknown): number | undefined;
  colorOf(value: unknown): string | undefined;
}

export interface IdentityColorScale {
  type: "identity";
  naValue: string;
  unknownValue: string;
  /** True when the mapped channel has at most one distinct non-null value. */
  constant?: boolean;
  colorOf(value: unknown): string | undefined;
}
