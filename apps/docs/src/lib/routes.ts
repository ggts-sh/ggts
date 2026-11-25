import { DOCS_ROUTES } from "./generated/routes.js";
import type { DocsRouteMetadata } from "./route-types.js";

// Re-export the thin client surface so server tests and scripts can keep one
// import path. Client chrome must import from `$lib/routes-nav` instead so
// DOCS_ROUTES stays out of the layout graph.
export {
  GUIDE_NAVIGATION,
  primaryNavigationOwner,
  type PrimaryNavigationOwner,
} from "./routes-nav.js";
export { DOCS_ROUTES };

const ROUTES: readonly DocsRouteMetadata[] = DOCS_ROUTES;
const ROUTES_BY_PATH = new Map<string, DocsRouteMetadata>(
  ROUTES.map((route) => [route.path, route]),
);
const GUIDES = ROUTES.filter((route) => route.navigation !== undefined).toSorted(
  (a, b) => (a.navigation?.order ?? 0) - (b.navigation?.order ?? 0),
);
const GUIDE_INDEX_BY_PATH = new Map<string, number>(
  GUIDES.map((route, index) => [route.path, index]),
);

export function routePath(pathname: string, base: string): string {
  const hasBaseBoundary = base !== "" && (pathname === base || pathname.startsWith(`${base}/`));
  const withoutBase = hasBaseBoundary ? pathname.slice(base.length) : pathname;
  const path = withoutBase === "" ? "/" : withoutBase;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function findDocsRoute(path: string): DocsRouteMetadata | undefined {
  return ROUTES_BY_PATH.get(path);
}

export function canonicalUrl(route: DocsRouteMetadata, canonicalBase: string): string {
  return `${canonicalBase.replace(/\/$/, "")}${route.canonicalPath}`;
}

export function sitemapRoutes(): DocsRouteMetadata[] {
  return ROUTES.filter((route) => route.sitemap);
}

export function guideSequence(path: string): {
  previous?: DocsRouteMetadata;
  next?: DocsRouteMetadata;
} {
  const index = GUIDE_INDEX_BY_PATH.get(path);
  if (index === undefined) return {};
  const previous = GUIDES[index - 1];
  const next = GUIDES[index + 1];
  return {
    ...(previous !== undefined && { previous }),
    ...(next !== undefined && { next }),
  };
}
