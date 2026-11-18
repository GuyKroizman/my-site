// Pure talent-tree data: no Phaser, no game state, no imports. The scene, the
// hero and the headless tests all read this same module.

export type HeroClassName = "Warrior" | "Dwarf" | "Cleric" | "Elf" | "Wizard";
export type TalentBonusKind =
  | "maxHealth"
  | "armor"
  | "evasion"
  | "regen"
  | "lowHpDamage"
  | "typedDamage"
  | "haste";

export type TalentNode = {
  id: string;
  name: string;
  description: string;
  branch: string;
  tier: 1 | 2 | 3;
  minLevel: number;
  requires: string[];
  maxRank: number;
  bonus?: { kind: TalentBonusKind; amount: number };
};

const node = (
  id: string,
  name: string,
  description: string,
  branch: string,
  tier: 1 | 2 | 3,
  bonus?: { kind: TalentBonusKind; amount: number },
  requires: string[] = []
): TalentNode => ({
  id, name, description, branch, tier,
  minLevel: tier === 1 ? 2 : tier === 2 ? 5 : 9,
  requires, maxRank: 2, bonus,
});

// Three branches per class, tiers 1/2/3 with a prerequisite chain inside each
// branch. The five legacy talent ids remain the tier-1 root of their class.
export const TALENT_TREE: Record<HeroClassName, TalentNode[]> = {
  Warrior: [
    node("fury", "Deep Fury", "+1 damage at or below half HP per rank.", "Fury", 1, { kind: "lowHpDamage", amount: 1 }),
    node("bloodletter", "Bloodletter", "+1 damage at or below half HP per rank.", "Fury", 2, { kind: "lowHpDamage", amount: 1 }, ["fury"]),
    node("sustainedRage", "Sustained Rage", "+1 HP regenerated each turn per rank.", "Fury", 3, { kind: "regen", amount: 1 }, ["bloodletter"]),
    node("ironResolve", "Iron Resolve", "+3 maximum HP per rank.", "Guard", 1, { kind: "maxHealth", amount: 3 }),
    node("bulwark", "Bulwark", "+1 physical armor per rank.", "Guard", 2, { kind: "armor", amount: 1 }, ["ironResolve"]),
    node("secondWind", "Second Wind", "+2 HP regenerated each turn per rank.", "Guard", 3, { kind: "regen", amount: 2 }, ["bulwark"]),
    node("quickstep", "Quickstep", "+2 evasion per rank.", "Momentum", 1, { kind: "evasion", amount: 2 }),
    node("relentless", "Relentless", "−10% weapon delay per rank.", "Momentum", 2, { kind: "haste", amount: 0.1 }, ["quickstep"]),
    node("unyielding", "Unyielding", "+1 physical armor per rank.", "Momentum", 3, { kind: "armor", amount: 1 }, ["relentless"]),
  ],
  Dwarf: [
    node("armor", "Iron Skin", "+1 physical armor per rank.", "Fortress", 1, { kind: "armor", amount: 1 }),
    node("stoneSkin", "Stone Skin", "+1 physical armor per rank.", "Fortress", 2, { kind: "armor", amount: 1 }, ["armor"]),
    node("deepRoots", "Deep Roots", "+4 maximum HP per rank.", "Fortress", 3, { kind: "maxHealth", amount: 4 }, ["stoneSkin"]),
    node("sunder", "Sunder", "+1 damage at or below half HP per rank.", "Demolition", 1, { kind: "lowHpDamage", amount: 1 }),
    node("heavyBlows", "Heavy Blows", "+1 damage at or below half HP per rank.", "Demolition", 2, { kind: "lowHpDamage", amount: 1 }, ["sunder"]),
    node("siegebreaker", "Siegebreaker", "+3 maximum HP per rank.", "Demolition", 3, { kind: "maxHealth", amount: 3 }, ["heavyBlows"]),
    node("frugality", "Frugality", "+1 physical armor per rank.", "Thrift", 1, { kind: "armor", amount: 1 }),
    node("ironGut", "Iron Gut", "+1 HP regenerated each turn per rank.", "Thrift", 2, { kind: "regen", amount: 1 }, ["frugality"]),
    node("survivor", "Survivor", "+3 maximum HP per rank.", "Thrift", 3, { kind: "maxHealth", amount: 3 }, ["ironGut"]),
  ],
  Cleric: [
    node("mending", "Greater Mending", "+1 HP regenerated each turn per rank.", "Mending", 1, { kind: "regen", amount: 1 }),
    node("renewedFaith", "Renewed Faith", "+1 HP regenerated each turn per rank.", "Mending", 2, { kind: "regen", amount: 1 }, ["mending"]),
    node("holyVigor", "Holy Vigor", "+3 maximum HP per rank.", "Mending", 3, { kind: "maxHealth", amount: 3 }, ["renewedFaith"]),
    node("radiance", "Radiance", "+1 fire/shock/magic damage per rank.", "Light", 1, { kind: "typedDamage", amount: 1 }),
    node("smite", "Smite", "+1 fire/shock/magic damage per rank.", "Light", 2, { kind: "typedDamage", amount: 1 }, ["radiance"]),
    node("sunfire", "Sunfire", "+1 fire/shock/magic damage per rank.", "Light", 3, { kind: "typedDamage", amount: 1 }, ["smite"]),
    node("sanctuary", "Sanctuary", "+1 physical armor per rank.", "Ward", 1, { kind: "armor", amount: 1 }),
    node("wardingLight", "Warding Light", "+2 evasion per rank.", "Ward", 2, { kind: "evasion", amount: 2 }, ["sanctuary"]),
    node("blessedAegis", "Blessed Aegis", "+3 maximum HP per rank.", "Ward", 3, { kind: "maxHealth", amount: 3 }, ["wardingLight"]),
  ],
  Elf: [
    node("grace", "Light Footwork", "+5 evasion per rank.", "Footwork", 1, { kind: "evasion", amount: 5 }),
    node("featherStep", "Feather Step", "+2 evasion per rank.", "Footwork", 2, { kind: "evasion", amount: 2 }, ["grace"]),
    node("windrunner", "Windrunner", "+3 evasion per rank.", "Footwork", 3, { kind: "evasion", amount: 3 }, ["featherStep"]),
    node("keenEye", "Keen Eye", "+1 fire/shock/magic damage per rank.", "Marksman", 1, { kind: "typedDamage", amount: 1 }),
    node("piercingShot", "Piercing Shot", "+1 fire/shock/magic damage per rank.", "Marksman", 2, { kind: "typedDamage", amount: 1 }, ["keenEye"]),
    node("eagleEye", "Eagle Eye", "+1 fire/shock/magic damage per rank.", "Marksman", 3, { kind: "typedDamage", amount: 1 }, ["piercingShot"]),
    node("camouflage", "Camouflage", "+2 evasion per rank.", "Wilderness", 1, { kind: "evasion", amount: 2 }),
    node("woodlandSense", "Woodland Sense", "+1 HP regenerated each turn per rank.", "Wilderness", 2, { kind: "regen", amount: 1 }, ["camouflage"]),
    node("naturesBlessing", "Nature's Blessing", "+3 maximum HP per rank.", "Wilderness", 3, { kind: "maxHealth", amount: 3 }, ["woodlandSense"]),
  ],
  Wizard: [
    node("mastery", "Focused Mastery", "+1 fire/shock/magic damage per rank.", "Mastery", 1, { kind: "typedDamage", amount: 1 }),
    node("arcaneFocus", "Arcane Focus", "+1 fire/shock/magic damage per rank.", "Mastery", 2, { kind: "typedDamage", amount: 1 }, ["mastery"]),
    node("elementalSurge", "Elemental Surge", "+1 fire/shock/magic damage per rank.", "Mastery", 3, { kind: "typedDamage", amount: 1 }, ["arcaneFocus"]),
    node("wandLore", "Wand Lore", "+1 fire/shock/magic damage per rank.", "Arcana", 1, { kind: "typedDamage", amount: 1 }),
    node("manaWell", "Mana Well", "+1 HP regenerated each turn per rank.", "Arcana", 2, { kind: "regen", amount: 1 }, ["wandLore"]),
    node("spellWeave", "Spell Weave", "+1 physical armor per rank.", "Arcana", 3, { kind: "armor", amount: 1 }, ["manaWell"]),
    node("stillness", "Stillness", "+2 evasion per rank.", "Control", 1, { kind: "evasion", amount: 2 }),
    node("frostWard", "Frost Ward", "+1 physical armor per rank.", "Control", 2, { kind: "armor", amount: 1 }, ["stillness"]),
    node("mindShield", "Mind Shield", "+3 maximum HP per rank.", "Control", 3, { kind: "maxHealth", amount: 3 }, ["frostWard"]),
  ],
};

