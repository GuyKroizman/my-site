// Pure, browser-free music-state selector. Given a game context it decides
// which instruments can be heard and how intense the music should be. No audio
// and no Phaser objects here, so the rules can be unit-tested directly.

import type { GameContext } from './context.ts';
import type { Entity } from './entity.ts';

export type MusicCue =
  | 'goblin'
  | 'skeleton'
  | 'boss'
  | 'ghoul'
  | 'brute'
  | 'cultist'
  | 'wraith'
  | 'quloptsh'
  | 'mimic'
  | 'deadlyFrog'
  | 'swarmOfFlies'
  | 'fireElemental'
  | 'iceElemental'
  | 'lightningElemental';
export type MusicIntensity = 'calm' | 'uneasy' | 'combat' | 'boss';
export type ActiveCue = { cue: MusicCue; level: number; visible: boolean };
export type MusicState = { intensity: MusicIntensity; cues: ActiveCue[] };

// Sound travels through walls and closed doors; this is a hint, not sight.
// Music changes with distance up to this radius.
export const HEARING_RADIUS = 10;
const COMBAT_RADIUS = 3;

type MusicEntity = Entity & {
  musicCue?: MusicCue;
  sleeping?: boolean;
  isDecoy?: boolean;
};

const NAME_CUES: Record<string, MusicCue> = {
  Goblin: 'goblin',
  Skeleton: 'skeleton',
  'The Unblinking Coil': 'boss',
  Ghoul: 'ghoul',
  Brute: 'brute',
  Cultist: 'cultist',
  Wraith: 'wraith',
  Quloptsh: 'quloptsh',
  Mimic: 'mimic',
  'Deadly Frog': 'deadlyFrog',
  'Swarm of Flies': 'swarmOfFlies',
  'Fire Elemental': 'fireElemental',
  'Ice Elemental': 'iceElemental',
  'Lightning Elemental': 'lightningElemental',
};

function cueFor(entity: Entity): MusicCue | undefined {
  const e = entity as MusicEntity;
  if (e.musicCue) return e.musicCue;
  // Fallbacks keep older saves (which have no `musicCue`) working.
  return NAME_CUES[e.name];
}

function distance(player: Entity, entity: Entity): number {
  if (player.x === undefined || player.y === undefined ||
      entity.x === undefined || entity.y === undefined) return Infinity;
  return Math.hypot(player.x - entity.x, player.y - entity.y);
}

function visible(context: GameContext, entity: Entity): boolean {
  return entity.x !== undefined && entity.y !== undefined &&
    context.visibleTiles.has(`${entity.x},${entity.y}`);
}

export function selectMusicState(context: GameContext): MusicState {
  const player = context.player as Entity | undefined;
  if (!player) return { intensity: 'calm', cues: [] };

  const cues: ActiveCue[] = [];
  let combat = false;

  for (const entity of context.entities) {
    if (entity === player || entity.type !== 'enemy' || entity.healthPoints <= 0) continue;
    if ((entity as MusicEntity).isDecoy) continue; // mirror images are not characters
    const cue = cueFor(entity);
    if (!cue) continue;

    // The guardian owns the soundtrack on its floor, at any distance.
    if (cue === 'boss') {
      return {
        intensity: 'boss',
        cues: [{ cue: 'boss', level: 1, visible: visible(context, entity) }],
      };
    }

    const dist = distance(player, entity);
    if (dist > HEARING_RADIUS) continue;
    const sleeping = (entity as MusicEntity).sleeping === true;

    // A dormant mimic looks like a chest; its motif would spoil the surprise.
    if (sleeping && entity.name === 'Mimic') continue;

    let level = (HEARING_RADIUS - dist) / HEARING_RADIUS;
    if (sleeping) level *= 0.25;
    const isVisible = visible(context, entity);
    if (isVisible) level = Math.min(1, level + 0.25);
    cues.push({ cue, level: Math.max(0, Math.min(1, level)), visible: isVisible });

    if (!sleeping && (dist <= COMBAT_RADIUS || entity.awareOfPlayer)) combat = true;
  }

  cues.sort((a, b) => b.level - a.level);
  return {
    intensity: combat ? 'combat' : cues.length > 0 ? 'uneasy' : 'calm',
    cues,
  };
}

/** Cheap equality check so the scene only updates the engine on real changes. */
export function sameMusicState(a: MusicState, b: MusicState): boolean {
  if (a.intensity !== b.intensity || a.cues.length !== b.cues.length) return false;
  return a.cues.every((cue, i) => {
    const other = b.cues[i];
    return cue.cue === other.cue && cue.visible === other.visible &&
      Math.abs(cue.level - other.level) < 0.001;
  });
}
