import type { Entity } from './entity';
import type { HeroControlHost, HeroControlServices, TilePosition } from './heroControlTypes';
import { isHostile, pickupMessage } from './heroControlRules.ts';

// Path planning and movement policy. The scheduler/terrain still own movement
// execution; these operations never advance time except through spendTurn().
export function createHeroNavigation(services: HeroControlServices) {
  const { dungeon, hasEffect, isGrassConcealed, getTrapState, isModalOpen,
    actionCost, starvationDamageDuring } = services;
  return {
    nextStepToward(hero: HeroControlHost, tx: number, ty: number): TilePosition | null {
      if (hero.x === undefined || hero.y === undefined) return null;
      const path = dungeon.findPath(hero.x, hero.y, tx, ty, true, true, hero);
      return path.length > 1 ? { x: path[1][0], y: path[1][1] } : null;
    },

    setWalkTarget(hero: HeroControlHost, tx: number, ty: number, target?: Entity): void {
      if (hero.x === undefined || hero.y === undefined) return;
      hero.walkTargetEntity = target && isHostile(target) ? target : undefined;
      if (hero.tryStepIntoChasm(tx, ty)) return;
      hero.context.onResumeFollow?.();
      // A new command acknowledges current threats, never enemies discovered
      // later on the route. Track identities, not their last seen positions.
      hero.acknowledgedWalkEnemies = new Set(hero.context.entities.filter(entity =>
        isHostile(entity) && entity.healthPoints > 0 &&
        hero.context.visibleTiles.has(`${entity.x},${entity.y}`) &&
        !isGrassConcealed(entity.x, entity.y, hero.x, hero.y)));
      const path = dungeon.findPath(hero.x, hero.y, tx, ty, true, true, hero);
      hero.walkPath = path.length > 1 ? path.slice(1).map(([x, y]) => ({ x, y })) : [];
    },

    stepAutoWalk(hero: HeroControlHost): void {
      if (isModalOpen(hero.context) || hero.walkPath.length === 0) return;
      if (hero.context.entities.some(entity => isHostile(entity) && entity.healthPoints > 0 &&
          !hero.acknowledgedWalkEnemies.has(entity) &&
          hero.context.visibleTiles.has(`${entity.x},${entity.y}`) &&
          !isGrassConcealed(entity.x, entity.y, hero.x, hero.y))) {
        hero.walkPath = [];
        hero.walkTargetEntity = undefined;
        return;
      }
      if (!hero.canAct()) return;

      // Pursue visible moving targets; stop on death, or continue to the last
      // known tile when a target leaves sight. Never chase an unseen position.
      if (hero.walkTargetEntity) {
        const target = hero.walkTargetEntity;
        const alive = isHostile(target) && target.healthPoints > 0 &&
          target.x !== undefined && target.y !== undefined && hero.context.entities.includes(target);
        if (!alive || hero.x === undefined || hero.y === undefined) {
          hero.walkTargetEntity = undefined;
          hero.walkPath = [];
          return;
        }
        if (!hero.context.visibleTiles.has(`${target.x},${target.y}`) ||
            isGrassConcealed(target.x, target.y, hero.x, hero.y)) {
          hero.walkTargetEntity = undefined;
        } else {
          const path = dungeon.findPath(hero.x, hero.y, target.x!, target.y!, true, true, hero);
          hero.walkPath = path.length > 1 ? path.slice(1).map(([x, y]) => ({ x, y })) : [];
          if (hero.walkPath.length === 0) {
            hero.walkTargetEntity = undefined;
            return;
          }
        }
      }
      const destination = hero.walkPath[hero.walkPath.length - 1];
      const step = destination ? hero.nextStepToward(destination.x, destination.y) : null;
      if (!step) {
        hero.walkPath = [];
        hero.walkTargetEntity = undefined;
        return;
      }
      const entity = dungeon.entityAtTile(hero.context, step.x, step.y);
      // Recheck before every action, including pickups/doors: speed and health
      // can change during travel. Automatic starvation deaths are avoidable.
      if (hero.hunger <= 0) {
        const action = entity && isHostile(entity) ? 'attack' : 'move';
        const duration = actionCost(hero, action, hero.currentWeapon()?.attackDelay ?? hero.attackDelay);
        if (starvationDamageDuring(hero.context.simulationTime ?? 0, duration) >= hero.healthPoints) {
          hero.walkPath = [];
          hero.walkTargetEntity = undefined;
          dungeon.log(hero.context, 'Auto-walk stopped: starvation would kill you. Eat or heal before continuing.');
          return;
        }
      }
      if (entity && isHostile(entity)) {
        hero.walkPath = [];
        hero.walkTargetEntity = undefined;
        if (hero.canAct()) {
          const weapon = hero.currentWeapon();
          if (weapon) {
            const ranged = weapon.range() > 0 ? weapon.attackTile || weapon.tile : 0;
            dungeon.attackEntity(hero.context, hero, entity, ranged, weapon.tint, weapon.damageType);
            hero.spendTurn('attack');
          }
        }
        return;
      }
      if (hasEffect(hero, 'rooted')) {
        hero.walkPath = [];
        hero.walkTargetEntity = undefined;
        return;
      }
      if (hasEffect(hero, 'confused') && dungeon.confusedMove(hero.context, hero)) return;
      if (entity && entity.type === 'item') {
        hero.walkPath = [];
        if (entity.isContainer) {
          entity.openContainer();
          return;
        }
        if (hero.addItem(entity)) {
          dungeon.itemPicked(entity);
          dungeon.log(hero.context, pickupMessage(entity));
          hero.spendTurn('move');
          dungeon.moveEntityTo(hero.context, hero, step.x, step.y);
        }
        return;
      }
      if (dungeon.openDoor(step.x, step.y)) {
        hero.spendTurn('openDoor');
        return;
      }
      if (dungeon.isWalkableTile(hero.context, step.x, step.y)) {
        hero.walkPath.shift();
        hero.spendTurn('move');
        dungeon.moveEntityTo(hero.context, hero, step.x, step.y);
      } else {
        hero.walkPath = [];
        hero.walkTargetEntity = undefined;
      }
    },

    tryStepIntoChasm(hero: HeroControlHost, x: number, y: number): boolean {
      if (!dungeon.canEnterChasm(hero.context, hero, x, y)) return false;
      hero.walkPath = [];
      hero.inputBuffer = [];
      if (!hero.canAct() || isModalOpen(hero.context)) return true;
      const warning = hero.context.floor === 25 ? 'You will fall to your death.'
        : 'You will fall to the level below and take damage (1/3 of your maximum HP).';
      const floor = hero.context.floor, originX = hero.x, originY = hero.y;
      hero.context.onConfirmChasm?.(warning, () => {
        if (hero.context.floor !== floor || hero.x !== originX || hero.y !== originY ||
            hero.healthPoints <= 0 || !hero.canAct() || isModalOpen(hero.context)) return;
        if (dungeon.stepIntoChasm(hero.context, hero, x, y)) hero.spendTurn('move');
      });
      return true;
    },

    stepManually(hero: HeroControlHost, dx: number, dy: number): void {
      if (!hero.canAct()) return;
      const context = hero.context;
      const oldX = hero.x!, oldY = hero.y!;
      let newX = oldX + dx, newY = oldY + dy;
      if (hasEffect(hero, 'confused') && dungeon.entityAtTile(context, newX, newY)?.type !== 'enemy' &&
          dungeon.confusedMove(context, hero)) return;
      context.onResumeFollow?.();
      hero.walkPath = [];
      if (!dungeon.canStepBetween(oldX, oldY, newX, newY, hero)) return;
      // Revealed traps require explicitly tapping their tile, not a direction key.
      if (getTrapState(newX, newY) === 'visible') return;
      if (hasEffect(hero, 'rooted') && dungeon.entityAtTile(context, newX, newY)?.type !== 'enemy') return;
      if (hero.tryStepIntoChasm(newX, newY)) return;
      if (dungeon.openDoor(newX, newY)) {
        hero.spendTurn('openDoor');
        return;
      }
      if (!dungeon.isWalkableTile(context, newX, newY)) {
        const entity = dungeon.entityAtTile(context, newX, newY);
        if (entity && isHostile(entity)) {
          const weapon = hero.currentWeapon();
          if (!weapon) return;
          const ranged = weapon.range() > 0 ? weapon.attackTile || weapon.tile : 0;
          dungeon.attackEntity(context, hero, entity, ranged, weapon.tint, weapon.damageType);
          hero.spendTurn('attack');
        }
        if (entity && entity.type === 'item' && !hasEffect(hero, 'rooted')) {
          if (entity.isContainer) {
            entity.openContainer();
            return;
          }
          if (hero.addItem(entity)) {
            dungeon.itemPicked(entity);
            dungeon.log(context, pickupMessage(entity));
          } else {
            newX = oldX; newY = oldY;
          }
        } else {
          newX = oldX; newY = oldY;
        }
      }
      if (newX !== oldX || newY !== oldY) {
        if (hasEffect(hero, 'rooted')) return;
        hero.spendTurn('move');
        dungeon.moveEntityTo(context, hero, newX, newY);
      }
    },
  };
}
