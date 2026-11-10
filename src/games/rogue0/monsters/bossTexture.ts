import type Phaser from "phaser";

export const BOSS_TEXTURE = "monster-boss-blob";
// The dungeon's guardian is a hulking one-eyed blob: a single huge eye with a
// glint, a belly-shaded green mass and a maw packed with interlocking fangs.
// 24x24 art drawn at 2x to fill the physical 48x48 (3x3 tile) body. The broad,
// rounded-square silhouette reaches every edge, with only small corner cutouts:
// no transparent padding that makes an adjacent hero look a whole tile away.
export const BOSS_PIXELS = [
  "...oooooooooooooooooo...",
  ".ooggggggggggggggggggoo.",
  "oggggggggggggggggggggggo",
  "oggggggggggggggggggggggo",
  "oggggGGgoowwwwoogggggggo",
  "ogggGGgowwwwwwwwoggggggo",
  "oggGGgowwWWppwwwwogggggo",
  "oggGggwwwWppppwwwwgggggo",
  "ogggggwwwwppppwwwwgggggo",
  "ogggggowwwppppwwwogggggo",
  "ogggggoowwwppwwwoogggggo",
  "ogggggggowwwwwwogggggggo",
  "ogggggggoooooooogggggggo",
  "ogggggomtmtmtmtmtogggggo",
  "ogggomtmtmmmtmmmtmtogggo",
  "oggmtmmmmmmmmmmmmmmmtggo",
  "oggmtmmmmmmmmmmmmmmmtggo",
  "ogggtmmmtmmmtmmmtmtmgggo",
  "oggddgtmtmtmtmtmtmgggggo",
  "oddddddooooooooooddddddo",
  "oddddddddddddddddddddddo",
  "oddddddddddddddddddddddo",
  ".ooddddddddddddddddddoo.",
  "...oooooooooooooooooo..."
];
export const BOSS_PALETTE: Record<string, number> = {
  o: 0x1a1422, g: 0x6cb04a, G: 0x9cd66c, d: 0x427430,
  w: 0xf4f6e2, p: 0x18141e, W: 0xffffff,
  m: 0x6e1a26, t: 0xf6f2ce
};
export const BOSS_TEXTURE_SIZE = 24;

export function generateBossTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(BOSS_TEXTURE)) return;
  const g = scene.make.graphics(undefined, false);
  BOSS_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
    const color = BOSS_PALETTE[pixel];
    if (color === undefined) return;
    g.fillStyle(color, 1);
    g.fillRect(x, y, 1, 1);
  }));
  g.generateTexture(BOSS_TEXTURE, BOSS_TEXTURE_SIZE, BOSS_TEXTURE_SIZE);
  g.destroy();
}
