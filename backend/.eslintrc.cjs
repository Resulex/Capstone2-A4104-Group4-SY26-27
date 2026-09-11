/**
 * ESLint config for the serverless backend.
 *
 * Why this file exists: the `lint` npm script lints every TypeScript file
 * under src and CI gates on it, but no config was ever committed. ESLint 8
 * exits non-zero when it cannot find one, so the gate could not run at all.
 *
 * The rules are deliberately close to the defaults so the gate reflects the
 * code that is actually here rather than a wholesale reformat.
 */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: [
    'node_modules/',
    '.build/',
    '.esbuild/',
    '.serverless/',
    'dist/',
  ],
  rules: {
    // Handler signatures receive an unused AWS `Context`; the codebase marks
    // them `_context` by convention.
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    // Mongoose documents and the native `mongodb` driver hand back loose types
    // in migrations; allow explicit `any` but keep the warning visible.
    '@typescript-eslint/no-explicit-any': 'warn',
    // `require` is used deliberately in migrate.ts / seed scripts.
    '@typescript-eslint/no-var-requires': 'warn',
  },
};
