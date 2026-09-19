import { Fragment, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  a11yMarkCount,
  a11yRows,
  collapseIdenticalDisplayMembers,
  defaultTooltipRows,
  formatTooltipCell,
  selectHoverDisplayMembers,
  tooltipTotalPlacement,
  TRANSIENT_MEMBER_LIMIT,
  type TooltipTotal,
} from "@ggts-sh/core/interaction";
import { ensureReactPlotChrome, shouldShowTooltipPinHint } from "./plot-chrome.js";
import { tooltipCardPosition, tooltipOverflowCount } from "./plot-tooltip-layout.js";
import type { GeometryBatch, RenderModel, CellValue } from "@ggts-sh/core";
import type { PlotInspectionChange } from "@ggts-sh/core/interaction";
import type { PortableSpec } from "@ggts-sh/spec";
import type { InspectOptions, InteractionSource } from "./interaction.js";

export const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

export function CanvasAccessibility({
  model,
  batches,
  label,
}: {
  model: RenderModel;
  batches: GeometryBatch[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const table = useMemo(() => (open ? a11yRows(model, batches) : null), [open, model, batches]);
  const total = useMemo(() => a11yMarkCount(batches), [batches]);
  return (
    <div className="gg-canvas-a11y">
      <div
        role="img"
        aria-label={`${label} — ${total} canvas-rendered marks. Use the data table.`}
        style={visuallyHidden}
      />
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {open ? "Hide data table" : "Show data table"}
      </button>
      {table !== null && (
        <div style={{ overflow: "auto", maxHeight: 320 }}>
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                {table.fields.map((field) => (
                  <th key={field} scope="col">
                    {field}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((value, cell) => (
                    <td key={cell}>{formatTooltipCell(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {table.total > table.rows.length && (
            <p>
              First {table.rows.length} of {table.total} rows.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function inspectionLabel(
  inspection: PlotInspectionChange<Record<string, CellValue>, PropertyKey> | null,
): string {
  if (inspection === null) return "";
  return inspection.focus.fields
    .map((field) => `${field.field}: ${formatTooltipCell(field.value)}`)
    .join(", ");
}

function PlotTooltipDefaultBody({
  inspection,
  spec,
  model,
  showPinHint,
  tooltipTotal,
}: {
  inspection: PlotInspectionChange<Record<string, CellValue>, PropertyKey>;
  spec: PortableSpec;
  model: RenderModel;
  showPinHint: boolean;
  tooltipTotal: TooltipTotal | undefined;
}) {
  const displayMembers = collapseIdenticalDisplayMembers(
    inspection.members,
    inspection.focus,
    model.axisFormatters,
    inspection.mode,
  );
  const members =
    inspection.state === "transient"
      ? selectHoverDisplayMembers(displayMembers, inspection.focus, {
          mode: inspection.mode,
          limit: TRANSIENT_MEMBER_LIMIT,
        })
      : displayMembers;
  const overflowCount = tooltipOverflowCount({
    transient: inspection.state === "transient",
    mode: inspection.mode,
    groupMemberCount:
      inspection.mode === "x" || inspection.mode === "y"
        ? inspection.groupMemberCount
        : displayMembers.length,
    displayCount: displayMembers.length,
    shownCount: members.length,
  });
  const placement = tooltipTotalPlacement({
    tooltipTotal: tooltipTotal ?? "auto",
    groupTotal: inspection.groupTotal,
    memberCount: displayMembers.length,
    mode: inspection.mode,
  });
  const stackTotal = placement === null ? null : (inspection.groupTotal ?? null);
  const total =
    stackTotal === null ? null : (
      <dl
        className={
          placement === "top" ? "gg-tooltip-total gg-tooltip-total-top" : "gg-tooltip-total"
        }
      >
        <dt>Total</dt>
        <dd>{formatTooltipCell(stackTotal)}</dd>
      </dl>
    );
  return (
    <>
      {(inspection.mode === "x" || inspection.mode === "y") && (
        <div className="gg-tooltip-axis">{inspection.axisLabel}</div>
      )}
      <div className="gg-tooltip-members">
        {placement === "top" && total}
        {members.map((member, index) => (
          <dl key={index} className={member === inspection.focus ? "gg-tooltip-focus" : undefined}>
            {defaultTooltipRows(member.fields, inspection.mode, { labs: spec.labs }).map((row) => (
              <Fragment key={row.key}>
                <dt>{row.label}</dt>
                <dd>
                  {formatTooltipCell(
                    row.value,
                    member.row === null
                      ? { channel: row.valueChannel, axisFormatters: model.axisFormatters }
                      : undefined,
                  )}
                </dd>
              </Fragment>
            ))}
          </dl>
        ))}
        {placement === "bottom" && total}
      </div>
      {overflowCount > 0 ? (
        <p className="gg-tooltip-more">
          {showPinHint ? `+${overflowCount} more · pin to inspect all` : `+${overflowCount} more`}
        </p>
      ) : (
        showPinHint &&
        inspection.state === "transient" && <p className="gg-tooltip-hint">Click to pin</p>
      )}
    </>
  );
}

export function PlotTooltip({
  id,
  inspection,
  options,
  model,
  spec,
  onClose,
  onEnter,
  onLeave,
}: {
  id: string;
  inspection: PlotInspectionChange<Record<string, CellValue>, PropertyKey>;
  options: InspectOptions;
  model: RenderModel;
  spec: PortableSpec;
  onClose: (source: InteractionSource) => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  ensureReactPlotChrome();
  const pinned = inspection.state === "pinned";
  const interactive = options.contentMode === "interactive" && pinned;
  const pin = options.pin ?? true;
  const tooltipBorder = model.scene.theme.tooltipBorder ?? "#b8b8b8";
  const showPinHint = shouldShowTooltipPinHint({ pin, tooltipBorder });
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (node === null) return;
    const measure = () => {
      setMeasured({ width: node.offsetWidth, height: node.offsetHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  const { left, top } = tooltipCardPosition({
    anchorX: inspection.focus.anchor.x,
    anchorY: inspection.focus.anchor.y,
    measuredWidth: measured.width,
    measuredHeight: measured.height,
    sceneWidth: model.scene.width,
    sceneHeight: model.scene.height,
  });
  return (
    <div
      ref={setNode}
      id={id}
      className={`gg-tooltip${pinned ? " gg-tooltip-pinned" : ""}${interactive ? " gg-tooltip-interactive" : ""}`}
      role={interactive ? "dialog" : "tooltip"}
      aria-label={interactive ? "Data inspection" : undefined}
      tabIndex={interactive ? -1 : undefined}
      style={{
        left,
        top,
        fontSize: model.scene.theme.fontSize,
      }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose("keyboard");
        }
      }}
    >
      {options.content === undefined ? (
        <PlotTooltipDefaultBody
          inspection={inspection}
          spec={spec}
          model={model}
          showPinHint={showPinHint}
          tooltipTotal={options.tooltipTotal}
        />
      ) : (
        options.content(inspection)
      )}
      {interactive && (
        <button
          type="button"
          onClick={() => {
            onClose("pointer");
          }}
        >
          Close
        </button>
      )}
    </div>
  );
}
