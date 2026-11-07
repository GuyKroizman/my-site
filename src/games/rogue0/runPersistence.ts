import type { GameContext, PoisonCloud } from './context';
import type { Entity } from './entity';
import { restoreConsumableKnowledge, rememberIdentifiedWandTypes } from './entity';
import type { FeaturePlacement } from './tiles';
import type { RunSave } from './saveStorage';
import type { Registry } from './saveCodec';
import { decodeGraph } from './saveCodec';
import { saveRegistry } from './saveRegistry';
import { restoreEffects } from './saveEffects';
import BasicHero from './classes/basicHero';
import classes from './classes';
import ScrollOfUpgrade from './items/ScrollOfUpgrade';
import Ring from './items/ring';
import Wand from './items/wand';
import Mimic from './monsters/mimic';
import SwarmOfFlies from './monsters/swarmOfFlies';
import { IceElemental } from './monsters/elemental';
import { ICE_ELEMENTAL_TEXTURE } from './monsters/iceElementalTexture';

export type SavedFloor = {
  savedAt: number;
  poisonClouds?: PoisonCloud[];
  map: number[][];
  seen: boolean[][];
  features: FeaturePlacement[];
  entities: Entity[];
  up: { x: number; y: number };
  down: { x: number; y: number };
};

export type RunState = {
  player: BasicHero;
  floors: Map<number, SavedFloor>;
  floor: number;
  kills: number;
  // Boss floors whose guardian died. Optional so v1 saves written before boss
  // floors were sealed still load.
  bossesSlain?: Set<number>;
  messages: string[];
  time: number;
  nextTick: number;
  knowledge: Parameters<typeof restoreConsumableKnowledge>[1];
  // Items swallowed by a chasm, keyed by the floor they will land on. They are
  // not on any floor yet, so they ride in the run save beside the floors.
  chasmFallen?: Map<number, Entity[]>;
};

// v1 hydration and compatibility repairs live here, not in scene creation.
// Constructors must not be rerun for restored actors: they roll starting gear
// and attach input. Effects reattach behavior without reapplying their bonuses.
export function decodeRunSave(save: RunSave, context: GameContext, registry: Registry = saveRegistry): RunState {
  const run: RunState = decodeGraph(save.graph, registry, (entity: Entity) => {
    entity.context = context;
    if (entity instanceof ScrollOfUpgrade) {
      const defaults = new ScrollOfUpgrade(context);
      Object.assign(entity, {
        requiresItemTarget: defaults.requiresItemTarget,
        itemTargetTitle: defaults.itemTargetTitle,
        noItemTargetsMessage: defaults.noItemTargetsMessage,
        description: defaults.description,
      });
    }
    entity.effects = restoreEffects(entity.effects ?? [], entity instanceof BasicHero ? entity.artifact : undefined);
    entity.moving = false;
    entity.tweens = 0;
    if (entity instanceof BasicHero) entity.resetTransientState();
  });
  const Hero = Object.prototype.hasOwnProperty.call(classes, save.heroClass)
    ? classes[save.heroClass as keyof typeof classes] : undefined;
  if (save.version !== 1 || !Hero || !run || !(run.player instanceof Hero) || run.player.healthPoints <= 0 ||
      !(run.floors instanceof Map) || !run.floors.has(save.floor) || run.floor !== save.floor ||
      !Number.isFinite(run.time) || run.time < 0 || !Number.isFinite(run.nextTick) ||
      !Array.isArray(run.messages) || !Array.isArray(run.knowledge?.appearances) ||
      !Array.isArray(run.knowledge?.known)) throw new Error('Invalid saved run');
  if (run.bossesSlain !== undefined) {
    if (!(run.bossesSlain instanceof Set)) throw new Error('Invalid saved run');
    for (const floor of run.bossesSlain) {
      if (!Number.isInteger(floor) || floor < 1 || floor > 25) throw new Error('Invalid saved run');
    }
  }
  for (const [floor, data] of run.floors) {
    if (!Number.isInteger(floor) || floor < 1 || floor > 25 || !data ||
        !Array.isArray(data.map) || !data.map.length || data.map.length > 256 ||
        !data.map.every((row: unknown) => Array.isArray(row) && row.length === data.map[0].length && row.length > 0 && row.length <= 256 && row.every(Number.isFinite)) ||
        !Array.isArray(data.features) || !Array.isArray(data.entities) || !Array.isArray(data.seen) ||
        !Number.isFinite(data.savedAt) || !data.up || !data.down) throw new Error('Invalid saved floor');
    for (const entity of data.entities) {
      if (entity instanceof Mimic) entity.restoreLegacyStrength(floor);
      if (entity instanceof SwarmOfFlies) entity.flying = true;
      // Older saves stored the ice elemental as a chest atlas frame; point it
      // back at the generated crystal art when its sprite is rebuilt.
      if (entity instanceof IceElemental && entity.textureKey !== ICE_ELEMENTAL_TEXTURE) {
        entity.textureKey = ICE_ELEMENTAL_TEXTURE;
        entity.tile = 0;
      }
    }
  }
  // Pending chasm drops are optional: saves written before the chasm chute
  // existed simply have no queue.
  if (run.chasmFallen !== undefined) {
    if (!(run.chasmFallen instanceof Map)) throw new Error('Invalid saved run');
    for (const [floor, items] of run.chasmFallen) {
      if (!Number.isInteger(floor) || floor < 2 || floor > 25 || !Array.isArray(items)) {
        throw new Error('Invalid saved chasm drop');
      }
      for (const item of items) {
        if (!item || item.type !== 'item') throw new Error('Invalid saved chasm drop');
      }
    }
  }
  const active = run.floors.get(run.floor)!;
  if (!Number.isInteger(run.player.x) || !Number.isInteger(run.player.y) ||
      active.map[run.player.y!]?.[run.player.x!] === undefined) throw new Error('Invalid saved position');
  return run;
}

// Install only after the decoded run has been validated. The scene remains
// responsible for maps, sprites, input binding and scheduler deadlines.
export function restoreRunState(context: GameContext, run: RunState): void {
  context.player = run.player;
  context.floor = run.floor;
  context.kills = run.kills;
  context.bossesSlain = run.bossesSlain ?? new Set();
  context.messages = run.messages;
  context.simulationTime = run.time;
  restoreConsumableKnowledge(context, run.knowledge);
  context.chasmFallenItems = run.chasmFallen;
  const items = [...run.player.getAllItems(), ...[...run.floors.values()].flatMap(floor => floor.entities),
    ...(run.chasmFallen ? [...run.chasmFallen.values()].flat() : [])];
  rememberIdentifiedWandTypes(context, items);
  for (const ring of [run.player.ring1, run.player.ring2]) {
    if (ring instanceof Ring) ring.onUpgrade();
  }
  for (const item of items) {
    if (item instanceof Wand) item.reconcileChargeScaling();
  }
}
