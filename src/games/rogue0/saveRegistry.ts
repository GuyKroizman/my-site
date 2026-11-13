import type { Registry } from './saveCodec';
import BasicHero from './classes/basicHero';
import Warrior from './classes/warrior';
import Dwarf from './classes/dwarf';
import Cleric from './classes/cleric';
import Elf from './classes/elf';
import Wizard from './classes/wizard';
import Axe from './items/axe';
import BerserkPotion from './items/berserkPotion';
import ChaliceOfBlood from './items/ChaliceOfBlood';
import Chest from './items/chest';
import SkeletalRemains from './items/skeletalRemains';
import CursedGem from './items/cursedGem';
import FangOfTheBeast from './items/FangOfTheBeast';
import Gold from './items/gold';
import Hammer from './items/hammer';
import LongSword from './items/longSword';
import PotionOfExperience from './items/PotionOfExperience';
import PotionOfFrost from './items/PotionOfFrost';
import PotionOfHealing from './items/PotionOfHealing';
import PotionOfInvisibility from './items/PotionOfInvisibility';
import PotionOfLevitation from './items/PotionOfLevitation';
import PotionOfLiquidFlame from './items/PotionOfLiquidFlame';
import PotionOfStrength from './items/PotionOfStrength';
import PotionOfToxicGas from './items/PotionOfToxicGas';
import Ration from './items/ration';
import Ring from './items/ring';
import RingOfAccuracy from './items/RingOfAccuracy';
import RingOfElements from './items/RingOfElements';
import RingOfEvasion from './items/RingOfEvasion';
import RingOfHaste from './items/RingOfHaste';
import RingOfMight from './items/RingOfMight';
import ScrollOfFireball from './items/scrolloffireball';
import ScrollOfIdentify from './items/ScrollOfIdentify';
import ScrollOfLightning from './items/scrolloflightning';
import ScrollOfRage from './items/ScrollOfRage';
import ScrollOfBeckoning from './items/ScrollOfBeckoning';
import ScrollOfRecharging from './items/ScrollOfRecharging';
import ScrollOfRemoveCurse from './items/ScrollOfRemoveCurse';
import ScrollOfTeleport from './items/ScrollOfTeleport';
import ScrollOfTerror from './items/ScrollOfTerror';
import ScrollOfUpgrade from './items/ScrollOfUpgrade';
import Shield from './items/shield';
import Shoe from './items/Shoe';
import StoneOfBlink from './items/stoneOfBlink';
import StoneOfDetectCurse from './items/stoneOfDetectCurse';
import Sword from './items/sword';
import { TieredWeapon, TieredArmor } from './items/tieredEquipment';
import Wand from './items/wand';
import WandOfFirebolt from './items/WandOfFirebolt';
import WandOfFrost from './items/WandOfFrost';
import WandOfLightning from './items/WandOfLightning';
import WandOfBlast from './items/WandOfBlast';
import Boss from './monsters/boss';
import Brute from './monsters/brute';
import Cultist from './monsters/cultist';
import DeadlyFrog from './monsters/deadlyFrog';
import { FireElemental, IceElemental, ShockElemental } from './monsters/elemental';
import Ghoul from './monsters/ghoul';
import Goblin from './monsters/goblin';
import Mimic from './monsters/mimic';
import MirrorImage from './monsters/mirrorImage';
import Monster from './monsters/monster';
import Quloptsh from './monsters/quloptsh';
import Skeleton from './monsters/skelaton';
import SwarmOfFlies from './monsters/swarmOfFlies';
import Wraith from './monsters/wraith';

