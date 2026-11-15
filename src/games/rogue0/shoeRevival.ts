import type { GameContext } from './context.ts';
import type { Entity } from './entity.ts';
import { removeEntity } from './entity.ts';
import { terrainFor } from './terrain.ts';
import dungeon from './dungeon.ts';
import Shoe from './items/Shoe.ts';
import BlessedShoe from './items/BlessedShoe.ts';
import DroppedBackpack from './items/droppedBackpack.ts';
import { placeFloorItem } from './itemPresentation.ts';
import { randomWalkableTiles } from './mapgen.ts';
import { sfx } from './audio.ts';

type RevivalKind = 'boot' | 'blessed';

export function findRevivalShoe(context: GameContext): { item: Entity; kind: RevivalKind } | undefined {
  const player = context.player;
  if (!player) return undefined;
  // Trigger only from backpack. Blessed Boot has greater priority.
  const blessed = player.backpack.find(item => item instanceof BlessedShoe);
  if (blessed) return { item: blessed, kind: 'blessed' };
  const normal = player.backpack.find(item => item instanceof Shoe);
  if (normal) return { item: normal, kind: 'boot' };
  return undefined;
}

function clearHarmfulEffects(entity: Entity): void {
  const harmful = new Set(['burning', 'poisoned', 'frozen', 'stunned', 'crippled', 'chilled', 'bleeding', 'weakened', 'confused', 'charmed']);
  entity.effects = (entity.effects ?? []).filter(effect => !harmful.has(effect.id));
}

function validReviveTile(context: GameContext, x: number, y: number): boolean {
  const level = context.currentLevel;
  if (!level?.length || !Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (level[y]?.[x] !== 0) return false;
  if (terrainFor(context).isBlocking(x, y)) return false;
  if (context.entities.some(entity => entity !== context.player && entity.type !== 'item' && entity.x === x && entity.y === y && (entity.healthPoints ?? 0) > 0)) return false;
  return true;
}

function randomSafeTile(context: GameContext): { x: number; y: number } | undefined {
  const player = context.player;
  const level = context.currentLevel;
  if (!player || !level?.length) return undefined;
  const occupied = new Set<string>();
  for (const entity of context.entities) {
    if (entity !== player && entity.type !== 'item' && entity.x !== undefined && entity.y !== undefined && (entity.healthPoints ?? 0) > 0) {
      occupied.add(`${entity.x},${entity.y}`);
    }
  }
  const candidates = randomWalkableTiles(level, 200, occupied, level[0].length, terrainFor(context))
    .filter(tile => validReviveTile(context, tile.x, tile.y));
  if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
  // Fallback: any valid in-bounds floor tile.
  const fallback = randomWalkableTiles(level, 200, new Set(), level[0].length, terrainFor(context))
    .filter(tile => level[tile.y]?.[tile.x] === 0 && !terrainFor(context).isBlocking(tile.x, tile.y));
  if (fallback.length) return fallback[Math.floor(Math.random() * fallback.length)];
  if (player.x !== undefined && player.y !== undefined) return { x: player.x, y: player.y };
  return undefined;
}

function nearestDropTile(context: GameContext, x: number, y: number): { x: number; y: number } {
  if (validDropTile(context, x, y)) return { x, y };
  let best: { x: number; y: number; d: number } | undefined;
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!validDropTile(context, nx, ny)) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (!best || d < best.d) best = { x: nx, y: ny, d };
    }
  }
  if (best) return { x: best.x, y: best.y };
  const safe = randomSafeTile(context);
  return safe ?? { x, y };
}

function validDropTile(context: GameContext, x: number, y: number): boolean {
  const level = context.currentLevel;
  if (!level?.length || level[y]?.[x] !== 0) return false;
  if (terrainFor(context).isBlocking(x, y)) return false;
  return true;
}

function detachFromHero(player: any, item: Entity): void {
  player.backpack = player.backpack.filter((candidate: Entity) => candidate !== item);
  player.quickslots = player.quickslots.map((candidate: Entity | undefined) => candidate === item ? undefined : candidate);
  player.context.entities = player.context.entities.filter((candidate: Entity) => candidate !== item);
  item.sprite?.destroy?.();
  item.sprite = undefined;
}

