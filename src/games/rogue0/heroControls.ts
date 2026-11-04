import dungeon from './dungeon';
import { isModalOpen } from './context';
import { hasEffect } from './effects';
import { getTrapState, isGrassConcealed } from './tiles';
import { hasLineOfSight } from './fov';
import { actionCost, starvationDamageDuring } from './timing';
import { createHeroNavigation } from './heroNavigation';
import { createHeroTargeting } from './heroTargeting';
import { createHeroInput } from './heroInput';

const services = { dungeon, isModalOpen, hasEffect, getTrapState,
  isGrassConcealed, hasLineOfSight, actionCost, starvationDamageDuring };

// Runtime wiring only; actor state is always supplied explicitly. Import the
// individual factories in headless tests, not this Phaser-connected adapter.
export const heroControls = {
  ...createHeroNavigation(services),
  ...createHeroTargeting(services),
  ...createHeroInput(services),
};
