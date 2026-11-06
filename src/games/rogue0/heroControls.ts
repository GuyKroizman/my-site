import dungeon from './dungeon';
import { isModalOpen, type GameContext } from './context';
import { hasEffect } from './effects';
import { terrainFor } from './terrain';
import { hasLineOfSight } from './fov';
import { actionCost, starvationDamageDuring } from './timing';
import { createHeroNavigation } from './heroNavigation';
import { createHeroTargeting } from './heroTargeting';
import { createHeroInput } from './heroInput';
import type { HeroControlServices } from './heroControlTypes';

function createControls(context: GameContext) {
  const terrain = terrainFor(context);
  const services: HeroControlServices = { dungeon, isModalOpen, hasEffect,
    isGrassConcealed: terrain.isGrassConcealed,
    hasLineOfSight: (map, x, y, tx, ty) => hasLineOfSight(map, x, y, tx, ty, terrain),
    actionCost, starvationDamageDuring };
  return { ...createHeroNavigation(services), ...createHeroTargeting(services),
    ...createHeroInput(services) };
}

// Runtime wiring only. Cache by owner so input disposal/binding state is stable
// while terrain reads can never fall back to whichever run was created last.
const controls = new WeakMap<GameContext, ReturnType<typeof createControls>>();
export function heroControlsFor(context: GameContext) {
  let instance = controls.get(context);
  if (!instance) {
    instance = createControls(context);
    controls.set(context, instance);
  }
  return instance;
}
