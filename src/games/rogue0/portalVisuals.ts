// Free-standing door seen from the front or back. The hero can walk around it
// and stand behind it, so the back has its own closed panel; the open vortex is
// visible from both sides.
export const PORTAL_TEXTURE = 'store-portal';
const FRAME_COUNT = 18;

export function portalFrame(open: boolean, time: number, back = false): number {
  const phase = Math.floor(time / 110) % 8;
  if (!open) return back ? 9 : 0;
  return (back ? 10 : 1) + phase;
}

export function generatePortalTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(PORTAL_TEXTURE)) return;
  const texture = scene.textures.createCanvas(PORTAL_TEXTURE, 16 * FRAME_COUNT, 24)!;
  const ctx = texture.context;
  const pixel = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
  };
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const back = frame >= 9;
    const kind = back ? frame - 9 : frame;
    const left = frame * 16;
    // Frame and hinges read from both sides; the back is a little darker.
    pixel(left + 1, 3, 14, 21, back ? '#191521' : '#211c32');
    pixel(left + 3, 1, 10, 3, back ? '#7f6c83' : '#9b809b');
    pixel(left + 1, 3, 3, 21, back ? '#5d4e67' : '#74617c');
    pixel(left + 12, 3, 3, 21, back ? '#41394f' : '#4e455f');
    pixel(left, 22, 16, 2, '#aca0a9');
    for (const y of [6, 12, 18]) {
      pixel(left + 1, y, 3, 1, back ? '#2e253b' : '#382c46');
      pixel(left + 12, y, 3, 1, back ? '#292236' : '#30283d');
    }
    if (kind === 0) {
      if (!back) {
        pixel(left + 4, 4, 8, 18, '#453349');
        pixel(left + 7, 4, 1, 18, '#221f2e');
        pixel(left + 4, 7, 8, 1, '#a68b62');
        pixel(left + 4, 19, 8, 1, '#a68b62');
        pixel(left + 6, 11, 4, 4, '#a36add');
        pixel(left + 7, 12, 2, 2, '#eee5ff');
      } else {
        pixel(left + 4, 4, 8, 18, '#342d3d');
        for (let y = 6; y < 22; y += 4) pixel(left + 4, y, 8, 1, '#241f2d');
        pixel(left + 5, 12, 1, 3, '#9b809b');
      }
    } else {
      // The vortex is clipped to the aperture, never a screen-wide flash.
      for (let y = 4; y < 22; y++) for (let x = 4; x < 12; x++) {
        const dx = (x - 7.5) * 1.8, dy = y - 13;
        const phase = Math.atan2(dy, dx) + Math.hypot(dx, dy) * 0.7 - kind * Math.PI / 4;
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
