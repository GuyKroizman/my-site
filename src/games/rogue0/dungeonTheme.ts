/** Texture keys shared by the ground tilemap and raised wall faces. */
export function dungeonThemeName(floor: number): string {
  // Shared boundaries belong to the new region: 5, 10, 15, and 20.
  let theme = 'stone';
  if (floor >= 20 && floor <= 25) theme = 'volcanic';
  else if (floor >= 15 && floor < 20) theme = 'crystal';
  else if (floor >= 10 && floor < 15) theme = 'sandstone';
  else if (floor >= 5 && floor < 10) theme = 'crypt';
  return theme;
}

/** Tile index of the wall face inside a theme sheet. Each sheet is a 33x16
 * strip of two 16px tiles with 1px spacing: floor at 0, wall face at 1. The
 * same grid feeds the spritesheet frames, so the frame index matches the
 * tilemap index and one image per theme serves both the tilemap layer and the
 * raised wall sprites. */
export const WALL_TILE = 1;

export function dungeonTheme(floor: number): { tiles: string; wallFrame: number } {
  return { tiles: `${dungeonThemeName(floor)}-tiles`, wallFrame: WALL_TILE };
}

/** Door artwork per region: oak on floors 1-4, banded iron on 6-9, sandstone
 * slab on 11-14, crystal on 16-19, glowing basalt on 21-24. The shared
 * boundary floors (5, 10, 15, 20, 25) take the incoming region's style, the
 * same way the wall and floor art does. */
export type DoorStyle = 'wood' | 'iron' | 'stone-slab' | 'crystal' | 'basalt';

export function doorStyleName(floor: number): DoorStyle {
  switch (dungeonThemeName(floor)) {
    case 'crypt': return 'iron';
    case 'sandstone': return 'stone-slab';
    case 'crystal': return 'crystal';
    case 'volcanic': return 'basalt';
    default: return 'wood';
  }
}

/** Texture keys for one door style. The oak doors keep the original
 * unqualified names so existing saves and art assumptions stay valid. */
export function doorTextureKeys(style: DoorStyle): {
  front: string;
  side: string;
  threshold: string;
  thresholdSide: string;
} {
  const suffix = style === 'wood' ? '' : `-${style}`;
  return {
    front: `door-front${suffix}`,
    side: `door-side${suffix}`,
    threshold: `door-threshold${suffix}`,
    thresholdSide: `door-threshold-side${suffix}`
  };
}
