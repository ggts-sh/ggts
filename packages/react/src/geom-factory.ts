import { useRef } from "react";

import { GEOM_PARAM_KEYS, type GeomName } from "@ggts-sh/spec";
import type {
  AesInput,
  DataInput,
  PositionName,
  PositionParams,
  RenderBackend,
  StatName,
} from "@ggts-sh/spec";
import type { Layer } from "@ggts-sh/compose";

import { useRegisterLayer } from "./registry.js";

export interface GeomProps {
  aes?: AesInput;
  data?: DataInput | readonly Record<string, unknown>[];
  stat?: StatName;
  position?: PositionName;
  positionParams?: PositionParams;
  render?: RenderBackend;
  inspect?: false;
}

export function useGeomLayer(geom: GeomName, props: GeomProps): void {
  const paramKeys = GEOM_PARAM_KEYS[geom];
  if (paramKeys === undefined) {
    throw new Error(`useGeomLayer: no GEOM_PARAM_KEYS entry for geom "${geom}"`);
  }
  const propsRef = useRef(props);
  propsRef.current = props;
  const layerRef = useRef<Layer | null>(null);
  layerRef.current ??= {
    kind: "mark",
    descriptor: {
      geom,
      get stat() {
        return propsRef.current.stat;
      },
      get aes() {
        return propsRef.current.aes;
      },
      get data() {
        return propsRef.current.data;
      },
      get position() {
        return propsRef.current.position;
      },
      get positionParams() {
        return propsRef.current.positionParams;
      },
      get render() {
        return propsRef.current.render;
      },
      get inspect() {
        return propsRef.current.inspect;
      },
      get params() {
        const current = propsRef.current as Record<string, unknown>;
        const params: Record<string, unknown> = {};
        for (const key of paramKeys) {
          const value = current[key];
          if (value !== undefined) params[key] = value;
        }
        return Object.keys(params).length > 0 ? params : undefined;
      },
    },
  };
  useRegisterLayer(layerRef.current);
}

export function usePlotLayerValue<K extends Exclude<Layer["kind"], "mark">>(
  kind: K,
  build: () => Extract<Layer, { kind: K }>["value"],
): void {
  const buildRef = useRef(build);
  buildRef.current = build;
  const layerRef = useRef<Layer | null>(null);
  layerRef.current ??= {
    kind,
    get value() {
      return buildRef.current();
    },
  } as Layer;
  useRegisterLayer(layerRef.current);
}
