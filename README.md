# My Site

A simplified personal website featuring stories and games.

## Features

- **Snake Bitter Story**: A charming Hebrew children's story about Sharga and the snakes
- **Rogue0**: A classic dungeon-crawler game built with Phaser
- **Hoot**: An action-packed shooting game

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

## Deployment

This site is configured for deployment on Cloudflare Pages:

1. Build command: `npm run build`
2. Build output directory: `dist`
3. The `public/_redirects` file handles client-side routing

## Project Structure

```
src/
├── pages/           # Individual pages
│   ├── SnakeBitter.tsx
│   ├── Rogue0.tsx
│   └── Hoot.tsx
├── App.tsx          # Main landing page
├── main.tsx         # Application entry point
└── index.css        # Global styles
```

## Why This Approach?

This simplified architecture offers several advantages over the previous Remix setup:

- **Easier Maintenance**: Standard React patterns, no framework-specific concepts
- **Faster Development**: Vite provides instant hot reloading
- **Simple Deployment**: Static site generation works with any host
- **Clear Structure**: All game logic is self-contained within components
- **No Server Required**: Pure client-side application

## Games

### Rogue0
A dungeon crawler where you explore randomly generated levels, fight monsters, and collect items. Use WASD or arrow keys to move.

### Hoot
A shooting game where you control an owl-like character. Avoid red enemies and shoot them down. Use WASD to move and SPACE to shoot.
