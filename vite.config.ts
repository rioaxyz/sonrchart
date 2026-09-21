import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server for the demo harness (npm run dev). The library itself is built
// with tsup (npm run build); this config only serves demo/.
export default defineConfig({
  root: "demo",
  plugins: [react()],
  server: { port: 5300 },
});
