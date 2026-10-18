// TypeScript errors after site migration - ignoring for game functionality
import type { EntityType } from "../entity";
import { Entity, removeEntity, identify } from "../entity";
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import { hasLineOfSight } from "../fov";
import { sfx } from "../audio";
import {
  applyEffect,
  createBurningEffect,
  createFrozenEffect,
  createPoisonedEffect,
  removeEffect
} from "../effects";
import type { DamageType, StatusEffect } from "../effects";
import { resolveAttack } from "../combat";

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

export default class BasicHero extends Entity {
  name: string = "The Hero";
  description: string = "A brave adventurer";
  movementPoints: number = 1;
  actionPoints: number = 1;
  healthPoints: number = 30;
  maxHealthPoints: number = 30;
  hunger: number = 100;
  maxHunger: number = 100;
  gold: number = 0;
  private hungerWarned: boolean = false;
  xp: number = 0;
  level: number = 1;
  baseAttack: number = 0;
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
  capacity: number = 20;

  UIHeader?: Phaser.GameObjects.Text;
  UIStatsText?: Phaser.GameObjects.Text;
  UIScene?: Phaser.Scene;
  UIEffectIcons: Phaser.GameObjects.Sprite[] = [];
  UIEffectTexts: Phaser.GameObjects.Text[] = [];
  UIX: number = 0;
  UIY: number = 0;
  inputBuffer: string[] = [];
  onBackpackToggle?: () => void;

