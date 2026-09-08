import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { formatBoundsDraft, validateBoundsDraft } from "@ggts-sh/core/interaction";
import type {
  BoundsDraftErrors,
  BoundsEditorInput,
  InteractionTool,
  PreciseBoundsApplyEvent,
} from "@ggts-sh/core/interaction";

interface PlotControlsProps {
  tools: readonly InteractionTool[];
  activeTool: InteractionTool;
  onToolChange: (tool: InteractionTool) => void;
  canResetZoom: boolean;
  onResetZoom: () => void;
  canClearSelection: boolean;
  onClearSelection: () => void;
  canClearIntervals: boolean;
  onClearIntervals: () => void;
  boundsInputs: readonly { panelId: string; input: BoundsEditorInput }[];
  onApplyBounds: (panelId: string, event: PreciseBoundsApplyEvent) => void;
}

const controlStyle: CSSProperties = {
  boxSizing: "border-box",
  minWidth: 44,
  minHeight: 44,
  padding: "8px 10px",
  border: "1px solid var(--gg-panelBorder, var(--gg-theme-panelBorder, currentColor))",
  borderRadius: 2,
  background: "var(--gg-panelBg, var(--gg-theme-panelBg, Canvas))",
  color: "inherit",
  font: "inherit",
};

const toolLabels: Record<InteractionTool, string> = {
  inspect: "Inspect",
  point: "Select point",
  "select-area": "Select area",
  "zoom-area": "Zoom area",
};

function hintFor(input: BoundsEditorInput): string {
  if (input.scale === "time") {
    return input.temporalKind === "monthDay"
      ? "Enter a month-day as MM-DD (for example 04-01)."
      : "Enter an ISO 8601 date, or a date-time with Z or an explicit offset.";
  }
  if (input.scale === "band") return "Endpoints include both selected categories.";
  if (input.transform === "log10") return "Enter positive values in ascending domain order.";
  if (input.transform === "sqrt") return "Enter zero or positive values in ascending domain order.";
  return "Enter values in ascending domain order.";
}

