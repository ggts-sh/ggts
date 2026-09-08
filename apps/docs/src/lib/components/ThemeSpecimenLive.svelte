<script lang="ts">
  /**
   * Interactive body for a theme specimen. Dynamically imported by
   * ThemeSpecimen when the host is near the viewport so /themes does not
   * hydrate dozens of full GGPlot controllers on first paint.
   */
  import {
    CoordFixed,
    GeomArea,
    GeomBar,
    GeomCol,
    GeomLine,
    GeomMap,
    GeomPoint,
    GeomSmooth,
    GeomText,
    GGPlot,
    GuideLegend,
    Inspect,
    Labs,
    Scale,
    ScaleFillContinuous,
    ScaleXDate,
    scaleXLog10,
    Theme,
  } from "@ggts-sh/svelte";
  import type { ThemeName } from "@ggts-sh/spec";

  import TemperaturesSpecimen from "$lib/components/TemperaturesSpecimen.svelte";
  import { docsAppearance } from "$lib/docs-appearance-state.svelte";
  import { marksOnlyThemeRoles } from "$lib/marks-only-theme-contrast";
  import type {
    SchemeName,
    ThemeSpecimenKind,
  } from "$lib/theme-specimens/catalog";
  import {
    attendees,
    cities,
    countries,
    generation,
    longRunSeries,
    penguins,
    revenue,
    ridership,
    sohoNeighbourhoodDeaths,
    sohoPumpNeighbourhoods,
  } from "$lib/theme-specimens/data";

  const {
    name,
    label,
    kind,
    scheme,
    legendFocus,
    height,
  }: {
    name: ThemeName;
    label: string;
    kind: ThemeSpecimenKind;
    scheme: SchemeName;
    legendFocus: boolean;
    height: number;
  } = $props();

  const colorScale = $derived({ type: "ordinal" as const, scheme });
  /** void/map/solid: light ink on the dark docs shell so marks stay readable. */
  const themeRoles = $derived(
    marksOnlyThemeRoles(name, docsAppearance.current),
  );
</script>

