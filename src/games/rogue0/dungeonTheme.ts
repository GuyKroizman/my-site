/** Texture keys shared by the ground tilemap and raised wall faces. */
export function dungeonTheme(floor: number): { tiles: string; wall: string } {
  // Shared boundaries belong to the new region: 5, 10, 15, and 20.
  let theme = 'stone';
  if (floor >= 20 && floor <= 25) theme = 'volcanic';
  else if (floor >= 15 && floor < 20) theme = 'crystal';
  else if (floor >= 10 && floor < 15) theme = 'sandstone';
  else if (floor >= 5 && floor < 10) theme = 'crypt';
  return { tiles: `${theme}-tiles`, wall: `${theme}-wall` };
}
