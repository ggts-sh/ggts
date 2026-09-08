/**
 * bun test preload (bunfig.toml): core unit tests import modules without going
 * through a registering entry; install the full grammar + Temporal so
 * ColumnTable/pipeline tests see the complete runtime. Kept out of src so the
 * lean `@ggts-sh/core/render` graph never evaluates it.
 */
import { installCandidates } from "../src/install-candidates.ts";
import { registerAll } from "../src/register.ts";

registerAll();
installCandidates();
