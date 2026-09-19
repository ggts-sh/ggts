import { join } from "node:path";

import react from "@vitejs/plugin-react";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const dir = import.meta.dirname;

export default defineConfig({
  root: dir,
  plugins: [svelte(), react()],
  server: {
    host: "127.0.0.1",
    port: 4177,
    strictPort: true,
    fs: { allow: [join(dir, "../..")] },
  },
});
