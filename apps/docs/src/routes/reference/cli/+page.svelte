<script lang="ts">
  import { base } from "$app/paths";

  import CopyCode from "$lib/components/CopyCode.svelte";

  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();
</script>

<article class="cli-reference prose" aria-labelledby="cli-heading">
  <h1 id="cli-heading">Command-line reference</h1>
  <p>
    <code>ggts render</code> reads PortableSpec JSON and writes deterministic
    SVG. <code>ggts check</code> runs the same validation and rendering checks
    with no SVG output. Its option list below comes from the same
    package-private registry as argument parsing and
    <code>--help</code>.
  </p>

  <h2 id="install">Install</h2>
  <p>
    The CLI ships as its own package, <code>@ggts-sh/cli</code> — it does not
    arrive with <code>@ggts-sh/svelte</code>. If an agent authors specs in a
    sandbox, install the CLI in that sandbox: it is how the agent sees
    validation errors and chart-quality warnings before a chart ships.
  </p>
  <CopyCode
    class="cli-command"
    language="bash"
    accessibleLabel="Copy command"
    code="npm install -g @ggts-sh/cli"
  />

  <h2 id="input-and-output">Input and output</h2>
  <p>
    Pass one JSON file or omit it to read stdin. SVG is the only stdout output.
  </p>
  <CopyCode
    class="cli-command"
    language="bash"
    accessibleLabel="Copy command"
    code="ggts render spec.json > chart.svg 2> diagnostics.jsonl"
  />
  <p>Errors, warnings, and advisories are JSON Lines on stderr.</p>

  <h2 id="options">Options</h2>
  <dl class="cli-options">
    {#each data.options as option (option.flag)}
      <div>
        <dt id={option.anchor}>
          <code
            >{option.flag}{option.value === "" ? "" : ` ${option.value}`}</code
          >
        </dt>
        <dd>
          <p>{option.description}.</p>
          {#if option.aliases.length > 0}
            <p>Alias: <code>{option.aliases.join(", ")}</code>.</p>
          {/if}
          {#if option.detail !== undefined}
            <p><code>{option.detail}</code></p>
          {/if}
        </dd>
      </div>
    {/each}
  </dl>

  <h2 id="exit-codes">Exit codes</h2>
  <dl class="exit-codes">
    <div>
      <dt>0</dt>
      <dd>Checked or rendered successfully.</dd>
    </div>
    <div>
      <dt>1</dt>
      <dd>The pipeline or renderer failed after structural validation.</dd>
    </div>
    <div>
      <dt>2</dt>
      <dd>Usage, input, file, or JSON parsing failed.</dd>
    </div>
    <div>
      <dt>3</dt>
      <dd>The PortableSpec failed validation.</dd>
    </div>
  </dl>

  <h2 id="troubleshooting">Troubleshooting</h2>
  <p>
    Keep stdout and stderr separate. Search the source-qualified code in the
    <a href={`${base}/guide/errors#cli-diagnostics-ggts`}>Errors reference</a>,
    correct the input, and rerun the same command.
  </p>
</article>

<style>
  .cli-options,
  .exit-codes {
    margin: 1.5rem 0;
  }

  .cli-options > div,
  .exit-codes > div {
    display: grid;
    grid-template-columns: minmax(8rem, 0.35fr) minmax(0, 1fr);
    padding: 1rem 0;
    border-top: 1px solid var(--line);
    gap: 1rem;
  }

  .cli-options > div:last-child,
  .exit-codes > div:last-child {
    border-bottom: 1px solid var(--line);
  }

  dt,
  dd,
  dd p {
    margin: 0;
  }

  dd p + p {
    margin-top: 0.5rem;
  }

  .cli-reference :global(.cli-command code) {
    white-space: pre;
  }

  @media (max-width: 40rem) {
    .cli-options > div,
    .exit-codes > div {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }
</style>
