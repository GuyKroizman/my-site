// TypeScript errors after site migration - ignoring for game functionality
import type { EntityType } from "../entity";
import { Entity, removeEntity, identify } from "../entity";
import { isModalOpen, type GameContext } from "../context";
import dungeon from "../dungeon";
import Gem from "../items/gem";
import Wand from "../items/wand";
import { getTrapState, isGrassConcealed } from "../tiles";
import { hasLineOfSight } from "../fov";
import { sfx } from "../audio";
import {
  applyEffect,
  createBurningEffect,
  createFrozenEffect,
  createPoisonedEffect,
  removeEffect,
  hasEffect
} from "../effects";
import type { DamageType, StatusEffect } from "../effects";
import { resolveAttack } from "../combat";
import { spawnEntityFloatingText } from "../floatingText";
import type { ActionKind } from "../timing";

// UI palette — kept in sync with the --r0-* variables in src/index.css and
// the constants in src/games/rogue0/ui.ts. Hex strings are CSS colors, 0x
// numbers are rectangle fills.
const UI_HIGHLIGHT_BACKGROUND_COLOR = "#a29a8e";
const UI_COL = {
  text: "#e8e1d5",
  muted: "#a29a8e",
  dim: "#6e675f",
  gold: "#f0b429"
};

const UI_C = {
  cell: 0x16121c,
  panel2: 0x1f1926,
  border: 0x3a3342,
  borderStrong: 0x5a5060,
  gold: 0xf0b429
};

const UI_FONT_PIXEL = "Press Start 2P";
const UI_FONT_MONO = "VT323";

type EquipSlotKey = "weapon" | "armor" | "ring1" | "ring2" | "artifact";

export const CLASS_TALENTS = {
  Warrior: [
    { id: "power", name: "Crushing Strike", description: "+2 Power Strike damage per rank." },
    { id: "fury", name: "Deep Fury", description: "+1 damage at/below half HP per rank." }
  ],
  Dwarf: [
    { id: "bash", name: "Hamstring", description: "+1 time of Shield Bash cripple per rank." },
    { id: "armor", name: "Iron Skin", description: "+1 physical armor per rank." }
  ],
  Cleric: [
    { id: "heal", name: "Greater Heal", description: "+3 HP restored by Heal per rank." },
    { id: "prayer", name: "Quick Prayer", description: "Heal cooldown reduced by 1 time per rank." }
  ],
  Elf: [
    { id: "strike", name: "Twin Blades", description: "+1 damage to each Double Strike hit per rank." },
    { id: "grace", name: "Light Footwork", description: "+5 evasion per rank (before armor penalties)." }
  ],
  Wizard: [
    { id: "nova", name: "Lingering Flame", description: "+1 time of Nova burning per rank." },
    { id: "focus", name: "Focused Nova", description: "Nova cooldown reduced by 1 time per rank." }
  ]
} as const;

export default class BasicHero extends Entity {
  name: string = "The Hero";
  description: string = "A brave adventurer";
  actionReady: boolean = true;
  healthPoints: number = 30;
  maxHealthPoints: number = 30;
  hunger: number = 100;
  maxHunger: number = 100;
  gold: number = 0;
  private hungerWarned: boolean = false;
  private regenerationTicks: number = 0;
  xp: number = 0;
  level: number = 1;
  talentClass?: keyof typeof CLASS_TALENTS;
  talentRanks: Record<string, number> = {};

  get availableTalents() {
    return this.talentClass ? CLASS_TALENTS[this.talentClass] : [];
  }

  talentRank(id: string): number {
    return this.availableTalents.some(t => t.id === id) ? (this.talentRanks?.[id] ?? 0) : 0;
  }

  get talentPoints(): number {
    const spent = this.availableTalents.reduce((sum, t) => sum + this.talentRank(t.id), 0);
    return Math.max(0, Math.min(3, this.level - 1) - spent);
  }

  learnTalent(id: string): boolean {
    if (this.healthPoints <= 0 || !this.availableTalents.some(t => t.id === id) ||
        this.talentPoints <= 0 || this.talentRank(id) >= 2) return false;
    this.talentRanks[id] = this.talentRank(id) + 1;
    const talent = this.availableTalents.find(t => t.id === id)!;
    dungeon.log(this.context, `Learned ${talent.name} (${this.talentRank(id)}/2).`);
    this.refreshUI();
    return true;
  }
  baseAttack: number = 0;
  strength: number = 10;
  tile: number = 26;
  moving: boolean = false;
  type: EntityType = "player";

  // Equipment slots + backpack (G6). One item per slot; the backpack holds
  // everything else up to `capacity`.
  weapon: Entity | undefined;
  armor: Entity | undefined;
  ring1: Entity | undefined;
  ring2: Entity | undefined;
  artifact: Entity | undefined;
  backpack: Entity[] = [];
  quickslots: (Entity | undefined)[] = Array(4).fill(undefined);
  private zapping = false;

  canQuickslot(item: Entity): boolean {
    return item instanceof Wand || item.consumable;
  }

  quickslotItem(index: number): Entity | undefined {
    const item = this.quickslots[index];
    if (item && !this.getAllItems().includes(item)) this.quickslots[index] = undefined;
    return this.quickslots[index];
  }

  assignQuickslot(index: number, item: Entity): boolean {
    if (index < 0 || index >= this.quickslots.length || !Number.isInteger(index) ||
        !this.getAllItems().includes(item) || !this.canQuickslot(item)) return false;
    this.quickslots[index] = item;
    return true;
  }

  activateQuickslot(index: number): void {
    const item = this.quickslotItem(index);
    if (item) this.useItem(item);
  }
  capacity: number = 20;

  UIHeader?: Phaser.GameObjects.Text;
  UIScene?: Phaser.Scene;
  UISkillLabel?: Phaser.GameObjects.Text;
  UIX: number = 0;
  UIY: number = 0;
  inputBuffer: string[] = [];
  walkPath: Array<{ x: number; y: number }> = [];
  private acknowledgedWalkEnemies = new Set<Entity>();
  onBackpackToggle?: () => void;
  onHeroIconTap?: () => void;

  // Per-class skills recharge in elapsed simulation time, not action count.
  skill: string = "";
  skillDescription: string = "";
  private skillReadyAt: number = 0;
  get skillCooldown(): number {
    return Math.max(0, Math.ceil((this.skillReadyAt ?? 0) - (this.context?.simulationTime ?? 0) - 1e-9));
  }
  set skillCooldown(duration: number) {
    this.skillReadyAt = (this.context?.simulationTime ?? 0) + Math.max(0, duration);
  }
  skillMaxCooldown: number = 0;

  constructor(context: GameContext) {
    super();

    // Make the context available before init() so subclasses can add their
    // starting gear in their constructors.
    this.context = context;

    if (context.scene?.input?.keyboard == undefined) {
      throw new Error("Error in PlayerCharacter context is undefined");
    }

    context.scene.input.keyboard.on("keydown", (event: KeyboardEvent) => {
      if (isModalOpen(this.context)) return;
      if (this.cursorDir(event.key)) event.preventDefault();
      // Cursor keys (x / Esc / Enter / arrows / HJKL) stay live while the
      // inspect or throw cursor is active, even when it isn't the player's
      // turn. Everything else keeps the existing canAct()/buffer behaviour.
      if (this.canAct() || (this.cursorActive() && this.isCursorKey(event.key))) {
        this.processInput(event.key);
      } else {
        this.bufferKey(event.key);
      }
    });

    context.scene.input.on("pointerup", (event: Phaser.Input.Pointer) => {
      this.processTouchInput(context, event);
    });
  }

