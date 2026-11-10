import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent skills copied from other repositories (e.g. .claude/skills/unslop); kept as published.
    ".claude/**",
    // Map assets: MapLibre's worker (copied from node_modules), tiles and fonts.
    "public/basemap/**",
  ]),
]);

export default eslintConfig;
