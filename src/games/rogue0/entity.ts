// TypeScript errors after site migration - ignoring for game functionality
import Phaser from "phaser";
import { actorOriginY, worldDepth } from './rendering';
import { forgetInspectedEntity } from "./context.ts";
import type { GameContext } from "./context";
import { sfx } from "./audio";
import type { DamageType, StatusEffect } from "./effects";
import { tickEffects as tickStatusEffects } from "./effects";
import { actionCost, type ActionKind } from "./timing";
import { CURSE_NAMES, CURSE_FLAVOR } from "./curseData";
import type { CurseId } from "./curseData";

export type EntityType = "player" | "enemy" | "item";

// Unknown physical gear becomes familiar after this many real combat uses:
// one swing for a weapon, one blow taken for armor. A Scroll of Identify
// reveals it immediately, but equipping alone no longer does.
export const EQUIPMENT_IDENTIFY_USES = 30;

export type EquipSlot =
  | "weapon"
  | "armor"
  | "ring"
  | "artifact"
  | "consumable"
  | "junk";

// One shuffled, one-to-one appearance assignment per run, shared by all copies.
const consumableAppearances = new WeakMap<GameContext, Map<string, string>>();
const knownConsumables = new WeakMap<GameContext, Set<string>>();
function consumableKind(item: Entity): string | undefined {
  const category = item.textureKey?.startsWith('potion-') ? 'potion'
    : item.textureKey?.startsWith('scroll-') ? 'scroll'
    : item.textureKey?.startsWith('wand-') ? 'wand' : undefined;
  return category ? `${category}:${item.name}` : undefined;
}
export function resetConsumableAppearances(context: GameContext): void {
  consumableAppearances.delete(context);
  knownConsumables.delete(context);
}
export function saveConsumableKnowledge(context: GameContext) {
  return { appearances: [...(consumableAppearances.get(context) ?? new Map())],
    known: [...(knownConsumables.get(context) ?? new Set<string>())] };
}
export function restoreConsumableKnowledge(context: GameContext, data: ReturnType<typeof saveConsumableKnowledge>) {
  consumableAppearances.set(context, new Map(data.appearances));
  knownConsumables.set(context, new Set(data.known));
}

// Preserve knowledge from older saves that identified wands instance-by-instance.
// Keep the saved knowledge format (and export names) compatible with old runs.
export function rememberIdentifiedWandTypes(context: GameContext, items: Iterable<Entity>): void {
  let known = knownConsumables.get(context);
  if (!known) knownConsumables.set(context, known = new Set());
  for (const item of items) {
    const kind = consumableKind(item);
    if (kind?.startsWith('wand:') && item.identified) known.add(kind);
  }
}
const scrollAppearances = ['fireball', 'lightning', 'identify', 'upgrade', 'remove-curse', 'teleport', 'rage', 'terror', 'recharging'];

export type ConsumableCategory = 'potion' | 'scroll';

// Every potion and scroll that can be generated, by true name. The knowledge
// page lists all of them from the first turn (each with its run-specific
// appearance alias), so a kind must be added here when a new consumable item
// class is created. scripts/test-rogue0-consumable-knowledge.mjs keeps this
// list in sync with items/.
export const CONSUMABLE_NAMES: Record<ConsumableCategory, readonly string[]> = {
  potion: [
    'Berserk Potion',
    'Full Heal Potion',
    'Holy Potion',
    'Minor Heal Potion',
    'Potion of Experience',
    'Potion of Frost',
    'Potion of Healing',
    'Potion of Invisibility',
    'Potion of Levitation',
    'Potion of Liquid Flame',
    'Potion of Strength',
    'Potion of Toxic Gas'
  ],
  scroll: [
    'Scroll of Fireball',
    'Scroll of Identify',
    'Scroll of Lightning',
    'Scroll of Rage',
    'Scroll of Recharging',
    'Scroll of Remove Curse',
    'Scroll of Teleport',
    'Scroll of Terror',
    'Scroll of Upgrade'
  ]
};

// One entry per potion/scroll kind in the dungeon. The alias is derived from
// the shuffled appearance, never from the real name, so an unidentified entry
// cannot leak what the item is.
export type ConsumableKnowledgeEntry = {
  category: ConsumableCategory;
  // Texture key of the appearance shown on the floor and in the backpack.
  appearance: string;
  // The item's real name (only meaningful once `identified`).
  name: string;
  identified: boolean;
  alias: string;
};

