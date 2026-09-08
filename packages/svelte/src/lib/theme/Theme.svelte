<script lang="ts">
  /**
   * <Theme> — declaration-only theme layer for <GGPlot> (#659).
   * Generic escape hatch: pass `name` and/or role overrides. Named shells
   * (<ThemeDark/>, …) are preferred when the base theme is known at authoring
   * time; use this form for reactive/dynamic names
   * (`<Theme name={currentTheme}/>`).
   *
   * Emits NO markup; registers a live theme layer during component init and
   * unregisters on destroy. Inert without a <GGPlot> ancestor.
   *
   * Canonical PortableSpec form: no role overrides → ThemeName string; any
   * role override → ThemeSpec object with only defined keys.
   */
  import type { ThemeName, ThemeSpec } from "@ggts-sh/spec";

  import { createThemeLayer, type ThemeRoleKey } from "./factory.svelte.js";

  type Props = {
    name?: ThemeName;
  } & {
    [K in ThemeRoleKey]?: ThemeSpec[K];
  };

  const props: Props = $props();
  createThemeLayer(() => props);
</script>
