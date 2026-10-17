// TypeScript errors after site migration - ignoring for game functionality
import type { EntityType } from "../entity";
import { Entity, removeEntity, identify } from "../entity";
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import { hasLineOfSight } from "../fov";
import { sfx } from "../audio";
import { removeEffect } from "../effects";

const UI_HIGHLIGHT_BACKGROUND_COLOR = "#646059";

type EquipSlotKey = "weapon" | "armor" | "ring1" | "ring2" | "artifact";

export default class BasicHero extends Entity {
  name: string = "The Hero";
  description: string = "A brave adventurer";
  movementPoints: number = 1;
  actionPoints: number = 1;
  healthPoints: number = 30;
  maxHealthPoints: number = 30;
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
  UISlotBoxes: Phaser.GameObjects.Rectangle[] = [];
  UIItems: Phaser.GameObjects.Rectangle[] = [];
  UIX: number = 0;
  UIY: number = 0;
  inputBuffer: string[] = [];

  constructor(context: GameContext) {
    super();

    // Make the context available before init() so subclasses can add their
    // starting gear in their constructors.
    this.context = context;

    if (context.scene?.input?.keyboard == undefined) {
      throw new Error("Error in PlayerCharacter context is undefined");
    }

    context.scene.input.keyboard.on("keydown", (event: KeyboardEvent) => {
      if (this.canAct()) {
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
  private slotFor(item: Entity): EquipSlotKey | undefined {
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
  private slotOf(item: Entity): EquipSlotKey | undefined {
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

  private clickEquippedSlot(index: number): void {
    if (!this.canAct()) return;
    const slots = [this.weapon, this.armor, this.ring1, this.ring2, this.artifact];
    const item = slots[index];
    if (item) {
      this.unequipItem(item);
    }
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

  processInput(key: string) {
    let oldX = this.x!;
    let oldY = this.y!;
    let moved = false;
    let newX = this.x!;
    let newY = this.y!;

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
    return `Lv ${this.level}  Xp ${this.xp}/${this.xpForNextLevel()}\nHp: ${this.healthPoints}\nMp: ${this.movementPoints}\nAp: ${this.actionPoints}`;
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

  createUI({ scene, x, y }: {
    scene: Phaser.Scene;
    x: number;
    y: number;
    width?: number
  }) {
    this.UIScene = scene;
    this.UIX = x;
    this.UIY = y;

    let yy = y;

    // Character sprite, name and stats.
    this.UISprite = scene.add.sprite(x, yy, "tiles", this.tile).setOrigin(0);
    this.UIHeader = scene.add.text(x + 20, yy, this.name, {
      font: "16px Arial",
      color: UI_HIGHLIGHT_BACKGROUND_COLOR
    });
    this.UIStatsText = scene.add.text(x + 20, yy + 20, this.statsText(), {
      font: "12px Arial",
      backgroundColor: UI_HIGHLIGHT_BACKGROUND_COLOR
    });
    yy += 60;

    // Equipped slots (click to unequip).
    scene.add.text(x, yy, "Equipped", {
      font: "11px Arial",
      color: "#cfc6b8"
    });
    yy += 14;

    this.UISlotBoxes = [];
    const slotLabels = ["W", "A", "R1", "R2", "Ar"];
    for (let i = 0; i < 5; i++) {
      const rx = x + i * 24;
      const box = scene.add.rectangle(rx, yy, 22, 22, 0xcfc6b8, 0.3).setOrigin(0);
      box.setInteractive({ useHandCursor: true });
      box.on("pointerup", () => this.clickEquippedSlot(i));
      this.UISlotBoxes.push(box);
      scene.add.text(rx + 3, yy + 1, slotLabels[i], {
        font: "10px Arial",
        color: "#8a8578"
      });
    }
    yy += 26;

    // Backpack grid (numbered keys 1-0 act on the first 10 cells).
    scene.add.text(x, yy, "Backpack (1-0)", {
      font: "11px Arial",
      color: "#cfc6b8"
    });
    yy += 14;

    this.UIItems = [];
    const cols = 5;
    const rows = Math.ceil(this.capacity / cols);
    for (let i = 0; i < this.capacity; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rx = x + col * 24;
      const ry = yy + row * 24;
      const box = scene.add.rectangle(rx, ry, 22, 22, 0xcfc6b8, 0.3).setOrigin(0);
      box.setInteractive({ useHandCursor: true });
      box.on("pointerup", () => this.useOrEquipBackpackSlot(i));
      this.UIItems.push(box);
    }
    yy += rows * 24;

    // Separator.
    yy += 4;
    scene.add.line(x + 5, yy, 0, 10, 175, 10, 0xcfc6b8).setOrigin(0);
    yy += 10;

    this.refreshUI();
    return yy - y;
  }

  refreshUI() {
    if (!this.UIScene) return;

    const slots = [this.weapon, this.armor, this.ring1, this.ring2, this.artifact];
    for (let i = 0; i < this.UISlotBoxes.length; i++) {
      this.renderItemInBox(slots[i], this.UISlotBoxes[i]);
    }
    for (let i = 0; i < this.UIItems.length; i++) {
      this.renderItemInBox(this.backpack[i], this.UIItems[i]);
    }
  }

  private renderItemInBox(item: Entity | undefined, box: Phaser.GameObjects.Rectangle) {
    const scene = this.UIScene;
    if (!scene || !box) return;
    if (!item) return;

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    if (item.identified) {
      if (!item.UISprite) {
        item.UISprite = scene.add.sprite(cx, cy, "tiles", item.tile).setOrigin(0.5);
        if (item.UISprite && item.tint) {
          item.UISprite.tint = item.tint;
        }
      }
      item.UISprite.setPosition(cx, cy);
      item.UISprite.setVisible(true);
      item.UIText?.setVisible(false);
    } else {
      item.UISprite?.setVisible(false);
      if (!item.UIText) {
        item.UIText = scene.add.text(cx, cy, "?", {
          font: "16px Arial",
          color: "#ffffff"
        }).setOrigin(0.5);
      }
      item.UIText.setPosition(cx, cy);
      item.UIText.setVisible(true);
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
