// TypeScript errors after site migration - ignoring for game functionality
import Phaser from "phaser";
import type { GameContext } from "./context";
import { sfx } from "./audio";
import type { DamageType, StatusEffect } from "./effects";
import { tickEffects as tickStatusEffects } from "./effects";
import { actionCost, type ActionKind } from "./timing";

export type EntityType = "player" | "enemy" | "item";

export type EquipSlot =
  | "weapon"
  | "armor"
  | "ring"
  | "artifact"
  | "consumable"
  | "junk";

export abstract class Entity {
  healthPoints: number = 0;
  maxHealthPoints: number = 0;
  movementSpeed: number = 1;
  // Time required for an attack; weapons override this independently of walking.
  attackDelay: number = 1;
  nextActionTime: number = 0;
  actionReady: boolean = false;
  visionRadius: number = 0;
  tweens: number = 0;
  x?: number;
  y?: number;
  moving: boolean = false;
  sprite: Phaser.GameObjects.Sprite | undefined;
  tile: number = 0;
  name: string = "Unknown Entity";
  description: string = "Unknown Entity Description";
  type: EntityType = "enemy";
  UISprite?: Phaser.GameObjects.Sprite;
  UIText?: Phaser.GameObjects.Text;
  context!: GameContext;
  attackTile: number = 11 * 49 + 11;
  projectileTexture?: string;
  tint: number | undefined = undefined;
  // Optional texture key (e.g. generated potion flasks). Falls back to "tiles".
  textureKey?: string;
  consumable: boolean = false;
  // Sight at the start of the last decision, not after moving into view.
  // Pursuit memory is separate: a hunting enemy can still be ambushed.
  awareOfPlayer: boolean = false;
  lastSeenX?: number;
  lastSeenY?: number;
  xpValue: number = 0;

  // Item model v2 (G3). Optional with defaults so existing items still
  // compile without setting them.
  tier: number = 1;
  identified: boolean = true;
  cursed: boolean = false;
  blessed: boolean = false;
  level: number = 0;
  charges: number = 0;
  equipSlot: EquipSlot = "junk";
  // Number of identical items stacked in this one slot (consumables).
  count: number = 1;
  // Floor currency is collected into the wallet, never into backpack slots.
  goldAmount: number = 0;

  // Status effects and combat stats used by effects.ts / combat.ts.
  effects: StatusEffect[] = [];
  accuracy: number = 95;
  evasion: number = 0;
  resistance: Partial<Record<DamageType, number>> = {};
  vulnerability: Partial<Record<DamageType, number>> = {};
  damageType: DamageType = "physical";

  // Hidden-style name used before an item is identified ("?scroll", "?ring").
  get displayName(): string {
    if (this.identified) {
      return this.type === "item" && this.level > 0 ? `${this.name} +${this.level}` : this.name;
    }
    switch (this.equipSlot) {
      case "weapon":
        return /wand/i.test(this.name) ? "Wand" : "Weapon";
      case "armor":
        return "Armor";
      case "ring":
        return "Ring";
      case "artifact":
        return "Artifact";
      case "consumable":
        return /scroll/i.test(this.name) ? "Scroll" : "Potion";
      default:
        return "Item";
    }
  }

  // Generic icon used while an item is unidentified (distinguishes category
  // without revealing what the item is).
  get unidentifiedTextureKey(): string {
    // Preserve visible scroll glyphs and potion colours before identification,
    // while still hiding the item's name/effect.
    if (this.textureKey?.startsWith("scroll-") || this.textureKey?.startsWith("potion-")) {
      return this.textureKey;
    }
    switch (this.equipSlot) {
      case "consumable":
        return /scroll/i.test(this.name) ? "unknown-scroll" : "unknown-potion";
      case "weapon":
        return /wand/i.test(this.name) ? "unknown-wand" : "unknown-item";
      case "ring":
        return "unknown-ring";
      case "artifact":
        return "unknown-artifact";
      default:
        return "unknown-item";
    }
  }

  // Texture + frame to use when rendering this entity's sprite.
  get spriteTextureKey(): string {
    return this.textureKey ?? "foreground-tiles";
  }

  get spriteFrame(): number {
    return this.textureKey ? 0 : this.tile;
  }