  // Per-class active skill (Phase 9). Triggered with `f` / `F`; the cooldown
  // ticks down once per round in refresh() and is shown in statsText().
  skill: string = "";
  skillDescription: string = "";
  skillCooldown: number = 0;
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
    }

    this.refreshUI();

    // Execute buffered input as soon as the player can act.
    this.drainInputBuffer();
  }

  canAct(): boolean {
    return this.movementPoints > 0 && !this.moving;
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
    const slot = this.slotFor(item);
    const willEquip = slot !== undefined && this[slot] === undefined;

    if (!willEquip && this.backpack.length >= this.capacity) {
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

    if (willEquip && slot) {
      this[slot] = item;
      this.onEquip(item);
    } else {
      this.backpack.push(item);
    }

    this.refreshUI();
    return true;
  }

  private onEquip(item: Entity): void {
    const detail = item.identified ? `: ${item.description}` : "";
    dungeon.log(this.context, `${this.name} equips ${item.displayName}${detail}.`);
    sfx.equip();
    item.equip();
  }

  private onUnequip(item: Entity): void {
    dungeon.log(this.context, `${this.name} unequips ${item.displayName}.`);
    item.unequip?.();
  }

  equipItem(item: Entity): void {
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
    this.refreshUI();
  }

  unequipItem(item: Entity): void {
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
    this.refreshUI();
  }

  // Drop an item from an equipped slot or the backpack back onto the map at
  // the player's tile. Cursed items refuse to be dropped while cursed.
  dropItem(item: Entity): void {
    if (item.cursed) {
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

    const slot = this.slotOf(item);
    if (slot) {
      this[slot] = undefined;
      this.onUnequip(item);
    } else {
      this.backpack = this.backpack.filter((i) => i !== item);
    }
    this.clearItemUI(item);

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
          "tiles",
          item.tile
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
    this.refreshUI();
  }

  // Use a consumable. Identifies it (if needed) and runs its consume effect.
  useItem(item: Entity): boolean {
    if (!item.consumable) return false;

    if (!item.identified) {
      identify(item);
    }
    dungeon.log(this.context, `${this.name} uses ${item.name}.`);
    item.equip();
    sfx.potion();
    return true;
  }

  // Numbered key / click action for a backpack cell: consume if consumable,
  // otherwise try to equip it.
  useOrEquipBackpackSlot(index: number): void {
    if (!this.canAct()) return;
    const item = this.backpack[index];
    if (!item) return;

    if (item.consumable) {
      if (this.actionPoints <= 0) return;
      this.useItem(item);
      this.actionPoints -= 1;
    } else {
      this.equipItem(item);
    }
    this.refreshUI();
  }

  removeItem(item: Entity): void {
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

  refresh() {
    this.movementPoints = 1;
    this.actionPoints = 1;
    if (this.skillCooldown > 0) {
      this.skillCooldown -= 1;
    }

    // Hunger (G5): burn one point of hunger per round, clamped at 0.
    if (this.hunger > 0) {
      this.hunger -= 1;
    }

    // Warn once when hunger first drops below 30, not every round.
    if (this.hunger > 0 && this.hunger < 30 && !this.hungerWarned) {
      this.hungerWarned = true;
      dungeon.log(this.context, "You are getting hungry.");
    }

    // Starving: 1 damage per round until food is eaten.
    if (this.hunger === 0) {
      this.healthPoints -= 1;
      dungeon.log(this.context, "You are starving! You take 1 damage.");
      if (this.healthPoints <= 0) {
        removeEntity(this.context, this);
      }
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
    }
  }

  processTouchInput(context: GameContext, event: Phaser.Input.Pointer) {
    if (context.map == undefined) {
      throw new Error("context.map is undefined");
    }
    let x = context.map.worldToTileX(event.worldX);
    let y = context.map.worldToTileY(event.worldY);

    let entity = dungeon.entityAtTile(context, x!, y!);

    // Throw targeting takes priority: any tap resolves the pending throw.
    if (context.throwMode) {
      this.throwAt(x!, y!);
      return;
    }

    // Inspect is a UI action: always available, on any turn.
    if (context.inspectMode) {
      if (entity && entity.type !== "player" && context.visibleTiles?.has(`${x},${y}`)) {
        context.inspectedEntity = entity;
      } else {
        context.inspectedEntity = undefined;
      }
      return;
    }

    // Otherwise this is a player action (attack): only during the player's turn.
    if (this.isOver()) return;

    if (entity && entity.type == "enemy" && this.actionPoints > 0) {
      const currentWeapon = this.currentWeapon();
      if (currentWeapon) {
        const rangedAttack = currentWeapon.range() > 0 ? currentWeapon.attackTile || currentWeapon.tile : false;
        const distance = dungeon.distanceBetweenEntities(this, entity);
        const hasLOS = hasLineOfSight(
          dungeon.getCurrentLevel(),
          this.x!,
          this.y!,
          entity.x!,
          entity.y!
        );
        if (rangedAttack && hasLOS && distance <= currentWeapon.range()) {
          dungeon.attackEntity(
            context,
            this,
            entity,
            rangedAttack,
            currentWeapon.tint,
            currentWeapon.damageType
          );
          this.actionPoints -= 1;
        }
      }
    }
  }

  // --- Inspect cursor + throw targeting ---

  private cursorActive(): boolean {
    return this.context.inspectMode || this.context.throwMode;
  }

  private isCursorKey(key: string): boolean {
    return (
      key === "x" || key === "X" || key === "Escape" || key === "Enter" ||
      key === "ArrowLeft" || key === "ArrowRight" ||
      key === "ArrowUp" || key === "ArrowDown" ||
      key === "h" || key === "j" || key === "k" || key === "l"
    );
  }

  private cursorDir(key: string): { dx: number; dy: number } | undefined {
    switch (key) {
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

  private toggleInspectMode(): void {
    const context = this.context;
    context.inspectMode = !context.inspectMode;
    if (context.inspectMode) {
      if (context.cursorX === undefined || context.cursorY === undefined) {
        context.cursorX = this.x;
        context.cursorY = this.y;
      }
      this.updateInspectedFromCursor();
    } else {
      context.inspectedEntity = undefined;
    }
    context.onInspectModeChange?.(context.inspectMode);
  }

  private exitCursorModes(): void {
    const context = this.context;
    if (context.throwMode) {
      this.cancelThrow();
      return;
    }
    if (context.inspectMode) {
      context.inspectMode = false;
      context.inspectedEntity = undefined;
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

    if (!context.visibleTiles.has(`${x},${y}`)) {
      context.inspectedEntity = undefined;
      return;
    }

    const entity = dungeon.entityAtTile(context, x, y);
    if (entity && entity.type !== "player") {
      context.inspectedEntity = entity;
    } else {
      context.inspectedEntity = undefined;
    }
  }

  beginThrow(item: Entity): void {
    const context = this.context;
    if (!this.getAllItems().includes(item)) {
      dungeon.log(context, "You don't have that item.");
      return;
    }
    if (item.cursed) {
      dungeon.log(context, `${item.displayName} is cursed and cannot be thrown.`);
      return;
    }

    context.throwMode = true;
    context.throwItem = item;
    if (context.cursorX === undefined || context.cursorY === undefined) {
      context.cursorX = this.x;
      context.cursorY = this.y;
    }
    dungeon.log(
      context,
      `Throwing ${item.displayName} — tap a tile (<=5 tiles, line of sight), or move the cursor and press Enter. Esc cancels.`
    );
  }

  cancelThrow(): void {
    const context = this.context;
    if (!context.throwMode) return;
    context.throwMode = false;
    context.throwItem = undefined;
    dungeon.log(context, "You stop throwing.");
  }

  throwAtCursor(): void {
    const context = this.context;
    if (!context.throwMode || !context.throwItem) return;
    if (context.cursorX === undefined || context.cursorY === undefined) return;
    this.throwAt(context.cursorX, context.cursorY);
  }

  // Resolve a throw at a tile (reached from a pointer tap or the cursor).
  throwAt(tx: number, ty: number): void {
    const context = this.context;
    const item = context.throwItem;
    if (!item) return;
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

    if (!inBounds || distance > 5 || !hasLOS || isWall) {
      dungeon.log(context, "You can't throw there.");
      this.cancelThrow();
      return;
    }

    // Remove the item from the hero's possession now; the landing handler
    // either consumes it (enemy hit) or puts it on the floor.
    this.removeItem(item);

    const scene = context.scene;
    const map = context.map;
    if (!scene || !map) {
      this.addItem(item);
      this.cancelThrow();
      return;
    }

    const projectile = scene.add
      .sprite(map.tileToWorldX(this.x)!, map.tileToWorldY(this.y)!, "tiles", item.tile)
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
        this.resolveThrowLanding(item, tx, ty);
      }
    });

    context.throwMode = false;
    context.throwItem = undefined;
  }

  private resolveThrowLanding(item: Entity, tx: number, ty: number): void {
    const context = this.context;
    const target = dungeon.entityAtTile(context, tx, ty);

    if (target && target.type === "enemy") {
      this.applyThrownItemToEnemy(item, target);
      removeEntity(context, item);
      return;
    }

    this.placeItemOnGround(item, tx, ty);
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
        enemy.healthPoints -= result.damage;
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
      .sprite(map.tileToWorldX(tx)!, map.tileToWorldY(ty)!, "tiles", item.tile)
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
        `${this.skill} is recharging (${this.skillCooldown} turn${this.skillCooldown === 1 ? "" : "s"}).`
      );
      return;
    }

    if (this.actionPoints <= 0) {
      dungeon.log(this.context, "You have no action points to use a skill.");
      return;
    }

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
      victim.healthPoints -= result.damage;
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
      if (distance <= radius) enemies.push(entity);
    }

    return enemies;
  }

  processInput(key: string) {
    const context = this.context;

    // --- Inspect / throw cursor modes ---
    // While a cursor is active, arrows/HJKL move the highlighted tile instead
    // of the player, x/Escape leave the mode, and Enter throws at the cursor.
    if (context.inspectMode || context.throwMode) {
      if (key === "Escape") {
        this.exitCursorModes();
        return;
      }
      if (key === "x" || key === "X") {
        if (context.throwMode) {
          this.cancelThrow();
        } else {
          this.toggleInspectMode();
        }
        return;
      }
      if (key === "Enter") {
        if (context.throwMode) {
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

    let oldX = this.x!;
    let oldY = this.y!;
    let moved = false;
    let newX = this.x!;
    let newY = this.y!;

    // Active class skill (f / F).
    if (key === "f" || key === "F") {
      this.tryUseSkill();
      return;
    }

    // Numbered keys 1-0 act on backpack slots 1-10 (use/equip).
    if (/^[0-9]$/.test(key)) {
      let keyNumber = Number(key);
      if (keyNumber == 0) {
        keyNumber = 10;
      }
      this.useOrEquipBackpackSlot(keyNumber - 1);
    }

    // Pass the turn
    if (key == " ") {
      this.movementPoints = 0;
      this.actionPoints = 0;
    }

    // Movement decision
    if (key == "ArrowLeft" || key === "h") {
      newX -= 1;
      moved = true;
    }

    if (key == "ArrowRight" || key === "l") {
      newX += 1;
      moved = true;
    }

    if (key == "ArrowUp" || key === "k") {
      newY -= 1;
      moved = true;
    }

    if (key == "ArrowDown" || key === "j") {
      newY += 1;
      moved = true;
    }

    // Execute movement
    if (moved) {
      this.movementPoints -= 1;

      if (!dungeon.isWalkableTile(this.context, newX, newY)) {
        let entity = dungeon.entityAtTile(this.context, newX, newY);

        // Check if entity at destination is an enemy
        if (entity && entity.type == "enemy" && this.actionPoints > 0) {
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
          this.actionPoints -= 1;
          this.movementPoints += 1;
        }

        // Check if entity at destination is an item
        if (entity && entity.type == "item" && this.actionPoints > 0) {
          if (this.addItem(entity)) {
            dungeon.itemPicked(entity);
            const detail = entity.identified ? `: ${entity.description}` : "";
            dungeon.log(this.context, `${this.name} picked ${entity.displayName}${detail}`);
            this.actionPoints -= 1;
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
        dungeon.moveEntityTo(this.context, this, newX, newY);
      }
    }
  }

  isOver() {
    return this.movementPoints == 0 && !this.moving;
  }

  statsText(): string {
    let text = `Lv ${this.level}  Xp ${this.xp}/${this.xpForNextLevel()}\nHp: ${this.healthPoints}  Mp: ${this.movementPoints}  Ap: ${this.actionPoints}`;
    const food =
      this.hunger <= 0
        ? "Starving!"
        : `Food: ${this.hunger}/${this.maxHunger}`;
    text += `\n${food}  Gold: ${this.gold}`;
    if (this.skill !== "") {
      const state =
        this.skillCooldown > 0 ? `cd ${this.skillCooldown}` : "ready [f]";
      text += `\n${this.skill}: ${state}`;
    }
    return text;
  }

  updateUI() {
    const over = this.movementPoints == 0 && !this.moving;
    if (this.UIHeader) {
      this.UIHeader.setColor(over ? UI_HIGHLIGHT_BACKGROUND_COLOR : "#fff");
    }
    if (this.UIStatsText) {
      this.UIStatsText.setText(this.statsText());
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

    // Portrait + pixel-font name aligned on a single header row.
    this.UISprite = scene.add.sprite(x, yy, "tiles", this.tile).setOrigin(0);
    this.UIHeader = scene.add.text(x + 20, yy + 4, this.name, {
      fontFamily: `"${UI_FONT_PIXEL}", monospace`,
      fontSize: 10,
      color: UI_COL.gold
    });
    yy += 18;

    // Stats box on the dark panel (replaces the old grey Arial slab).
    scene.add
      .rectangle(x, yy, w, 80, UI_C.cell, 1)
      .setOrigin(0)
      .setStrokeStyle(1, UI_C.border, 1);
    this.UIStatsText = scene.add.text(x + 6, yy + 6, this.statsText(), {
      fontFamily: `${UI_FONT_MONO}, monospace`,
      fontSize: 16,
      color: UI_COL.text,
      lineSpacing: 2,
      wordWrap: { width: w - 12 }
    });
    yy += 88;

    // Active status effects under the portrait (buff/debuff icons + turns).
    scene.add.text(x, yy, "Status", {
      fontFamily: `"${UI_FONT_PIXEL}", monospace`,
      fontSize: 8,
      color: UI_COL.muted
    });
    yy += 12;

    this.UIEffectIcons = [];
    this.UIEffectTexts = [];
    for (let i = 0; i < 8; i++) {
      const ex = x + i * 20;
      const icon = scene.add.sprite(ex, yy, "tiles", 0).setOrigin(0).setVisible(false);
      const label = scene.add.text(ex + 4, yy + 18, "", {
        fontFamily: `${UI_FONT_MONO}, monospace`,
        fontSize: 12,
        color: UI_COL.text
      }).setOrigin(0).setVisible(false);
      this.UIEffectIcons.push(icon);
      this.UIEffectTexts.push(label);
    }
    yy += 36;

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

    this.refreshUI();
    return yy - y;
  }

  refreshUI() {
    if (!this.UIScene) return;
    this.UIHeader?.setColor(
      this.movementPoints === 0 && !this.moving ? UI_COL.muted : UI_COL.gold
    );

    // Render active status effects (icon + remaining duration). Manual-expiry
    // effects (frozen / curse) show ∞ instead of a turn count.
    for (let i = 0; i < this.UIEffectIcons.length; i++) {
      const icon = this.UIEffectIcons[i];
      const label = this.UIEffectTexts[i];
      const effect = this.effects[i];
      if (effect) {
        icon.setTexture("tiles", effect.iconTile).setVisible(true);
        const infinite =
          effect.manualExpiry || effect.duration === Number.POSITIVE_INFINITY;
        label.setText(infinite ? "∞" : String(effect.duration)).setVisible(true);
      } else {
        icon.setVisible(false);
        label.setVisible(false);
      }
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
