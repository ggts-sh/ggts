<!-- Recipes adapted from examples/<category>/<name>/ where noted; hand-authored recipes are validated by scripts/skill-content/fences.test.ts (normalize + validate on every json complete fence). -->

# Long-tail recipes

Each recipe pairs a validated JSON `PortableSpec` with its Svelte-children twin.
Inline data is cut to a few rows — swap in yours. Plot-level `aes` inherits into
every layer; a layer `aes` merges over it, and `null` unsets a channel.

## Error bars from raw values (stat summary)

Raw observations per group; the summary stat computes mean ± se, no preaggregation.
<!-- adapted from examples/errorbar/mean-se/ -->

```json complete
{
  "data": {
    "values": [
      { "drug": "A", "sleep": 0.7 },
      { "drug": "A", "sleep": 1.6 },
      { "drug": "A", "sleep": 0.2 },
      { "drug": "B", "sleep": 1.9 },
      { "drug": "B", "sleep": 3.4 },
      { "drug": "B", "sleep": 2.5 }
    ]
  },
  "aes": { "x": { "field": "drug" }, "y": { "field": "sleep" } },
  "layers": [
    {
      "geom": "point",
      "position": "jitter",
      "positionParams": { "width": 0.1, "height": 0, "seed": 7 },
      "params": { "alpha": 0.5 }
    },
    { "geom": "errorbar", "stat": "summary", "params": { "width": 0.3 } }
  ]
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "drug", y: "sleep" }}>
  <GeomPoint
    position="jitter"
    positionParams={{ width: 0.1, height: 0, seed: 7 }}
    alpha={0.5}
  />
  <GeomErrorbar stat="summary" width={0.3} />
</GGPlot>
```

The `stat="summary"` override needs one call at app startup:
`import { registerSummary } from "@ggts-sh/svelte"; registerSummary();`
(or `registerAll()`; the JSON spec twin needs `registerAll()` regardless).

## Value labels on columns

`dy`/`dx` are PIXEL offsets (negative dy = up); `position: "nudge"` + `positionParams` offsets in DATA units instead.
<!-- adapted from examples/text/labels/ -->

```json complete
{
  "data": {
    "values": [
      { "cat": "a", "n": 4 },
      { "cat": "b", "n": 7 },
      { "cat": "c", "n": 5 }
    ]
  },
  "aes": { "x": { "field": "cat" }, "y": { "field": "n" } },
  "layers": [
    { "geom": "col" },
    {
      "geom": "text",
      "aes": { "label": { "field": "n" } },
      "params": { "dy": -8 }
    }
  ]
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "cat", y: "n" }}>
  <GeomCol />
  <GeomText aes={{ label: "n" }} dy={-8} />
</GGPlot>
```

## Big scatter on canvas

`"render": "canvas"` forces the canvas path; layers over `CANVAS_AUTO_THRESHOLD` (2000) marks switch on their own. Plot-level `"a11y": "force-svg"` overrides for assistive tech.

```json complete
{
  "data": {
    "values": [
      { "x": 1, "y": 2 },
      { "x": 2, "y": 3 },
      { "x": 3, "y": 2.5 },
      { "x": 4, "y": 4 }
    ]
  },
  "layers": [
    {
      "geom": "point",
      "render": "canvas",
      "aes": { "x": { "field": "x" }, "y": { "field": "y" } },
      "params": { "size": 1.2, "alpha": 0.4 }
    }
  ],
  "a11y": "force-svg"
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "x", y: "y" }} a11y="force-svg">
  <GeomPoint render="canvas" size={1.2} alpha={0.4} />
</GGPlot>
```

## Log10 axis scatter

Positive data only; the transform runs before stats. Authored `"type": "log"` canonicalizes to this form.
<!-- adapted from examples/point/log-scale/ -->

```json complete
{
  "data": {
    "values": [
      { "density": 10, "rate": 3 },
      { "density": 100, "rate": 9 },
      { "density": 1000, "rate": 30 },
      { "density": 5000, "rate": 55 }
    ]
  },
  "layers": [
    {
      "geom": "point",
      "aes": { "x": { "field": "density" }, "y": { "field": "rate" } }
    }
  ],
  "scales": { "x": { "type": "linear", "transform": "log10" } }
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "density", y: "rate" }}>
  <GeomPoint />
  <ScaleXLog10 />
</GGPlot>
```

