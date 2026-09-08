<script lang="ts">
  import "../app.css";

  import DocsShell from "$lib/components/DocsShell.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";

  import type { LayoutProps } from "./$types";

  const { data, children }: LayoutProps = $props();
  const noindex = $derived(
    !data.site.indexable || data.route === undefined || !data.route.index,
  );
</script>

<svelte:head>
  <title>{data.route?.title ?? "ggts"}</title>
  {#if data.route !== undefined}
    <meta name="description" content={data.route.description} />
  {/if}
  {#if data.canonical !== undefined}
    <link rel="canonical" href={data.canonical} />
  {/if}
  {#if data.seo !== undefined}
    <meta property="og:site_name" content="ggts" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={data.seo.title} />
    <meta property="og:description" content={data.seo.description} />
    <meta property="og:url" content={data.seo.canonical} />
    <meta property="og:image" content={data.seo.image.url} />
    <meta property="og:image:width" content={String(data.seo.image.width)} />
    <meta property="og:image:height" content={String(data.seo.image.height)} />
    <meta property="og:image:alt" content={data.seo.image.alt} />
    <meta name="twitter:card" content={data.seo.twitterCard} />
    <meta name="twitter:title" content={data.seo.title} />
    <meta name="twitter:description" content={data.seo.description} />
    <meta name="twitter:image" content={data.seo.image.url} />
    <meta name="twitter:image:alt" content={data.seo.image.alt} />
    {#if data.seo.structuredDataScript !== ""}
      {@html data.seo.structuredDataScript}
    {/if}
  {/if}
  {#if noindex}
    <meta name="robots" content="noindex,follow" />
  {/if}
  {#if data.site.analytics && data.site.analyticsToken !== null}
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({
        token: data.site.analyticsToken,
        spa: true,
      })}
    ></script>
  {/if}
</svelte:head>

<a class="skip-link" href="#main-content">Skip to content</a>
<SiteHeader path={data.path} route={data.route} />

<main
  id="main-content"
  class:docs-main={data.route?.shell === "docs"}
  class="site-main"
  data-build-mode={data.site.mode}
>
  {#if data.route?.shell === "docs"}
    <DocsShell
      route={data.route}
      path={data.path}
      previous={data.sequence.previous}
      next={data.sequence.next}
    >
      {@render children()}
    </DocsShell>
  {:else}
    {@render children()}
  {/if}
</main>

<SiteFooter />
