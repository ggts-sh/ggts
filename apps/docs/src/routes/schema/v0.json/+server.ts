/**
 * /schema/v0.json — the PortableSpec JSON Schema, served from the docs build
 * (plan: "schema served from docs build"). Imports the same committed
 * artifact the @ggts-sh/spec package ships (staleness-tested against a
 * fresh TypeBox build), so the served schema cannot drift from the package.
 */
import schema from "@ggts-sh/spec/schema/v0.json";

export const prerender = true;

export function GET(): Response {
  return new Response(JSON.stringify(schema, null, 2) + "\n", {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
