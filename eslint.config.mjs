import { defaultConfig } from "@caido/eslint-config";

const forbidImports = (files, group, message) => ({
  files: [files],
  rules: {
    "no-restricted-imports": ["error", { patterns: [{ group, message }] }],
  },
});

/** @type {import('eslint').Linter.Config } */
export default [
  ...defaultConfig(),

  forbidImports(
    "packages/frontend/src/{components,views,composables}/**",
    ["@/stores", "@/stores/*", "@/repositories", "@/repositories/*"],
    "Presentation may not reach into stores or repositories. Local SAML core is allowed; see ARCHITECTURE section 2.",
  ),

  forbidImports(
    "packages/frontend/src/stores/**",
    [
      "@/repositories",
      "@/repositories/*",
      "@/services",
      "@/services/*",
      "@/plugins/sdk",
      "@/core",
      "@/core/*",
    ],
    "Stores hold reactive state only. Backend I/O and orchestration belong in a service.",
  ),

  forbidImports(
    "packages/frontend/src/core/**",
    ["vue", "pinia", "@/plugins/sdk", "@/stores", "@/services"],
    "core/ is host-agnostic. No Vue, no Pinia, no SDK, no stores or services.",
  ),
];
