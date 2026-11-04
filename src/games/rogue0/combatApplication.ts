import type { Entity } from './entity';
import type { GameContext } from './context';
import type { CombatResult } from './combat';
import type { StatusEffect } from './effects';

// Gameplay mutations are explicit ports: no Phaser, global dungeon, or animation
// dependency. Callers choose attack-specific hooks, not a second damage pipeline.
export type AttackApplication = {
  applyEffect: (target: Entity, effect: StatusEffect) => void;
  removeEffect: (target: Entity, id: string) => void;
  removeEntity: (context: GameContext, target: Entity) => void;
  // After damage/invisibility/water conduction, before status effects. Used for
  // attack messages, weapon/armor curses, and the lightning wand's secondary arc.
  onHit?: () => void;
  afterEffects?: () => void;
  // Wands historically do not invoke physical-hit reactions. Keep that policy
  // explicit rather than accidentally changing it while consolidating attacks.
  notifyVictim?: boolean;
  applyZeroDamage?: boolean;
};

export function applyAttackResult(
  context: GameContext,
  attacker: Entity,
  victim: Entity,
  result: CombatResult,
  hooks: AttackApplication
): void {
  if (!result.hit) return;

  if (result.damage > 0 || hooks.applyZeroDamage) victim.takeDamage(result.damage);
  if (result.damage > 0) {
    if (attacker.type === 'player' && attacker.effects.some(effect => effect.id === 'invisible')) {
      hooks.removeEffect(attacker, 'invisible');
    }
    if (result.damageType === 'shock') context.onShockWater?.(victim, result.damage);
  }

  hooks.onHit?.();
  for (const effect of result.appliedEffects) {
    if (victim.healthPoints > 0) hooks.applyEffect(victim, effect);
  }
  hooks.afterEffects?.();
  if (hooks.notifyVictim !== false) victim.onHitBy?.(attacker, result.damageType, result.damage);
  if (victim.healthPoints <= 0) hooks.removeEntity(context, victim);
}
