#!/usr/bin/env node
/**
 * Makes ammo-debug-drawer findable for @c-frame/aframe-physics-system's postinstall.
 * When patch-package runs inside that package, it looks for
 * node_modules/ammo-debug-drawer relative to that package (i.e.
 * .../aframe-physics-system/node_modules/ammo-debug-drawer). Yarn hoists it to
 * the repo root, so we create a symlink in the physics package's node_modules.
 */
const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const physicsPkg = path.join(repoRoot, 'node_modules', '@c-frame', 'aframe-physics-system')
const targetDir = path.join(physicsPkg, 'node_modules')
const linkPath = path.join(targetDir, 'ammo-debug-drawer')
const sourcePath = path.join(repoRoot, 'node_modules', 'ammo-debug-drawer')

if (!fs.existsSync(sourcePath)) {
  console.warn('fix-ammo-debug-drawer: ammo-debug-drawer not in root node_modules, skipping')
  process.exit(0)
}

if (!fs.existsSync(physicsPkg)) {
  console.warn('fix-ammo-debug-drawer: @c-frame/aframe-physics-system not found, skipping')
  process.exit(0)
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

// Symlink target: from .../aframe-physics-system/node_modules/ammo-debug-drawer
// to repo root node_modules/ammo-debug-drawer = ../../../ammo-debug-drawer
const relativeSource = path.relative(targetDir, sourcePath)

if (fs.existsSync(linkPath)) {
  const stat = fs.lstatSync(linkPath)
  if (stat.isSymbolicLink()) process.exit(0)
  fs.rmSync(linkPath, { recursive: true })
}

fs.symlinkSync(relativeSource, linkPath)
console.log('fix-ammo-debug-drawer: symlink created')
