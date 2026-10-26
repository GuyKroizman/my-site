# Vision

Player sight uses a Euclidean radius of 8 cells and reciprocal center-to-center
Bresenham LOS. Opaque endpoints are visible, but intermediate opaque cells block
sight. Diagonal steps cannot peek past hard opaque corners, so pillars and door
jambs cast shadows. Grass permits sight around its sides when the other corner
cell is clear; two opaque corner cells still block the diagonal. This reveals
the cells to either side of an adjacent tuft without seeing straight through it.
Monster LOS uses the same terrain rules (with each monster's own radius).

- Base-map walls (`1`) block sight, including solid pillars/barricades represented
  as wall cells. Closed doors and tall grass also block sight.
- Open doors, water, and chasms are transparent. Chasms still block walking.
- `TileState.blocksSight` overrides opacity independently of movement. For
  example `setFeature(x, y, "door", {door: "closed", blocksSight: false})`
  represents a transparent crystal door. An optical override of `false` on a
  base-wall cell supports glass walls without making them walkable. This adds
  optical support, not new glass/crystal artwork or generated terrain variants.

## Fog presentation

Unexplored cells remain fully black. Five one-pixel opacity bands feather the
boundary inward onto explored cells, softening the edge without exposing hidden
terrain or changing exploration, LOS, concealment, or targeting. Remembered cells
retain their ordinary dimming under this presentation-only edge shading.

## Dynamic modifiers

`resolveVision()` in `fov.ts` is the pure, modular parameter resolver.
`Scene0` recalculates sight on position, world-time, effect, lighting, or terrain
changes, including opening doors and burning away grass while stationary.

- `context.darkLevel` overrides floor lighting; absent an override, floors above
  5 are dark. Darkness reduces radius to 4.
- `createTorchEffect(duration)` restores ordinary radius in darkness.
- `createMagicalSightEffect(duration)` gives radius 12 and ignores opacity.
- `createMindVisionEffect(duration)` marks every living on-map enemy with a
  purple mind marker, regardless of radius or walls. It never reveals terrain,
  adds exploration memory, or grants ranged targeting through fog.
- `createBlindedEffect(duration)` limits optical sight to the hero's own cell,
  overriding magical sight. Mind sensing remains independent of blindness.

Apply factories through the existing `applyEffect(hero, effect)` API. They use
normal world-time expiry; the factories do not add new loot items or change
floor generation. Existing blindness sources automatically affect player sight.

Run `npm run test:rogue0` for movement/combat and vision regressions.