## Violin with jittered points

Distribution shape per group; needs several y values per group for the density. Seeded jitter is deterministic.
<!-- adapted from examples/boxplot/violin/ -->

```json complete
{
  "data": {
    "values": [
      { "run": "a", "v": 1 },
      { "run": "a", "v": 2 },
      { "run": "a", "v": 2.4 },
      { "run": "a", "v": 3.1 },
      { "run": "a", "v": 1.7 },
      { "run": "b", "v": 4 },
      { "run": "b", "v": 5.2 },
      { "run": "b", "v": 4.4 },
      { "run": "b", "v": 6 },
      { "run": "b", "v": 5.1 }
    ]
  },
  "aes": { "x": { "field": "run" }, "y": { "field": "v" } },
  "layers": [
    { "geom": "violin", "params": { "trim": true, "alpha": 0.7 } },
    {
      "geom": "point",
      "position": "jitter",
      "positionParams": { "width": 0.08, "height": 0, "seed": 3 },
      "params": { "size": 2 }
    }
  ]
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "run", y: "v" }}>
  <GeomViolin trim alpha={0.7} />
  <GeomPoint
    position="jitter"
    positionParams={{ width: 0.08, height: 0, seed: 3 }}
    size={2}
  />
</GGPlot>
```

## Tile heatmap (discrete x/y, continuous fill)

One tile per (x, y) pair; a sequential fill scale carries the value.
<!-- adapted from examples/tile/heatmap/ -->

```json complete
{
  "data": {
    "values": [
      { "day": "Mon", "hour": "am", "n": 3 },
      { "day": "Mon", "hour": "pm", "n": 8 },
      { "day": "Tue", "hour": "am", "n": 5 },
      { "day": "Tue", "hour": "pm", "n": 12 }
    ]
  },
  "layers": [
    {
      "geom": "tile",
      "aes": {
        "x": { "field": "day" },
        "y": { "field": "hour" },
        "fill": { "field": "n" }
      }
    }
  ],
  "scales": { "fill": { "type": "sequential", "scheme": "viridis" } }
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "day", y: "hour", fill: "n" }}>
  <GeomTile />
  <ScaleFillContinuous scheme="viridis" />
</GGPlot>
```

## Hex density heatmap

Overplotted x/y pairs binned into hexagons; fill defaults to the stat's `count`. `bin_2d` is the rectangular twin.
<!-- adapted from examples/hex/basic/ -->

```json complete
{
  "data": {
    "values": [
      { "x": 1, "y": 1 },
      { "x": 1.1, "y": 1.2 },
      { "x": 0.9, "y": 0.8 },
      { "x": 3, "y": 3 },
      { "x": 3.2, "y": 2.9 },
      { "x": 2.8, "y": 3.1 }
    ]
  },
  "layers": [
    {
      "geom": "hex",
      "aes": { "x": { "field": "x" }, "y": { "field": "y" } },
      "params": { "bins": 6 }
    }
  ]
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "x", y: "y" }}>
  <GeomHex bins={6} />
</GGPlot>
```

## Step chart (ECDF)

Stairs through precomputed points; `direction: "hv"` is the ECDF convention. `step` takes stat `identity` only, so compute F̂(x) = i/n yourself.
<!-- adapted from examples/step/ecdf/ -->

```json complete
{
  "data": {
    "values": [
      { "x": 1.2, "y": 0.25 },
      { "x": 2, "y": 0.5 },
      { "x": 3.1, "y": 0.75 },
      { "x": 4.5, "y": 1 }
    ]
  },
  "layers": [
    {
      "geom": "step",
      "aes": { "x": { "field": "x" }, "y": { "field": "y" } },
      "params": { "direction": "hv" }
    }
  ]
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "x", y: "y" }}>
  <GeomStep direction="hv" />
</GGPlot>
```

## Ribbon band with a center line