{#if kind === "temps-line"}
  <TemperaturesSpecimen
    theme={name}
    {scheme}
    {height}
    {legendFocus}
    ariaLabel={`${label} theme Playfair multi-series`}
  />
{:else if kind === "ridership-line"}
  <GGPlot
    data={ridership}
    aes={{ x: "month", y: "riders", color: "mode" }}
    {height}
    ariaLabel={`${label} theme Playfair wheat and wages`}
  >
    <GeomLine linewidth={2} />
    <GeomPoint size={2.8} />
    <Scale value={{ color: colorScale }} />
    <Theme {name} {...themeRoles} />
    {#if legendFocus}
      <GuideLegend channel="color" focus />
    {/if}
    <Labs
      title="Wheat price and a mechanic's weekly wage"
      subtitle="One quarter of wheat (~8 bushels) vs a week's pay — both in shillings"
      x="Year"
      y="Shillings"
      color="Series"
    />
    <Inspect mode="x" />
  </GGPlot>
{:else if kind === "attendees-dodge"}
  <GGPlot
    data={attendees}
    aes={{ x: "track", fill: "level", weight: "deaths" }}
    {height}
    ariaLabel={`${label} theme Edgeworth dodged bars`}
  >
    <GeomBar position="dodge" />
    <Scale value={{ fill: colorScale }} />
    <Theme {name} {...themeRoles} />
    {#if legendFocus}
      <GuideLegend channel="fill" focus />
    {/if}
    <Labs
      title="Edgeworth county deaths, 1876–82"
      x="Year"
      y="Deaths per million"
      fill="County"
    />
    <Inspect mode="exact" />
  </GGPlot>
{:else if kind === "generation-area"}
  <GGPlot
    data={generation}
    aes={{ x: "year", y: "twh", fill: "source" }}
    {height}
    ariaLabel={`${label} theme Nightingale stacked area`}
  >
    <GeomArea alpha={0.9} />
    <!-- Month observations as ISO dates; ScaleXDate keeps axis/tooltip as calendar
      units (e.g. Dec 1855), never linear fractional years (1855.9). -->
    <ScaleXDate labels="%b %Y" />
    <Scale value={{ fill: colorScale }} />
    <Theme {name} {...themeRoles} />
    {#if legendFocus}
      <GuideLegend channel="fill" focus />
    {/if}
    <Labs
      title="Crimean deaths by cause, 1854–56"
      x="Month"
      y="Deaths per 1,000 per year"
      fill="Cause"
    />
    <Inspect mode="x" />
  </GGPlot>
{:else if kind === "long-run-line"}
  <GGPlot
    data={longRunSeries}
    aes={{ x: "year", y: "value" }}
    {height}
    ariaLabel={`${label} theme Bowley exports`}
  >
    <GeomLine linewidth={1.5} />
    <Theme {name} {...themeRoles} />
    {#if legendFocus}
      <GuideLegend channel="color" focus />
    {/if}
    <Labs title="British exports, 1855–1899" x="Year" y="£ millions" />
    <Inspect mode="x" />
  </GGPlot>
{:else if kind === "penguins-scatter"}
  <GGPlot
    data={penguins}
    aes={{ x: "flipper", y: "mass", color: "species" }}
    {height}
    ariaLabel={`${label} theme penguin scatter`}
  >
    <GeomPoint size={3.5} alpha={0.9} />
    <Scale value={{ color: colorScale }} />
    <Theme {name} {...themeRoles} />
    {#if legendFocus}
      <GuideLegend channel="color" focus />
    {/if}
    <Labs
      title="Penguin flipper length and body mass"
      x="Flipper length (mm)"
      y="Body mass (g)"
      color="Species"
    />
    <Inspect mode="xy" />
  </GGPlot>
{:else if kind === "countries-scatter"}
  <GGPlot
    data={countries}
    aes={{ x: "gdp", y: "lifeExp", color: "region" }}
    {height}
    ariaLabel={`${label} theme cholera density scatter`}
  >
    <GeomPoint size={3.5} />
    <GeomSmooth method="lm" se={false} />
    <Scale
      value={{
        ...scaleXLog10({ labels: "~s" }),
        color: colorScale,
      }}
    />
    <Theme {name} {...themeRoles} />
    {#if legendFocus}
      <GuideLegend channel="color" focus />
    {/if}
    <Labs
      title="Cholera death rate vs density, 1849"
      x="People per acre (log scale)"
      y="Death rate per 10,000"
      color="Water supply"
    />
    <Inspect mode="xy" identity="country" />
  </GGPlot>
{:else if kind === "revenue-cols"}
  <GGPlot
    data={revenue}
    aes={{ x: "quarter", y: "amount" }}
    {height}
    ariaLabel={`${label} theme Salk trial columns`}
  >
    <GeomCol width={0.7} />
    <GeomText aes={{ label: "label" }} dy={-8} size={11} />
    <Theme {name} {...themeRoles} />
    {#if legendFocus}
      <GuideLegend channel="color" focus />
    {/if}
    <Labs
      title="Salk trial paralytic polio rates"
      x="Group"
      y="Cases per 100,000"
    />
    <Inspect mode="exact" />
  </GGPlot>
{:else if kind === "soho-choropleth"}
  <GGPlot
    data={sohoNeighbourhoodDeaths}
    aes={{ map_id: "pump", fill: "deaths" }}
    {height}
    ariaLabel={`${label} theme Soho cholera choropleth`}
  >
    <GeomMap
      map={{ values: sohoPumpNeighbourhoods }}
      mapId="pump"
      linewidth={1.2}
      alpha={0.95}
    />
    <CoordFixed />
    <ScaleFillContinuous scheme="viridis" />
    <Theme {name} {...themeRoles} />
    <Labs
      title="1854 Soho cholera deaths by pump neighbourhood"
      fill="Deaths"
    />
    <Inspect mode="exact" pin identity="pump" />
  </GGPlot>
{:else}
  <GGPlot
    data={cities}
    aes={{ x: "rent", y: "livability" }}
    {height}
    ariaLabel={`${label} theme Langren longitude labels`}
  >
    <GeomPoint size={3} />
    <GeomText aes={{ label: "city" }} dy={-9} size={10} />
    <Scale value={{ x: { labels: ".1f" } }} />
    <Theme {name} {...themeRoles} />
    {#if legendFocus}
      <GuideLegend channel="color" focus />
    {/if}
    <Labs
      title="Van Langren longitude estimates, 1644"
      x="Toledo–Rome longitude (°)"
      y="Estimate rank"
    />
    <Inspect mode="xy" />
  </GGPlot>
{/if}
