import {
  usePlotInputs,
  useInteractionRevision,
  plotBoundsInputs,
  preciseInterval,
  intervalPixels,
  plotLabel,
  inspectionKeys,
  type SurfaceProps,
} from "./plot-inputs.js";
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { collectCompositionDiagnostics } from "@ggts-sh/compose";
import { buildInteractionMasks, collectInspectIntentDiagnostics } from "@ggts-sh/core";
import {
  buildZoomEvent,
  filterScopeChannelsByZoomMode,
  INTERACTION_DIAGNOSTIC_CATALOG,
  iterateCandidates,
  resolveSemanticKeysForPlot,
  sanitizePartialZoomDomains,
  uniqueKeysFromRowIndexes,
} from "@ggts-sh/core/interaction";
import type { BatchInteractionMask, RenderModel } from "@ggts-sh/core";
import type {
  InteractionSource,
  LegendFilterClause,
  PreciseBoundsApplyEvent,
  ZoomDomains,
} from "@ggts-sh/core/interaction";
import type { LiveSvgHandle } from "@ggts-sh/core/svg-live";
import {
  CanvasAccessibility,
  inspectionLabel,
  PlotTooltip,
  visuallyHidden,
} from "./plot-accessibility.js";
import { PlotOverlay } from "./plot-overlay.js";
import { PlotControls } from "./plot-controls.js";
import { usePlotInteractions } from "./plot-interactions.js";
import { usePlotLegends } from "./plot-legends.js";
import { usePlotModel } from "./plot-runtime.js";
import { useHostLayoutEffect } from "./host-effect.js";
import { destroyAllLives, renderStackHTML, syncStrata } from "./strata-sync.js";

const EMPTY_FILTERS: readonly LegendFilterClause[] = [];
const NO_MASKS: readonly (BatchInteractionMask | null)[] = [];

