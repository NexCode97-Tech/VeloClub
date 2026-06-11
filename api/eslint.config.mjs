import security from 'eslint-plugin-security';

export default [
  security.configs.recommended,
  {
    files: ['src/**/*.ts'],
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