// Scrambled, stable label for a shuffled appearance (or any identity string).
// Potions, scrolls and legacy wands all derive their unknown names here so the
// label never changes when the same item is seen again.
export function appearanceLabel(identity: string): string {
  let hash = 2166136261;
  for (const char of identity) {
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

// Every potion and scroll in the dungeon, split by category, in a fixed order
// for the run so a row stays put when its real name is revealed. A kind is
// shown by its real name once identified and by its appearance alias until
// then; copies found later share the same row.
export function consumableKnowledge(context: GameContext, category: ConsumableCategory): ConsumableKnowledgeEntry[] {
  const assignments = consumableAppearances.get(context);
  const known = knownConsumables.get(context);
  const kinds = new Set<string>();
  for (const name of CONSUMABLE_NAMES[category]) kinds.add(`${category}:${name}`);
  // Preserve extra kinds from older saves whose names left the catalogue.
  for (const kind of assignments?.keys() ?? []) {
    const separator = kind.indexOf(':');
    if (separator >= 0 && kind.slice(0, separator) === category) kinds.add(kind);
  }
  const entries = [...kinds].map(kind => {
    const name = kind.slice(kind.indexOf(':') + 1);
    const appearance = assignments?.get(kind) ?? assignConsumableAppearance(context, category, name);
    return {
      category,
      appearance,
      name,
      identified: !!known?.has(kind),
      alias: appearanceLabel(appearance)
    };
  });
  // Order by appearance, which is shuffled per run: stable while playing and
  // no hint about the alphabetical order of the real names.
  return entries.sort((a, b) => a.appearance.localeCompare(b.appearance));
}

// Give every catalogue kind its run-specific appearance up front, so the
// labels seen in the dungeon always match the knowledge page and cannot be
// rerolled by opening it.
export function prewarmConsumableAppearances(context: GameContext): void {
  for (const category of Object.keys(CONSUMABLE_NAMES) as ConsumableCategory[]) {
    for (const name of CONSUMABLE_NAMES[category]) {
      assignConsumableAppearance(context, category, name);
    }
  }
}

function consumableAppearance(item: Entity): string | undefined {
  const category = item.textureKey?.startsWith('potion-') ? 'potion'
    : item.textureKey?.startsWith('scroll-') ? 'scroll' : undefined;
  if (!category || !item.context) return item.textureKey;
  return assignConsumableAppearance(item.context, category, item.name);
}

// One-to-one appearance assignment per run, shared by all copies of a kind.
function assignConsumableAppearance(
  context: GameContext,
  category: ConsumableCategory,
  name: string
): string {
  let assignments = consumableAppearances.get(context);
  if (!assignments) {
    assignments = new Map();
    consumableAppearances.set(context, assignments);
  }
  const kind = `${category}:${name}`;
  const assigned = assignments.get(kind);
  if (assigned) return assigned;
  const keys = category === 'potion'
    ? Array.from({ length: 12 }, (_, i) => `potion-${i}`)
    : scrollAppearances.map(glyph => `scroll-${glyph}`);
  const used = new Set(assignments.values());
  const available = keys.filter(key => !used.has(key));
  if (!available.length) throw new Error(`No unused ${category} appearances`);
  const key = available[Math.floor(Math.random() * available.length)];
  assignments.set(kind, key);
  return key;
}

export abstract class Entity {
  healthPoints: number = 0;
  maxHealthPoints: number = 0;
  movementSpeed: number = 1;
  // Naturally airborne actors (e.g. swarm of flies) ignore ground hazards and
  // cross chasms. The levitating status effect grants the same temporarily.
  flying: boolean = false;
  // Poison-immune creatures (e.g. the Deadly Frog) ignore the poisoned status.
  poisonImmune: boolean = false;
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
  isContainer = false;
  openContainer(): boolean { return false; }
  requiresItemTarget = false;
  itemTargetTitle = "CLEANSE: CHOOSE ITEM";
  noItemTargetsMessage = "You have no cursed items to cleanse.";
  // Using this item opens throw targeting instead of consuming it in place.
  throwToUse = false;
  // A Stone of Detect Curse has looked at this item's curse without
  // identifying it. The result is permanent knowledge for this item.
  curseScanned = false;
  curseEffectId?: string;
  canTargetItem(_target: Entity): boolean { return false; }
  useOnItem(_target: Entity): boolean { return false; }
  // Resolve a special landing effect (e.g. a Stone of Blink). True means the
  // throw is fully handled and the item never rests on the floor.
  onThrownLand?(_tx: number, _ty: number): boolean;
  onUncursed(): void {}
  onUpgrade(): void {}
  onAttacked(_attacker: Entity): void {}
  // Called after a successful attack lands and its damage is applied, before
  // death cleanup. Lets victims react to the exact hit (e.g. a swarm splits).
  onHitBy?(_attacker: Entity, _damageType: DamageType, _damage: number): void;
  // Sight at the start of the last decision, not after moving into view.
  // Pursuit memory is separate: a hunting enemy can still be ambushed.
  awareOfPlayer: boolean = false;
  // An actor that fell (or was dragged, or was killed while flying) over a
  // chasm. Its loot goes down the hole instead of resting on the void tile.
  fellIntoChasm: boolean = false;
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
  get isFlying(): boolean {
    return this.flying || this.effects.some((e) => e.id === "levitating");
  }
  movementCostMultiplier(): number { return 1; }
  attackCostMultiplier(): number { return 1; }
  protected locallyIdentified: boolean = true;
  get identified(): boolean {
    const kind = consumableKind(this);
    return this.locallyIdentified || !!(kind && this.context && knownConsumables.get(this.context)?.has(kind));
  }
  set identified(value: boolean) { this.locallyIdentified = value; }
  cursed: boolean = false;
  curseLifted = false;
  // Named SPD-style curse rolled at generation (see curseData.ts). Empty
  // means either uncursed or a legacy bespoke curse (e.g. the Cursed Gem).
  curseId: string = "";
  // Friendly actor (mirror image) rendered as an enemy but never hostile.
  isDecoy: boolean = false;
  blessed: boolean = false;
  level: number = 0;
  // Successful combat uses since the item was found. Tracked for unknown
  // physical gear so upgrades and curses stay secret until it has been used.
  equipmentUses: number = 0;
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

  // Items override only their content; curse status is shared by every kind.
  get baseDescription(): string {
    return this.description;
  }

  // Equipment slots lock cursed items on until the curse is lifted. Wands are
  // backpack tools and are never "equipped", so they get no lock-on warning.
  private get curseLockMessage(): string {
    if (this.equipSlot === "weapon" || this.equipSlot === "armor" ||
        this.equipSlot === "ring" || this.equipSlot === "artifact") {
      return "It cannot be removed while equipped until the curse is lifted.";
    }
    return "";
  }

  get curseDescription(): string {
    // A glyph stone exposes curse status without revealing the item's identity.
    // Keep the lifting record visible even before identification, as it was
    // before the stone existed.
    if (!this.identified) {
      if (this.cursed) {
        return this.curseScanned
          ? 'A glyph stone reveals that this item is cursed.'
          : '';
      }
      if (this.curseLifted) {
        return this.curseLockMessage
          ? 'Curse lifted: this item is no longer cursed and can be freely unequipped or dropped.'
          : 'Curse lifted: this item is no longer cursed.';
      }
      return this.curseScanned
        ? 'A glyph stone reveals that this item is free of curse.'
        : '';
    }
    if (this.cursed) {
      const name = this.curseId ? CURSE_NAMES[this.curseId as CurseId] : '';
      if (name) {
        const lock = this.curseLockMessage ? ` ${this.curseLockMessage}` : '';
        return `${name}: ${CURSE_FLAVOR[this.curseId as CurseId]}${lock}`;
      }
      // Legacy bespoke curses (e.g. the Cursed Gem) are always lock-on gear.
      return 'Cursed: cannot be removed while equipped until the curse is lifted.';
    }
    if (this.curseLifted) {
      return this.curseLockMessage
        ? 'Curse lifted: this item is no longer cursed and can be freely unequipped or dropped.'
        : 'Curse lifted: this item is no longer cursed.';
    }
    return '';
  }

  get displayDescription(): string {
    return [this.baseDescription, this.curseDescription].filter(Boolean).join('\n\n');
  }

  // Learn an unknown physical item's true quality through actual combat use.
  // Equipping is not enough: a weapon must connect, armor must take a blow.
  learnEquipmentFromUse(): void {
    if (this.identified || !this.isPhysicalEquipment) return;
    this.equipmentUses = (this.equipmentUses ?? 0) + 1;
    if (this.equipmentUses >= EQUIPMENT_IDENTIFY_USES) identify(this);
  }

  // Consumable labels follow their shuffled appearance, not their true identity.
  // Copies, floor changes and stack splits retain the same label within a run.
  get unidentifiedName(): string {
    // Wands keep their existing type-based aliases, independent of charges,
    // upgrades, location or equipment slot. Do not assign them potion artwork.
    const identity = this.textureKey?.startsWith('wand-') ? `junk:${this.name}`
      : consumableKind(this) && this.context ? consumableAppearance(this)!
      : `${this.equipSlot}:${this.name}`;
    return appearanceLabel(identity);
  }

  // Physical equipment is recognizable; identification reveals its upgrades
  // and curse state, not whether it is a sword, axe, or suit of armor.
  get isPhysicalEquipment(): boolean {
    return this.type === "item" && (this.equipSlot === "weapon" || this.equipSlot === "armor");
  }

  // Artifacts are recognizable on sight too; curse knowledge remains separate.
  get isRecognizableEquipment(): boolean {
    return this.isPhysicalEquipment || (this.type === "item" && this.equipSlot === "artifact");
  }

  get displayName(): string {
    if (this.isPhysicalEquipment) {
      // The make and tier are recognizable, but an unknown upgrade level must
      // not leak through the name before the item has been used or identified.
      const level = this.identified && this.level > 0 ? ` +${this.level}` : "";
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
      // Anchor feet, not the top of the artwork. Tall actors overlap the
      // preceding row without floating above the floor or moving their grid.
      if (this.type !== 'item') this.sprite.setOrigin(0, actorOriginY(this.sprite.height ?? 16));
      this.sprite.setDepth(worldDepth(this.sprite.y, this.type === "item" ? "item" : "actor"));

      // Floor items pulse gently so they stand out.
      if (this.type === "item" && !this.isContainer && this.sprite) {
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

  // Damage for a close-quarters strike. Most entities hit as hard in melee as
  // with their main attack; ranged attackers (bows, spells) override this with
  // a weaker sidearm and opt in via `hasMeleeSidearm`.
  meleeAttack(): number {
    return this.attack();
  }

  // True when this entity should answer an adjacent target with `meleeAttack`
  // instead of firing its primary ranged attack point-blank.
  hasMeleeSidearm(): boolean {
    return false;
  }

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
  // monsters with on-hit abilities (e.g. Ghoul bleeding). `isRanged` lets an
  // ability belong to the primary attack only (e.g. barbed arrows bleed, but a
  // goblin's close-quarters dagger does not).
  onHitEffects(_isRanged: boolean = true): StatusEffect[] {
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

  if (entity.type === "enemy" && !entity.isDecoy) {
    sfx.death();
  }

  // The scene checks whether this was the floor's last monster and, if so,
  // sends reinforcements elsewhere. Run after loot/XP so the wave cannot
  // replace the dead monster's drops.
  if (entity.type === "enemy" && !entity.isDecoy) {
    context.onMonsterRemoved?.(entity);
  }

  entity.x = undefined;
  entity.y = undefined;

  forgetInspectedEntity(context, entity);
}

function logMessage(context: GameContext, text: string): void {
  context.messages.unshift(text);
  context.messages = context.messages.slice(0, 20);
}

// Reveals an item's real name and description (the G3 identify loop).
export function identify(item: Entity): void {
  const kind = consumableKind(item);
  if (kind && item.context) {
    let known = knownConsumables.get(item.context);
    if (!known) knownConsumables.set(item.context, known = new Set());
    known.add(kind);
  }
  item.identified = true;
  logMessage(item.context, `Identified: ${item.name}`);
}

// Upgrade rule: +1 `level`, never +1 tier. Physical weapons gain +1 minimum
// and +(tier + 1) maximum damage; armor gains +tier protection per level.
// Other item families keep their own upgrade curves.
export function upgrade(item: Entity): void {
  if (item.level >= item.maxLevel) {
    logMessage(item.context, item.identified
      ? `${item.name} is already at its maximum level (${item.maxLevel}).`
      : `${item.displayName} is already at its maximum level.`);
    return;
  }
  item.level += 1;
  item.onUpgrade?.();
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
