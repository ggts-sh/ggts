import { PipelineError, registerAll, runPipeline } from "@ggts-sh/core";

// Headless full-grammar rendering (#1420): explicit opt-in.
registerAll();
import { validate, type PortableSpec } from "@ggts-sh/spec";

export interface ColorBehaviorEvidence {
  incompatible: {
    code: string;
    path: string;
    message: string;
    fix: string;
  };
  cycle: {
    code: string;
    message: string;
  };
  error: {
    code: string;
    path: string;
    message: string;
  };
}

const rows = [
  { x: 1, y: 2, group: "Alpha" },
  { x: 2, y: 3, group: "Beta" },
  { x: 3, y: 4, group: "Gamma" },
];

function exhaustionSpec(onExhaust: "cycle" | "error"): PortableSpec {
  return {
    data: { values: rows },
    layers: [
      {
        geom: "point",
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          color: { field: "group" },
        },
      },
    ],
    scales: {
      color: {
        type: "ordinal",
        range: ["#123456", "#abcdef"],
        onExhaust,
      },
    },
  };
}

export function colorBehaviorEvidence(): ColorBehaviorEvidence {
  // Categorical scheme on a sequential scale — still the load-bearing mismatch.
  // Ordinal + viridis is valid for scale_*_viridis_d (#828).
  const incompatibleResult = validate({
    ...exhaustionSpec("cycle"),
    scales: { color: { type: "sequential", scheme: "ipsum" } },
  });
  if (incompatibleResult.ok) {
    throw new Error("Expected the incompatible color scheme demonstration to fail validation.");
  }
  const incompatible = incompatibleResult.errors.find(
    (diagnostic) => diagnostic.code === "scale-scheme-type",
  );
  if (incompatible === undefined || incompatible.fix === undefined) {
    throw new Error("The incompatible color scheme demonstration returned no repair diagnostic.");
  }

  const cycle = runPipeline(exhaustionSpec("cycle"), { width: 640, height: 400 }).warnings.find(
    (warning) => warning.code === "palette-exhausted",
  );
  if (cycle === undefined) {
    throw new Error("The cycle demonstration returned no palette exhaustion warning.");
  }

  let failure: PipelineError | undefined;
  try {
    runPipeline(exhaustionSpec("error"), { width: 640, height: 400 });
  } catch (error) {
    if (!(error instanceof PipelineError)) throw error;
    failure = error;
  }
  if (failure === undefined) {
    throw new Error("Expected the strict palette exhaustion demonstration to fail.");
  }

  return {
    incompatible: {
      code: incompatible.code,
      path: incompatible.path,
      message: incompatible.message,
      fix: incompatible.fix.description,
    },
    cycle: {
      code: cycle.code,
      message: cycle.message,
    },
    error: {
      code: failure.code,
      path: failure.path,
      message: failure.message,
    },
  };
}
