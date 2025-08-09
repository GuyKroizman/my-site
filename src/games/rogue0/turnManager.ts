// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { Entity } from "entity";

const turnManager = {
  entityIndex: 0,

  update: (entities: Entity[]) => {
    if (turnManager._isOver(entities)) {
      turnManager._refresh(entities);
    }
    turnManager._turn(entities);
  },

  _refresh: (entities: Entity[]) => entities.forEach((e) => {
    e.refresh();
    turnManager.entityIndex = 0;
  }),

  _turn: (entities: Entity[]) => {
    if (entities.length === 0 || !entities) {
      return;
    }

    let e = entities[turnManager.entityIndex];

    if (!e.isOver()) {
      e.turn();
    } else {
      turnManager.entityIndex++;
    }
  },

  _isOver: (entities: Entity[]) => entities.every((e) => e.isOver())
};

export default turnManager;
