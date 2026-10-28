import * as effects from './effects';
import type { StatusEffect } from './effects';
import ChaliceOfBlood from './items/ChaliceOfBlood';

// Reattach trusted local behavior, never evaluate code from a save. Do not call
// apply(): stats already include active effects and must not be applied twice.
const factories = new Map<string, (duration?: number) => StatusEffect>();
for (const [name, factory] of Object.entries(effects)) {
  if (name.startsWith('create') && name.endsWith('Effect')) {
    const create = factory as (duration?: number) => StatusEffect;
    factories.set(create().id, create);
  }
}
export function restoreEffects(saved: StatusEffect[], artifact?: unknown): StatusEffect[] {
  return saved.map(effect => {
    if (effect.id === 'chalice-regeneration' && artifact instanceof ChaliceOfBlood) {
      return Object.assign(artifact.regenEffect(), effect);
    }
    const create = factories.get(effect.id);
    if (!create) throw new Error(`Unsupported saved effect: ${effect.id}`);
    return Object.assign(create(effect.duration), effect);
  });
}
