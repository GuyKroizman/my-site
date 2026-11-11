# Test reporting

- During Rogue0 development, use focused runs such as `npm run test:rogue0 -- movement vision`. Run `npm run test:rogue0` before completing a change. `--list` lists available suites without running them. Each suite automatically appends its result to `logs/rogue0-tests.jsonl`, including failures. Do not delete or rewrite this history to hide failures.
- In your completion report, mention test failures encountered during the work, what caused them, and whether they were fixed—not just the final passing result. Distinguish actual game bugs from incorrect tests or environment problems.
- Use `npm run test:rogue0:history` when the user asks about test usefulness or past failures (`-- --summary` for a compact report). Counts are suite executions, not unique bugs.
- After diagnosing a failure, append its cause/resolution with `npm run test:rogue0:history -- classify <failure-id> <category> "cause and resolution"`. Categories: `game-bug`, `test-bug`, `environment`, `intended-change`, `unknown`. Record evidence and what was fixed; do not guess historical causes from exception types or mark a failure resolved just because a later run passed. Annotations are separate from original results and can be corrected by appending another annotation.
- For deliberate failures used to verify tests or logging, set `ROGUE0_TEST_PURPOSE=verification` (or `mutation`) so they do not inflate normal development failure counts. Do not use these labels for ordinary development failures.
- History is local and git-ignored. It begins when logging was added; it is not a record of earlier runs. The runner records process-startup/import/syntax failures and whole-batch wall time in `logs/rogue0-test-batches.jsonl`. Direct `node` runs and older npm shortcuts still use in-process logging, which excludes static imports and cannot record failures before initialization. Killing the runner itself or bypassing these scripts can leave unrecorded results. Do not compare these timing scopes as if they were equivalent.

# Dependency notes

- **Phaser 4 dropped WebGL `setMask`.** `GameObject.setMask` silently does
  nothing in WebGL now (it warns once) and the object draws unclipped. That is
  how the chasm's parallax floor ended up covering the whole dungeon. For text
  and panels use `setCrop`, which works in both renderers; the chasm deep layer
  uses one small TileSprite per chasm cell instead of a masked full-map layer.
  `filters.internal.addMask()` exists but renders an untransformed mask to its
  own texture, so screen-space UI masks are not a drop-in replacement.
- **Do not upgrade to TypeScript 7 yet.** `typescript@7` is the native port and
  exports only `version`/`versionMajorMinor` — no compiler API. That breaks two
  things here: `typescript-eslint` refuses to load (`does not support TS 7.0`)
  and `scripts/lib/rogue0-logic-loader.mjs` cannot transpile (it needs
  `createSourceFile`/`transpileModule`), which fails every suite. `tsc` itself
  type-checks the project cleanly, so the only blocker is tooling: wait for
  typescript-eslint support, and swap the test loader to a transpiler that does
  not need the TS API (esbuild, or `module.stripTypeScriptTypes` plus manual
  CommonJS export mapping).
- **`src/phaserGlobal.ts` exists on purpose.** Phaser 3's bundle installed
  `globalThis.Phaser`; Phaser 4 does not, and ~33 game modules use `Phaser.*` as
  an implicit global (the node fixtures rely on it too, because they transpile
  imports away). It must stay imported first in `src/main.tsx`. Giving those
  files explicit `import * as Phaser from 'phaser'` instead crashes node: the
  package touches `window` at import time, and static-import hooks cannot be
  registered in-process. Removing the shim needs a phaser stub preloaded via
  `--import` in every test entry point first.
- **Tailwind v4 has no `tailwind.config.js`.** Configuration lives in CSS
  (`@import 'tailwindcss'` in `src/index.css`) and PostCSS uses
  `@tailwindcss/postcss`. Do not re-run `@tailwindcss/upgrade` blindly: it
  rewrote game logic (`'ring'` equip slot → `'ring-3'`, palette keys
  `outline`/`shadow`, a cannon-es `shadow` attribute) because it treats those
  strings as Tailwind classes.
- **`package.json` overrides `minimatch` to `^11.0.8`.** ESLint 10 asks for
  `^10.2.x`, which is inside GHSA-g3hv-75wg-m249. Keep the override until
  eslint depends on a patched version, and re-check that `npm run lint` still
  walks the same file set afterwards.
- **react-hooks v7's React Compiler rules are off** in `eslint.config.js`
  (`set-state-in-effect`, `refs`, `preserve-manual-memoization`); they flag
  deliberate Phaser effect/ref patterns. Enabling them is a refactor, not a
  dependency bump.
