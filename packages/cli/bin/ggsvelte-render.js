#!/usr/bin/env node
// Legacy command forwards to the same implementation.
process.argv.splice(2, 0, "render");
await import("./ggts.js");
