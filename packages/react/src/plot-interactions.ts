import {
  rectangle,
  expandBrushRect,
  sourceOf,
  semanticDomainsForRect,
  moveKeyboardPoint,
} from "./plot-gesture.js";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import {
  buildIntervalSelectionFromScene,
  buildPointSelectionEvent,
  consumeIntervalKeys,
  intervalQuerySceneFromModel,
  iterateCandidates,
  materializeInspection,
  nextLocalIntervalRecords,
  nextPointSelectionKeys,
  resolveBrushZoomDomains,
  resolvedTarget,
  uniqueKeysFromRowIndexes,
} from "@ggts-sh/core/interaction";
import type { CandidateFacts, CellValue, PlotRect, RenderModel } from "@ggts-sh/core";
import type {
  InteractionSource,
  InteractionTool,
  IntervalSelection,
  PlotInteractionInterval,
  PlotInteractionScope,
  ReadonlyIntervalDomains,
  ZoomDomains,
} from "@ggts-sh/core/interaction";
import type { GGPlotProps } from "./plot-props.js";
import type { PlotInspectionChange, ResolvedInteractionConfig } from "./interaction.js";

type Point = { x: number; y: number };
type Inspection = PlotInspectionChange<Record<string, CellValue>, PropertyKey>;
type Brush = { start: Point; end: Point; panelId: string; source: InteractionSource };
export function usePlotInteractions(input: {
  flipped: boolean;
  model: RenderModel | null;
  config: ResolvedInteractionConfig;
  props: GGPlotProps;
  scope: PlotInteractionScope;
  capture: RefObject<HTMLDivElement | null>;
  keyForRow: (index: number) => PropertyKey | null;
  zoom: ZoomDomains | null;
  onZoom: (domains: ZoomDomains | null, source: InteractionSource) => void;
}) {
  const { model, config, props, scope, capture, keyForRow } = input;
  const [chosenTool, setChosenTool] = useState<InteractionTool>(config.initialTool);
  const activeTool =
    props.tool !== undefined && config.availableTools.includes(props.tool)
      ? props.tool
      : config.availableTools.includes(chosenTool)
        ? chosenTool
        : config.initialTool;
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const inspectionRef = useRef(inspection);
  inspectionRef.current = inspection;
  const seedId = useRef<number | null>(null);
  const [localSelection, setLocalSelection] = useState<readonly PropertyKey[]>([]);
  const [localIntervals, setLocalIntervals] = useState<
    readonly PlotInteractionInterval<PropertyKey>[]
  >([]);
  const [brush, setBrush] = useState<Brush | null>(null);
  const brushRef = useRef<Brush | null>(brush);
  brushRef.current = brush;
  const origin = useRef<Brush | null>(null);
  const keyboardPoint = useRef<Point | null>(null);
  const tooltipHovered = useRef(false);
  const restoringFocus = useRef(false);
  const selected = props.interaction?.selected(scope) ?? localSelection;
  const intervals = props.interaction?.intervals(scope) ?? localIntervals;
  const candidates = useMemo(
    () =>
      model === null || (intervals.length === 0 && selected.length === 0)
        ? []
        : [...iterateCandidates(model.candidates)].map((candidate) => ({
            ...candidate,
            keys: uniqueKeysFromRowIndexes(model.lineage.keys(candidate.lineage), keyForRow),
          })),
    [model, keyForRow, intervals, selected],
  );
  const intervalKeys = useMemo(
    () =>
      model === null
        ? []
        : consumeIntervalKeys({ records: intervals, panels: model.viewport.panels, candidates }),
    [model, intervals, candidates],
  );

  const publishInspection = (next: Inspection | null, source: InteractionSource) => {
    inspectionRef.current = next;
    setInspection(next);
    const event = next ?? { type: "inspect" as const, phase: "clear" as const, source };
    props.oninspect?.(event);
    props.oninteraction?.(event);
  };
  const closeInspection = (source: InteractionSource) => {
    if (inspectionRef.current === null) return;
    publishInspection(null, source);
    if (source === "keyboard") {
      restoringFocus.current = true;
      capture.current?.focus();
      restoringFocus.current = false;
    }
  };
  const inspectCandidate = (
    candidate: CandidateFacts,
    source: InteractionSource,
    pinned = false,
  ) => {
    if (model === null || config.inspect === null) return;
    const mode = config.inspect.mode === "auto" ? candidate.autoMode : config.inspect.mode;
    const target = resolvedTarget(model, candidate, mode);
    if (target === null) {
      closeInspection(source);
      return;
    }
    seedId.current = candidate.id;
    const next = materializeInspection(
      { model, seed: candidate, mode, state: pinned ? "pinned" : "transient", source },
      target,
      pinned ? "complete" : "transient",
      keyForRow,
    );
    publishInspection(next, source);
  };
  const selectCandidate = (candidate: CandidateFacts, source: InteractionSource) => {
    if (model === null || config.select?.type !== "point") return;
    const rows = new Set(model.lineage.keys(candidate.lineage));
    if (candidate.rowIndex !== null) rows.add(candidate.rowIndex);
    const keys = uniqueKeysFromRowIndexes(rows, keyForRow);
    const next = nextPointSelectionKeys(selected, keys, config.select.multiple);
    setLocalSelection(next);
    props.interaction?.setSelection(next, { scope, source });
    const event = buildPointSelectionEvent(next, source);
    props.onselect?.(event);
    props.oninteraction?.(event);
  };
  const clearSelection = (source: InteractionSource = "programmatic") => {
    setLocalSelection([]);
    props.interaction?.clearSelection({ scope, source });
    const event = {
      type: "select" as const,
      phase: "clear" as const,
      mode: "point" as const,
      keys: [],
      source,
    };
    props.onselect?.(event);
    props.oninteraction?.(event);
  };
  const commitInterval = (event: IntervalSelection, domains: ReadonlyIntervalDomains) => {
    props.onselect?.(event);
    props.oninteraction?.(event);
    if (
      config.select?.persistent !== true ||
      event.panelId === null ||
      (domains.x === undefined && domains.y === undefined)
    )
      return;
    const record = {
      panelId: event.panelId,
      preset: config.select.preset,
      domains,
      keys: event.keys,
    };
    setLocalIntervals((current) => nextLocalIntervalRecords(current, record));
    props.interaction?.setInterval(record, { scope, source: event.source });
  };
  const clearIntervals = (source: InteractionSource = "programmatic") => {
    setLocalIntervals([]);
    props.interaction?.clearIntervals({ scope, source });
    const event: IntervalSelection = {
      type: "select",
      phase: "clear",
      mode: config.select?.mode ?? "xy",
      panelId: null,
      domain: {},
      pixels: { x0: 0, y0: 0, x1: 0, y1: 0 },
      keys: [],
      lineageCount: 0,
      source,
    };
    props.onselect?.(event);
    props.oninteraction?.(event);
  };
  const brushRect = (value: Brush): PlotRect => {
    const rect = rectangle(value.start, value.end);
    const panel = model?.viewport.panel(value.panelId);
    const mode = activeTool === "zoom-area" ? config.zoom?.mode : config.select?.mode;
    if (panel === null || panel === undefined) return rect;
    return expandBrushRect(rect, panel.bounds, mode, input.flipped);
  };
  const publishBrush = (value: Brush, phase: "start" | "change") => {
    if (model === null || activeTool !== "select-area" || config.select?.type !== "interval")
      return;
    const event = buildIntervalSelectionFromScene({
      phase,
      mode: config.select.mode,
      source: value.source,
      pixels: brushRect(value),
      scene: intervalQuerySceneFromModel(model),
      panelId: value.panelId,
      keyForRow,
    });
    props.onselect?.(event);
    props.oninteraction?.(event);
  };
  const finishBrush = (value: Brush) => {
    if (model === null) return;
    const rect = brushRect(value);
    const panel = model.viewport.panel(value.panelId);
    if (panel === null) return;
    if (activeTool === "zoom-area" && config.zoom !== null) {
      const domains = resolveBrushZoomDomains(rect, panel, config.zoom.mode, input.zoom);
      if (domains !== null) input.onZoom(domains, value.source);
    } else if (activeTool === "select-area" && config.select?.type === "interval") {
      const event = buildIntervalSelectionFromScene({
        phase: "end",
        mode: config.select.mode,
        source: value.source,
        pixels: rect,
        scene: intervalQuerySceneFromModel(model),
        panelId: value.panelId,
        keyForRow,
      });
      commitInterval(event, semanticDomainsForRect(model, value.panelId, rect, config.select.mode));
    }
  };
  const locate = (event: PointerEvent<HTMLDivElement>): Point | null => {
    if (model === null) return null;
    return model.viewport.locate(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
    );
  };
  const hit = (point: Point) =>
    model?.viewport.panelAtOrOnly(point)?.nearest(point, {
      mode: config.inspect?.mode ?? "auto",
      maxDistance: config.inspect?.maxDistance ?? 24,
    }) ?? null;
  const area = activeTool === "select-area" || activeTool === "zoom-area";
  const cancelBrush = () => {
    origin.current = null;
    brushRef.current = null;
    setBrush(null);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (!event.isPrimary && event.pointerId !== 0)) return;
    const point = locate(event);
    const panel = point === null ? null : model?.viewport.panelAtOrOnly(point);
    if (point === null || panel === null || panel === undefined) return;
    origin.current = { start: point, end: point, panelId: panel.id, source: sourceOf(event) };
    if (area) {
      event.preventDefault();
      if (event.nativeEvent.isTrusted) event.currentTarget.setPointerCapture?.(event.pointerId);
      setBrush(origin.current);
      brushRef.current = origin.current;
      publishBrush(origin.current, "start");
    }
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary && event.pointerId !== 0) return;
    const point = locate(event);
    if (point === null) return;
    if (area && origin.current !== null) {
      const panel = model?.viewport.panel(origin.current.panelId);
      const end =
        panel === null || panel === undefined
          ? point
          : {
              x: Math.max(panel.bounds.x0, Math.min(point.x, panel.bounds.x1)),
              y: Math.max(panel.bounds.y0, Math.min(point.y, panel.bounds.y1)),
            };
      const next = { ...origin.current, end };
      brushRef.current = next;
      setBrush(next);
      publishBrush(next, "change");
      return;
    }
    if (
      activeTool !== "inspect" ||
      config.inspect === null ||
      inspectionRef.current?.state === "pinned" ||
      event.pointerType === "touch"
    )
      return;
    const candidate = hit(point);
    if (candidate === null) closeInspection(sourceOf(event));
    else inspectCandidate(candidate, sourceOf(event));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const point = locate(event);
    if (point === null) return;
    const start = origin.current;
    origin.current = null;
    if (
      area &&
      start !== null &&
      Math.hypot(point.x - start.start.x, point.y - start.start.y) >= 4
    ) {
      finishBrush({ ...start, end: point });
      cancelBrush();
      return;
    }
    cancelBrush();
    const candidate = hit(point);
    if (candidate === null) {
      closeInspection(sourceOf(event));
      return;
    }
    if (activeTool === "point") selectCandidate(candidate, sourceOf(event));
    else if (activeTool === "inspect" && config.inspect !== null) {
      const pinned =
        config.inspect.pin &&
        !(inspectionRef.current?.state === "pinned" && seedId.current === candidate.id);
      inspectCandidate(candidate, sourceOf(event), pinned);
    }
  };
  const navigate = (
    direction: "next" | "previous" | "first" | "last" | "left" | "right" | "up" | "down",
    step = 1,
  ) => {
    if (model === null) return;
    const id = model.candidates.traverse(seedId.current, direction, step);
    const candidate = id === null ? null : model.candidates.candidate(id);
    if (candidate !== null) {
      seedId.current = candidate.id;
      if (config.inspect !== null)
        inspectCandidate(candidate, "keyboard", inspectionRef.current?.state === "pinned");
    }
  };
  const handleAreaKey = (
    event: KeyboardEvent<HTMLDivElement>,
    direction: "left" | "right" | "up" | "down" | undefined,
  ) => {
    if (model !== null) {
      const panel =
        model.viewport.panelAtOrOnly(
          keyboardPoint.current ?? { x: model.scene.width / 2, y: model.scene.height / 2 },
        ) ?? model.viewport.panels[0];
      if (panel === undefined) return false;
      const point = keyboardPoint.current ?? {
        x: (panel.bounds.x0 + panel.bounds.x1) / 2,
        y: (panel.bounds.y0 + panel.bounds.y1) / 2,
      };
      if (direction !== undefined) {
        event.preventDefault();
        const step = event.shiftKey ? 1 : 10;
        const next = moveKeyboardPoint(point, panel.bounds, direction, step);
        keyboardPoint.current = next;
        if (brushRef.current !== null) {
          const value = { ...brushRef.current, end: next };
          brushRef.current = value;
          setBrush(value);
          publishBrush(value, "change");
        }
        return true;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (brushRef.current === null) {
          const value = {
            start: point,
            end: point,
            panelId: panel.id,
            source: "keyboard" as const,
          };
          brushRef.current = value;
          setBrush(value);
          publishBrush(value, "start");
        } else {
          finishBrush(brushRef.current);
          cancelBrush();
        }
        return true;
      }
    }
    return false;
  };
  const activateKeyboardCandidate = (event: KeyboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (seedId.current === null) navigate("first");
    const candidate = seedId.current === null ? null : model?.candidates.candidate(seedId.current);
    if (candidate === null || candidate === undefined) return;
    if (activeTool === "point") selectCandidate(candidate, "keyboard");
    else if (config.inspect?.pin === true)
      inspectCandidate(candidate, "keyboard", inspectionRef.current?.state !== "pinned");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelBrush();
      closeInspection("keyboard");
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      if (activeTool === "select-area") clearIntervals("keyboard");
      else if (activeTool === "point") clearSelection("keyboard");
      return;
    }
    const arrows = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    } as const;
    const direction = arrows[event.key as keyof typeof arrows];
    if (area && handleAreaKey(event, direction)) return;
    if (direction !== undefined) {
      event.preventDefault();
      navigate(direction);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      navigate(event.key === "Home" ? "first" : "last");
    } else if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      navigate(event.key === "PageDown" ? "next" : "previous", 10);
    } else if (event.key === "Enter" || event.key === " ") activateKeyboardCandidate(event);
  };
  useEffect(() => {
    if (config.inspect === null) closeInspection("programmatic");
  }, [config.inspect]);
  const previousModel = useRef(model);
  useEffect(() => {
    if (previousModel.current === model) return;
    previousModel.current = model;
    cancelBrush();
    const current = inspectionRef.current;
    if (current === null) return;
    if (current.state !== "pinned" || model === null) {
      closeInspection("programmatic");
      return;
    }
    const key = current.focus.key ?? current.focus.sourceKeys[0];
    const candidate = [...iterateCandidates(model.candidates)].find(
      (item) =>
        item.layerIndex === current.focus.layerIndex &&
        uniqueKeysFromRowIndexes(model.lineage.keys(item.lineage), keyForRow).includes(key!),
    );
    if (candidate === undefined) closeInspection("programmatic");
    else inspectCandidate(candidate, "programmatic", true);
  }, [model]);

  return {
    seed: seedId.current === null ? null : (model?.candidates.candidate(seedId.current) ?? null),
    activeTool,
    inspection,
    selected,
    intervals,
    intervalKeys,
    brush: brush === null ? null : brushRect(brush),
    clearSelection,
    clearIntervals,
    commitInterval,
    closeInspection,
    chooseTool(this: void, tool: InteractionTool) {
      setChosenTool(tool);
      props.ontoolchange?.(tool);
      cancelBrush();
    },
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: cancelBrush,
    onLostPointerCapture: cancelBrush,
    onPointerLeave(this: void) {
      if (!area && inspectionRef.current?.state !== "pinned")
        queueMicrotask(() => {
          if (!tooltipHovered.current) closeInspection("pointer");
        });
    },
    onKeyDown,
    onFocus(this: void) {
      if (!restoringFocus.current && inspectionRef.current === null) navigate("first");
    },
    onBlur(this: void, event: { relatedTarget: EventTarget | null }) {
      if (
        event.relatedTarget instanceof Node &&
        capture.current?.parentElement?.contains(event.relatedTarget) === true
      )
        return;
      if (inspectionRef.current?.state !== "pinned") closeInspection("keyboard");
      cancelBrush();
    },
    onTooltipEnter(this: void) {
      tooltipHovered.current = true;
    },
    onTooltipLeave(this: void) {
      tooltipHovered.current = false;
      if (inspectionRef.current?.state !== "pinned") closeInspection("pointer");
    },
  };
}
