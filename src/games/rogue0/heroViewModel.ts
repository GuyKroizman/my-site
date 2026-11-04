import type BasicHero from './classes/basicHero';

type HeroStats = Pick<BasicHero, 'level' | 'xp' | 'strength' | 'healthPoints' |
  'maxHealthPoints' | 'hunger' | 'maxHunger' | 'hungerState' | 'gold' |
  'skill' | 'skillCooldown' | 'xpForNextLevel'>;

// Read-only presentation: no Phaser objects or simulation mutations on heroes.
export function heroStatsText(hero: HeroStats): string {
  let text = `Lv ${hero.level}  Xp ${hero.xp}/${hero.xpForNextLevel()}  Str ${hero.strength}\nHp: ${hero.healthPoints}/${hero.maxHealthPoints}`;
  text += `\nFood: ${Math.ceil(hero.hunger)}/${hero.maxHunger} (${hero.hungerState})  Gold: ${hero.gold}`;
  if (hero.skill !== '') {
    const state = hero.skillCooldown > 0 ? `cd ${hero.skillCooldown}` : 'ready [f]';
    text += `\n${hero.skill}: ${state}`;
  }
  return text;
}

export function heroHudView(hero: Pick<HeroStats, 'healthPoints' | 'maxHealthPoints' | 'level' | 'hunger' | 'hungerState'>, floor: number) {
  return {
    healthFraction: Math.max(0, Math.min(1, hero.healthPoints / Math.max(1, hero.maxHealthPoints))),
    healthText: `${hero.healthPoints}/${hero.maxHealthPoints}`,
    heroStatus: `Lv ${hero.level} · Food ${Math.ceil(hero.hunger)} · ${hero.hungerState}`,
    floorStatus: `Floor ${floor}`,
  };
}
