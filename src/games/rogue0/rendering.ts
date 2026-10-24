// Terrain is a separate layer. Only one foreground entity is drawn per cell.
export function foregroundEntities<T extends { x?: number; y?: number; type: string }>(entities: T[], player?: T): Set<T> {
  const cells = new Map<string, T>();
  const priority = (entity: T) => entity === player ? 3 : entity.type === 'item' ? 1 : 2;
  for (const entity of entities) {
    if (entity.x === undefined || entity.y === undefined) continue;
    const key = `${entity.x},${entity.y}`;
    const current = cells.get(key);
    // Stable item choice: first item wins until removed from the cell.
    if (!current || priority(entity) > priority(current)) cells.set(key, entity);
  }
  return new Set(cells.values());
}

/** The legacy atlas has a solid mauve backdrop. Keep it for floor tiles,
 * but remove that exact palette color for all foreground sprites, including
 * future creatures/items that use the atlas. Custom textures must have alpha.
 */
export function createForegroundAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists('foreground-tiles')) return;
  const source = scene.textures.get('tiles').getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (pixels.data[i] === 71 && pixels.data[i + 1] === 45 && pixels.data[i + 2] === 60) {
      pixels.data[i + 3] = 0;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = scene.textures.addCanvas('foreground-source', canvas);
  if (texture) scene.textures.addSpriteSheet('foreground-tiles', texture, {
    frameWidth: 16, frameHeight: 16, spacing: 1
  });
}
