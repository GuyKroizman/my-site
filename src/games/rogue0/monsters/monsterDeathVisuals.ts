import type Phaser from 'phaser';
import type { GameContext } from '../context';
import { FLY_POSITIONS } from './flySwarmTexture.ts';
import { footprintTiles, TILE_FOOTPRINT } from '../footprint.ts';

// Derived from the existing saved monster identity, not a new serialized field.
// Skeleton owns its anatomical animation; unknown creatures retain Entity's fade.
export const MONSTER_DEATH_STYLES = {
  Goblin: 'topple', Ghoul: 'crumple', Brute: 'slam', Cultist: 'robe',
  Quloptsh: 'melt', 'Deadly Frog': 'belly-flop', Mimic: 'splinter',
  Wraith: 'dissolve', 'Swarm of Flies': 'scatter',
  'Fire Elemental': 'embers', 'Ice Elemental': 'shatter',
  'Lightning Elemental': 'discharge', 'Bone Lord': 'deflate',
  'Mirror Image': 'illusion',
} as const;
export type MonsterDeathStyle = typeof MONSTER_DEATH_STYLES[keyof typeof MONSTER_DEATH_STYLES];
export const DEATH_DURATIONS: Record<MonsterDeathStyle, number> = {
  topple: 800, crumple: 900, slam: 950, robe: 1000, melt: 900,
  'belly-flop': 850, splinter: 850, dissolve: 1000, scatter: 700,
  embers: 900, shatter: 850, discharge: 550, deflate: 1200, illusion: 650,
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const BODY_STYLES = new Set<MonsterDeathStyle>(['topple', 'crumple', 'slam', 'robe', 'melt', 'belly-flop', 'deflate']);
export type DeathPart = { x: number; y: number; width: number; height: number };

export function monsterDeathStyle(name: string): MonsterDeathStyle | undefined {
  return Object.prototype.hasOwnProperty.call(MONSTER_DEATH_STYLES, name)
    ? MONSTER_DEATH_STYLES[name as keyof typeof MONSTER_DEATH_STYLES] : undefined;
}

/** Reuse the actual artwork, including custom textures and scaled offspring. */
export function monsterDeathParts(style: MonsterDeathStyle, width: number, height: number): DeathPart[] {
  if (BODY_STYLES.has(style)) return [{ x: 0, y: 0, width, height }];
  if (style === 'scatter' && width === 16 && height === 16) {
    return FLY_POSITIONS.map(([x, y]) => ({ x, y, width: 7, height: 6 }));
  }
  const columns = style === 'illusion' || style === 'splinter' ? 1 : 4;
  const rows = style === 'dissolve' ? 1 : style === 'splinter' ? 2 : 4;
  const parts: DeathPart[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const x = Math.floor(col * width / columns), y = Math.floor(row * height / rows);
    const w = Math.floor((col + 1) * width / columns) - x;
    const h = Math.floor((row + 1) * height / rows) - y;
    if (w && h) parts.push({ x, y, width: w, height: h });
  }
  return parts;
}

/** Local pixel offsets, evaluated from absolute age (frame-rate independent). */
export function monsterDeathPose(style: MonsterDeathStyle, part: DeathPart, index: number,
  elapsed: number, width: number, height: number) {
  const t = clamp(elapsed / DEATH_DURATIONS[style]);
  const fall = ease(t / 0.55);
  const pose = { x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1, alpha: 1 - ease((t - 0.65) / 0.35) };
  switch (style) {
    case 'topple':
      pose.angle = 88 * fall; pose.x = 4 * fall; break;
    case 'crumple':
      pose.scaleY = 1 - 0.55 * ease(t / 0.3);
      pose.angle = -68 * ease((t - 0.2) / 0.4); pose.x = -2 * fall;
      // This narrow atlas figure has four empty pixels beside its shoulders.
      // Once sideways, sink that transparent margin rather than floating on it.
      pose.y = 4 * ease((t - 0.2) / 0.4); break;
    case 'slam':
      pose.angle = -85 * ease(t / 0.38);
      pose.scaleY = 1 - 0.2 * Math.sin(Math.PI * clamp((t - 0.32) / 0.25));
      pose.x = -3 * fall; break;
    case 'robe':
      pose.scaleY = 1 - 0.88 * fall; pose.scaleX = 1 + 0.25 * fall; break;
    case 'melt':
      pose.scaleY = 1 - 0.92 * ease(t / 0.7); pose.scaleX = 1 + 0.65 * fall; break;
    case 'belly-flop': {
      const hop = clamp(t / 0.55);
      pose.y = -7 * Math.sin(Math.PI * hop);
      pose.angle = 180 * ease(t / 0.5);
      pose.scaleY = 1 - 0.5 * ease((t - 0.48) / 0.15); break;
    }
    case 'deflate': {
      const pulse = Math.sin(t * Math.PI * 8) * (1 - fall) * 0.08;
      pose.scaleX = 1 + 0.25 * fall + pulse;
      pose.scaleY = 1 - 0.87 * ease(t / 0.65) - pulse; break;
    }
    case 'splinter': {
      pose.x = (index === 0 ? -4 : 3) * fall;
      pose.angle = (index === 0 ? -65 : 12) * fall;
      const radians = pose.angle * Math.PI / 180;
      const extent = Math.abs(Math.sin(radians)) * part.width + Math.abs(Math.cos(radians)) * part.height;
      pose.y = (height - part.y - part.height / 2 - extent / 2) * fall -
        (index === 0 ? 9 * Math.sin(Math.PI * fall) : 0);
      break;
    }
    case 'dissolve':
      pose.x = Math.sin(t * 5 + index) * t * 3;
      pose.y = -(8 + index * 3) * t; pose.scaleX = 1 - 0.85 * t;
      pose.scaleY = 1 + 0.35 * t; pose.alpha = (1 - t) ** 2; break;
    case 'illusion':
      pose.x = (index % 2 ? 1 : -1) * 12 * t;
      pose.y = -3 * t; pose.alpha = (1 - t) * (Math.floor(t * 12) % 2 ? 0.4 : 1); break;
    case 'scatter': {
      const direction = [-2.4, -0.4, 1.8][index % 3];
      pose.x = Math.cos(direction) * 16 * t;
      pose.y = Math.sin(direction) * 11 * t + 12 * t * t;
      pose.angle = (index % 2 ? 1 : -1) * 150 * t;
      pose.alpha = 1 - t; break;
    }
    case 'embers':
      pose.x = Math.sin(index * 2.4) * 7 * t;
      pose.y = -(9 + index % 4 * 3) * t;
      pose.scaleX = pose.scaleY = 1 - 0.85 * t;
      pose.alpha = (1 - t) * (0.8 + 0.2 * Math.cos(t * 20 + index)); break;
    case 'shatter': {
      const land = clamp(t / (0.38 + index % 4 * 0.035));
      const bounce = clamp((t - (0.38 + index % 4 * 0.035)) / 0.18);
      pose.x = ((part.x + part.width / 2) / width - 0.5) * 14 * ease(t / 0.65);
      pose.y = (height - part.y - part.height) * land * land -
        Math.sin(Math.PI * land) * 3 - Math.sin(Math.PI * bounce) * 1.5;
      pose.angle = (index % 2 ? 1 : -1) * 110 * land; break;
    }
    case 'discharge': {
      const radius = 12 * ease(t / 0.55);
      const direction = index * 2.4;
      const jitter = t > 0 && t < 0.8 ? Math.sin(Math.floor(t * 14) * 3 + index) * 2 : 0;
      pose.x = Math.cos(direction) * radius + jitter;
      pose.y = Math.sin(direction) * radius;
      pose.scaleX = 1 - 0.9 * t; pose.scaleY = 1 + Math.sin(t * Math.PI) * 1.5;
      pose.alpha = (1 - t) * (Math.floor(t * 16) % 2 ? 0.25 : 1); break;
    }
  }
  if (BODY_STYLES.has(style)) {
    // Keep the rotating/squashing corpse on its original floor contact line.
    const radians = pose.angle * Math.PI / 180;
    const extent = Math.abs(Math.sin(radians)) * width * pose.scaleX +
      Math.abs(Math.cos(radians)) * height * pose.scaleY;
    pose.y += (height - extent) / 2;
  }
  return pose;
}

/** Cosmetic dust, soul motes and droplets. Never create damage or poison here. */
export function monsterDeathMotes(style: MonsterDeathStyle, elapsed: number) {
  const t = clamp(elapsed / DEATH_DURATIONS[style]);
  const palette: Partial<Record<MonsterDeathStyle, number>> = {
    slam: 0xa68c71, robe: 0xb88cff, melt: 0x8ca648, 'belly-flop': 0x95b84b, deflate: 0xb8ae65,
  };
  const color = palette[style];
  if (color === undefined) return [];
  const rising = style === 'robe';
  const p = clamp((t - (rising ? 0 : 0.35)) / 0.55);
  if (p <= 0 || p >= 1) return [];
  return Array.from({ length: style === 'deflate' ? 12 : 8 }, (_, i) => ({
    x: (i - (style === 'deflate' ? 5.5 : 3.5)) * (1 + p * 2),
    y: rising ? -4 - (10 + i % 3 * 4) * p : -Math.sin(Math.PI * p) * (2 + i % 3),
    size: style === 'deflate' ? 2 : 1, alpha: (1 - p) * 0.8, color,
  }));
}

/** Presentation-only ownership transfer from removeEntity. */
export function playMonsterDeath(context: GameContext, sprite: Phaser.GameObjects.Sprite,
  name: string, tileX?: number, tileY?: number, footprint = TILE_FOOTPRINT): boolean {
  const style = monsterDeathStyle(name);
  const scene = context.scene;
  if (!style || !scene || !sprite.frame) return false;
  if (!sprite.visible || sprite.alpha <= 0) { sprite.destroy(); return true; }
  const floor = context.floor, level = context.currentLevel;
  const x = tileX ?? Math.floor(sprite.x / 16), y = tileY ?? Math.floor(sprite.y / 16);
  const cells = [...footprintTiles(footprint, x, y)].map(([cx, cy]) => `${cx},${cy}`);
  const flipX = sprite.flipX, flipY = sprite.flipY;
  const width = sprite.frame.width, height = sprite.frame.height;
  const sx = Math.abs(sprite.scaleX), sy = Math.abs(sprite.scaleY);
  const left = sprite.x - sprite.displayOriginX * sx, top = sprite.y - sprite.displayOriginY * sy;
  const alpha = sprite.alpha, depth = Math.min(99, sprite.depth);
  const parts = monsterDeathParts(style, width, height);
  const images = parts.map((part, index) => {
    const key = `death-${style}-${sprite.frame.name}-${index}`;
    const texture = sprite.texture;
    if (!texture.has(key)) {
      // Phaser makes the first added subframe the default for image textures.
      // Keep __BASE as the default or later spawns/icons become one fragment!
      const defaultFrame = texture.firstFrame;
      texture.add(key, sprite.frame.sourceIndex,
        sprite.frame.cutX + part.x, sprite.frame.cutY + part.y, part.width, part.height);
      texture.firstFrame = defaultFrame;
    }
    return scene.add.image(0, 0, texture.key, key).setDepth(depth)
      .setTint(sprite.tintTopLeft).setFlip(sprite.flipX, sprite.flipY);
  });
  const dust = scene.add.graphics().setDepth(depth);
  sprite.destroy();
  const clock = { elapsed: 0 };
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    scene.events.off('shutdown', cleanup);
    scene.tweens.killTweensOf(clock);
    images.forEach(image => image.destroy());
    dust.destroy();
  };
  const draw = () => {
    if (finished) return;
    // Stairs can replace the floor without shutting down the Phaser scene.
    if (context.floor !== floor || context.currentLevel !== level) { cleanup(); return; }
    const visible = cells.some(cell => context.visibleTiles.has(cell));
    images.forEach((image, index) => {
      const part = parts[index];
      const pose = monsterDeathPose(style, part, index, clock.elapsed, width, height);
      const cx = part.x + part.width / 2, cy = part.y + part.height / 2;
      image.setPosition(left + ((flipX ? width - cx : cx) + pose.x * (flipX ? -1 : 1)) * sx,
        top + (flipY ? height - cy : cy) * sy + pose.y * sy)
        .setScale(sx * pose.scaleX, sy * pose.scaleY).setAngle(pose.angle * (flipX ? -1 : 1))
        .setAlpha(alpha * pose.alpha).setVisible(visible);
    });
    dust.clear();
    if (!visible) return;
    for (const mote of monsterDeathMotes(style, clock.elapsed)) {
      const px = Math.round(left + (width / 2 + mote.x) * sx);
      const py = Math.round(top + (height + mote.y) * sy);
      if (!context.visibleTiles.has(`${Math.floor(px / 16)},${Math.floor(py / 16)}`)) continue;
      dust.fillStyle(mote.color, alpha * mote.alpha).fillRect(px, py, mote.size * sx, mote.size * sy);
    }
  };
  scene.events.once('shutdown', cleanup);
  draw();
  scene.tweens.add({ targets: clock, elapsed: DEATH_DURATIONS[style],
    duration: DEATH_DURATIONS[style], ease: 'Linear', onUpdate: draw, onComplete: cleanup });
  return true;
}
