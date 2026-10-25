// TypeScript errors after site migration - ignoring for game functionality
import BasicHero from "./basicHero";
import type { GameContext } from "../context";
import scrollofFireball from "../items/scrolloffireball";
import scrollofLightning from "../items/scrolloflightning";
import MinorHealPotion from "../items/minorHealPotion";
import dungeon from "../dungeon";
import { applyEffect, createBurningEffect } from "../effects";

export default class Wizard extends BasicHero {
  constructor(context : GameContext, x: number, y: number) {
    super(context);

    this.name = "Wizard";
    this.talentClass = "Wizard";
    this.description =
      "A volatile spellcaster. Passive (Elemental Mastery): +1 damage with fire/shock/magic attacks. Active (Nova, f): burn every visible enemy within 4 tiles.";
    this.healthPoints = 20;
    this.maxHealthPoints = 20;
    this.tile = 49 + 24;

    this.skill = "Nova";
    this.skillDescription = "Burn every visible enemy within 4 tiles.";
    this.skillMaxCooldown = 8;

    const fireball = new scrollofFireball(context);
    const lightning = new scrollofLightning(context);
    this.addItem(fireball);
    this.addItem(lightning);
    this.addItem(new MinorHealPotion(context));
    this.addItem(new MinorHealPotion(context));
    this.equipItem(lightning);

    this.vulnerability = { physical: 1 };

    this.init(context, x, y);
  }

  // Passive: Elemental Mastery — +1 damage with fire/shock/magic attacks.
  attack() {
    let total = super.attack();
    const type = this.currentWeapon()?.damageType;
    if (type === "fire" || type === "shock" || type === "magic") {
      total += 1;
    }
    return total;
  }

  // Active: Nova — apply burning to visible enemies within radius 4.
  useSkill() {
    const enemies = this.visibleEnemiesInRadius(4);
    if (enemies.length === 0) {
      dungeon.log(this.context, "No visible enemies to burn with Nova.");
      return;
    }

    dungeon.log(this.context, `${this.name} unleashes a fiery Nova!`);
    for (const enemy of enemies) {
      applyEffect(enemy, createBurningEffect(3 + this.talentRank("nova")));
    }
    this.spendTurn();
    this.skillCooldown = this.skillMaxCooldown - this.talentRank("focus");
  }
}
