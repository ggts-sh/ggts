export const DOCS_BUILD_MODES = ["dev", "cloudflare-preview", "cloudflare-production"] as const;

type DocsBuildMode = (typeof DOCS_BUILD_MODES)[number];

export interface DocsBuildConfig {
  mode: DocsBuildMode;
  base: "";
  canonicalBase: "https://ggts.sh";
  indexable: boolean;
  analytics: boolean;
  analyticsToken: string | null;
}

export interface DocsBuildInput {
  mode?: string;
  basePath?: string;
  analyticsToken?: string;
}

const VALID_COMBINATIONS = [
  "dev + no BASE_PATH",
  "cloudflare-preview + no BASE_PATH",
  "cloudflare-production + no BASE_PATH",
].join("; ");

function invalid(input: DocsBuildInput): never {
  const mode = input.mode ?? "(unset)";
  const basePath = input.basePath ?? "(unset)";
  throw new Error(
    `Invalid docs build configuration: DOCS_BUILD_MODE=${mode}, BASE_PATH=${basePath}. Valid combinations: ${VALID_COMBINATIONS}.`,
  );
}

export function resolveDocsBuildConfig(input: DocsBuildInput): DocsBuildConfig {
  const mode = input.mode ?? "dev";
  const basePath = input.basePath;
  const analyticsToken = input.analyticsToken;
  if (analyticsToken !== undefined && mode !== "cloudflare-production") {
    throw new Error("Analytics token is allowed only for cloudflare-production builds.");
  }
  if (analyticsToken !== undefined && !/^[a-f\d]{32}$/i.test(analyticsToken)) {
    throw new Error("DOCS_ANALYTICS_TOKEN must be a 32-character hexadecimal token.");
  }

  if (mode === "dev" && basePath === undefined) {
    return {
      mode,
      base: "",
      canonicalBase: "https://ggts.sh",
      indexable: false,
      analytics: false,
      analyticsToken: null,
    };
  }
  if (mode === "cloudflare-preview" && basePath === undefined) {
    return {
      mode,
      base: "",
      canonicalBase: "https://ggts.sh",
      indexable: false,
      analytics: false,
      analyticsToken: null,
    };
  }
  if (mode === "cloudflare-production" && basePath === undefined) {
    return {
      mode,
      base: "",
      canonicalBase: "https://ggts.sh",
      indexable: true,
      analytics: analyticsToken !== undefined,
      analyticsToken: analyticsToken ?? null,
    };
  }

  return invalid(input);
}
