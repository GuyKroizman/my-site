# Cloudflare Pages

This project uses **npm**. Cloudflare detects `package-lock.json` and automatically uses `npm ci` for installs.

**No custom install or build commands are required.** Use the defaults:

- **Install command:** (default) `npm ci` (auto-detected from `package-lock.json`)
- **Build command:** (default) `npm run build`

Floaty McHandface loads A-Frame and the physics system from CDN at runtime, so no npm packages are needed for the VR game and the build runs without the previous patch-package workaround.
