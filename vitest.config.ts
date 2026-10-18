import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

// Two projects: node environment by default, jsdom for tests/components.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/components/**"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/setup-components.ts"],
        },
      },
    ],
  },
});
