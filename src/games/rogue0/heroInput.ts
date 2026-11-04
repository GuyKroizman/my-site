import type { GameContext } from './context';
import type { HeroControlHost, HeroControlServices, PointerPosition } from './heroControlTypes';
import { isHostile, hostileAtTile } from './heroControlRules.ts';

// Input dispatch only: targeting/navigation decide what a command means. Event
// subscriptions are runtime-only, idempotent, and removed on scene shutdown.
export function createHeroInput(services: HeroControlServices) {
  const { dungeon, isModalOpen, isGrassConcealed, hasLineOfSight } = services;
  const bindings = new WeakMap<HeroControlHost, () => void>();
  return {
    bindInput(hero: HeroControlHost): void {
      const context = hero.context;
      const input = context.scene?.input;
      const keyboard = input?.keyboard;
      if (!input || !keyboard) throw new Error('Error in PlayerCharacter context is undefined');
      bindings.get(hero)?.();
      const onKey = (event: KeyboardEvent) => {
        if (isModalOpen(hero.context)) return;
        if (hero.cursorDir(event.key)) event.preventDefault();
        if (hero.canAct() || (hero.cursorActive() && hero.isCursorKey(event.key))) hero.processInput(event.key);
        else hero.bufferKey(event.key);
      };
      const onPointer = (event: PointerPosition) => hero.processTouchInput(context, event);
      const events = context.scene?.events;
      const dispose = () => {
        keyboard.off('keydown', onKey);
        input.off('pointerup', onPointer);
        events?.off('shutdown', dispose);
        if (bindings.get(hero) === dispose) bindings.delete(hero);
      };
      bindings.set(hero, dispose);
      keyboard.on('keydown', onKey);
      input.on('pointerup', onPointer);
      events?.once('shutdown', dispose);
    },

    bufferKey(hero: HeroControlHost, key: string): void {
      if (hero.inputBuffer.length < 4) hero.inputBuffer.push(key);
    },

    drainInputBuffer(hero: HeroControlHost): void {
      if (!hero.canAct() || hero.inputBuffer.length === 0) return;
      const key = hero.inputBuffer.shift();
      if (key !== undefined) hero.processInput(key);
    },

    processInput(hero: HeroControlHost, key: string): void {
      const context = hero.context;
      if (isModalOpen(context)) return;
      if (hero.cursorActive()) {
        if (key === 'Escape') { hero.exitCursorModes(); return; }
        if (key === 'x' || key === 'X') {
          if (context.terrainActionMode) hero.exitCursorModes();
          else if (context.throwMode) hero.cancelThrow();
          else hero.toggleInspectMode();
          return;
        }
        if (key === 'Enter') {
          if (context.throwMode) hero.throwAtCursor();
          return;
        }
        const dir = hero.cursorDir(key);
        if (dir) hero.moveCursor(dir.dx, dir.dy);
        return;
      }
      if (key === 'x' || key === 'X') { hero.toggleInspectMode(); return; }
      if (!hero.canAct()) return;
      if (key === 'f' || key === 'F') { hero.tryUseSkill(); return; }
      if (key === 's' || key === 'S') { hero.search(); return; }
      if (key === ' ') { hero.waitTurn(); return; }
      const dir = hero.cursorDir(key);
      if (dir) hero.stepManually(dir.dx, dir.dy);
    },

    processTouchInput(hero: HeroControlHost, context: GameContext, event: PointerPosition): void {
      if (isModalOpen(context) || context.pinching || context.panning) return;
      if (context.map === undefined) throw new Error('context.map is undefined');
      const x = context.map.worldToTileX(event.worldX);
      const y = context.map.worldToTileY(event.worldY);
      let entity = dungeon.entityAtTile(context, x!, y!);
      if (entity && isGrassConcealed(entity.x, entity.y, hero.x, hero.y)) entity = undefined;
      // Wands select an enemy first, then confirm; ordinary throws fire on tap.
      if (context.throwMode) {
        if (hero.zapping && x !== null && y !== null) {
          const hostile = hostileAtTile(context, x, y);
          if (hostile && !isGrassConcealed(hostile.x, hostile.y, hero.x, hero.y)) {
            if (context.cursorX === x && context.cursorY === y) hero.throwAt(x, y);
            else { context.cursorX = x; context.cursorY = y; }
            return;
          }
        }
        hero.throwAt(x!, y!);
        return;
      }
      if (context.inspectMode) {
        if (x !== null && y !== null) {
          hero.exitCursorModes();
          hero.inspectTile(x, y);
        }
        return;
      }
      if (x !== null && y !== null && hero.x === x && hero.y === y &&
          x === context.upstairsX && y === context.upstairsY) {
        context.onAscend?.();
        return;
      }
      if (x !== null && y !== null && hero.x === x && hero.y === y &&
          x === context.stairsX && y === context.stairsY) {
        context.onDescend?.();
        return;
      }
      if (entity && isHostile(entity)) {
        const weapon = hero.currentWeapon();
        const ranged = weapon && weapon.range() > 0 ? weapon.attackTile || weapon.tile : false;
        const distance = weapon ? dungeon.distanceBetweenEntities(hero, entity) : 0;
        const los = hasLineOfSight(dungeon.getCurrentLevel(), hero.x!, hero.y!, entity.x!, entity.y!);
        if (weapon && ranged && los && distance <= weapon.range() && hero.canAct()) {
          dungeon.attackEntity(context, hero, entity, ranged, weapon.tint, weapon.damageType);
          hero.spendTurn('attack');
        } else hero.setWalkTarget(entity.x!, entity.y!, entity);
        return;
      }
      if (entity && entity.type === 'item') hero.setWalkTarget(entity.x!, entity.y!);
      else hero.setWalkTarget(x!, y!);
    },
  };
}