function BoundsForm({
  input,
  onApply,
  onClose,
}: {
  input: BoundsEditorInput;
  onApply: (event: PreciseBoundsApplyEvent) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => formatBoundsDraft(input));
  const [errors, setErrors] = useState<BoundsDraftErrors>({});
  const controls = useRef<Partial<Record<"lower" | "upper", HTMLInputElement | HTMLSelectElement>>>(
    {},
  );
  const inputSource = useRef<PreciseBoundsApplyEvent["inputSource"]>("keyboard");
  const axis = input.axis === "x" ? "horizontal" : "vertical";
  const action = input.action === "select" ? "selection" : "zoom";

  useEffect(() => {
    setDraft(formatBoundsDraft(input));
    setErrors({});
    inputSource.current = "keyboard";
  }, [input]);
  useEffect(() => {
    controls.current.lower?.focus();
  }, []);

  return (
    <form
      className="gg-bounds-editor"
      noValidate
      onKeyDown={(event) => {
        inputSource.current = "keyboard";
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const result = validateBoundsDraft(input, draft.lower, draft.upper, inputSource.current);
        inputSource.current = "keyboard";
        if (!result.ok) {
          setErrors(result.errors);
          controls.current[result.errors.lower === undefined ? "upper" : "lower"]?.focus();
          return;
        }
        onApply(result.event);
        onClose();
      }}
    >
      <fieldset
        aria-label={`Edit ${axis} ${action} bounds`}
        style={{ margin: 0, minWidth: 0, padding: 12 }}
      >
        <legend>Precise {axis} bounds</legend>
        <p id={`${id}-hint`} style={{ margin: "0 0 8px" }}>
          {hintFor(input)}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {(["lower", "upper"] as const).map((field) => {
            const props = {
              id: `${id}-${field}`,
              value: draft[field],
              "aria-invalid": errors[field] === undefined ? undefined : true,
              "aria-describedby": `${id}-hint${errors[field] === undefined ? "" : ` ${id}-${field}-error`}`,
              style: { ...controlStyle, width: "100%" },
            };
            return (
              <div key={field} style={{ flex: "1 1 140px", minWidth: 0 }}>
                <label htmlFor={props.id}>
                  {field === "lower" ? "Lower bound" : "Upper bound"}
                </label>
                {input.scale === "band" ? (
                  <select
                    {...props}
                    ref={(node) => {
                      if (node !== null) controls.current[field] = node;
                    }}
                    onChange={(event) => {
                      setDraft({ ...draft, [field]: event.currentTarget.value });
                    }}
                  >
                    {input.categories.map((category, index) => (
                      <option key={index} value={String(index)}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...props}
                    ref={(node) => {
                      if (node !== null) controls.current[field] = node;
                    }}
                    type={input.scale === "time" ? "text" : "number"}
                    inputMode={input.scale === "time" ? undefined : "decimal"}
                    step={input.scale === "linear" ? (input.step ?? "any") : undefined}
                    autoComplete="off"
                    onChange={(event) => {
                      setDraft({ ...draft, [field]: event.currentTarget.value });
                    }}
                  />
                )}
                {errors[field] !== undefined && (
                  <p
                    id={`${id}-${field}-error`}
                    role="alert"
                    style={{ color: "var(--gg-error, var(--gg-theme-error, #a40000))" }}
                  >
                    {errors[field]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button
            type="submit"
            style={controlStyle}
            onPointerDown={(event) => {
              inputSource.current = event.pointerType === "touch" ? "touch" : "pointer";
            }}
            onPointerCancel={() => {
              inputSource.current = "keyboard";
            }}
          >
            Apply
          </button>
          <button type="button" style={controlStyle} onClick={onClose}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function boundsKey(panelId: string, input: BoundsEditorInput): string {
  return JSON.stringify([panelId, input.action, input.axis]);
}

export function PlotControls(props: PlotControlsProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const editorId = useId();
  const current = props.boundsInputs.find(
    ({ panelId, input }) => boundsKey(panelId, input) === editing,
  );
  const multiplePanels = new Set(props.boundsInputs.map(({ panelId }) => panelId)).size > 1;
  const close = () => {
    setEditing(null);
    trigger.current?.focus();
  };

  return (
    <div
      className="gg-plot-controls"
      style={{ color: "var(--gg-text, var(--gg-theme-text, currentColor))", font: "inherit" }}
    >
      <div
        role="group"
        aria-label="Chart interaction tools"
        style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
      >
        {props.tools.map((tool) => (
          <button
            key={tool}
            type="button"
            style={controlStyle}
            aria-pressed={props.activeTool === tool}
            onClick={() => {
              props.onToolChange(tool);
            }}
          >
            {toolLabels[tool]}
          </button>
        ))}
        {props.canResetZoom && (
          <button type="button" style={controlStyle} onClick={props.onResetZoom}>
            Reset zoom
          </button>
        )}
        {props.canClearSelection && (
          <button type="button" style={controlStyle} onClick={props.onClearSelection}>
            Clear selection
          </button>
        )}
        {props.canClearIntervals && (
          <button type="button" style={controlStyle} onClick={props.onClearIntervals}>
            Clear all selections
          </button>
        )}
        {props.boundsInputs.map(({ panelId, input }) => {
          const key = boundsKey(panelId, input);
          return (
            <button
              key={key}
              type="button"
              style={controlStyle}
              aria-expanded={editing === key}
              aria-controls={editing === key ? editorId : undefined}
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setEditing(editing === key ? null : key);
              }}
            >
              Set {input.axis} {input.action === "select" ? "selection" : "zoom"} bounds
              {multiplePanels ? `: ${panelId}` : ""}
            </button>
          );
        })}
      </div>
      {current !== undefined && (
        <div id={editorId} style={{ marginTop: 8 }}>
          <BoundsForm
            key={editing}
            input={current.input}
            onClose={close}
            onApply={(event) => {
              props.onApplyBounds(current.panelId, event);
            }}
          />
        </div>
      )}
    </div>
  );
}