Map ymin/ymax at plot level for the band; the line layer adds its own y.
<!-- adapted from examples/ribbon/bounds/ -->

```json complete
{
  "data": {
    "values": [
      { "t": 1, "lo": 2, "hi": 5, "mid": 3.4 },
      { "t": 2, "lo": 3, "hi": 6, "mid": 4.5 },
      { "t": 3, "lo": 2.5, "hi": 7, "mid": 4.8 },
      { "t": 4, "lo": 4, "hi": 8, "mid": 6 }
    ]
  },
  "aes": {
    "x": { "field": "t" },
    "ymin": { "field": "lo" },
    "ymax": { "field": "hi" }
  },
  "layers": [
    { "geom": "ribbon", "params": { "alpha": 0.35 } },
    {
      "geom": "line",
      "aes": { "y": { "field": "mid" } },
      "params": { "linewidth": 1.5 }
    }
  ]
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "t", ymin: "lo", ymax: "hi" }}>
  <GeomRibbon alpha={0.35} />
  <GeomLine aes={{ y: "mid" }} linewidth={1.5} />
</GGPlot>
```

## Horizontal boxplot (coord flip)

Map the category to x and the value to y as usual, then flip — long labels get room.
<!-- hand-authored; validated by skill-content test -->

```json complete
{
  "data": {
    "values": [
      { "g": "a", "v": 1 },
      { "g": "a", "v": 2 },
      { "g": "a", "v": 3 },
      { "g": "a", "v": 2.2 },
      { "g": "b", "v": 4 },
      { "g": "b", "v": 5 },
      { "g": "b", "v": 6 },
      { "g": "b", "v": 4.8 }
    ]
  },
  "layers": [
    {
      "geom": "boxplot",
      "aes": { "x": { "field": "g" }, "y": { "field": "v" } }
    }
  ],
  "coord": { "type": "flip" }
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "g", y: "v" }}>
  <GeomBoxplot />
  <CoordFlip />
</GGPlot>
```

## Smooth trend with per-layer aes override

Both layers inherit x/y; only the point layer maps size. A layer channel set to `null` would drop an inherited one instead.
<!-- adapted from examples/smooth/loess-scatter/ -->

```json complete
{
  "data": {
    "values": [
      { "year": 1, "angle": 10, "w": 1 },
      { "year": 2, "angle": 14, "w": 3 },
      { "year": 3, "angle": 13, "w": 2 },
      { "year": 4, "angle": 18, "w": 4 },
      { "year": 5, "angle": 21, "w": 2 },
      { "year": 6, "angle": 20, "w": 5 }
    ]
  },
  "aes": { "x": { "field": "year" }, "y": { "field": "angle" } },
  "layers": [
    { "geom": "smooth", "params": { "method": "loess", "span": 0.9 } },
    {
      "geom": "point",
      "aes": { "size": { "field": "w" } },
      "params": { "alpha": 0.85 }
    }
  ]
}
```

```svelte fragment
<GGPlot data={rows} aes={{ x: "year", y: "angle" }}>
  <GeomSmooth method="loess" span={0.9} />
  <GeomPoint aes={{ size: "w" }} alpha={0.85} />
</GGPlot>
```

## Map polygons (geom sf)

Rows carry a `geometry` column of GeoJSON Geometry JSON strings, already projected; map no x/y — fill carries the value.
<!-- adapted from examples/sf/basic/ -->

```json complete
{
  "data": {
    "values": [
      {
        "region": "A",
        "rate": 12,
        "geometry": "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[2,0],[1,2],[0,0]]]}"
      },
      {
        "region": "B",
        "rate": 28,
        "geometry": "{\"type\":\"Polygon\",\"coordinates\":[[[2.2,0],[4.2,0],[3.2,2],[2.2,0]]]}"
      }
    ]
  },
  "layers": [
    {
      "geom": "sf",
      "aes": { "fill": { "field": "rate" } },
      "params": { "linewidth": 0.8 }
    }
  ]
}
```

```svelte fragment
<GGPlot data={regions} aes={{ fill: "rate" }}>
  <GeomSf linewidth={0.8} />
</GGPlot>
```
