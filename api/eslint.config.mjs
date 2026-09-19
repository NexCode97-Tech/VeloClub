import security from 'eslint-plugin-security';
import tsParser from '@typescript-eslint/parser';

// Sin el parser de TypeScript, ESLint lee estos archivos con el parser de
// JavaScript: un `interface` o un `as` bastan para que el archivo entero falle
// con «Parsing error» y ninguna regla de seguridad llegue a correr. El plugin
// quedaba instalado pero sin revisar una sola línea.
export default [
  security.configs.recommended,
  {
    ignores: ['dist/**', 'coverage/**', 'prisma/migrations/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: { security },
    rules: {
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-child-process': 'warn',
    },
  },
];
