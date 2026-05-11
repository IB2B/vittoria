import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference + dev-only scripts shouldn't be linted with app rules.
    "reference/**",
    "scripts/**",
    // Unused now that the clients page renders cards instead of a table.
    "src/app/(app)/clients/clients-table.tsx",
  ]),
  {
    rules: {
      // React 19's `react-hooks/set-state-in-effect` flags legitimate hydration
      // and external-state-sync patterns (theme toggle, useMobile, action-state
      // toast handlers). We accept these as valid uses; downgrade to warning.
      "react-hooks/set-state-in-effect": "warn",
      // Inline column-cell renderers from TanStack Table don't need display names.
      "react/display-name": "off",
    },
  },
]);

export default eslintConfig;
