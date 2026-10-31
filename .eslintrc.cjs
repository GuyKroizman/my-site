module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    // Project conventions: Phaser/three APIs and the save codec intentionally
    // work with dynamic shapes, and some files rely on targeted
    // @ts-ignore/@ts-expect-error comments.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/prefer-as-const': 'off',
    '@typescript-eslint/no-namespace': 'off',
    // Pages mix component and non-component exports, so the Fast Refresh
    // export rule is not actionable here.
    'react-refresh/only-export-components': 'off',
    // Underscore-prefixed identifiers mark intentionally unused params/vars.
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
    // Game loops are commonly written as `while (true)` with an internal break.
    'no-constant-condition': ['error', { checkLoops: false }],
  },
}