  turn() {
    if (!this.sprite) {
      throw new Error("Error in PlayerCharacter sprite is undefined");
    }
    if (this.healthPoints <= 6) {
      this.sprite.tint = Phaser.Display.Color.GetColor(255, 0, 0);
    } else {
      this.sprite.clearTint();
    }

    this.refreshUI();

    // Execute buffered input as soon as the player can act.
    this.drainInputBuffer();

    // Continue an auto-walk started by a tap, one step per turn.
    this.stepAutoWalk();
  }

  canAct(): boolean {
    return this.actionReady && !this.moving && !hasEffect(this, "frozen");
  }

  spendTurn(action: ActionKind = "skill"): void {
    this.spendTime(action, this.currentWeapon()?.attackDelay ?? this.attackDelay);
  }

  bufferKey(key: string) {
    if (this.inputBuffer.length < 4) {
      this.inputBuffer.push(key);
    }
  }

  drainInputBuffer() {
    if (!this.canAct() || this.inputBuffer.length === 0) return;
    const key = this.inputBuffer.shift();
    if (key !== undefined) {
      this.processInput(key);
    }
  }

  // Which equipment slot an item would prefer to fill. Returns undefined for
  // items that go straight to the backpack (consumables, junk, or rings when
  // both ring slots are already occupied).
  slotFor(item: Entity): EquipSlotKey | undefined {
    switch (item.equipSlot) {
      case "weapon":
        return "weapon";
      case "armor":
        return "armor";
      case "ring":
        if (this.ring1 === undefined) return "ring1";
        if (this.ring2 === undefined) return "ring2";
        return undefined;
      case "artifact":
        return "artifact";
      default:
        return undefined;
    }
  }

  // Which equipment slot currently holds this item (if any).
  slotOf(item: Entity): EquipSlotKey | undefined {
    if (this.weapon === item) return "weapon";
    if (this.armor === item) return "armor";
    if (this.ring1 === item) return "ring1";
    if (this.ring2 === item) return "ring2";
    if (this.artifact === item) return "artifact";
    return undefined;
  }

  // Every item in the hero's possession (equipped slots + backpack).
  getAllItems(): Entity[] {
    return [...this.equippedItems(), ...this.backpack];
  }

  // Add an item, auto-equipping it if its slot is empty, otherwise stowing it
  // in the backpack. Returns false (and leaves the item untouched on the
  // ground) when there is no room.
  addItem(item: Entity): boolean {
    if (item.goldAmount > 0) {
      // Only live floor piles can be collected; prevent duplicate credit.
      const index = this.context.entities.indexOf(item);
      if (index === -1 || item.x === undefined || item.y === undefined) return false;
      this.gold += item.goldAmount;
      this.context.entities.splice(index, 1);
      this.refreshUI();
      return true;
    }
    // Stack only equivalent consumables. Name alone would discard upgrades,
    // identification and curse state. Timed effects retain independent phases,
    // so affected items must remain separate even if their effects look alike.
    if (item.equipSlot === "consumable") {
      const existing = this.backpack.find(
        (i) => i.equipSlot === "consumable" && i.name === item.name &&
          i.constructor === item.constructor &&
          i.identified === item.identified && i.level === item.level &&
          i.tier === item.tier && i.cursed === item.cursed &&
          i.blessed === item.blessed && i.charges === item.charges &&
          i.effects.length === 0 && item.effects.length === 0
      );
      if (existing) {
        existing.count += item.count;
        const idx = this.context.entities.indexOf(item);
        if (idx !== -1) this.context.entities.splice(idx, 1);
        if (item.sprite) {
          this.context.scene?.tweens.killTweensOf(item.sprite);
          item.sprite.destroy();
          item.sprite = undefined;
        }
        this.refreshUI();
        return true;
      }
    }

    if (this.backpack.length >= this.capacity) {
      dungeon.log(this.context, "Your backpack is full.");
      return false;
    }

    if (!this.context.entities.includes(item)) {
      this.context.entities.push(item);
    }
    item.context = this.context;
    item.x = undefined;
    item.y = undefined;
    if (item.sprite) {
      this.context.scene?.tweens.killTweensOf(item.sprite);
      item.sprite.destroy();
    }
    item.sprite = undefined;

    this.backpack.push(item);
    this.refreshUI();
    return true;
  }

  private onEquip(item: Entity): void {
    const revealsCurse = item.isPhysicalEquipment && !item.identified;
    if (item.isPhysicalEquipment) item.identified = true;
    const detail = item.identified ? `: ${item.displayDescription}` : "";
    dungeon.log(this.context, `${this.name} equips ${item.displayName}${detail}.`);
    if (revealsCurse) {
      dungeon.log(this.context, item.cursed
        ? `${item.displayName} is cursed and cannot be removed until its curse is lifted.`
        : `${item.displayName} is not cursed.`);
    }
    sfx.equip();
    item.equip();
  }

  private onUnequip(item: Entity): void {
    dungeon.log(this.context, `${this.name} unequips ${item.displayName}.`);
    item.unequip?.();
  }

  equipItem(item: Entity): void {
    if (this.sprite && !this.canAct()) return;
    const slot = this.slotFor(item);
    if (!slot) {
      dungeon.log(this.context, `${item.displayName} cannot be equipped.`);
      return;
    }
    if (!this.backpack.includes(item)) {
      dungeon.log(this.context, `${item.displayName} is not in your backpack.`);
      return;
    }

    const previous = this[slot];
    if (previous?.cursed) {
      dungeon.log(
        this.context,
        `${previous.displayName} is cursed and cannot be removed.`
      );
      return;
    }

    // Removing `item` frees exactly one backpack slot, so swapping the
    // previously equipped item back into the backpack always fits.
    this.backpack = this.backpack.filter((i) => i !== item);
    if (previous) {
      this[slot] = item;
      this.backpack.push(previous);
      this.onUnequip(previous);
    } else {
      this[slot] = item;
    }

    this.onEquip(item);
    // Starting equipment is installed before the hero sprite exists.
    if (this.sprite) this.spendTurn("equip");
    this.refreshUI();
  }

  unequipItem(item: Entity): void {
    if (!this.canAct()) return;
    if (item.cursed) {
      dungeon.log(
        this.context,
        `${item.displayName} is cursed and cannot be removed.`
      );
      return;
    }
    const slot = this.slotOf(item);
    if (!slot) return;

    if (this.backpack.length >= this.capacity) {
      dungeon.log(this.context, "Your backpack is full.");
      return;
    }

    this[slot] = undefined;
    this.backpack.push(item);
    this.onUnequip(item);
    this.spendTurn("equip");
    this.refreshUI();
  }