function usePlotSurface(props: SurfaceProps) {
  const { registry } = props;
  const revision = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getSnapshot,
  );
  useInteractionRevision(props.interaction);
  const root = useRef<HTMLDivElement | null>(null);
  const capture = useRef<HTMLDivElement | null>(null);
  const stack = useRef<HTMLDivElement | null>(null);
  const lives = useRef(new Map<number, LiveSvgHandle>());
  const plotId = `gg-${useId().replaceAll(/[^a-zA-Z0-9_-]/g, "")}`;
  const [containerWidth, setContainerWidth] = useState(0);
  const [localZoom, setLocalZoom] = useState<ZoomDomains | null>(null);
  const [filters, setFilters] = useState<readonly LegendFilterClause[]>(EMPTY_FILTERS);
  const [paintedModel, setPaintedModel] = useState<RenderModel | null>(null);
  const {
    width,
    height,
    assembled,
    inspectChildren,
    config,
    datumKey,
    scope,
    zoom,
    effectiveSpec,
  } = usePlotInputs(props, revision, containerWidth, localZoom);
  const runtime = usePlotModel({
    spec: effectiveSpec,
    baselineSpec: zoom === null ? null : assembled,
    width,
    height,
    rowFilters: filters,
  });
  const { model, strata } = runtime;
  const label = plotLabel(props, model);
  const rowIdentity = props.data ?? props.spec?.data;
  const priorKeys = useMemo(() => new Map<string, PropertyKey>(), [rowIdentity, datumKey]);
  const hasLegendIntent =
    registry.layers.some(
      (layer) =>
        (layer.kind === "legendFocus" || layer.kind === "legendFilter") && layer.value !== null,
    ) ||
    Boolean(props.legendFocus) ||
    Boolean(props.legendFilter);
  const keyResolution = useMemo(
    () =>
      resolveSemanticKeysForPlot({
        model:
          config.interactive || props.interaction !== undefined || hasLegendIntent ? model : null,
        layers: assembled?.layers ?? [],
        datumKey,
        priorKeys,
        dataToken: "data",
        specToken: "spec",
      }),
    [model, assembled, datumKey, priorKeys, config.interactive, props.interaction, hasLegendIntent],
  );
  const keyForRow = useCallback(
    (index: number) => keyResolution.keys.get(index) ?? null,
    [keyResolution],
  );
  const onZoom = (domains: ZoomDomains | null, source: InteractionSource) => {
    const next = domains === null ? null : sanitizePartialZoomDomains(domains, model?.scales, zoom);
    if (domains !== null && next === null) return;
    setLocalZoom(next);
    const zoomScope = filterScopeChannelsByZoomMode(scope, config.zoom?.mode ?? null);
    if (next === null) props.interaction?.resetZoom({ scope: zoomScope, source });
    else props.interaction?.setZoom(next, { scope: zoomScope, source });
    const event = buildZoomEvent(next, source);
    props.onzoom?.(event);
    props.oninteraction?.(event);
  };
  const interactions = usePlotInteractions({
    flipped: assembled?.coord?.type === "flip",
    model,
    config,
    props,
    scope,
    capture,
    keyForRow,
    zoom,
    onZoom,
  });
  const legends = usePlotLegends({
    model,
    registry,
    revision,
    props,
    scope,
    keyForRow,
    filters,
    setFilters,
  });
  const semanticCandidates = useMemo(() => {
    if (
      model === null ||
      (!config.interactive && !hasLegendIntent && props.interaction === undefined)
    )
      return [];
    const lineageKeys = new Map<number, PropertyKey[]>();
    return [...iterateCandidates(model.candidates)].map((candidate) => {
      let keys = lineageKeys.get(candidate.lineage);
      if (keys === undefined) {
        keys = uniqueKeysFromRowIndexes(model.lineage.keys(candidate.lineage), keyForRow);
        lineageKeys.set(candidate.lineage, keys);
      }
      return { ...candidate, keys };
    });
  }, [model, keyForRow, config.interactive, hasLegendIntent, props.interaction]);
  const focusKeys = [
    ...legends.emphasis,
    ...interactions.selected,
    ...interactions.intervalKeys,
    ...inspectionKeys(config, interactions),
  ];
  const focusToken = useRef<readonly PropertyKey[]>([]);
  if (
    focusToken.current.length !== focusKeys.length ||
    focusKeys.some((key, index) => key !== focusToken.current[index])
  )
    focusToken.current = focusKeys;
  const masks = useMemo(
    () =>
      model === null || focusToken.current.length === 0
        ? NO_MASKS
        : buildInteractionMasks(model.scene.batches, focusToken.current, semanticCandidates),
    [model, semanticCandidates, focusToken.current],
  );
  const firstMarkup = useRef<string | null>(null);
  if (firstMarkup.current === null && model !== null)
    firstMarkup.current = renderStackHTML(model.scene, strata, plotId, label);
  const initialHTML = useMemo(() => ({ __html: firstMarkup.current ?? "" }), [firstMarkup.current]);
  const lastPainted = useRef<RenderModel | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;

  useHostLayoutEffect(() => {
    const element = root.current;
    if (typeof props.width === "number" || element === null) return () => {};
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured !== undefined) setContainerWidth(measured);
    });
    observer.observe(element);
    const measured = element.getBoundingClientRect().width;
    setContainerWidth(measured);
    return () => {
      observer.disconnect();
    };
  }, [props.width]);
  useHostLayoutEffect(() => {
    const element = stack.current;
    if (element === null) return () => {};
    if (model === null) {
      destroyAllLives(lives.current);
      element.replaceChildren();
      setPaintedModel(null);
      return () => {};
    }
    const paint = () => {
      const complete = syncStrata(
        element,
        model.scene,
        strata,
        lives.current,
        plotId,
        label,
        masks,
      );
      setPaintedModel(complete ? model : null);
      if (complete && lastPainted.current !== model) {
        lastPainted.current = model;
        if (effectiveSpec !== null) callbacks.current.onrender?.(model, effectiveSpec);
      }
    };
    paint();
    if (!strata.some((stratum) => stratum.backend === "canvas")) return () => {};
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    // A local theme provider can override canvas CSS without replacing chart props.
    observer.observe(element, { attributes: true, attributeFilter: ["class", "style"] });
    return () => {
      observer.disconnect();
    };
  }, [model, strata, plotId, label, masks, effectiveSpec]);
  useHostLayoutEffect(
    () => () => {
      destroyAllLives(lives.current);
      lastPainted.current = null;
    },
    [],
  );
  useEffect(() => {
    const diagnostics = [
      ...config.diagnostics,
      ...keyResolution.diagnostics,
      ...collectCompositionDiagnostics(registry.layers),
    ];
    if (inspectChildren.length > 1)
      diagnostics.push(INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_DUPLICATE_INSPECT_CAPABILITY);
    for (const diagnostic of diagnostics) callbacks.current.ondiagnostic?.(diagnostic);
    if (config.inspect !== null && assembled !== null) {
      for (const diagnostic of collectInspectIntentDiagnostics(
        assembled.layers,
        config.inspect.mode,
      ))
        callbacks.current.ondiagnostic?.(diagnostic);
    }
  }, [config, keyResolution, assembled, registry, revision]);
  useImperativeHandle(props.plotRef, () => ({
    resetScales() {
      runtime.resetScales();
      onZoom(null, "programmatic");
    },
    setZoom(domains) {
      onZoom({ ...zoom, ...domains }, "programmatic");
    },
  }));
  const boundsInputs = useMemo(
    () => plotBoundsInputs(model, config),
    [model, config.select, config.zoom],
  );
  const applyBounds = (panelId: string, event: PreciseBoundsApplyEvent) => {
    if (model === null) return;
    if (event.action === "zoom") {
      if (event.scale !== "band")
        onZoom({ ...zoom, [event.axis]: [...event.bounds] }, event.inputSource);
      return;
    }
    const selection = preciseInterval(
      model,
      panelId,
      event,
      interactions.intervals,
      semanticCandidates,
      config.select?.mode,
    );
    if (selection !== null) interactions.commitInterval(selection.event, selection.domains);
  };
  const canvasBatches = useMemo(
    () =>
      strata
        .filter((stratum) => stratum.backend === "canvas")
        .flatMap((stratum) => stratum.batches),
    [strata],
  );
  const liveText =
    inspectionLabel(interactions.inspection) ||
    (interactions.selected.length > 0 ? `${interactions.selected.length} selected` : "");
  const interactive = config.availableTools.length > 0;
  const intervalRects =
    model === null
      ? []
      : interactions.intervals.flatMap((record) => {
          const rect = intervalPixels(model, record.panelId, record.domains);
          return rect === null ? [] : [rect];
        });
  const rectangles = [
    ...intervalRects,
    ...(interactions.brush === null ? [] : [interactions.brush]),
  ];
  return {
    ready:
      (typeof props.width === "number" || containerWidth > 0) &&
      model !== null &&
      paintedModel === model,
    props,
    config,
    interactions,
    legends,
    zoom,
    onZoom,
    boundsInputs,
    applyBounds,
    root,
    capture,
    stack,
    model,
    height,
    initialHTML,
    semanticCandidates,
    rectangles,
    assembled,
    interactive,
    plotId,
    label,
    liveText,
    canvasBatches,
  };
}

