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

// One label for every place a remaining time is shown (status icon badge,
// icon tooltip, character modal). Curses and artifact auras never expire, so
// they read as ∞ instead of a misleading huge number.
export function statusDurationLabel(effect: { duration: number; manualExpiry?: boolean }): string {
  const infinite = effect.manualExpiry || effect.duration === Number.POSITIVE_INFINITY;
  return infinite ? "∞" : `${effect.duration}`;
}

// The HUD portrait shows the hero's own sprite, so it uses the same
// `spriteTextureKey`/`spriteFrame` the actor renders. With no hero yet it draws
// the base hero art rather than an unrelated atlas character.
type HeroSprite = Pick<BasicHero, 'spriteTextureKey' | 'spriteFrame'>;

export function heroPortrait(hero: HeroSprite | undefined): { textureKey: string; frame: number } {
  return {
    textureKey: hero?.spriteTextureKey ?? 'hero-color',
    frame: hero?.spriteFrame ?? 0,
  };
}