  // Drop an item from an equipped slot or the backpack back onto the map at
  // the player's tile. Cursed items cannot be dropped while equipped.
  dropItem(item: Entity): void {
    if (!this.canAct() || !this.getAllItems().includes(item)) return;
    if (item.cursed && this.slotOf(item)) {
      dungeon.log(
        this.context,
        `${item.displayName} is cursed and cannot be dropped.`
      );
      return;
    }

    if (this.x === undefined || this.y === undefined) {
      dungeon.log(this.context, "There is nowhere to drop that here.");
      return;
    }

    // Split without calling a constructor: rerolling an item would discard
    // upgrades, curses and other state. The original keeps its inventory UI.
    if (item.count > 1) {
      item.count -= 1;
      item = this.splitStackItem(item);
    } else {
      const slot = this.slotOf(item);
      if (slot) {
        this[slot] = undefined;
        this.onUnequip(item);
      } else {
        this.backpack = this.backpack.filter((i) => i !== item);
      }
      this.clearItemUI(item);
    }

    // Put the item back on the map and recreate its sprite so it can be
    // picked up again (matches the floor-item setup in entity.init()).
    item.context = this.context;
    item.x = this.x;
    item.y = this.y;

    if (!this.context.entities.includes(item)) {
      this.context.entities.push(item);
    }

    const scene = this.context.scene;
    const map = this.context.map;
    if (scene && map) {
      item.sprite?.destroy();
      item.sprite = undefined;
      const sprite = scene.add
        .sprite(
          map.tileToWorldX(this.x)!,
          map.tileToWorldY(this.y)!,
          item.spriteTextureKey,
          item.spriteFrame
        )
        .setOrigin(0);
      if (item.tint) {
        sprite.tint = item.tint;
      }
      item.sprite = sprite;

      if (item.type === "item") {
        scene.tweens.add({
          targets: sprite,
          alpha: { from: 0.7, to: 1 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
      }
    }

    dungeon.log(this.context, `${this.name} drops ${item.displayName}.`);
    this.spendTurn("drop");
    this.refreshUI();
  }

  // Use a consumable. Identifies it (if needed) and runs its consume effect.
  useItem(item: Entity): boolean {
    if (!this.canAct() || !this.getAllItems().includes(item)) return false;
    if (item instanceof Wand) {
      if (item.charges <= 0) {
        dungeon.log(this.context, "The wand is spent.");
        return false;
      }
      this.beginThrow(item, true);
      return false;
    }
    if (!item.consumable) return false;

    if (item instanceof Gem) {
      this.context.onChooseEnchantment?.(item);
      return false; // Opening/cancelling target selection is not a spent action.
    }
    if (!item.identified) {
      identify(item);
    }
    dungeon.log(this.context, `${this.name} uses ${item.name}.`);
    item.equip();
    sfx.potion();
    this.spendTurn("use");
    return true;
  }

  // Numbered key / click action for a backpack cell: consume if consumable,
  // otherwise try to equip it.
  useOrEquipBackpackSlot(index: number): void {
    if (!this.canAct()) return;
    const item = this.backpack[index];
    if (!item) return;

    if (item.consumable || item instanceof Wand) {
      this.useItem(item);
    } else {
      this.equipItem(item);
    }
    this.refreshUI();
  }

  removeItem(item: Entity): void {
    // Consuming from a stack only decrements the count.
    if (item.count > 1) {
      item.count -= 1;
      this.refreshUI();
      return;
    }

    const slot = this.slotOf(item);
    if (slot) {
      this[slot] = undefined;
      this.onUnequip(item);
    } else {
      this.backpack = this.backpack.filter((i) => i !== item);
    }
    this.clearItemUI(item);
    this.refreshUI();
  }

  removeItemsByProperty(property: string, value: any) {
    const removed = this.getAllItems().filter(
      (item) => (item as any)[property] === value
    );

    for (const item of removed) {
      const slot = this.slotOf(item);
      if (slot) {
        this[slot] = undefined;
        item.unequip?.();
      } else {
        this.backpack = this.backpack.filter((i) => i !== item);
      }
      this.clearItemUI(item);
      removeEntity(this.context, item);
    }
    this.refreshUI();
  }

  // Uncurse every cursed item (so they can be unequipped) and clear the
  // active curse penalty. Used by Holy Potion and Scroll of Remove Curse.
  removeCurse(): void {
    let lifted = false;
    for (const item of this.getAllItems()) {
      if (item.cursed) {
        item.cursed = false;
        lifted = true;
      }
    }
    removeEffect(this, "cursed");
    if (lifted) {
      dungeon.log(this.context, "The curse is lifted from your equipment.");
    } else {
      dungeon.log(this.context, "Nothing is cursed.");
    }
    this.refreshUI();
  }

  equippedItems() {
    const items: Entity[] = [];
    for (const item of [this.weapon, this.armor, this.ring1, this.ring2, this.artifact]) {
      if (item) items.push(item);
    }
    return items;
  }

  currentWeapon() {
    return this.weapon;
  }

  strengthDeficit(item?: Entity): number {
    return item ? Math.max(0, item.requiredStrength - this.strength) : 0;
  }

  get effectiveAccuracy(): number {
    return this.accuracy / Math.pow(1.2, this.strengthDeficit(this.weapon));
  }

  get effectiveEvasion(): number {
    return (this.evasion + 5 * this.talentRank("grace")) / Math.pow(1.2, this.strengthDeficit(this.armor));
  }

  movementCostMultiplier(): number {
    return Math.pow(1.2, this.strengthDeficit(this.armor));
  }

  attackCostMultiplier(): number {
    return Math.pow(1.2, this.strengthDeficit(this.weapon));
  }

  attack() {
    let total = this.baseAttack;
    if (this.weapon) {
      total += this.weapon.damage();
    }
    for (const item of [this.ring1, this.ring2, this.artifact]) {
      if (item) total += item.damage();
    }
    return total;
  }

  protection() {
    let total = 0;
    if (this.armor) {
      total += this.armor.protection();
    }
    for (const item of [this.ring1, this.ring2, this.artifact]) {
      if (item) total += item.protection();
    }
    return total;
  }

  get hungerState(): "Fed" | "Hungry" | "Starving" {
    if (this.hunger <= 0) return "Starving";
    return this.hunger < 30 ? "Hungry" : "Fed";
  }

  refresh() {
    // Drain a quarter point per world-time unit: food lasts 4x as long.
    const wasStarving = this.hunger === 0;
    this.hunger = Math.max(0, this.hunger - 0.25);

    // Warn once when hunger first drops below 30, not every time tick.
    if (this.hunger > 0 && this.hunger < 30 && !this.hungerWarned) {
      this.hungerWarned = true;
      dungeon.log(this.context, "You are hungry. Natural healing has stopped.");
    }

    // Starving: 1 damage per time unit until food is eaten.
    if (this.hunger === 0) {
      // Stop once on entering starvation, not when knowingly resuming travel.
      this.takeDamage(1, !wasStarving);
      spawnEntityFloatingText(this, "-1");
      dungeon.log(this.context, "You are starving! You take 1 damage.");
      if (this.healthPoints <= 0) {
        removeEntity(this.context, this);
      }
    }

    // Fed: regain 1 HP every 3 world-time units; hunger stops natural healing.
    if (this.hungerState === "Fed" && this.healthPoints < this.maxHealthPoints) {
      this.regenerationTicks = (this.regenerationTicks ?? 0) + 1;
      if (this.regenerationTicks >= 3) {
        this.healthPoints = Math.min(this.maxHealthPoints, this.healthPoints + 1);
        spawnEntityFloatingText(this, "+1", "#6aff6a");
        this.regenerationTicks = 0;
      }
    } else {
      this.regenerationTicks = 0;
    }
  }

  restoreHunger(amount: number): void {
    this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    if (this.hunger >= 30) {
      this.hungerWarned = false;
    }
  }

  xpForNextLevel(): number {
    return 8 + (this.level - 1) * 8;
  }

  gainXp(amount: number) {
    if (amount <= 0) return;
    this.xp += amount;
    while (this.xp >= this.xpForNextLevel()) {
      this.xp -= this.xpForNextLevel();
      this.level += 1;
      this.maxHealthPoints += 5;
      this.baseAttack += 1;
      sfx.levelUp();
      dungeon.log(this.context, `You leveled up! You are now level ${this.level} (+5 HP, +1 ATK).`);
      if (this.level <= 4 && this.availableTalents.length) {
        dungeon.log(this.context, "Talent point earned! Open the Hero panel to choose a talent.");
      }
    }
  }

  processTouchInput(context: GameContext, event: Phaser.Input.Pointer) {
    if (isModalOpen(context)) return;
    if (context.pinching || context.panning) return;
    if (context.map == undefined) {
      throw new Error("context.map is undefined");
    }
    let x = context.map.worldToTileX(event.worldX);
    let y = context.map.worldToTileY(event.worldY);

    let entity = dungeon.entityAtTile(context, x!, y!);
    if (entity && isGrassConcealed(entity.x, entity.y, this.x, this.y)) entity = undefined;

    if (context.terrainActionMode) {
      if (x !== null && y !== null) this.jumpAt(x, y);
      return;
    }

    // Throw targeting takes priority: any tap resolves the pending throw.
    if (context.throwMode) {
      this.throwAt(x!, y!);
      return;
    }

    // Inspect is a UI action: always available, on any turn.
    if (context.inspectMode) {
      if (x !== null && y !== null) {
        this.exitCursorModes();
        this.inspectTile(x, y);
      }
      return;
    }

    if (x !== null && y !== null && this.x === x && this.y === y &&
        x === context.upstairsX && y === context.upstairsY) {
      context.onAscend?.();
      return;
    }

    // Tap the stairs you're standing on to descend (mobile-friendly).
    if (
      x !== null &&
      y !== null &&
      this.x === x &&
      this.y === y &&
      x === context.stairsX &&
      y === context.stairsY
    ) {
      context.onDescend?.();
      return;
    }

    if (entity && entity.type === "enemy") {
      const currentWeapon = this.currentWeapon();
      const rangedAttack = currentWeapon && currentWeapon.range() > 0
        ? currentWeapon.attackTile || currentWeapon.tile
        : false;
      const distance = currentWeapon
        ? dungeon.distanceBetweenEntities(this, entity)
        : 0;
      const hasLOS = hasLineOfSight(
        dungeon.getCurrentLevel(),
        this.x!,
        this.y!,
        entity.x!,
        entity.y!
      );

      if (
        currentWeapon &&
        rangedAttack &&
        hasLOS &&
        distance <= currentWeapon.range() &&
        this.canAct()
      ) {
        dungeon.attackEntity(
          context,
          this,
          entity,
          rangedAttack,
          currentWeapon.tint,
          currentWeapon.damageType
        );
        this.spendTurn("attack");
      } else {
        // No ranged attack: walk toward the enemy to attack it.
        this.setWalkTarget(entity.x!, entity.y!);
      }
      return;
    }

    if (entity && entity.type === "item") {
      // Walk toward the item and pick it up when adjacent.
      this.setWalkTarget(entity.x!, entity.y!);
      return;
    }

    // Tap a walkable tile to move there (SPD-style).
    this.setWalkTarget(x!, y!);
  }

  // --- Inspect cursor + throw targeting ---

  private cursorActive(): boolean {
    return this.context.inspectMode || this.context.throwMode || !!this.context.terrainActionMode;
  }

  private isCursorKey(key: string): boolean {
    return (
      key === "x" || key === "X" || key === "Escape" || key === "Enter" ||
      key === "ArrowLeft" || key === "ArrowRight" ||
      key === "ArrowUp" || key === "ArrowDown" ||
      this.cursorDir(key) !== undefined
    );
  }

  private cursorDir(key: string): { dx: number; dy: number } | undefined {
    switch (key) {
      case "Home": return { dx: -1, dy: -1 };
      case "PageUp": return { dx: 1, dy: -1 };
      case "End": return { dx: -1, dy: 1 };
      case "PageDown": return { dx: 1, dy: 1 };
      case "ArrowLeft":
      case "h":
        return { dx: -1, dy: 0 };
      case "ArrowRight":
      case "l":
        return { dx: 1, dy: 0 };
      case "ArrowUp":
      case "k":
        return { dx: 0, dy: -1 };
      case "ArrowDown":
      case "j":
        return { dx: 0, dy: 1 };
      default:
        return undefined;
    }
  }

  inspectOrSearch(): void {
    this.context.terrainActionMode = false;
    if (this.context.throwMode) this.cancelThrow();
    this.walkPath = [];
    if (this.context.inspectMode) {
      this.exitCursorModes();
      this.context.inspectChoices = undefined;
      this.search();
    } else {
      this.toggleInspectMode();
    }
  }

  toggleInspectMode(): void {
    const context = this.context;
    context.terrainActionMode = false;
    context.inspectMode = !context.inspectMode;
    context.inspectedEntity = undefined;
    context.inspectedTerrain = undefined;
    if (context.inspectMode) {
      // Position the cursor, but wait for a tile selection before inspecting.
      context.cursorX = this.x;
      context.cursorY = this.y;
    }
    context.onInspectModeChange?.(context.inspectMode);
  }

  // SPD-style search (looking glass): reveal hidden traps around the hero.
  // Costs a full turn.
  waitTurn(): void {
    if (!this.canAct()) return;
    this.walkPath = [];
    this.spendTurn("wait");
  }

  search(): void {
    if (!this.canAct()) return;
    if (this.x === undefined || this.y === undefined) return;

    const found = dungeon.searchAround(this.x, this.y);
    if (found > 0) {
      dungeon.log(
        this.context,
        found === 1
          ? "You search and uncover a secret!"
          : `You search and uncover ${found} secrets!`
      );
    } else {
      dungeon.log(this.context, "You search but find nothing.");
    }

    this.walkPath = [];
    this.spendTurn("search");
  }

  // --- Touch-to-move (auto-walk) ---

  private nextStepToward(tx: number, ty: number): { x: number; y: number } | null {
    if (this.x === undefined || this.y === undefined) return null;
    const path = dungeon.findPath(this.x, this.y, tx, ty, true, true, this);
    if (path.length > 1) return { x: path[1][0], y: path[1][1] };
    return null;
  }

  private setWalkTarget(tx: number, ty: number): void {
    if (this.x === undefined || this.y === undefined) return;
    this.context.onResumeFollow?.();
    // A fresh command acknowledges current threats, but not other monsters
    // encountered later along the route. Use identity rather than position.
    this.acknowledgedWalkEnemies = new Set(
      this.context.entities.filter((entity) =>
        entity.type === "enemy" && entity.healthPoints > 0 &&
        this.context.visibleTiles.has(`${entity.x},${entity.y}`) &&
        !isGrassConcealed(entity.x, entity.y, this.x, this.y)
      )
    );
    const path = dungeon.findPath(this.x, this.y, tx, ty, true, true, this);
    this.walkPath =
      path.length > 1 ? path.slice(1).map(([x, y]) => ({ x, y })) : [];
  }

  private stepAutoWalk(): void {
    if (isModalOpen(this.context)) return;
    if (this.walkPath.length === 0) return;
    if (this.context.entities.some((entity) =>
      entity.type === "enemy" && entity.healthPoints > 0 &&
      !this.acknowledgedWalkEnemies.has(entity) &&
      this.context.visibleTiles.has(`${entity.x},${entity.y}`) &&
      !isGrassConcealed(entity.x, entity.y, this.x, this.y)
    )) {
      this.walkPath = [];
      return;
    }
    if (!this.canAct()) return;

    const target = this.walkPath[this.walkPath.length - 1];
    const step = this.nextStepToward(target.x, target.y);
    if (!step) {
      this.walkPath = [];
      return;
    }

    const entity = dungeon.entityAtTile(this.context, step.x, step.y);

    if (entity && entity.type === "enemy") {
      this.walkPath = [];
      if (this.canAct()) {
        const weapon = this.currentWeapon();
        if (weapon) {
          const ranged = weapon.range() > 0 ? weapon.attackTile || weapon.tile : 0;
          dungeon.attackEntity(
            this.context,
            this,
            entity,
            ranged,
            weapon.tint,
            weapon.damageType
          );
          this.spendTurn("attack");
        }
      }
      return;
    }

    if (hasEffect(this, "rooted")) {
      this.walkPath = [];
      return;
    }

    if (hasEffect(this, "confused") && dungeon.confusedMove(this.context, this)) return;

    if (entity && entity.type === "item") {
      this.walkPath = [];
      if (this.addItem(entity)) {
        dungeon.itemPicked(entity);
        dungeon.log(this.context, `${this.name} picked ${entity.displayName}.`);
        // Pickup is included in the cost of stepping onto this tile.
        this.spendTurn("move");
        dungeon.moveEntityTo(this.context, this, step.x, step.y);
      }
      return;
    }

    // Open a closed door when stepping into it (no-op for other tiles).
    dungeon.openDoor(step.x, step.y);
    if (dungeon.isWalkableTile(this.context, step.x, step.y)) {
      this.walkPath.shift();
      this.spendTurn("move");
      dungeon.moveEntityTo(this.context, this, step.x, step.y);
    } else {
      this.walkPath = [];
    }
  }

  beginJump(): void {
    if (isModalOpen(this.context)) return;
    const wasActive = this.context.terrainActionMode;
    this.exitCursorModes();
    this.walkPath = [];
    this.inputBuffer = [];
    if (wasActive) return;
    this.context.terrainActionMode = true;
    this.context.cursorX = this.x;
    this.context.cursorY = this.y;
    dungeon.log(this.context, "Jump: select a cardinally adjacent empty chasm. Drops a floor for 1/3 max HP damage (fatal on the last floor). Esc cancels.");
  }

  jumpAt(x: number, y: number): void {
    if (!this.context.terrainActionMode || !this.canAct() || isModalOpen(this.context)) return;
    if (!dungeon.jumpIntoChasm(this.context, this, x, y)) {
      dungeon.log(this.context, "Cannot jump there. Choose a cardinally adjacent empty chasm; you cannot jump while rooted or levitating.");
      return;
    }
    this.context.terrainActionMode = false;
    this.walkPath = [];
    this.inputBuffer = [];
    this.spendTurn("move");
  }

  private exitCursorModes(): void {
    const context = this.context;
    context.terrainActionMode = false;
    if (context.throwMode) {
      this.cancelThrow();
      return;
    }
    if (context.inspectMode) {
      context.inspectMode = false;
      context.inspectedEntity = undefined;
      context.inspectedTerrain = undefined;
      context.onInspectModeChange?.(false);
    }
  }

  private moveCursor(dx: number, dy: number): void {
    const context = this.context;
    if (context.cursorX === undefined || context.cursorY === undefined) {
      context.cursorX = this.x;
      context.cursorY = this.y;
    }
    if (context.cursorX === undefined || context.cursorY === undefined) return;

    const level = dungeon.getCurrentLevel();
    const nx = context.cursorX + dx;
    const ny = context.cursorY + dy;
    if (ny < 0 || nx < 0 || ny >= level.length || nx >= level[0].length) return;

    context.cursorX = nx;
    context.cursorY = ny;

    if (context.inspectMode) {
      this.updateInspectedFromCursor();
    }
  }

  private updateInspectedFromCursor(): void {
    const context = this.context;
    if (context.cursorX === undefined || context.cursorY === undefined) return;
    const x = context.cursorX;
    const y = context.cursorY;

    this.inspectTile(x, y);
  }

  private inspectTile(x: number, y: number): void {
    const context = this.context;
    context.inspectChoices = undefined;
    context.inspectedEntity = undefined;
    context.inspectedTerrain = undefined;
    if (!context.visibleTiles.has(`${x},${y}`)) return;

    const entities = context.entities.filter((entity) =>
      entity.sprite && entity.x === x && entity.y === y && entity.type !== "player" &&
      !isGrassConcealed(entity.x, entity.y, this.x, this.y)
    );
    if (entities.length > 1) {
      context.inspectChoices = entities;
    } else if (entities.length === 1) {
      context.inspectedEntity = entities[0];
    } else {
      context.inspectedTerrain = dungeon.inspectTile(x, y);
    }
  }

  beginThrow(item: Entity, zap = false): void {
    const context = this.context;
    if (!this.getAllItems().includes(item)) {
      dungeon.log(context, "You don't have that item.");
      return;
    }
    if (item.cursed && this.slotOf(item) && !zap) {
      dungeon.log(context, `${item.displayName} is cursed and cannot be thrown.`);
      return;
    }

    this.zapping = zap;
    context.terrainActionMode = false;
    context.throwMode = true;
    context.throwItem = item;
    if (context.cursorX === undefined || context.cursorY === undefined) {
      context.cursorX = this.x;
      context.cursorY = this.y;
    }
    dungeon.log(
      context,
      `${zap ? "Zapping" : "Throwing"} ${item.displayName} — tap a tile in range and line of sight, or move the cursor and press Enter. Esc cancels.`
    );
  }

  cancelThrow(): void {
    const context = this.context;
    if (!context.throwMode) return;
    context.throwMode = false;
    context.throwItem = undefined;
    this.zapping = false;
    dungeon.log(context, "Targeting cancelled.");
  }

  throwAtCursor(): void {
    const context = this.context;
    if (!context.throwMode || !context.throwItem) return;
    if (context.cursorX === undefined || context.cursorY === undefined) return;
    this.throwAt(context.cursorX, context.cursorY);
  }

  private splitStackItem(item: Entity): Entity {
    return Object.assign(Object.create(Object.getPrototypeOf(item)), item, {
      count: 1, x: undefined, y: undefined, sprite: undefined,
      UISprite: undefined, UIText: undefined,
      effects: item.effects.map(effect => ({ ...effect }))
    });
  }

  // Resolve a throw at a tile (reached from a pointer tap or the cursor).
  throwAt(tx: number, ty: number): void {
    const context = this.context;
    const item = context.throwItem;
    if (!item || !this.canAct()) return;
    // Target selection may outlive an inventory change. Never throw a stale
    // reference (or an item that became cursed while equipped).
    if (!this.getAllItems().includes(item) ||
        (!this.zapping && item.cursed && this.slotOf(item))) {
      this.cancelThrow();
      return;
    }
    if (this.x === undefined || this.y === undefined) {
      this.cancelThrow();
      return;
    }

    const level = dungeon.getCurrentLevel();
    const inBounds =
      ty >= 0 && tx >= 0 && ty < level.length && tx < level[0].length;
    const distance = Math.max(Math.abs(tx - this.x), Math.abs(ty - this.y));
    const isWall = inBounds && level[ty][tx] === 1;
    const hasLOS = inBounds && hasLineOfSight(level, this.x, this.y, tx, ty);

    const range = this.zapping && item instanceof Wand ? item.range() : 5;
    if (!inBounds || distance > range || !hasLOS || isWall) {
      dungeon.log(context, "You can't throw there.");
      this.cancelThrow();
      return;
    }

    const intercepted = dungeon.firstActorInPath(context, this, tx, ty);
    if (intercepted) {
      tx = intercepted.x!;
      ty = intercepted.y!;
    }

    if (this.zapping && item instanceof Wand) {
      if (!this.getAllItems().includes(item) || item.charges <= 0) {
        this.cancelThrow();
        return;
      }
      const damage = item.damage();
      const enemy = intercepted ?? dungeon.entityAtTile(context, tx, ty);
      if (enemy?.type === "enemy") {
        const attack = this.attack;
        this.attack = () => damage;
        try {
          const result = resolveAttack(context, this, enemy, {
            damageType: item.damageType, isRanged: true, onHitEffects: [item.wandEffect()]
          });
          if (result.hit) {
            enemy.takeDamage(result.damage);
            if (result.damageType === "shock" && result.damage > 0) context.onShockWater?.(enemy, result.damage);
            for (const effect of result.appliedEffects) {
              if (enemy.healthPoints > 0) applyEffect(enemy, effect);
            }
            dungeon.applyHitEffects(context, enemy);
            if (enemy.healthPoints <= 0) removeEntity(context, enemy);
          }
          dungeon.log(context, `${item.displayName}: ${result.hit ? `${result.damage} damage` : "miss"}.`);
        } finally {
          this.attack = attack;
        }
      }
      context.throwMode = false;
      context.throwItem = undefined;
      this.zapping = false;
      this.spendTurn("use");
      this.refreshUI();
      return;
    }

    const scene = context.scene;
    const map = context.map;
    if (!scene || !map) {
      this.cancelThrow();
      return;
    }

    // Split a single projectile from a stack without reusing the inventory
    // entity. Preserve upgrades/identification, but never share sprites/UI.
    const thrown: Entity = item.count > 1
      ? this.splitStackItem(item)
      : item;
    this.removeItem(item);
    if (!context.entities.includes(thrown)) context.entities.push(thrown);

    this.spendTurn("throw");
    this.moving = true;
    const projectile = scene.add
      .sprite(map.tileToWorldX(this.x)!, map.tileToWorldY(this.y)!, item.spriteTextureKey, item.spriteFrame)
      .setOrigin(0)
      .setDepth(250);
    if (item.tint) projectile.tint = item.tint;

    scene.tweens.add({
      targets: projectile,
      x: map.tileToWorldX(tx)!,
      y: map.tileToWorldY(ty)!,
      duration: 140,
      ease: "Power2",
      onComplete: () => {
        projectile.destroy();
        this.resolveThrowLanding(thrown, tx, ty);
        this.moving = false;
      }
    });

    context.throwMode = false;
    context.throwItem = undefined;
  }

  private resolveThrowLanding(item: Entity, tx: number, ty: number): void {
    const context = this.context;
    // Loot can share an actor's tile; entity array order must not hide the
    // living target from the impact handler.
    const target = context.entities.find(entity =>
      entity.type === "enemy" && entity.healthPoints > 0 && entity.x === tx && entity.y === ty
    );

    if (target) {
      this.applyThrownItemToEnemy(item, target);
      removeEntity(context, item);
      dungeon.triggerArrowTrap(context, tx, ty);
      return;
    }

    if (item.consumable && item.name === "Potion of Toxic Gas" && context.onCreatePoisonGas?.(tx, ty)) {
      removeEntity(context, item);
      dungeon.triggerArrowTrap(context, tx, ty);
      return;
    }
    // Frost can prepare a terrain hazard without needing a living target.
    if (item.consumable && item.name === "Potion of Frost" && context.onFrostTerrain?.(tx, ty)) {
      removeEntity(context, item);
      dungeon.triggerArrowTrap(context, tx, ty);
      return;
    }
    this.placeItemOnGround(item, tx, ty);
    dungeon.triggerArrowTrap(context, tx, ty);
  }

  private applyThrownItemToEnemy(item: Entity, enemy: Entity): void {
    const context = this.context;

    // Weapons (and ranged weapon-like items such as fireball scrolls) deal
    // their own damage through the normal combat math.
    if (item.equipSlot === "weapon" || item.damage() > 0) {
      const originalAttack = (this as unknown as { attack: () => number }).attack;
      (this as unknown as { attack: () => number }).attack = () => item.damage();

      let result: ReturnType<typeof resolveAttack>;
      try {
        result = resolveAttack(context, this, enemy, {
          damageType: item.damageType ?? "physical",
          isRanged: true,
          onHitEffects: []
        });
      } finally {
        (this as unknown as { attack: () => number }).attack = originalAttack;
      }

      if (!result.hit) return;

      if (result.damage > 0) {
        enemy.takeDamage(result.damage);
        if (result.damageType === "shock") context.onShockWater?.(enemy, result.damage);
        dungeon.log(
          context,
          `${this.name} throws ${item.displayName} at ${enemy.name} for ${result.damage} ${result.damageType} damage.`
        );
        dungeon.applyHitEffects(context, enemy);
      } else {
        dungeon.log(
          context,
          `${this.name} throws ${item.displayName} at ${enemy.name} but deals no damage.`
        );
      }

      for (const effect of result.appliedEffects) {
        if (enemy.healthPoints > 0) {
          applyEffect(enemy, effect);
        }
      }

      if (enemy.healthPoints <= 0) {
        removeEntity(context, enemy);
      }
      return;
    }

    // Potions splash their status effect onto the target where one applies.
    this.applyThrownPotion(item, enemy);
  }

  private applyThrownPotion(item: Entity, enemy: Entity): void {
    const context = this.context;
    dungeon.log(
      context,
      `${this.name} throws ${item.displayName} at ${enemy.name}.`
    );

    const name = item.name.toLowerCase();
    if (name.includes("liquid flame")) {
      applyEffect(enemy, createBurningEffect(4));
    } else if (name.includes("toxic gas")) {
      applyEffect(enemy, createPoisonedEffect(4));
      if (enemy.x !== undefined && enemy.y !== undefined) context.onCreatePoisonGas?.(enemy.x, enemy.y);
    } else if (name.includes("frost")) {
      applyEffect(enemy, createFrozenEffect(1));
    } else {
      dungeon.log(context, "It splashes harmlessly.");
    }
  }

  private placeItemOnGround(item: Entity, tx: number, ty: number): void {
    const context = this.context;
    const scene = context.scene;
    const map = context.map;
    if (!scene || !map) {
      removeEntity(context, item);
      return;
    }

    item.context = context;
    item.x = tx;
    item.y = ty;

    if (!context.entities.includes(item)) {
      context.entities.push(item);
    }

    item.sprite?.destroy();
    item.sprite = undefined;
    const sprite = scene.add
      .sprite(map.tileToWorldX(tx)!, map.tileToWorldY(ty)!, item.spriteTextureKey, item.spriteFrame)
      .setOrigin(0);
    if (item.tint) {
      sprite.tint = item.tint;
    }
    item.sprite = sprite;

    if (item.type === "item") {
      scene.tweens.add({
        targets: sprite,
        alpha: { from: 0.7, to: 1 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }

    dungeon.log(
      context,
      `${this.name} throws ${item.displayName} — it lands on the floor.`
    );
  }

  // --- Per-class active skill (Phase 9) ---

  // `f` / `F` entry point. Guards cooldown + action points, then delegates to
  // the per-class useSkill() override.
  tryUseSkill(): void {
    if (this.skill === "") return;

    if (this.skillCooldown > 0) {
      dungeon.log(
        this.context,
        `${this.skill} is recharging (${this.skillCooldown} time remaining).`
      );
      return;
    }

    if (!this.canAct()) return;

    this.useSkill();
  }

  // Overridden by each class. The base hero has no active skill.
  useSkill(): void {
  }

  // Resolve a skill attack synchronously (no tween) and apply the result:
  // damage, on-hit status effects and death cleanup. Bonus damage is applied
  // by temporarily raising baseAttack while resolveAttack reads attack().
  protected resolveSkillAttack(
    victim: Entity,
    opts: {
      bonusDamage?: number;
      damageType?: DamageType;
      onHitEffects?: StatusEffect[];
    } = {}
  ): void {
    const previous = this.baseAttack;
    this.baseAttack += opts.bonusDamage ?? 0;

    let result: ReturnType<typeof resolveAttack>;
    try {
      result = resolveAttack(this.context, this, victim, {
        damageType: opts.damageType ?? "physical",
        onHitEffects: opts.onHitEffects ?? []
      });
    } finally {
      this.baseAttack = previous;
    }

    if (!result.hit) return;

    if (result.damage > 0) {
      victim.takeDamage(result.damage);
      if (result.damageType === "shock") this.context.onShockWater?.(victim, result.damage);
      dungeon.log(
        this.context,
        `${this.name} hits ${victim.name} for ${result.damage} ${result.damageType} damage.`
      );
      dungeon.applyHitEffects(this.context, victim);
    } else {
      dungeon.log(
        this.context,
        `${this.name} hits ${victim.name} but deals no damage.`
      );
    }

    for (const effect of result.appliedEffects) {
      if (victim.healthPoints > 0) {
        applyEffect(victim, effect);
      }
    }

    if (victim.healthPoints <= 0) {
      removeEntity(this.context, victim);
    }
  }

  // Nearest visible enemy within `maxRange` tiles (chebyshev distance).
  protected nearestVisibleEnemy(maxRange: number): Entity | undefined {
    if (this.x === undefined || this.y === undefined) return undefined;

    let best: Entity | undefined;
    let bestDistance = Infinity;

    for (const entity of this.context.entities) {
      if (entity.type !== "enemy" || !entity.sprite) continue;
      if (entity.x === undefined || entity.y === undefined) continue;
      if (!this.context.visibleTiles.has(`${entity.x},${entity.y}`)) continue;

      const distance = Math.max(
        Math.abs(entity.x - this.x),
        Math.abs(entity.y - this.y)
      );
      if (isGrassConcealed(entity.x, entity.y, this.x, this.y)) continue;
      if (distance <= maxRange && distance < bestDistance) {
        best = entity;
        bestDistance = distance;
      }
    }

    return best;
  }

  // An enemy on one of the eight tiles adjacent to the hero.
  protected adjacentEnemy(): Entity | undefined {
    if (this.x === undefined || this.y === undefined) return undefined;

    for (const entity of this.context.entities) {
      if (entity.type !== "enemy" || !entity.sprite) continue;
      if (entity.x === undefined || entity.y === undefined) continue;

      const distance = Math.max(
        Math.abs(entity.x - this.x),
        Math.abs(entity.y - this.y)
      );
      if (distance === 1) return entity;
    }

    return undefined;
  }

  // Visible enemies within `radius` tiles (chebyshev distance).
  protected visibleEnemiesInRadius(radius: number): Entity[] {
    if (this.x === undefined || this.y === undefined) return [];

    const enemies: Entity[] = [];
    for (const entity of this.context.entities) {
      if (entity.type !== "enemy" || !entity.sprite) continue;
      if (entity.x === undefined || entity.y === undefined) continue;
      if (!this.context.visibleTiles.has(`${entity.x},${entity.y}`)) continue;

      const distance = Math.max(
        Math.abs(entity.x - this.x),
        Math.abs(entity.y - this.y)
      );
      if (isGrassConcealed(entity.x, entity.y, this.x, this.y)) continue;
      if (distance <= radius) enemies.push(entity);
    }

    return enemies;
  }

  processInput(key: string) {
    if (isModalOpen(this.context)) return;
    const context = this.context;

    // --- Inspect / throw cursor modes ---
    // While a cursor is active, arrows/HJKL move the highlighted tile instead
    // of the player, x/Escape leave the mode, and Enter throws at the cursor.
    if (this.cursorActive()) {
      if (key === "Escape") {
        this.exitCursorModes();
        return;
      }
      if (key === "x" || key === "X") {
        if (context.terrainActionMode) {
          this.exitCursorModes();
        } else if (context.throwMode) {
          this.cancelThrow();
        } else {
          this.toggleInspectMode();
        }
        return;
      }
      if (key === "Enter") {
        if (context.terrainActionMode && context.cursorX !== undefined && context.cursorY !== undefined) {
          this.jumpAt(context.cursorX, context.cursorY);
        } else if (context.throwMode) {
          this.throwAtCursor();
        }
        return;
      }
      const dir = this.cursorDir(key);
      if (dir) {
        this.moveCursor(dir.dx, dir.dy);
        return;
      }
      // Ignore every other key while a cursor mode is active.
      return;
    }

    // `x` toggles the inspect cursor on from normal play.
    if (key === "x" || key === "X") {
      this.toggleInspectMode();
      return;
    }

    if (!this.canAct()) return;

    let oldX = this.x!;
    let oldY = this.y!;
    let moved = false;
    let newX = this.x!;
    let newY = this.y!;

    if (key === "v" || key === "V") {
      this.beginJump();
      return;
    }

    // Active class skill (f / F).
    if (key === "f" || key === "F") {
      this.tryUseSkill();
      return;
    }

    // Search (s / S): reveal nearby secrets without disabling traps.
    if (key === "s" || key === "S") {
      this.search();
      return;
    }

    // Pass the turn
    if (key == " ") {
      this.waitTurn();
    }

    const dir = this.cursorDir(key);
    if (dir) {
      newX += dir.dx;
      newY += dir.dy;
      if (hasEffect(this, "confused") &&
          dungeon.entityAtTile(context, newX, newY)?.type !== "enemy" &&
          dungeon.confusedMove(context, this)) return;
      moved = true;
    }

    // Execute movement
    if (moved) {
      this.context.onResumeFollow?.();
      this.walkPath = []; // manual input cancels auto-walk
      if (!dungeon.canStepBetween(oldX, oldY, newX, newY, this)) return;
      // Entering a revealed trap requires explicitly clicking its tile.
      if (getTrapState(newX, newY) === "visible") return;
      if (hasEffect(this, "rooted") &&
          dungeon.entityAtTile(this.context, newX, newY)?.type !== "enemy") return;
      dungeon.openDoor(newX, newY);

      if (!dungeon.isWalkableTile(this.context, newX, newY)) {
        let entity = dungeon.entityAtTile(this.context, newX, newY);

        // Check if entity at destination is an enemy
        if (entity && entity.type == "enemy") {
          const currentWeapon = this.currentWeapon();
          if (!currentWeapon) {
            return;
          }
          const rangedAttack = currentWeapon.range() > 0 ? currentWeapon.attackTile || currentWeapon.tile : 0;
          dungeon.attackEntity(
            this.context,
            this,
            entity,
            rangedAttack,
            currentWeapon.tint,
            currentWeapon.damageType
          );
          this.spendTurn("attack");
        }

        // Check if entity at destination is an item
        if (entity && entity.type == "item" && !hasEffect(this, "rooted")) {
          if (this.addItem(entity)) {
            dungeon.itemPicked(entity);
            const detail = entity.identified ? `: ${entity.displayDescription}` : "";
            dungeon.log(this.context, `${this.name} picked ${entity.displayName}${detail}`);
            // Pickup shares the movement turn below.
          } else {
            newX = oldX;
            newY = oldY;
          }
        } else {
          newX = oldX;
          newY = oldY;
        }

      }

      if (newX !== oldX || newY !== oldY) {
        if (hasEffect(this, "rooted")) return;
        this.spendTurn("move");
        dungeon.moveEntityTo(this.context, this, newX, newY);
      }
    }
  }

  isOver() {
    return !this.actionReady && !this.moving;
  }

  statsText(): string {
    let text = `Lv ${this.level}  Xp ${this.xp}/${this.xpForNextLevel()}  Str ${this.strength}\nHp: ${this.healthPoints}/${this.maxHealthPoints}`;
    const food = `Food: ${Math.ceil(this.hunger)}/${this.maxHunger} (${this.hungerState})`;
    text += `\n${food}  Gold: ${this.gold}`;
    if (this.skill !== "") {
      const state =
        this.skillCooldown > 0 ? `cd ${this.skillCooldown}` : "ready [f]";
      text += `\n${this.skill}: ${state}`;
    }
    return text;
  }

  private skillLabel(): string {
    if (this.skill === "") return "No skill";
    return this.skillCooldown > 0
      ? `${this.skill}  (cd ${this.skillCooldown})`
      : `${this.skill}  [f]`;
  }

  updateUI() {
    const over = !this.canAct();
    if (this.UIHeader) {
      this.UIHeader.setColor(over ? UI_HIGHLIGHT_BACKGROUND_COLOR : "#fff");
    }
  }

  onDestroy() {
    this.context.scene?.events.emit("player-died");
  }

  createUI({ scene, x, y, width }: {
    scene: Phaser.Scene;
    x: number;
    y: number;
    width?: number
  }) {
    this.UIScene = scene;
    this.UIX = x;
    this.UIY = y;

    const w = width ?? 160;
    let yy = y;

    // Hero icon + name (tap to open the hero stats modal).
    this.UISprite = scene.add.sprite(x, yy, "tiles", this.tile).setOrigin(0);
    this.UIHeader = scene.add.text(x + 20, yy + 4, this.name, {
      fontFamily: `"${UI_FONT_PIXEL}", monospace`,
      fontSize: 10,
      color: UI_COL.gold
    });
    scene.add
      .zone(x, yy, w, 22)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.onHeroIconTap?.());
    yy += 24;

    // Backpack button opens/closes the inventory window (i/b toggles too).
    const button = scene.add
      .rectangle(x, yy, w, 22, UI_C.panel2, 1)
      .setOrigin(0)
      .setStrokeStyle(1, UI_C.borderStrong, 1);
    const backpackLabel = scene.add
      .text(x + w / 2, yy + 11, "Backpack  [i/b]", {
        fontFamily: `${UI_FONT_MONO}, monospace`,
        fontSize: 16,
        color: UI_COL.muted
      })
      .setOrigin(0.5);
    button.setInteractive({ useHandCursor: true });
    button.on("pointerover", () => {
      button.setStrokeStyle(1, UI_C.gold, 1);
      backpackLabel.setColor(UI_COL.gold);
    });
    button.on("pointerout", () => {
      button.setStrokeStyle(1, UI_C.borderStrong, 1);
      backpackLabel.setColor(UI_COL.muted);
    });
    button.on("pointerup", () => this.onBackpackToggle?.());
    yy += 22;

    // Search (magnifying glass) button — reveals hidden traps around the hero.
    const searchBtn = scene.add
      .rectangle(x, yy, w, 22, UI_C.panel2, 1)
      .setOrigin(0)
      .setStrokeStyle(1, UI_C.borderStrong, 1);

    const magnifier = scene.add.graphics();
    magnifier.lineStyle(2, 0xa29a8e, 1);
    magnifier.strokeCircle(x + 15, yy + 11, 5);
    magnifier.lineBetween(x + 19, yy + 15, x + 25, yy + 21);

    const searchLabel = scene.add
      .text(x + w / 2 + 4, yy + 11, "Search  [s]", {
        fontFamily: `${UI_FONT_MONO}, monospace`,
        fontSize: 16,
        color: UI_COL.muted
      })
      .setOrigin(0.5);

    searchBtn.setInteractive({ useHandCursor: true });
    searchBtn.on("pointerover", () => {
      searchBtn.setStrokeStyle(1, UI_C.gold, 1);
      searchLabel.setColor(UI_COL.gold);
    });
    searchBtn.on("pointerout", () => {
      searchBtn.setStrokeStyle(1, UI_C.borderStrong, 1);
      searchLabel.setColor(UI_COL.muted);
    });
    searchBtn.on("pointerup", () => this.search());
    yy += 22;

    // Skill button — activates the class skill (same as pressing f).
    const skillBtn = scene.add
      .rectangle(x, yy, w, 22, UI_C.panel2, 1)
      .setOrigin(0)
      .setStrokeStyle(1, UI_C.borderStrong, 1);
    this.UISkillLabel = scene.add
      .text(x + w / 2, yy + 11, this.skillLabel(), {
        fontFamily: `${UI_FONT_MONO}, monospace`,
        fontSize: 16,
        color: UI_COL.muted
      })
      .setOrigin(0.5);
    skillBtn.setInteractive({ useHandCursor: true });
    skillBtn.on("pointerover", () => {
      skillBtn.setStrokeStyle(1, UI_C.gold, 1);
      this.UISkillLabel?.setColor(UI_COL.gold);
    });
    skillBtn.on("pointerout", () => {
      skillBtn.setStrokeStyle(1, UI_C.borderStrong, 1);
      this.UISkillLabel?.setColor(
        this.skillCooldown > 0 ? UI_COL.muted : UI_COL.gold
      );
    });
    skillBtn.on("pointerup", () => this.tryUseSkill());
    yy += 22;

    this.refreshUI();
    return yy - y;
  }

  refreshUI() {
    if (!this.UIScene) return;
    this.UIHeader?.setColor(
      !this.canAct() ? UI_COL.muted : UI_COL.gold
    );

    // Skill button label: gold when ready, muted while on cooldown.
    if (this.UISkillLabel) {
      this.UISkillLabel.setText(this.skillLabel());
      this.UISkillLabel.setColor(
        this.skillCooldown > 0 ? UI_COL.muted : UI_COL.gold
      );
    }
  }

  private clearItemUI(item: Entity): void {
    item.UISprite?.destroy();
    item.UISprite = undefined;
    item.UIText?.destroy();
    item.UIText = undefined;
  }

  damage(): number {
    return 0;
  }

  equip(): void {
  }

  range(): number {
    return 0;
  }
}
