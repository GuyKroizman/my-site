import type { Entity } from "./entity";
import dungeon from "./dungeon";
import { hasEffect, removeEffect } from "./effects";

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
    // Effects tick once per round, right after each entity refreshes its
    // turn resources (movement/action points). Iterating over a copy keeps
    // the loop safe when a status tick kills and removes an entity.
    entities.slice().forEach((e) => {
      e.refresh();
      e.tickEffects();
    });
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
      if (hasEffect(e, "frozen")) {
        dungeon.log(e.context, `${e.name} is frozen and skips their turn.`);
        removeEffect(e, "frozen");
        e.movementPoints = 0;
        e.actionPoints = 0;
      } else {
        e.turn();
      }
    } else {
      turnManager.entityIndex++;
    }
  },

  _isOver: (entities: Entity[]) => entities.every((e) => e.isOver())
};

export default turnManager;
