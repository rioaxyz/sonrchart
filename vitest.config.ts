import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // The KLine draw callbacks (indicators.ts) paint to a real canvas, which
      // jsdom can't exercise — they're covered by the demo/e2e path, not units.
      exclude: ["src/index.ts"],
    },
  },
});
