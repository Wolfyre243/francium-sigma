import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import { remixDevTools } from "remix-development-tools";

export default defineConfig({
  plugins: [remixDevTools(), remix()],
  resolve: {
    alias: {
      "@": "./",
      "@components": "./app/components/",
    }
  }
});