export const ALL_TALENT_NODES: TalentNode[] = Object.values(TALENT_TREE).flat();

export function talentNodesFor(className?: HeroClassName): TalentNode[] {
  return className ? (TALENT_TREE[className] ?? []) : [];
}

export function talentNodeById(id: string): TalentNode | undefined {
  return ALL_TALENT_NODES.find(entry => entry.id === id);
}

export function talentRankOf(ranks: Record<string, number>, id: string): number {
  return Math.max(0, Math.min(2, ranks?.[id] ?? 0));
}

export function spentTalentRanks(ranks: Record<string, number>, className?: HeroClassName): number {
  return talentNodesFor(className).reduce((sum, entry) => sum + talentRankOf(ranks, entry.id), 0);
}

export function isTalentUnlocked(entry: TalentNode, ranks: Record<string, number>, level: number): boolean {
  return level >= entry.minLevel && entry.requires.every(id => talentRankOf(ranks, id) >= 1);
}

export function talentBonus(
  kind: TalentBonusKind,
  ranks: Record<string, number>,
  className?: HeroClassName
): number {
  return talentNodesFor(className).reduce((sum, entry) =>
    entry.bonus?.kind === kind ? sum + talentRankOf(ranks, entry.id) * entry.bonus.amount : sum, 0);
}
