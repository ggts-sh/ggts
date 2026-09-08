/** Shared types for the deterministic mock responder (tests/evals). */
import type { DataProfile, ProfileFieldType } from "@ggts-sh/spec";

import type { FieldPicker } from "./profile.ts";

export type Channel = { field: string } | { value: string | number } | { stat: string };
export type MockAes = Record<string, Channel>;
export type MockScales = Record<
  string,
  { type: string; parse?: string; transform?: string; breaks?: number[] }
>;

export interface MockLayer {
  geom: string;
  stat?: string;
  position?: string;
  positionParams?: Record<string, number>;
  aes?: MockAes;
  params?: Record<string, unknown>;
}

export interface MockSpec {
  data: { name: string };
  layers: MockLayer[];
  facet?: Record<string, unknown>;
  coord?: {
    type: string;
    x?: {
      transform: string;
      limits?: number[];
      reverse?: boolean;
      expand?: boolean;
    };
    y?: {
      transform: string;
      limits?: number[];
      reverse?: boolean;
      expand?: boolean;
    };
    clip?: boolean;
    ratio?: number;
  };
  scales?: MockScales;
  guides?: Record<
    string,
    {
      type: "legend" | "colorbar" | "colorsteps";
      position?: "right" | "bottom";
      direction?: "vertical" | "horizontal";
    }
  >;
}

export interface Mention {
  name: string;
  type: ProfileFieldType;
  index: number;
}

export interface MockContext {
  prompt: string;
  profile: DataProfile;
  repair: boolean;
  pick: FieldPicker;
  spec: MockSpec;
  scales: MockScales;
}
