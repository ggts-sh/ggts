/**
 * Codemod: deprecated <GGPlot> grammar props → declaration-only child layers
 * (#659 slice 7, closes #290).
 *
 * Runs in the SSR (node) vitest lane: `.ssr.test.ts` is this repo's node-
 * environment suffix, and the codemod is pure string/AST work with no DOM.
 * It cannot live under scripts/ because `svelte/compiler` only resolves from
 * packages/svelte.
 *
 * ADR 0013 acceptance criteria, each asserted below:
 *   - idempotent (a second run is a no-op)
 *   - formatting untouched outside edited ranges
 *   - unrecognized shapes left untouched, reported with a guide anchor
 */
import { describe, expect, it } from "vitest";

import { migratePlotProps } from "../../src/lib/codemod/migrate-plot-props.js";

function migrate(source: string): string {
  return migratePlotProps(source).code;
}

/** A minimal file whose only variable is the `<GGPlot …>` open tag. */
function plot(openTag: string): string {
  return [
    '<script lang="ts">',
    '  import { GeomPoint, GGPlot } from "@ggts-sh/svelte";',
    "</script>",
    "",
    openTag,
    "  <GeomPoint />",
    "</GGPlot>",
    "",
  ].join("\n");
}

describe("migratePlotProps — value-escape-hatch props", () => {
  it("rewrites coord to <Coord value={…}/> and imports the component", () => {
    const before = [
      '<script lang="ts">',
      '  import { GeomPoint, GGPlot } from "@ggts-sh/svelte";',
      "</script>",
      "",
      '<GGPlot data={rows} aes={{ x: "a", y: "b" }} coord={coordFixed()}>',
      "  <GeomPoint />",
      "</GGPlot>",
      "",
    ].join("\n");

    expect(migrate(before)).toBe(
      [
        '<script lang="ts">',
        '  import { Coord, GeomPoint, GGPlot } from "@ggts-sh/svelte";',
        "</script>",
        "",
        '<GGPlot data={rows} aes={{ x: "a", y: "b" }}>',
        "  <Coord value={coordFixed()} />",
        "  <GeomPoint />",
        "</GGPlot>",
        "",
      ].join("\n"),
    );
  });

  it("appends to an import list the author did not keep sorted", () => {
    // Never reorder a line someone arranged deliberately: GGPlot > GeomPoint
    // case-insensitively, so this list is unsorted and only grows at the end.
    const before = [
      '<script lang="ts">',
      '  import { GGPlot, GeomPoint } from "@ggts-sh/svelte";',
      "</script>",
      "",
      '<GGPlot data={rows} coord="flip">',
      "  <GeomPoint />",
      "</GGPlot>",
      "",
    ].join("\n");

    expect(migrate(before)).toContain(
      'import { GGPlot, GeomPoint, Coord } from "@ggts-sh/svelte";',
    );
    expect(migrate(before)).toContain('<Coord value="flip" />');
  });

  it("routes scales and guides through their own value hatches", () => {
    const before = plot(
      '<GGPlot data={rows} scales={{ color: { scheme: "colorblind" } }} guides={{ color: guideNone() }}>',
    );
    const after = migrate(before);

    expect(after).toContain('<Scale value={{ color: { scheme: "colorblind" } }} />');
    expect(after).toContain("<Guides value={{ color: guideNone() }} />");
    // D8: the scales fragment is moved verbatim, never routed through a named
    // helper, so the assembled PortableSpec stays byte-identical.
    expect(after).not.toContain("ScaleColor");
  });
});

describe("migratePlotProps — flat prop bags", () => {
  it("expands a plain object literal into named props", () => {
    const after = migrate(
      plot('<GGPlot data={rows} labs={{ title: "Sales", x: "Quarter", y: total }}>'),
    );
    expect(after).toContain('<Labs title="Sales" x="Quarter" y={total} />');
  });

  it("spreads any object literal it will not expand losslessly", () => {
    for (const [value, expected] of [
      ['{{ ...base, title: "Sales" }}', '<Labs {...{ ...base, title: "Sales" }} />'],
      ["{{ title }}", "<Labs {...{ title }} />"],
      ["{{ [key]: 1 }}", "<Labs {...{ [key]: 1 }} />"],
      ["{computedLabs}", "<Labs {...computedLabs} />"],
    ] as const) {
      expect(migrate(plot(`<GGPlot data={rows} labs=${value}>`))).toContain(expected);
    }
  });

  it("expands legend and facet the same way", () => {
    expect(migrate(plot('<GGPlot data={rows} legend={{ order: "sorted" }}>'))).toContain(
      '<Legend order="sorted" />',
    );
    expect(migrate(plot('<GGPlot data={rows} facet={{ wrap: "g", ncol: 2 }}>'))).toContain(
      '<Facet wrap="g" ncol={2} />',
    );
  });
});

