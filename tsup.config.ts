import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom"],
  // klinecharts is bundled in so consumers get a single dependency to install.
  noExternal: ["klinecharts"],
});
