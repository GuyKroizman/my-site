/** Texture keys shared by the ground tilemap and raised wall faces. */
export function dungeonTheme(floor: number): { tiles: string; wall: string } {
  return floor >= 5 && floor <= 10
    ? { tiles: 'crypt-tiles', wall: 'crypt-wall' }
    : { tiles: 'stone-tiles', wall: 'stone-wall' };
}
