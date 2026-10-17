// TypeScript errors after site migration - ignoring for game functionality
import type { EntityType } from "../entity";
import { Entity, removeEntity, identify } from "../entity";
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import { hasLineOfSight } from "../fov";
import { sfx } from "../audio";
import { applyEffect, removeEffect } from "../effects";
import type { DamageType, StatusEffect } from "../effects";
import { resolveAttack } from "../combat";

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
    let text = `Lv ${this.level}  Xp ${this.xp}/${this.xpForNextLevel()}\nHp: ${this.healthPoints}\nMp: ${this.movementPoints}\nAp: ${this.actionPoints}`;
    if (this.skill !== "") {
      const state =
        this.skillCooldown > 0
          ? `cooldown ${this.skillCooldown}`
          : "ready [f]";
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

    // Active status effects under the portrait (buff/debuff icons + turns).
    scene.add.text(x, yy, "Status", {
      font: "11px Arial",
      color: "#cfc6b8"
    });
    yy += 14;

    this.UIEffectIcons = [];
    this.UIEffectTexts = [];
    for (let i = 0; i < 8; i++) {
      const ex = x + i * 22;
      const icon = scene.add.sprite(ex, yy, "tiles", 0).setOrigin(0).setVisible(false);
      const label = scene.add.text(ex, yy + 17, "", {
        font: "10px Arial",
        color: "#ffffff"
      }).setOrigin(0).setVisible(false);
      this.UIEffectIcons.push(icon);
      this.UIEffectTexts.push(label);
    }
    yy += 38;

    // Backpack button opens/closes the inventory window (i/b toggles too).
    const button = scene.add.rectangle(x, yy, 150, 24, 0xcfc6b8, 0.3).setOrigin(0);
    button.setInteractive({ useHandCursor: true });
    button.on("pointerup", () => this.onBackpackToggle?.());
    scene.add.text(x + 6, yy + 4, "Backpack  [i/b]", {
      font: "12px Arial",
      color: "#ffffff"
    });
    yy += 30;

    this.refreshUI();
    return yy - y;
  }

  refreshUI() {
    if (!this.UIScene) return;

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
