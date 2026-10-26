// TypeScript errors after site migration - ignoring for game functionality
import Phaser from "phaser";
import { worldDepth } from './rendering';
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

// One shuffled, one-to-one appearance assignment per run, shared by all copies.
const consumableAppearances = new WeakMap<GameContext, Map<string, string>>();
export function resetConsumableAppearances(context: GameContext): void {
  consumableAppearances.delete(context);
}
const scrollAppearances = ['fireball', 'lightning', 'identify', 'upgrade', 'remove-curse', 'teleport', 'rage', 'terror', 'recharging'];
function consumableAppearance(item: Entity): string | undefined {
  const category = item.textureKey?.startsWith('potion-') ? 'potion'
    : item.textureKey?.startsWith('scroll-') ? 'scroll' : undefined;
  if (!category || !item.context) return item.textureKey;
  let assignments = consumableAppearances.get(item.context);
  if (!assignments) {
    assignments = new Map();
    consumableAppearances.set(item.context, assignments);
  }
  const kind = `${category}:${item.name}`;
  if (!assignments.has(kind)) {
    const keys = category === 'potion'
      ? Array.from({ length: 12 }, (_, i) => `potion-${i}`)
      : scrollAppearances.map(glyph => `scroll-${glyph}`);
    const available = keys.filter(key => ![...assignments.values()].includes(key));
    if (!available.length) throw new Error(`No unused ${category} appearances`);
    assignments.set(kind, available[Math.floor(Math.random() * available.length)]);
  }
  return assignments.get(kind);
}

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

  hearNoise(x: number, y: number): void {
    // An investigation target, not magical awareness of the player's position.
    this.lastSeenX = x;
    this.lastSeenY = y;
  }
  xpValue: number = 0;

  // Item model v2 (G3). Optional with defaults so existing items still
  // compile without setting them.
  tier: number = 1;
  // Opt-in for physical weapons/armor; wands and utility gear are exempt.
  usesStrength: boolean = false;

  get requiredStrength(): number {
    if (!this.usesStrength) return 0;
    // Upgrade milestones +1, +3, +6, +10, ... each remove one requirement.
    const reduction = Math.floor((Math.sqrt(8 * Math.max(0, this.level) + 1) - 1) / 2);
    return Math.max(0, 8 + 2 * this.tier - reduction);
  }

  strengthDescription(strength: number): string {
    if (!this.usesStrength) return "";
    const deficit = Math.max(0, this.requiredStrength - strength);
    const warning = deficit > 0
      ? this.equipSlot === "weapon"
        ? ` Under-strength by ${deficit}: reduced accuracy and slower attacks.`
        : ` Under-strength by ${deficit}: reduced evasion and slower movement.`
      : "";
    return `Tier ${this.tier}; requires ${this.requiredStrength} Strength.${warning}`;
  }

  get effectiveAccuracy(): number { return this.accuracy; }
  get effectiveEvasion(): number { return this.evasion; }
  movementCostMultiplier(): number { return 1; }
  attackCostMultiplier(): number { return 1; }
  identified: boolean = true;
  cursed: boolean = false;
  blessed: boolean = false;
  level: number = 0;
  maxLevel: number = Number.POSITIVE_INFINITY;
  charges: number = 0;
  equipSlot: EquipSlot = "junk";
  // Number of identical items stacked in this one slot (consumables).
  count: number = 1;
  // Floor currency is collected into the wallet, never into backpack slots.
  goldAmount: number = 0;

  // Status effects and combat stats used by effects.ts / combat.ts.
  effects: StatusEffect[] = [];
  // After losing an action to frost, guarantee one real action before refreezing.
  freezeRecovery = false;
  accuracy: number = 95;
  evasion: number = 0;
  resistance: Partial<Record<DamageType, number>> = {};
  vulnerability: Partial<Record<DamageType, number>> = {};
  damageType: DamageType = "physical";

  // Override for descriptions whose stats change with upgrades.
  get displayDescription(): string {
    return this.description;
  }

  // Derive a pronounceable nonsense label from the true item kind, never from
  // instance state or RNG. Copies, floor changes and stack splits keep the name.
  get unidentifiedName(): string {
    let hash = 2166136261;
    for (const char of `${this.equipSlot}:${this.name}`) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    }
    const syllables = ['ba', 'zu', 'kir', 'vo', 'nel', 'sha', 'dor', 'mi',
      'fen', 'ra', 'tol', 'xi', 'gub', 'po', 'vek', 'lun'];
    let label = '';
    for (let i = 0; i < 5; i++) {
      label += syllables[hash & 15];
      hash >>>= 4;
    }
    return label[0].toUpperCase() + label.slice(1);
  }

  // Physical equipment is recognizable; identification reveals its curse state,
  // not whether it is a sword, axe, or suit of armor.
  get isPhysicalEquipment(): boolean {
    return this.type === "item" && (this.equipSlot === "weapon" || this.equipSlot === "armor");
  }

  // Artifacts are recognizable on sight too; curse knowledge remains separate.
  get isRecognizableEquipment(): boolean {
    return this.isPhysicalEquipment || (this.type === "item" && this.equipSlot === "artifact");
  }

  get displayName(): string {
    if (this.isPhysicalEquipment) {
      const level = this.level > 0 ? ` +${this.level}` : "";
      return `${this.name}${level} (Tier ${this.tier})`;
    }
    if (this.identified || this.isRecognizableEquipment) {
      return this.type === "item" && this.level > 0 ? `${this.name} +${this.level}` : this.name;
    }
    const category = this.equipSlot === "weapon"
      ? (/wand/i.test(this.name) ? "Wand" : "Weapon")
      : this.equipSlot === "consumable"
        ? (/scroll/i.test(this.name) ? "Scroll" : "Potion")
        : ({ armor: "Armor", ring: "Ring", artifact: "Artifact", junk: "Item" }[this.equipSlot]);
    return `${category} “${this.unidentifiedName}”`;

  }

  // Generic icon used while an item is unidentified (distinguishes category
  // without revealing what the item is).
  get unidentifiedTextureKey(): string {
    // Preserve visible scroll glyphs and potion colours before identification,
    // while still hiding the item's name/effect.
    if (this.textureKey?.startsWith("scroll-") || this.textureKey?.startsWith("potion-")) {
      return this.spriteTextureKey;
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
    return consumableAppearance(this) ?? "foreground-tiles";
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
      this.sprite = createSprite(context, this.x, this.y, this.spriteFrame, this.tint, this.spriteTextureKey);
      if (this.type === "item" && this.textureKey?.startsWith("potion-")) {
        this.sprite.setScale(0.5);
      }
      // Feet stay at the bottom of the cell. Raised foreground walls, rather
      // than a permanently lifted actor, provide corridor occlusion.
      this.sprite.setDepth(worldDepth(this.sprite.y, this.type === "item" ? "item" : "actor"));

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
    this.freezeRecovery = false;
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

  // Equipped artifacts may react to the same monster deaths that award XP.
  onMonsterKilled?(): void;

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
  logMessage(item.context, `Identified: ${item.name} — ${item.displayDescription}`);
}

// Upgrade rule: +1 `level`. Weapons and armour convert each level into a
// +1 damage / +1 protection bonus inside their own damage()/protection()
// methods (see the weapon and armour item files).
export function upgrade(item: Entity): void {
  if (item.level >= item.maxLevel) {
    logMessage(item.context, item.identified
      ? `${item.name} is already at its maximum level (${item.maxLevel}).`
      : `${item.displayName} is already at its maximum level.`);
    return;
  }
  item.level += 1;
  logMessage(item.context, item.identified
    ? `${item.name} upgraded to level ${item.level}.`
    : `${item.displayName} upgraded.`);
}

function createSprite(context: GameContext, x: number, y: number, tile: number, tint?: number, textureKey?: string): Phaser.GameObjects.Sprite {
  const xx = context.map!.tileToWorldX(x);
  const yy = context.map!.tileToWorldY(y);
  const sprite = context.scene!.add.sprite(
    xx || 0,
    yy || 0,
    textureKey ?? "foreground-tiles",
    tile
  );
  sprite.setOrigin(0);
  if (tint) {
    sprite.tint = tint;
  }
  return sprite;
}
