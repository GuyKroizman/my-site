// Compatibility shim for the `Phaser` global.
//
// Phaser 3's webpack bundle installed itself as `globalThis.Phaser`, and a large
// part of the game code relies on that implicit global (typing comes from
// Phaser's `export as namespace Phaser` declaration). Phaser 4 no longer
// publishes the global, so the app entry installs it explicitly.
//
// The node test fixtures in scripts/ depend on this too: they transpile the
// imports away and evaluate modules with `new Function`, which only resolves
// `Phaser` from the global scope or an injected binding.
//
// TODO: drop this shim by giving every file that uses Phaser as a value its own
// `import * as Phaser from 'phaser'` (33 files) and teaching the test loader to
// stub the module, since phaser cannot be imported under node (it needs window).
import Phaser from 'phaser'

;(globalThis as typeof globalThis & { Phaser?: typeof Phaser }).Phaser = Phaser

export {}
