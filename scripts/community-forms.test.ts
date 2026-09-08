import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const root = join(import.meta.dir, "..");
const issueDirectory = join(root, ".github", "ISSUE_TEMPLATE");
const discussionDirectory = join(root, ".github", "DISCUSSION_TEMPLATE");

interface FormField {
  type?: string;
  id?: string;
  attributes?: Record<string, unknown>;
  validations?: { required?: boolean };
}

interface Form {
  name?: string;
  description?: string;
  title?: string;
  body?: FormField[];
}

function parseYaml(path: string): Record<string, unknown> {
  return Bun.YAML.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function formFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".yml"))
    .map((name) => join(directory, name));
}

function validateForm(path: string, issue: boolean): void {
  const form = parseYaml(path) as Form;
  if (issue) {
    expect(form.name, path).toBeString();
    expect(form.description, path).toBeString();
  }
  expect(form.title, path).toBeString();
  expect(form.body, path).toBeArray();
  expect(form.body!.length, path).toBeGreaterThan(2);

  const ids = form.body!.flatMap((field) => (field.id === undefined ? [] : [field.id]));
  expect(new Set(ids).size, `${path} has duplicate field ids`).toBe(ids.length);
  for (const field of form.body!) {
    // `type` is optional on FormField because the YAML may omit it; GitHub
    // rejects such a form outright, so say that here rather than letting
    // toContain(undefined) report it as an unrecognised type.
    const { type } = field;
    if (type === undefined) throw new Error(`${path}: form field is missing "type"`);
    expect(["markdown", "textarea", "input", "dropdown", "checkboxes"], path).toContain(type);
    expect(field.attributes, path).toBeObject();
    if (field.type !== "markdown") expect(field.id, path).toMatch(/^[a-z0-9_-]+$/);
    if (field.type === "dropdown") {
      expect(field.attributes?.["options"], path).toBeArray();
    }
  }
}

describe("GitHub community forms", () => {
  test("parses and validates every issue and Discussion form", () => {
    const issueFiles = formFiles(issueDirectory).filter((path) => basename(path) !== "config.yml");
    expect(issueFiles.map((path) => basename(path)).toSorted()).toEqual([
      "bug.yml",
      "documentation.yml",
      "feature.yml",
      "interaction-accessibility.yml",
    ]);
    for (const path of issueFiles) validateForm(path, true);

    const discussionFiles = formFiles(discussionDirectory);
    expect(discussionFiles.map((path) => basename(path)).toSorted()).toEqual([
      "ideas.yml",
      "q-a.yml",
      "show-and-tell.yml",
    ]);
    for (const path of discussionFiles) validateForm(path, false);
  });

  test("routes questions, examples, proposals, and security without blank issues", () => {
    const config = parseYaml(join(issueDirectory, "config.yml"));
    expect(config["blank_issues_enabled"]).toBe(false);
    const links = config["contact_links"] as { name: string; url: string }[];
    const urls = links.map((link) => link.url);
    expect(urls).toContain("https://github.com/ggts-sh/ggts/discussions/categories/q-a");
    expect(urls).toContain("https://github.com/ggts-sh/ggts/discussions/categories/show-and-tell");
    expect(urls).toContain("https://github.com/ggts-sh/ggts/discussions/categories/ideas");
    expect(urls).toContain("https://github.com/ggts-sh/ggts/security/policy");
  });

  test("collects the interaction and accessibility reproduction contract", () => {
    const form = parseYaml(join(issueDirectory, "interaction-accessibility.yml")) as Form;
    const ids = new Set(form.body?.map((field) => field.id));
    for (const id of [
      "capability",
      "input_modalities",
      "assistive_technology",
      "reproduction",
      "journey",
      "expected_semantics",
      "actual_behavior",
      "renderer",
      "versions",
    ]) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
  });

  test("distinguishes presentation requests from semantic interaction changes", () => {
    const form = parseYaml(join(issueDirectory, "feature.yml")) as Form;
    const kind = form.body?.find((field) => field.id === "request_kind");
    const options = kind?.attributes?.["options"] as string[];
    expect(options.some((option) => option.startsWith("Presentation"))).toBe(true);
    expect(options.some((option) => option.startsWith("Semantic interaction"))).toBe(true);
    expect(form.body?.some((field) => field.id === "semantics")).toBe(true);
    expect(form.body?.some((field) => field.id === "portability")).toBe(true);
  });
});
