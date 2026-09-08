<script lang="ts">
  import type {
    BatchInteractionMask,
    GeometryBatch,
    ThemeTokens,
  } from "@ggts-sh/core";

  import Batch from "../../src/lib/scene/Batch.svelte";

  const {
    batch,
    theme,
    focusMask = null,
    focusable = false,
    markLabel,
  }: {
    batch: GeometryBatch;
    theme: ThemeTokens;
    focusMask?: BatchInteractionMask | null;
    focusable?: boolean;
    markLabel?: (row: number) => string;
  } = $props();
</script>

<svg width="100" height="100">
  <Batch {batch} {theme} {focusMask} {focusable} {markLabel} />
</svg>
