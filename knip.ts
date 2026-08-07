import type { RawConfigurationOrFn } from "knip/dist/types/config.js";

const config: RawConfigurationOrFn = {
  workspaces: {
    ".": {
      entry: ["caido.config.ts", "scripts/*.mjs"],
      ignoreBinaries: ["xmllint"],
    },
    "packages/backend": {
      project: ["src/**/*.ts"],
      ignoreBinaries: ["openssl"],
      ignoreDependencies: ["caido"],
    },
    "packages/frontend": {
      entry: ["src/index.ts"],
      project: ["src/**/*.{ts,tsx,vue}"],
    },
    "packages/shared": {
      project: ["src/**/*.ts"],
    },
  },
};

export default config;
