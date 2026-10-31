# Vision

Player sight uses a Euclidean radius of 8 cells and symmetric shadowcasting.
Four 90-degree quadrants are scanned in rows, splitting angular visibility at
opaque tiles. Walls expose their faces; floor sight is reciprocal. Adjacent
diagonal floor and doorways remain visible beside wall corners, while terrain
directly behind a wall, closed door, or tall grass stays hidden.

Monster sight and combat awareness use the same shadowcasting geometry (with
each monster's own radius). Seeing the player enter a doorway updates ordinary
last-seen pursuit memory, so no special door-investigation AI is needed. If the
player then leaves sight, monsters pursue that remembered doorway, not the
player's hidden current position. Bresenham paths remain available separately
for physical projectiles; this change does not make projectiles pass walls.

- Base-map walls (`1`) block sight, including solid pillars/barricades represented
  as wall cells. Closed doors and tall grass also block sight.
- Open doors, water, and chasms are transparent. Chasms still block walking.
- `TileState.blocksSight` overrides opacity independently of movement. For
  example `setFeature(x, y, "door", {door: "closed", blocksSight: false})`
  represents a transparent crystal door. An optical override of `false` on a
  base-wall cell supports glass walls without making them walkable. This adds
  optical support, not new glass/crystal artwork or generated terrain variants.

## Surprise attacks

Monsters track awareness on their own action, before moving. Breaking their
sight with a wall or tall grass lets a pursuer round that cover without having
reacted yet: the player's next hit can surprise it even though sight is restored.
Opening and entering a closed door explicitly creates the same opening.
The opening is consumed by the player's first attack, or expires when the
monster takes another turn and sees the player. Merely circling cover while
remaining visible does not grant repeated surprise hits.

Surprise retains its existing guaranteed-hit, bonus-damage and physical bleed
rules. Each resolved surprise hit emits a small golden `!` which rises and fades
for 650ms. Cues use cosmetic time only, respect fog, and clear on floor changes.

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
  15 are dark. Darkness reduces radius to 4.
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
