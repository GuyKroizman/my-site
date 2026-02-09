# Cloudflare Pages build (Yarn 4)

This project uses **Yarn 4** (Berry). In the Cloudflare Pages project **Build configuration**, set:

| Setting | Value |
|--------|--------|
| **Install command** | `yarn install --ignore-scripts` |
| **Build command** | `yarn run build:ci` |

This is required because `@c-frame/aframe-physics-system` runs `patch-package` in its postinstall and expects `ammo-debug-drawer` under its own `node_modules`. With `--ignore-scripts` we skip that postinstall during install; `build:ci` then creates a symlink and runs the patch before building.
