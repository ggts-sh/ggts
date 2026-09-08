import { SVELTE_QUICKSTART_SOURCE } from "./agent-quickstart";
import { QUICKSTART_PAGE_FILENAME, QUICKSTART_PAGE_SVELTE } from "./quickstart.js";

export type CodeClassification = "complete" | "fragment";

export interface GuideCodeBlock {
  language: string;
  classification?: CodeClassification;
  source: string;
}

export const COMPLETE_SVELTE_SNIPPETS = [
  { filename: "src/lib/SandboxChart.svelte", source: SVELTE_QUICKSTART_SOURCE },
  { filename: QUICKSTART_PAGE_FILENAME, source: QUICKSTART_PAGE_SVELTE },
] as const;

const completeSvelteSources = new Set<string>(
  COMPLETE_SVELTE_SNIPPETS.map((entry) => entry.source),
);

export function codeBlocks(markdown: string): GuideCodeBlock[] {
  const lines = markdown.split("\n");
  const blocks: GuideCodeBlock[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (!line.startsWith("```")) continue;
    const [language = "", ...flags] = line.slice(3).trim().split(/\s+/);
    const source: string[] = [];
    index++;
    while (index < lines.length && !lines[index]!.startsWith("```")) {
      source.push(lines[index]!);
      index++;
    }
    const classifications = flags.filter(
      (flag): flag is CodeClassification => flag === "complete" || flag === "fragment",
    );
    blocks.push({
      language,
      ...(classifications.length === 1 && { classification: classifications[0] }),
      source: source.join("\n"),
    });
  }
  return blocks;
}

export function assertGuideCodeContract(markdown: string, sourceName: string): void {
  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (!line.startsWith("```")) continue;
    const [language = "", ...flags] = line.slice(3).trim().split(/\s+/);
    const classifications = flags.filter(
      (flag): flag is CodeClassification => flag === "complete" || flag === "fragment",
    );
    if (classifications.length === 0) {
      throw new Error(`${sourceName}: every code fence must be complete or fragment`);
    }
    if (classifications.length !== 1) {
      throw new Error(`${sourceName}: every code fence must have exactly one classification`);
    }

    const source: string[] = [];
    index++;
    while (index < lines.length && !lines[index]!.startsWith("```")) {
      source.push(lines[index]!);
      index++;
    }
    if (
      language === "svelte" &&
      classifications[0] === "complete" &&
      !completeSvelteSources.has(source.join("\n"))
    ) {
      throw new Error(
        `${sourceName}: complete Svelte block is absent from packed snippet registry`,
      );
    }
  }
}
