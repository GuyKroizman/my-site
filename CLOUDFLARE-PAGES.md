# Cloudflare Pages

This project uses **Yarn 4**. Cloudflare detects it from `package.json`'s `packageManager` and uses Yarn 4.0.2.

**No custom install or build commands are required.** Use the defaults:

- **Install command:** (default) `yarn` or `yarn install`
- **Build command:** (default) `yarn build`

Floaty McHandface loads A-Frame and the physics system from CDN at runtime, so no npm packages are needed for the VR game and the build runs without the previous patch-package workaround.
