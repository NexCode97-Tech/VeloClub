import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // Ignorar archivos generados (build de Next, service worker/PWA, tipos autogenerados)
  {
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "public/sw.js",
      "public/workbox-*.js",
      "public/fallback-*.js",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
