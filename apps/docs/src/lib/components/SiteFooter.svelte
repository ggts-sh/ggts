<script lang="ts">
  import { base } from "$app/paths";
</script>

<footer class="site-footer site-chrome">
  <div class="site-footer__inner">
    <div>
      <a class="site-brand" href={`${base}/`}>ggts</a>
      <p>
        ggts is a fast agent-native implementation of the layered grammar of
        graphics, inspired by ggplot2
      </p>
    </div>
    <nav aria-label="Footer">
      <a href={`${base}/docs`}>Docs</a>
      <a href={`${base}/examples`}>Gallery</a>
      <a href={`${base}/themes`}>Themes</a>
      <a href={`${base}/palettes`}>Palettes</a>
      <a href={`${base}/reference`}>Reference</a>
      <a href={`${base}/schema/v0.json`}>JSON Schema</a>
      <a href="https://github.com/ggts-sh/ggts" rel="external">GitHub ↗</a>
    </nav>
  </div>
</footer>
