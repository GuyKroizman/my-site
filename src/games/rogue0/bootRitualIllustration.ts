// A larger depiction of the floor-7 mural's ceremony, drawn for the Inspect
// dialog. Pure presentation: nothing here touches game state or consumes
// gameplay randomness. The wall decal stays the tiny in-world version.

import type Phaser from 'phaser';

export const BOOT_RITUAL_ILLUSTRATION_TEXTURE = 'boot-ritual-illustration';
export const BOOT_RITUAL_ILLUSTRATION_SIZE = 128;

const INK = {
  stone: '#2a241c',
  frame: '#6b5a3e',
  guide: 'rgba(217, 207, 178, 0.32)',
  boot: '#b37654',
  bootDark: '#5c3b28',
  bootLight: '#d99a74',
  heal: '#ff5555',
  berserk: '#ffa500',
  glass: '#efe6cf',
  cork: '#8a6a3e'
};

function nextRandom(seed: { value: number }): number {
  seed.value = (Math.imul(seed.value, 1664525) + 1013904223) >>> 0;
  return seed.value / 0x100000000;
}

function drawStone(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = INK.stone;
  ctx.fillRect(0, 0, size, size);
  const seed = { value: 0x5eed1234 };
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(nextRandom(seed) * size);
    const y = Math.floor(nextRandom(seed) * size);
    ctx.fillStyle = nextRandom(seed) < 0.55
      ? 'rgba(0, 0, 0, 0.25)'
      : 'rgba(217, 207, 178, 0.06)';
    ctx.fillRect(x, y, 1 + Math.floor(nextRandom(seed) * 2), 1 + Math.floor(nextRandom(seed) * 2));
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK.frame;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(217, 207, 178, 0.16)';
  ctx.strokeRect(6, 6, size - 12, size - 12);
}

function drawGuides(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  const near = 30;
  const far = size - 30;
  ctx.strokeStyle = INK.guide;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(near, c);
  ctx.lineTo(far, c);
  ctx.moveTo(c, near);
  ctx.lineTo(c, far);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c, c - 22);
  ctx.lineTo(c + 22, c);
  ctx.lineTo(c, c + 22);
  ctx.lineTo(c - 22, c);
  ctx.closePath();
  ctx.stroke();
}

function drawAltar(ctx: CanvasRenderingContext2D, x: number, y: number, glow: string): void {
  const halo = ctx.createRadialGradient(x, y, 1, x, y, 20);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3c3325';
  ctx.beginPath();
  ctx.ellipse(x, y + 9, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK.frame;
  ctx.stroke();
}

function drawPotion(ctx: CanvasRenderingContext2D, x: number, y: number, body: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-3, -6);
  ctx.lineTo(3, -6);
  ctx.lineTo(6, -2);
  ctx.lineTo(6, 4);
  ctx.quadraticCurveTo(6, 9, 0, 9);
  ctx.quadraticCurveTo(-6, 9, -6, 4);
  ctx.lineTo(-6, -2);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK.glass;
  ctx.stroke();
  ctx.fillStyle = INK.cork;
  ctx.fillRect(-3, -11, 6, 5);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#c9a86a';
  ctx.strokeRect(-3, -11, 6, 5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(-4, -1, 2, 6);
  ctx.restore();
}

function drawBoot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
  halo.addColorStop(0, 'rgba(240, 180, 41, 0.35)');
  halo.addColorStop(1, 'rgba(240, 180, 41, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-8, -15);
  ctx.lineTo(3, -15);
  ctx.lineTo(3, 0);
  ctx.lineTo(9, 0);
  ctx.quadraticCurveTo(13, 0, 13, 4);
  ctx.lineTo(13, 8);
  ctx.lineTo(-10, 8);
  ctx.quadraticCurveTo(-12, 8, -12, 5);
  ctx.lineTo(-12, -13);
  ctx.quadraticCurveTo(-12, -15, -8, -15);
  ctx.closePath();
  ctx.fillStyle = INK.boot;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK.bootDark;
  ctx.stroke();
  ctx.fillStyle = INK.bootDark;
  ctx.fillRect(-12, 6, 25, 3);
  ctx.fillStyle = INK.bootLight;
  ctx.fillRect(-10, -14, 3, 14);
  ctx.fillStyle = 'rgba(239, 230, 207, 0.7)';
  ctx.fillRect(-8, -15, 11, 2);
  ctx.strokeStyle = 'rgba(239, 230, 207, 0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const ly = -10 + i * 4;
    ctx.beginPath();
    ctx.moveTo(-5, ly);
    ctx.lineTo(1, ly + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSparkles(ctx: CanvasRenderingContext2D, size: number): void {
  const points = [
    [22, 22], [size - 22, 24], [24, size - 24], [size - 24, size - 22],
    [size / 2, 12], [size / 2, size - 12], [12, size / 2], [size - 12, size / 2]
  ];
  ctx.fillStyle = 'rgba(240, 180, 41, 0.85)';
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x + 1, y - 1);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x + 1, y + 1);
    ctx.lineTo(x, y + 3);
    ctx.lineTo(x - 1, y + 1);
    ctx.lineTo(x - 3, y);
    ctx.lineTo(x - 1, y - 1);
    ctx.closePath();
    ctx.fill();
  }
}

export function generateBootRitualIllustration(scene: Phaser.Scene): void {
  if (scene.textures.exists(BOOT_RITUAL_ILLUSTRATION_TEXTURE)) return;
  const size = BOOT_RITUAL_ILLUSTRATION_SIZE;
  const texture = scene.textures.createCanvas(BOOT_RITUAL_ILLUSTRATION_TEXTURE, size, size);
  if (!texture) return;
  const ctx = texture.getContext();
  const c = size / 2;
  const near = 30;
  const far = size - 30;
  drawStone(ctx, size);
  drawGuides(ctx, size);
  // Left/right: Berserk. Above/below: Healing — the mural's exact pattern.
  drawAltar(ctx, near, c, 'rgba(255, 165, 0, 0.5)');
  drawAltar(ctx, far, c, 'rgba(255, 165, 0, 0.5)');
  drawAltar(ctx, c, near, 'rgba(255, 85, 85, 0.5)');
  drawAltar(ctx, c, far, 'rgba(255, 85, 85, 0.5)');
  drawPotion(ctx, near, c - 1, INK.berserk);
  drawPotion(ctx, far, c - 1, INK.berserk);
  drawPotion(ctx, c, near - 1, INK.heal);
  drawPotion(ctx, c, far - 1, INK.heal);
  drawBoot(ctx, c - 1, c + 2);
  drawSparkles(ctx, size);
  texture.refresh();
}
