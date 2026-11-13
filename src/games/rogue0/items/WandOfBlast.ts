import Wand from './wand';
import type { GameContext } from '../context';
import type { Entity } from '../entity';
import dungeon from '../dungeon';
import { actorFootprint } from '../actorBodies';
import { footprintTiles } from '../footprint';

export default class WandOfBlast extends Wand {
  constructor(context: GameContext, x?: number, y?: number) {
    super(context, {
      name: 'Wand of Blast',
      description: 'Pushes an enemy up to 3 tiles away without direct damage. Hitting a wall or closed door stuns for 3 actions. Grounded enemies pushed into chasms die; their loot falls to a random safe place on the floor below. Firing at an adjacent enemy also pushes you up to 3 tiles backwards, risking a stun or a chasm fall.',
      attackTile: 1,
      damageType: 'magic',
      charges: 3,
    }, x, y);
  }

  get damageBounds(): readonly [number, number] { return [0, 0]; }

  get baseDescription(): string {
    return `${this.description} Charges: ${this.charges}/${this.maxCharges}.`;
  }

  applySpecialImpact(caster: Entity, target: Entity): boolean {
    if (caster.x === undefined || caster.y === undefined || target.x === undefined || target.y === undefined) return true;
    const dx = Math.sign(target.x - caster.x);
    const dy = Math.sign(target.y - caster.y);
    // Check the whole body, not just the anchor of a large enemy. Capture this
    // before pushing/killing the target, so recoil also happens on a fatal fall.
    const adjacent = [...footprintTiles(actorFootprint(target), target.x, target.y)]
      .some(([x, y]) => Math.max(Math.abs(x - caster.x!), Math.abs(y - caster.y!)) === 1);
    dungeon.blastPush(this.context, target, dx, dy);
    if (adjacent) dungeon.blastPush(this.context, caster, -dx, -dy);
    return true;
  }
}