describe("migratePlotProps — theme", () => {
  it("rewrites a string literal in either attribute form", () => {
    expect(migrate(plot('<GGPlot data={rows} theme="dark">'))).toContain('<Theme name="dark" />');
    expect(migrate(plot('<GGPlot data={rows} theme={"tufte"}>'))).toContain(
      '<Theme name="tufte" />',
    );
  });

  it("leaves a non-literal theme untouched and reports the manual change", () => {
    const before = plot("<GGPlot data={rows} theme={currentTheme}>");
    const result = migratePlotProps(before);

    expect(result.code).toBe(before);
    expect(result.changes).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.prop).toBe("theme");
    expect(result.skipped[0]?.docUrl).toBe(
      "https://ggts.sh/guide/upgrading#compose-the-theme-as-a-child-layer",
    );
  });

  it("still migrates the other props on a plot whose theme is skipped", () => {
    const result = migratePlotProps(plot('<GGPlot data={rows} theme={t} coord="flip">'));

    expect(result.code).toContain('<Coord value="flip" />');
    expect(result.code).toContain("theme={t}");
    expect(result.changes.map((change) => change.prop)).toEqual(["coord"]);
    expect(result.skipped.map((skip) => skip.prop)).toEqual(["theme"]);
  });
});

describe("migratePlotProps — element surgery", () => {
  it("emits children in source order and leaves the surviving attributes spaced", () => {
    const after = migrate(
      plot('<GGPlot data={rows} theme="dark" aes={{ x: "a" }} coord="flip" width={480}>'),
    );

    expect(after).toContain('<GGPlot data={rows} aes={{ x: "a" }} width={480}>');
    expect(after).toContain('  <Theme name="dark" />\n  <Coord value="flip" />\n  <GeomPoint />');
  });

  it("puts migrated children BEFORE existing children so props still lose to them", () => {
    // D2: assemble applies props first, then children in registration order.
    // A migrated prop must therefore register ahead of a child that was
    // already overriding it, or <ScaleColorDiscrete> would stop winning.
    const after = migrate(
      [
        '<script lang="ts">',
        '  import { GeomPoint, GGPlot, ScaleColorDiscrete } from "@ggts-sh/svelte";',
        "</script>",
        "",
        '<GGPlot data={rows} scales={{ color: { scheme: "viridis" } }}>',
        '  <ScaleColorDiscrete scheme="colorblind" />',
        "  <GeomPoint />",
        "</GGPlot>",
        "",
      ].join("\n"),
    );

    expect(after.indexOf("<Scale value=")).toBeLessThan(after.indexOf("<ScaleColorDiscrete"));
  });

  it("grows a body on a self-closing plot", () => {
    const after = migrate(
      [
        '<script lang="ts">',
        '  import { GGPlot } from "@ggts-sh/svelte";',
        "</script>",
        "",
        '<GGPlot data={rows} spec={spec} theme="dark" />',
        "",
      ].join("\n"),
    );

    expect(after).toBe(
      [
        '<script lang="ts">',
        '  import { GGPlot, Theme } from "@ggts-sh/svelte";',
        "</script>",
        "",
        "<GGPlot data={rows} spec={spec}>",
        '  <Theme name="dark" />',
        "</GGPlot>",
        "",
      ].join("\n"),
    );
  });

  it("indents children to the plot's own column when it is nested", () => {
    const after = migrate(
      [
        '<script lang="ts">',
        '  import { GeomPoint, GGPlot } from "@ggts-sh/svelte";',
        "</script>",
        "",
        '<div class="chart">',
        '  <GGPlot data={rows} theme="dark">',
        "    <GeomPoint />",
        "  </GGPlot>",
        "</div>",
        "",
      ].join("\n"),
    );

    expect(after).toContain('  <GGPlot data={rows}>\n    <Theme name="dark" />\n    <GeomPoint />');
  });

  it("migrates every plot in the file, importing each component once", () => {
    const after = migrate(
      [
        '<script lang="ts">',
        '  import { GeomPoint, GGPlot } from "@ggts-sh/svelte";',
        "</script>",
        "",
        '<GGPlot data={a} theme="dark"><GeomPoint /></GGPlot>',
        '<GGPlot data={b} theme="light"><GeomPoint /></GGPlot>',
        "",
      ].join("\n"),
    );

    expect(after.match(/<Theme name=/g)).toHaveLength(2);
    expect(after.match(/\bTheme\b/g)).toHaveLength(3); // one import + two children
  });

  it("follows an aliased GGPlot binding", () => {
    const after = migrate(
      [
        '<script lang="ts">',
        '  import { GGPlot as Plot } from "@ggts-sh/svelte";',
        "</script>",
        "",
        '<Plot data={rows} theme="dark">',
        "  <slot />",
        "</Plot>",
        "",
      ].join("\n"),
    );

    expect(after).toContain("import { GGPlot as Plot, Theme }");
    expect(after).toContain('<Plot data={rows}>\n  <Theme name="dark" />');
  });
});

