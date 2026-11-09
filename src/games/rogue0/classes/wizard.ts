// TypeScript errors after site migration - ignoring for game functionality
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import scrollofFireball from "../items/scrolloffireball";
import scrollofLightning from "../items/scrolloflightning";
import PotionOfHealing from "../items/PotionOfHealing";
import { TieredWeapon } from "../items/tieredEquipment";

export default class Wizard extends BasicHero {
  constructor(context : GameContext, x: number, y: number) {
    super(context);

    this.name = "Wizard";
    this.talentClass = "Wizard";
    this.description =
      "A volatile spellcaster. Passive (Elemental Mastery): +1 damage with fire/shock/magic attacks.";
    this.healthPoints = 20;
    this.maxHealthPoints = 20;
    this.tile = 49 + 24;

    // The hero always starts armed: a tier-1 Dagger fills the weapon slot,
    // while the scrolls stay in the backpack as swappable ranged weapons.
    const dagger = new TieredWeapon(context, undefined, undefined, 1);
    const fireball = new scrollofFireball(context);
    const lightning = new scrollofLightning(context);
    this.addItem(dagger);
    this.addItem(fireball);
    this.addItem(lightning);
    this.addItem(new PotionOfHealing(context));
    this.equipItem(dagger);

    this.vulnerability = { physical: 1 };

    this.init(context, x, y);
  }

  // Passive: Elemental Mastery — +1 damage with fire/shock/magic attacks.
  attack() {
    let total = super.attack();
    const type = this.currentWeapon()?.damageType;
    if (type === "fire" || type === "shock" || type === "magic") {
      total += 1 + this.talentRank("mastery");
    }
    return total;
  }
}
