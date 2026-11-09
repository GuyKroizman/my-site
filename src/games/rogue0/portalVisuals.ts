// One closed panel and eight open-door vortex frames, all inside the same arch.
export const PORTAL_TEXTURE = 'store-portal';
export function portalFrame(open: boolean, time: number): number {
  return open ? 1 + Math.floor(time / 110) % 8 : 0;
}
export function generatePortalTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(PORTAL_TEXTURE)) return;
  const texture = scene.textures.createCanvas(PORTAL_TEXTURE, 16 * 9, 24)!;
  const ctx = texture.context;
  const pixel = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  };
  for (let frame = 0; frame < 9; frame++) {
    const left = frame * 16;
    pixel(left + 1, 3, 14, 21, '#211c32');
    pixel(left + 3, 1, 10, 3, '#9b809b');
    pixel(left + 1, 3, 3, 21, '#74617c');
    pixel(left + 12, 3, 3, 21, '#4e455f');
    pixel(left, 22, 16, 2, '#aca0a9');
    for (const y of [6, 12, 18]) { pixel(left + 1, y, 3, 1, '#382c46'); pixel(left + 12, y, 3, 1, '#30283d'); }
    if (!frame) {
      pixel(left + 4, 4, 8, 18, '#453349');
      pixel(left + 7, 4, 1, 18, '#221f2e');
      pixel(left + 4, 7, 8, 1, '#a68b62');
      pixel(left + 4, 19, 8, 1, '#a68b62');
      pixel(left + 6, 11, 4, 4, '#a36add');
      pixel(left + 7, 12, 2, 2, '#eee5ff');
    } else {
      // No screen-wide flash: animated spiral remains clipped to the aperture.
      for (let y = 4; y < 22; y++) for (let x = 4; x < 12; x++) {
        const dx = (x - 7.5) * 1.8, dy = y - 13;
        const phase = Math.atan2(dy, dx) + Math.hypot(dx, dy) * 0.7 - frame * Math.PI / 4;
        const wave = Math.sin(phase);
        pixel(left + x, y, 1, 1, wave > 0.7 ? '#78dedc' : wave > 0 ? '#9061c9' : '#32204f');
      }
      pixel(left + 3, 5, 1, 16, '#d8b2ff');
      pixel(left + 12, 5, 1, 16, '#b281de');
    }
    texture.add(frame, 0, left, 0, 16, 24);
  }
  texture.refresh();
}
