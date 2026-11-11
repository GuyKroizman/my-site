# My Site

A personal website

## Technology Stack

- **React** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Phaser** for game development
- **React Router** for navigation

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Yoga Session Builder

**Still** is available at `/yoga` and from the home menu. Build breath-based yoga
flows, save routines locally, and practice with a visual pacer and transition
chimes. See [the yoga feature guide](src/features/yoga/README.md) for usage
and storage details.

## Fonts

All fonts are self-hosted from npm (`@fontsource/*`) and bundled by Vite — the
site makes no requests to `fonts.googleapis.com` or `fonts.gstatic.com`.

| Family | Used by | Weights bundled | License |
| --- | --- | --- | --- |
| Caveat | notebook / site body | 400, 600, 700 (latin) | SIL OFL 1.1 |
| Press Start 2P | Rogue0 pixel UI | 400 (latin) | SIL OFL 1.1 |
| VT323 | Rogue0 body text, HUD | 400 (latin) | SIL OFL 1.1 |

All three are licensed under the **SIL Open Font License 1.1**, which permits
use, embedding and redistribution (including as part of a public website). The
conditions we meet:

- the copyright + license notice ships with the fonts — see
  `public/fonts/LICENSE-caveat.txt`, `LICENSE-vt323.txt` and
  `LICENSE-press-start-2p.txt` (copied verbatim from each package and served at
  `/fonts/…` in the built site);
- the fonts are bundled unmodified, so the "Press Start 2P" Reserved Font Name
  stays valid;
- the fonts are not sold on their own.

Changing weights or subsets is a one-line edit in `src/main.tsx` (the
`@fontsource/...` imports).

## Loading screens

Every route is a lazy chunk. `src/main.tsx` wraps each one in its own
`<Suspense>` with a themed fallback from `src/components/LoadingScreen.tsx`
(styled in `src/loading.css`), so a slow chunk shows the look of the page that
is coming instead of a generic white spinner. `index.html` has a small inline
notebook-style boot panel for the moment before the JS bundle mounts; React
replaces it on first render.

To add a page: add a variant to `LoadingVariant` + `LOADERS`, then wrap its
route with `withLoader('your-variant', <YourPage />)`.

## Deployment

1. Build command: `npm run build`
2. Build output directory: `dist`
3. The `public/_redirects` file handles client-side routing
