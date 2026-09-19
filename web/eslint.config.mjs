import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Desde Next 16 el plugin viene en formato plano y ya no pasa por FlatCompat.
// El equivalente de "next/core-web-vitals" y "next/typescript" son estos dos
// paquetes, que se esparcen directo.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Next 16 trae las reglas nuevas del compilador de React y las pone como
    // error. No son fallas: marcan patrones que funcionan pero que el
    // compilador no puede memorizar solo. Son 72 en la plataforma, la mayoria
    // `setState` dentro de un `useEffect`, y arreglarlas es repasar media
    // aplicacion. Quedan como aviso para poder verlas sin que tumben el build,
    // y se van limpiando pantalla por pantalla, como los iconos.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  // Los que ignora el propio eslint-config-next, mas los generados por la PWA.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/sw.js",
    "public/workbox-*.js",
    "public/fallback-*.js",
  ]),
]);

export default eslintConfig;
