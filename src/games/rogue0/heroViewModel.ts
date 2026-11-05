import type BasicHero from './classes/basicHero';

type HeroStats = Pick<BasicHero, 'level' | 'xp' | 'strength' | 'healthPoints' |
  'maxHealthPoints' | 'hunger' | 'maxHunger' | 'hungerState' | 'gold' |
  'xpForNextLevel'>;

// Read-only presentation: no Phaser objects or simulation mutations on heroes.
export function heroStatsText(hero: HeroStats): string {
  let text = `Lv ${hero.level}  Xp ${hero.xp}/${hero.xpForNextLevel()}  Str ${hero.strength}\nHp: ${hero.healthPoints}/${hero.maxHealthPoints}`;
  text += `\nFood: ${Math.ceil(hero.hunger)}/${hero.maxHunger} (${hero.hungerState})  Gold: ${hero.gold}`;
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
