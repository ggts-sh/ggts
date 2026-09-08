import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  a11yMarkCount,
  a11yRows,
  collapseIdenticalDisplayMembers,
  defaultTooltipRows,
  formatTooltipCell,
  tooltipTotalPlacement,
} from "@ggsvelte/core/interaction";
import type { GeometryBatch, RenderModel, CellValue } from "@ggsvelte/core";
import type { PlotInspectionChange } from "@ggsvelte/core/interaction";
import type { PortableSpec } from "@ggsvelte/spec";
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
  const pinned = inspection.state === "pinned";
  const interactive = options.contentMode === "interactive" && pinned;
  const members = collapseIdenticalDisplayMembers(
    inspection.members,
    inspection.focus,
    model.axisFormatters,
    inspection.mode,
  );
  const placement = tooltipTotalPlacement({
    tooltipTotal: options.tooltipTotal ?? "auto",
    groupTotal: inspection.groupTotal,
    memberCount: members.length,
    mode: inspection.mode,
  });
  const total = (
    <div className="gg-tooltip-total">
      Total: {formatTooltipCell(inspection.groupTotal ?? null)}
    </div>
  );
  return (
    <div
      id={id}
      className={`gg-tooltip${pinned ? " gg-tooltip-pinned" : ""}`}
      role={interactive ? "dialog" : "tooltip"}
      aria-label={interactive ? "Data inspection" : undefined}
      tabIndex={interactive ? -1 : undefined}
      style={{
        position: "absolute",
        left: Math.max(0, Math.min(inspection.focus.anchor.x + 12, model.scene.width - 260)),
        top: Math.max(0, Math.min(inspection.focus.anchor.y + 12, model.scene.height - 100)),
        maxWidth: 260,
        maxHeight: 320,
        overflow: "auto",
        padding: 12,
        lineHeight: 1.4,
        color: "var(--gg-ink, CanvasText)",
        background: "var(--gg-paper, Canvas)",
        border: "1px solid currentColor",
        borderRadius: 4,
        zIndex: 2,
        pointerEvents: "auto",
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
        <>
          {(inspection.mode === "x" || inspection.mode === "y") && (
            <div className="gg-tooltip-axis">{inspection.axisLabel}</div>
          )}
          {placement === "top" && total}
          {members.map((member, index) => (
            <dl key={index} className="gg-tooltip-member">
              {defaultTooltipRows(member.fields, inspection.mode, { labs: spec.labs }).map(
                (row) => (
                  <div
                    key={row.key}
                    style={{ display: "flex", gap: 12, justifyContent: "space-between" }}
                  >
                    <dt>{row.label}</dt>
                    <dd style={{ margin: 0 }}>
                      {formatTooltipCell(
                        row.value,
                        member.row === null
                          ? { channel: row.valueChannel, axisFormatters: model.axisFormatters }
                          : undefined,
                      )}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          ))}
          {placement === "bottom" && total}
          {(inspection.mode === "x" || inspection.mode === "y") &&
            inspection.groupMemberCount > members.length && (
              <div>+{inspection.groupMemberCount - members.length} more</div>
            )}
        </>
      ) : (
        options.content(inspection)
      )}
      {pinned && (
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