// Permanent wire IDs, NOT paths computed from the current module layout.
// Historical strings deliberately stay unchanged so existing v1 saves (including
// loot constructor references) need no rewrite. When moving/renaming a class,
// change only its import above. Never rename/remove a key without a migration.
// New classes should use semantic IDs such as "item:new-item", not source paths.
export const saveRegistry: Registry = {
  './classes/basicHero.ts:default': BasicHero,
  './classes/cleric.ts:default': Cleric,
  './classes/dwarf.ts:default': Dwarf,
  './classes/elf.ts:default': Elf,
  './classes/warrior.ts:default': Warrior,
  './classes/wizard.ts:default': Wizard,
  './items/axe.ts:default': Axe,
  './items/berserkPotion.ts:default': BerserkPotion,
  './items/ChaliceOfBlood.ts:default': ChaliceOfBlood,
  './items/chest.ts:default': Chest,
  'item:skeletal-remains': SkeletalRemains,
  './items/cursedGem.ts:default': CursedGem,
  './items/FangOfTheBeast.ts:default': FangOfTheBeast,
  // The old Minor/Full Heal Potions were folded into the one Potion of
  // Healing. Their wire IDs stay and resolve to it so existing runs load.
  './items/fullHealPotion.ts:default': PotionOfHealing,
  './items/gold.ts:default': Gold,
  './items/hammer.ts:default': Hammer,
  './items/longSword.ts:default': LongSword,
  './items/minorHealPotion.ts:default': PotionOfHealing,
  './items/PotionOfExperience.ts:default': PotionOfExperience,
  './items/PotionOfFrost.ts:default': PotionOfFrost,
  './items/PotionOfHealing.ts:default': PotionOfHealing,
  './items/PotionOfInvisibility.ts:default': PotionOfInvisibility,
  './items/PotionOfLevitation.ts:default': PotionOfLevitation,
  './items/PotionOfLiquidFlame.ts:default': PotionOfLiquidFlame,
  './items/PotionOfStrength.ts:default': PotionOfStrength,
  './items/PotionOfToxicGas.ts:default': PotionOfToxicGas,
  './items/ration.ts:default': Ration,
  './items/ring.ts:default': Ring,
  './items/RingOfAccuracy.ts:default': RingOfAccuracy,
  './items/RingOfElements.ts:default': RingOfElements,
  './items/RingOfEvasion.ts:default': RingOfEvasion,
  './items/RingOfHaste.ts:default': RingOfHaste,
  './items/RingOfMight.ts:default': RingOfMight,
  './items/scrolloffireball.ts:default': ScrollOfFireball,
  './items/ScrollOfIdentify.ts:default': ScrollOfIdentify,
  './items/scrolloflightning.ts:default': ScrollOfLightning,
  './items/ScrollOfRage.ts:default': ScrollOfRage,
  './items/ScrollOfBeckoning.ts:default': ScrollOfBeckoning,
  './items/ScrollOfRecharging.ts:default': ScrollOfRecharging,
  './items/ScrollOfRemoveCurse.ts:default': ScrollOfRemoveCurse,
  './items/ScrollOfTeleport.ts:default': ScrollOfTeleport,
  './items/ScrollOfTerror.ts:default': ScrollOfTerror,
  './items/ScrollOfUpgrade.ts:default': ScrollOfUpgrade,
  './items/shield.ts:default': Shield,
  './items/Shoe.ts:default': Shoe,
  'item:stone-of-blink': StoneOfBlink,
  'item:stone-of-detect-curse': StoneOfDetectCurse,
  './items/sword.ts:default': Sword,
  './items/tieredEquipment.ts:TieredArmor': TieredArmor,
  './items/tieredEquipment.ts:TieredWeapon': TieredWeapon,
  './items/wand.ts:default': Wand,
  './items/WandOfFirebolt.ts:default': WandOfFirebolt,
  './items/WandOfFrost.ts:default': WandOfFrost,
  './items/WandOfLightning.ts:default': WandOfLightning,
  './items/WandOfBlast.ts:default': WandOfBlast,
  './monsters/boss.ts:default': Boss,
  './monsters/brute.ts:default': Brute,
  './monsters/cultist.ts:default': Cultist,
  './monsters/deadlyFrog.ts:default': DeadlyFrog,
  './monsters/elemental.ts:FireElemental': FireElemental,
  './monsters/elemental.ts:IceElemental': IceElemental,
  './monsters/elemental.ts:ShockElemental': ShockElemental,
  // Retain BOTH historical aliases; the last is the canonical encoding ID.
  './monsters/elemental.ts:default': FireElemental,
  './monsters/ghoul.ts:default': Ghoul,
  './monsters/goblin.ts:default': Goblin,
  './monsters/mimic.ts:default': Mimic,
  './monsters/mirrorImage.ts:default': MirrorImage,
  './monsters/monster.ts:default': Monster,
  './monsters/quloptsh.ts:default': Quloptsh,
  './monsters/skelaton.ts:default': Skeleton,
  './monsters/swarmOfFlies.ts:default': SwarmOfFlies,
  './monsters/wraith.ts:default': Wraith,
};