export function PlotSurface(props: SurfaceProps) {
  return <PlotSurfaceView state={usePlotSurface(props)} />;
}

function PlotSurfaceView({ state }: { state: ReturnType<typeof usePlotSurface> }) {
  const {
    ready,
    props,
    config,
    interactions,
    legends,
    zoom,
    onZoom,
    boundsInputs,
    applyBounds,
    root,
    capture,
    stack,
    model,
    height,
    initialHTML,
    semanticCandidates,
    rectangles,
    assembled,
    interactive,
    plotId,
    label,
    liveText,
    canvasBatches,
  } = state;
  return (
    <div>
      {interactive && (
        <PlotControls
          tools={config.availableTools}
          activeTool={interactions.activeTool}
          onToolChange={interactions.chooseTool}
          canResetZoom={zoom !== null}
          onResetZoom={() => {
            onZoom(null, "pointer");
          }}
          canClearSelection={interactions.selected.length > 0}
          onClearSelection={() => {
            interactions.clearSelection("pointer");
          }}
          canClearIntervals={interactions.intervals.length > 0}
          onClearIntervals={() => {
            interactions.clearIntervals("pointer");
          }}
          boundsInputs={boundsInputs}
          onApplyBounds={applyBounds}
        />
      )}
      <div
        ref={root}
        className={`gg-plot-root${typeof props.width === "number" ? "" : " gg-container-width"}`}
        data-gg-ready={ready ? "true" : "false"}
        style={{
          position: "relative",
          width: typeof props.width === "number" ? props.width : "100%",
          height,
        }}
      >
        <div
          ref={stack}
          className="gg-stratum-stack"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          dangerouslySetInnerHTML={initialHTML}
        />
        {model !== null && (
          <PlotOverlay
            model={model}
            inspection={interactions.inspection}
            seed={interactions.seed}
            candidates={semanticCandidates}
            selected={interactions.selected}
            emphasized={legends.emphasis}
            rectangles={rectangles}
            flipped={assembled?.coord?.type === "flip"}
          />
        )}
        {interactive && (
          <div
            ref={capture}
            className="gg-capture"
            role="group"
            tabIndex={0}
            aria-label={label}
            aria-describedby={`${plotId}-description ${plotId}-active`}
            aria-controls={interactions.inspection === null ? undefined : `${plotId}-tooltip`}
            style={{
              position: "absolute",
              inset: 0,
              touchAction: interactions.activeTool.endsWith("-area") ? "none" : "pan-y pinch-zoom",
              cursor: interactions.activeTool.endsWith("-area") ? "crosshair" : "auto",
            }}
            onPointerDown={interactions.onPointerDown}
            onPointerMove={interactions.onPointerMove}
            onPointerUp={interactions.onPointerUp}
            onPointerCancel={interactions.onPointerCancel}
            onLostPointerCapture={interactions.onLostPointerCapture}
            onPointerLeave={interactions.onPointerLeave}
            onFocus={interactions.onFocus}
            onBlur={interactions.onBlur}
            onKeyDown={interactions.onKeyDown}
            onDoubleClick={() => {
              if (config.zoom !== null) onZoom(null, "pointer");
            }}
          />
        )}
        {model !== null &&
          assembled !== null &&
          config.inspect !== null &&
          interactions.inspection !== null && (
            <PlotTooltip
              id={`${plotId}-tooltip`}
              inspection={interactions.inspection}
              options={config.inspect}
              model={model}
              spec={assembled}
              onClose={interactions.closeInspection}
              onEnter={interactions.onTooltipEnter}
              onLeave={interactions.onTooltipLeave}
            />
          )}
        {interactive && (
          <>
            <p id={`${plotId}-description`} style={visuallyHidden}>
              Use arrow keys to explore data. Enter pins inspection or selects a point. For area
              tools, Enter starts and finishes a selection; arrow keys move its boundary. Escape
              cancels. Delete clears selection.
            </p>
            <p id={`${plotId}-active`} style={visuallyHidden}>
              {liveText}
            </p>
            <div role="status" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
              {liveText}
            </div>
          </>
        )}
      </div>
      {legends.controls}
      {model !== null && canvasBatches.length > 0 && (
        <CanvasAccessibility model={model} batches={canvasBatches} label={label} />
      )}
    </div>
  );
}
