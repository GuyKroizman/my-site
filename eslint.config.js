import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'scripts', 'fix-ts-errors.js'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // The React Compiler rules shipped with eslint-plugin-react-hooks v7
      // (set-state-in-effect, refs, preserve-manual-memoization, ...) flag
      // deliberate patterns in the Phaser game loops. Keep the classic
      // behaviour of the old `plugin:react-hooks/recommended` config for now.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
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
  },
)
