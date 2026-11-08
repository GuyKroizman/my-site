import type { Entity } from './entity';
import { applyInspectChoice } from './context.ts';
import type { InspectChoice } from './context.ts';
import type { HeroControlHost, HeroControlServices } from './heroControlTypes';
import { cursorDirection, isHostile } from './heroControlRules.ts';
import { actorFootprint, bodyDistance } from './actorBodies.ts';
import { actorIsVisible } from './actorVisibility.ts';
import { footprintContains, footprintTiles } from './footprint.ts';

// Inspect/aim mode transitions are free. Projectile resolution remains on the
// hero; this module selects a target without consuming charges or action time.
export function createHeroTargeting(services: HeroControlServices) {
  const { dungeon, isGrassConcealed, hasLineOfSight } = services;
  return {
    cursorDir: (_hero: HeroControlHost, key: string) => cursorDirection(key),
    cursorActive: (hero: HeroControlHost) =>
      hero.context.inspectMode || hero.context.throwMode || !!hero.context.terrainActionMode,
    isCursorKey: (hero: HeroControlHost, key: string) =>
      key === 'x' || key === 'X' || key === 'Escape' || key === 'Enter' || hero.cursorDir(key) !== undefined,

    inspectOrSearch(hero: HeroControlHost): void {
      hero.context.terrainActionMode = false;
      if (hero.context.throwMode) hero.cancelThrow();
      hero.walkPath = [];
      if (hero.context.inspectMode) {
        hero.exitCursorModes();
        hero.context.inspectChoices = undefined;
        hero.search();
      } else {
        hero.toggleInspectMode();
      }
    },

    toggleInspectMode(hero: HeroControlHost): void {
      const context = hero.context;
      context.terrainActionMode = false;
      context.inspectMode = !context.inspectMode;
      context.inspectChoices = undefined;
      context.inspectedEntity = undefined;
      context.inspectedTerrain = undefined;
      if (context.inspectMode) {
        context.cursorX = hero.x;
        context.cursorY = hero.y;
      }
      context.onInspectModeChange?.(context.inspectMode);
    },

    exitCursorModes(hero: HeroControlHost): void {
      const context = hero.context;
      context.terrainActionMode = false;
      if (context.throwMode) {
        hero.cancelThrow();
        return;
      }
      if (context.inspectMode) {
        context.inspectMode = false;
        context.inspectChoices = undefined;
        context.inspectedEntity = undefined;
        context.inspectedTerrain = undefined;
        context.onInspectModeChange?.(false);
      }
    },

    moveCursor(hero: HeroControlHost, dx: number, dy: number): void {
      const context = hero.context;
      if (context.cursorX === undefined || context.cursorY === undefined) {
        context.cursorX = hero.x;
        context.cursorY = hero.y;
      }
      if (context.cursorX === undefined || context.cursorY === undefined) return;
      const level = dungeon.getCurrentLevel();
      const nx = context.cursorX + dx, ny = context.cursorY + dy;
      if (ny < 0 || nx < 0 || ny >= level.length || nx >= level[0].length) return;
      context.cursorX = nx;
      context.cursorY = ny;
      if (context.inspectMode) hero.updateInspectedFromCursor();
    },

    updateInspectedFromCursor(hero: HeroControlHost): void {
      const { cursorX, cursorY } = hero.context;
      if (cursorX !== undefined && cursorY !== undefined) hero.inspectTile(cursorX, cursorY);
    },

    inspectTile(hero: HeroControlHost, x: number, y: number): void {
      const context = hero.context;
      context.inspectChoices = undefined;
      context.inspectedEntity = undefined;
      context.inspectedTerrain = undefined;
      const tileVisible = context.visibleTiles.has(`${x},${y}`);
      const entities = (context.entities ?? []).filter(entity => {
        if (!entity.sprite || entity.type === 'player' ||
            entity.x === undefined || entity.y === undefined) return false;
        // Items are single-cell objects; every other actor is found anywhere
        // inside its physical footprint, so inspecting a wide creature's limb
        // describes the creature rather than the floor beneath it.
        const covers = entity.type === 'item'
          ? entity.x === x && entity.y === y
          : footprintContains(actorFootprint(entity), entity.x, entity.y, x, y);
        if (!covers) return false;
        // Inspect judges the selected cell, not the whole body: an exposed
        // limb is describable even if the centre stands in tall grass.
        if (isGrassConcealed(x, y, hero.x, hero.y)) return false;
        if (tileVisible) return true;
        // A large body stays inspectable from any of its visible cells, even
        // when the tapped cell itself is still dark.
        for (const [tx, ty] of footprintTiles(actorFootprint(entity), entity.x, entity.y)) {
          if (context.visibleTiles.has(`${tx},${ty}`)) return true;
        }
        return false;
      });
      // Never reveal terrain the hero cannot see, even when a wide body is
      // visible through a different cell.
      const info = tileVisible ? dungeon.inspectTileInfo?.(x, y) : undefined;
      // Terrain is its own entry whenever it says more than plain floor, so an
      // item on a trap never hides the trap (and vice versa).
      const choices: InspectChoice[] = entities.map(entity => ({ kind: 'entity', entity }));
      if (info?.label) {
        choices.push({ kind: 'terrain', label: info.label, description: info.description });
      }
      if (choices.length > 1) context.inspectChoices = choices;
      else if (choices.length === 1) applyInspectChoice(context, choices[0]);
      else if (tileVisible) {
        context.inspectedTerrain = info?.description ?? dungeon.inspectTile(x, y);
      }
    },

    closestZapTarget(hero: HeroControlHost): Entity | undefined {
      const context = hero.context;
      if (hero.x === undefined || hero.y === undefined) return undefined;
      const level = dungeon.getCurrentLevel();
      if (!level?.length) return undefined;
      let best: Entity | undefined;
      let bestDistance = Infinity;
      for (const entity of context.entities ?? []) {
        if (!isHostile(entity) || (entity.healthPoints ?? 0) <= 0 || !entity.sprite) continue;
        if (entity.x === undefined || entity.y === undefined) continue;
        if (!context.visibleTiles || !actorIsVisible(entity, context.visibleTiles,
            (x, y) => isGrassConcealed(x, y, hero.x, hero.y))) continue;
        if (!hasLineOfSight(level, hero.x, hero.y, entity.x, entity.y)) continue;
        const distance = bodyDistance(hero, entity);
        if (distance < bestDistance) { best = entity; bestDistance = distance; }
      }
      return best;
    },

    beginThrow(hero: HeroControlHost, item: Entity, zap = false): void {
      const context = hero.context;
      if (!hero.getAllItems().includes(item)) {
        dungeon.log(context, "You don't have that item.");
        return;
      }
      if (item.cursed && hero.slotOf(item) && !zap) {
        dungeon.log(context, `${item.displayName} is cursed and cannot be thrown.`);
        return;
      }
      hero.zapping = zap;
      context.terrainActionMode = false;
      context.throwMode = true;
      context.throwItem = item;
      if (zap) {
        const target = hero.closestZapTarget();
        context.cursorX = target?.x ?? hero.x;
        context.cursorY = target?.y ?? hero.y;
      } else if (context.cursorX === undefined || context.cursorY === undefined) {
        context.cursorX = hero.x;
        context.cursorY = hero.y;
      }
    },

    cancelThrow(hero: HeroControlHost): void {
      if (!hero.context.throwMode) return;
      hero.context.throwMode = false;
      hero.context.throwItem = undefined;
      hero.zapping = false;
    },

    throwAtCursor(hero: HeroControlHost): void {
      const context = hero.context;
      if (!context.throwMode || !context.throwItem) return;
      if (context.cursorX === undefined || context.cursorY === undefined) return;
      hero.throwAt(context.cursorX, context.cursorY);
    },
  };
}