describe("migratePlotProps — ignores non-rule attribute names", () => {
  it("does not treat Object.prototype members as migratable props", () => {
    // RULES is a plain object; RULES[name] without hasOwn walks the prototype
    // and would treat constructor/toString/valueOf as "rules" with undefined
    // form/component, corrupting the rewrite and import list.
    const before = plot("<GGPlot data={rows} constructor={oops} toString={nope}>");
    const result = migratePlotProps(before);

    expect(result.code).toBe(before);
    expect(result.changes).toEqual([]);
    expect(result.code).not.toContain("<undefined");
    expect(result.code).not.toMatch(/import \{[^}]*undefined/);
  });
});

describe("migratePlotProps — ADR 0013 acceptance criteria", () => {
  const messy = [
    '<script lang="ts">',
    '  import { GeomPoint, GGPlot } from "@ggts-sh/svelte";',
    "",
    "  const rows = [{ x: 1, y: 2 }];",
    "</script>",
    "",
    "<!--   a comment whose   spacing is deliberate   -->",
    "<GGPlot",
    "  data={rows}",
    '  theme="dark"',
    '  labs={{ title: "Sales" }}',
    ">",
    "  <GeomPoint />",
    "</GGPlot>",
    "",
    "<style>\n  .x {   color : red }\n</style>",
    "",
  ].join("\n");

  it("is idempotent — a second run changes nothing", () => {
    const once = migrate(messy);
    const twice = migratePlotProps(once);

    expect(twice.code).toBe(once);
    expect(twice.changes).toEqual([]);
  });

  it("leaves formatting outside the edited ranges untouched", () => {
    const after = migrate(messy);

    expect(after).toContain("<!--   a comment whose   spacing is deliberate   -->");
    expect(after).toContain("<style>\n  .x {   color : red }\n</style>");
    expect(after).toContain("  const rows = [{ x: 1, y: 2 }];");
    // The multi-line open tag keeps its remaining attribute on its own line.
    expect(after).toContain("<GGPlot\n  data={rows}\n>");
  });

  it("returns the source untouched when there is nothing to do", () => {
    for (const source of [
      // No GGPlot import at all.
      '<script lang="ts">\n  import { GGPlot } from "./local.js";\n</script>\n\n<GGPlot theme="dark" />\n',
      // Already migrated.
      '<script lang="ts">\n  import { GGPlot, Theme } from "@ggts-sh/svelte";\n</script>\n\n<GGPlot data={rows}>\n  <Theme name="dark" />\n</GGPlot>\n',
      // Only non-deprecated props.
      plot("<GGPlot data={rows} width={480} inspect>"),
    ]) {
      const result = migratePlotProps(source);
      expect(result.code).toBe(source);
      expect(result.changes).toEqual([]);
    }
  });

  it("migrates a non-package specifier only when the caller opts it in", () => {
    const source = [
      '<script lang="ts">',
      '  import { GGPlot } from "../../src/lib/index.js";',
      "</script>",
      "",
      '<GGPlot data={rows} theme="dark" />',
      "",
    ].join("\n");

    expect(migratePlotProps(source).code).toBe(source);
    expect(migratePlotProps(source, { sources: ["../../src/lib/index.js"] }).code).toContain(
      '<Theme name="dark" />',
    );
  });
});