export function tryReviveHero(context: GameContext): boolean {
  const player = context.player;
  if (!player || player.healthPoints > 0) return false;
  const revival = findRevivalShoe(context);
  if (!revival) return false;

  const deathX = player.x ?? 0;
  const deathY = player.y ?? 0;
  const { item, kind } = revival;
  const scene = context.scene as any;
  const map = context.map as any;
  const heroSprite = player.sprite;

  // Death cue before revival (requested): brief sound/flash.
  sfx.playerDeath?.();
  if (scene && heroSprite) {
    scene.tweens.add({ targets: heroSprite, alpha: 0.25, duration: 120, yoyo: true, repeat: 1 });
  }

  // Consume boot first.
  detachFromHero(player, item);
  removeEntity(context, item);

  // Common restore.
  player.healthPoints = player.maxHealthPoints;
  player.hunger = player.maxHunger;
  (player as any).hungerWarned = false;
  player.moving = false;
  player.actionReady = true;
  player.walkPath = [];
  player.inputBuffer = [];
  clearHarmfulEffects(player);
  player.sprite?.clearTint?.();

  if (kind === 'boot') {
    // Drop backpack contents and ring1/ring2/artifact at death tile (or fallback).
    const dropTile = nearestDropTile(context, deathX, deathY);
    const droppedBackpackItems = [...player.backpack];
    const droppedEquipment = [player.ring1, player.ring2, player.artifact].filter(Boolean) as Entity[];

    // Remove items from hero state without triggering equip hooks side effects badly.
    player.backpack = [];
    player.quickslots = Array(4).fill(undefined);
    for (const eq of droppedEquipment) {
      const slot = player.slotOf?.(eq);
      if (slot) (player as any)[slot] = undefined;
      // Keep equipment passive cleanup consistent.
      eq.unequip?.();
    }

    // Place loose equipment beneath container (separate floor items).
    for (const eq of droppedEquipment) {
      eq.context = context;
      eq.x = dropTile.x; eq.y = dropTile.y;
      if (!context.entities.includes(eq)) context.entities.push(eq);
      placeFloorItem(eq);
    }
    // Recoverable container on same tile, kept visually above loose drops.
    const container = new DroppedBackpack(context, droppedBackpackItems);
    container.context = context;
    container.x = dropTile.x; container.y = dropTile.y;
    context.entities.push(container);
    placeFloorItem(container);
    if (container.sprite) container.sprite.setDepth((container.sprite.depth ?? 0) + 0.05);

    context.onForgetFloorMemory?.();
  }

  const dest = randomSafeTile(context);
  if (dest) {
    player.x = dest.x;
    player.y = dest.y;
    if (player.sprite && context.map) {
      player.sprite.x = context.map.tileToWorldX(dest.x)!;
      player.sprite.y = context.map.tileToWorldY(dest.y)!;
    }
  }

  sfx.revive?.();
  if (scene && map && player.sprite) {
    const wx = map.tileToWorldX(player.x!)! + 8;
    const wy = map.tileToWorldY(player.y!)! + 8;
    const light = scene.add.circle(wx, wy, 10, 0xfff6c9, 0.9).setDepth(500);
    scene.tweens.add({ targets: light, radius: 34, alpha: 0, duration: 520, ease: 'Sine.easeOut', onComplete: () => light.destroy() });
    const beam = scene.add.rectangle(wx, wy - 8, 6, 28, 0xffffff, 0.7).setDepth(499);
    scene.tweens.add({ targets: beam, alpha: 0, scaleY: 2.2, duration: 520, ease: 'Sine.easeOut', onComplete: () => beam.destroy() });
    // Ensure any earlier death-cue tween cannot leave the hero invisible.
    scene.tweens.killTweensOf(player.sprite);
    player.sprite.setVisible(true);
    player.sprite.setActive(true);
    player.sprite.setAlpha(0);
    scene.tweens.add({
      targets: player.sprite,
      alpha: 1,
      duration: 260,
      ease: 'Sine.easeIn',
      onComplete: () => player.sprite?.setAlpha(1),
    });
  } else if (player.sprite) {
    player.sprite.setAlpha(1);
    player.sprite.setVisible(true);
  }

  dungeon.log(context, kind === 'blessed'
    ? 'The Blessed Boot shatters and saves you!'
    : 'The Boot shatters and saves you! You leave your belongings behind as the floor fades from memory.');
  context.saveNow?.();
  return true;
}