  init(context: GameContext, x?: number, y?: number) {

    this.x = x;
    this.y = y;
    this.context = context;

    // x, y are not provided if the entity is an item carried (equipped) by the player
    // (not on the map)
    if (this.x !== undefined && this.y !== undefined) {
      this.sprite = createSprite(context, this.x, this.y, this.tile, this.tint, this.textureKey);
      // Actors render above floor loot regardless of spawn/drop order, but
      // enemies remain below the fog layer (100).
      this.sprite.setDepth(this.type === "item" ? 1 : this.type === "enemy" ? 2 : 200);

      // Floor items pulse gently so they stand out.
      if (this.type === "item" && this.sprite) {
        context.scene?.tweens.add({
          targets: this.sprite,
          alpha: { from: 0.7, to: 1 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
      }
    } else {
      this.sprite = undefined;
    }
  }

  takeDamage(amount: number, interruptNavigation = true): void {
    this.healthPoints -= amount;
    const player = this.context?.player;
    if (interruptNavigation && amount > 0 && player && (player as Entity) === this) {
      player.walkPath = [];
    }
  }

  spendTime(action: ActionKind, weaponDelay = this.attackDelay): void {
    this.nextActionTime += actionCost(this, action, weaponDelay);
    this.actionReady = false;
  }

  abstract equip(): void;

  // Optional hook called when this item is removed from an equipment slot.
  unequip?(): void;

  abstract refresh(): void;

  abstract turn(): void;

  abstract isOver(): boolean;

  abstract attack(): number;

  abstract protection(): number;

  abstract range(): number;

  abstract damage(): number;

  abstract onDestroy(): void;

  createUI?(options: { scene: Phaser.Scene, x: number, y: number, width?: number }): number;

  // Ticks this entity's status effects once per unit of world time. Death from a status
  // tick (burn/poison/bleed) is cleaned up here via removeEntity.
  tickEffects(): void {
    tickStatusEffects(this, this.context);
    if (this.type !== "item" && this.healthPoints <= 0) {
      removeEntity(this.context, this);
    }
  }

  // Status effects this entity applies on a successful attack. Overridden by
  // monsters with on-hit abilities (e.g. Ghoul bleeding).
  onHitEffects(): StatusEffect[] {
    return [];
  }
}

export function removeEntity(context: GameContext, entity: Entity) {
  const victimIndexInEntities = context.entities.findIndex((e) => e === entity);
  if (victimIndexInEntities === -1) {
    return;
  }

  context.entities.splice(victimIndexInEntities, 1);

  const sprite = entity.sprite;
  entity.sprite = undefined;

  if (sprite) {
    context.scene?.tweens.killTweensOf(sprite);

    // Fade and shrink the sprite out before destroying it.
    context.scene?.tweens.add({
      targets: sprite,
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 180,
      onComplete: () => sprite.destroy()
    });
  }

  // onDestroy may drop loot at the entity's position, so keep x/y intact
  // until after it has run.
  entity.onDestroy();

  if (entity.type === "enemy") {
    sfx.death();
  }

  entity.x = undefined;
  entity.y = undefined;

  if (context.inspectedEntity === entity) {
    context.inspectedEntity = undefined;
  }
}

function logMessage(context: GameContext, text: string): void {
  context.messages.unshift(text);
  context.messages = context.messages.slice(0, 20);
}

// Reveals an item's real name and description (the G3 identify loop).
export function identify(item: Entity): void {
  item.identified = true;
  logMessage(item.context, `Identified: ${item.name} — ${item.description}`);
}

// Upgrade rule: +1 `level`. Weapons and armour convert each level into a
// +1 damage / +1 protection bonus inside their own damage()/protection()
// methods (see the weapon and armour item files).
export function upgrade(item: Entity): void {
  item.level += 1;
  logMessage(item.context, `${item.name} upgraded to level ${item.level}.`);
}

function createSprite(context: GameContext, x: number, y: number, tile: number, tint?: number, textureKey?: string): Phaser.GameObjects.Sprite {
  const xx = context.map!.tileToWorldX(x);
  const yy = context.map!.tileToWorldY(y);
  const sprite = context.scene!.add.sprite(
    xx || 0,
    yy || 0,
    textureKey ?? "foreground-tiles",
    textureKey ? 0 : tile
  );
  sprite.setOrigin(0);
  if (tint) {
    sprite.tint = tint;
  }
  return sprite;
}
