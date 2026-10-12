import type { Entity } from "./entity";

const turnManager = {
  entityIndex: 0,

  reset: () => {
    turnManager.entityIndex = 0;
  },

  update: (entities: Entity[]) => {
    if (turnManager._isOver(entities)) {
      turnManager._refresh(entities);
    }
    turnManager._turn(entities);
  },

  _refresh: (entities: Entity[]) => {
    entities.forEach((e) => e.refresh());
    turnManager.entityIndex = 0;
  },

  _turn: (entities: Entity[]) => {
    if (!entities || entities.length === 0) {
      return;
    }

    if (turnManager.entityIndex >= entities.length) {
      turnManager.entityIndex = 0;
    }

    let e = entities[turnManager.entityIndex];

    if (!e) {
      return;
    }

    if (!e.isOver()) {
      e.turn();
    } else {
      turnManager.entityIndex++;
    }
  },

  _isOver: (entities: Entity[]) => entities.every((e) => e.isOver())
};

export default turnManager;
