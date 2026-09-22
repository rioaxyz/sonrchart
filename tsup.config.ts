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
  // klinecharts references process.env.NODE_ENV, which is undefined in a browser
  // (WKWebView, etc.) and throws "Can't find variable: process". Replace it with
  // a literal at build time so the shipped bundle has no bare `process` lookup.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
