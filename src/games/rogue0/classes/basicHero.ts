import type { EntityType } from "../entity";
import { Entity, removeEntity, identify } from "../entity";
import type { GameContext } from "../context";
import dungeon from "../dungeon";
import Gem from "../items/gem";
import Wand from "../items/wand";
import { terrainFor } from '../terrain';
import { hasLineOfSight } from "../fov";
import { sfx } from "../audio";
import {
  applyEffect,
  createBurningEffect,
  createChilledEffect,
  createFrozenEffect,
  createPoisonedEffect,
  removeEffect,
  hasEffect
} from "../effects";
import { resolveAttack } from "../combat";
import { applyAttackResult } from '../combatApplication';
import { heroInventory } from '../heroInventory';
import { splitStackItem, type EquipSlotKey } from '../inventory';
import { placeFloorItem } from '../itemPresentation';
import { stashChasmFallen } from '../chasmDrops';
import { heroStatsText } from '../heroViewModel';

import { heroControlsFor } from '../heroControls';
import { hostileAtTile, isHostile } from '../heroControlRules';
import type { HeroControlHost, PointerPosition } from '../heroControlTypes';
import { spawnEntityFloatingText } from "../floatingText";
import type { ActionKind } from "../timing";

// A thrown Potion of Frost is especially dangerous to fire elementals: the
// flask's cold payload hits them directly before the normal frozen splash.
const FROST_POTION_FIRE_DAMAGE = 4;

// Every talent is a passive: the game has no active class abilities.
export const CLASS_TALENTS = {
  Warrior: [
    { id: "fury", name: "Deep Fury", description: "+1 damage at/below half HP per rank." }
  ],
  Dwarf: [
    { id: "armor", name: "Iron Skin", description: "+1 physical armor per rank." }
  ],
  Cleric: [
    { id: "mending", name: "Greater Mending", description: "+1 HP regenerated each turn per rank." }
  ],
  Elf: [
    { id: "grace", name: "Light Footwork", description: "+5 evasion per rank (before armor penalties)." }
  ],
  Wizard: [
    { id: "mastery", name: "Focused Mastery", description: "+1 fire/shock/magic damage per rank." }
  ]
} as const;

/** Rank cap for every talent. */
export const MAX_TALENT_RANK = 2;

export default class BasicHero extends Entity implements HeroControlHost {
  private get controls() { return heroControlsFor(this.context); }

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
    const capacity = this.availableTalents.length * MAX_TALENT_RANK;
    return Math.max(0, Math.min(capacity, this.level - 1) - spent);
  }

  learnTalent(id: string): boolean {
    if (this.healthPoints <= 0 || !this.availableTalents.some(t => t.id === id) ||
        this.talentPoints <= 0 || this.talentRank(id) >= MAX_TALENT_RANK) return false;
    this.talentRanks[id] = this.talentRank(id) + 1;
    const talent = this.availableTalents.find(t => t.id === id)!;
    dungeon.log(this.context, `Learned ${talent.name} (${this.talentRank(id)}/${MAX_TALENT_RANK}).`);
    return true;
  }
  baseAttack: number = 0;
  strength: number = 10;
  tile: number = 26;
  textureKey = 'hero-color';
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
  // Runtime control state shared with the input/targeting facade; reset on load.
  zapping = false;

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

  inputBuffer: string[] = [];
  walkPath: Array<{ x: number; y: number }> = [];
  acknowledgedWalkEnemies = new Set<Entity>();
  walkTargetEntity?: Entity;

  constructor(context: GameContext) {
    super();

    // Make the context available before init() so subclasses can add their
    // starting gear in their constructors.
    this.context = context;

    this.bindInput();
  }

  /** Runtime-only control state is never resumed from a browser checkpoint. */
  resetTransientState(): void {
    this.inputBuffer = [];
    this.walkPath = [];
    this.acknowledgedWalkEnemies = new Set();
    this.walkTargetEntity = undefined;
    this.zapping = false;
  }

  /** Also used after restoring the hero without rerolling its starting gear. */
  bindInput(): void {
    this.controls.bindInput(this);
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

    // Execute buffered input as soon as the player can act.
    this.drainInputBuffer();

    // Continue an auto-walk started by a tap, one step per turn.
    this.stepAutoWalk();
  }

  canAct(): boolean {
    return this.actionReady && !this.moving && !hasEffect(this, "frozen");
  }

  spendTurn(action: ActionKind = "wait"): void {
    this.spendTime(action, this.currentWeapon()?.attackDelay ?? this.attackDelay);
  }

  bufferKey(key: string): void {
    this.controls.bufferKey(this, key);
  }

  drainInputBuffer(): void {
    this.controls.drainInputBuffer(this);
  }

  // Compatibility facade: callers and saved fields stay on the hero, while
  // storage/equipment rules live in the independently testable inventory core.
  slotFor(item: Entity): EquipSlotKey | undefined {
    return heroInventory.slotFor(this, item);
  }

  slotOf(item: Entity): EquipSlotKey | undefined {
    return heroInventory.slotOf(this, item);
  }

  getAllItems(): Entity[] {
    return heroInventory.allItems(this);
  }

  addItem(item: Entity): boolean {
    return heroInventory.addItem(this, item);
  }

  equipItem(item: Entity): void {
    heroInventory.equipItem(this, item);
  }

  unequipItem(item: Entity): void {
    heroInventory.unequipItem(this, item);
  }

  dropItem(item: Entity): void {
    heroInventory.dropItem(this, item);
  }

  // Use a consumable. Identifies it (if needed) and runs its consume effect.
  useItem(item: Entity): boolean {
    if (!this.getAllItems().includes(item)) return false;
    // Tapping the wand that is already aiming fires at the highlighted enemy.
    // Changing your mind means opening the backpack, which cancels targeting.
    // With nothing hostile under the cursor the tap only deselects, so a stray
    // second tap never spends a charge or a turn.
    if (item instanceof Wand && this.zapping && this.context.throwMode &&
        this.context.throwItem === item) {
      const { cursorX, cursorY } = this.context;
      if (cursorX !== undefined && cursorY !== undefined &&
          hostileAtTile(this.context, cursorX, cursorY)) {
        this.throwAt(cursorX, cursorY);
      } else {
        this.cancelThrow();
      }
      return false;
    }
    if (!this.canAct()) return false;
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
    if (item.requiresItemTarget) {
      if (!this.getAllItems().some(target => item.canTargetItem(target))) {
        dungeon.log(this.context, item.noItemTargetsMessage);
        return false;
      }
      this.context.onChooseItemTarget?.(item);
      return false; // Selecting/cancelling is free; confirmation consumes it.
    }
    if (!item.identified) {
      identify(item);
    }
    const previousMessages = this.context.messages.join("\n");
    item.equip();
    if (this.context.messages.join("\n") === previousMessages) {
      dungeon.log(this.context, `You use ${item.name}.`);
    }
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
  }

  removeItem(item: Entity): void {
    heroInventory.removeItem(this, item);
  }

  removeItemsByProperty<K extends keyof Entity>(property: K, value: Entity[K]): void {
    heroInventory.removeItemsByProperty(this, property, value);
  }

  removeCurse(target?: Entity): void {
    heroInventory.removeCurse(this, target);
  }

  equippedItems(): Entity[] {
    return heroInventory.equippedItems(this);
  }

  currentWeapon() {
    return this.weapon;
  }

  strengthDeficit(item?: Entity): number {
    return item ? Math.max(0, item.requiredStrength - this.strength) : 0;
  }

  get effectiveAccuracy(): number {
    const base = this.accuracy / Math.pow(1.2, this.strengthDeficit(this.weapon));
    // Wayward curse halves accuracy while the cursed weapon stays equipped.
    return this.weapon?.cursed && this.weapon?.curseId === "wayward" ? base * 0.5 : base;
  }

  get effectiveEvasion(): number {
    return (this.evasion + 5 * this.talentRank("grace")) / Math.pow(1.2, this.strengthDeficit(this.armor));
  }

  movementCostMultiplier(): number {
    const bulk = this.armor?.cursed && this.armor?.curseId === "bulk" ? 2 : 1;
    return bulk * Math.pow(1.2, this.strengthDeficit(this.armor));
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
    // Metabolism curse doubles hunger drain while the cursed armor stays on.
    const drain = this.armor?.cursed && this.armor?.curseId === "metabolism" ? 0.5 : 0.25;
    this.hunger = Math.max(0, this.hunger - drain);

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

  // Control facade: public for the explicit HeroControlHost contract. The
  // factories own policy; actor methods/state and existing callers stay stable.
  processTouchInput(context: GameContext, event: PointerPosition): void {
    this.controls.processTouchInput(this, context, event);
  }

  cursorActive(): boolean {
    return this.controls.cursorActive(this);
  }

  isCursorKey(key: string): boolean {
    return this.controls.isCursorKey(this, key);
  }

  cursorDir(key: string): { dx: number; dy: number } | undefined {
    return this.controls.cursorDir(this, key);
  }

  inspectOrSearch(): void {
    this.controls.inspectOrSearch(this);
  }

  toggleInspectMode(): void {
    this.controls.toggleInspectMode(this);
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

  nextStepToward(tx: number, ty: number): { x: number; y: number } | null {
    return this.controls.nextStepToward(this, tx, ty);
  }

  setWalkTarget(tx: number, ty: number, target?: Entity): void {
    this.controls.setWalkTarget(this, tx, ty, target);
  }

  stepAutoWalk(): void {
    this.controls.stepAutoWalk(this);
  }

  tryStepIntoChasm(x: number, y: number): boolean {
    return this.controls.tryStepIntoChasm(this, x, y);
  }

  exitCursorModes(): void {
    this.controls.exitCursorModes(this);
  }

  moveCursor(dx: number, dy: number): void {
    this.controls.moveCursor(this, dx, dy);
  }

  updateInspectedFromCursor(): void {
    this.controls.updateInspectedFromCursor(this);
  }

  inspectTile(x: number, y: number): void {
    this.controls.inspectTile(this, x, y);
  }

  closestZapTarget(): Entity | undefined {
    return this.controls.closestZapTarget(this);
  }

  beginThrow(item: Entity, zap = false): void {
    this.controls.beginThrow(this, item, zap);
  }

  cancelThrow(): void {
    this.controls.cancelThrow(this);
  }

  throwAtCursor(): void {
    this.controls.throwAtCursor(this);
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
    const hasLOS = inBounds && hasLineOfSight(level, this.x, this.y, tx, ty, terrainFor(this.context));

    // Thrown items have no distance cap; only wands keep their own range
    // (which is already unlimited for every wand currently in the game).
    const outOfRange = this.zapping && item instanceof Wand && distance > item.range();
    if (!inBounds || outOfRange || !hasLOS || isWall) {
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
      const enemy = intercepted ?? dungeon.entityAtTile(context, tx, ty);
      const damage = Math.round(item.damage() * (enemy ? item.wandDamageMultiplier(enemy) : 1));
      // A cursed wand may redirect its own magic onto the caster. The charge
      // is already spent by `damage()`; only the effect flips onto the hero.
      if (dungeon.procWandCurse(context, this, item)) {
        context.throwMode = false;
        context.throwItem = undefined;
        this.zapping = false;
        this.spendTurn("use");
        return;
      }
      // Resolve the hit when the bolt head reaches the target, not the frame
      // the zap is fired: otherwise a killed monster disappears before the
      // projectile animation arrives. The hero stays `moving` until then so
      // the turn scheduler waits for the projectile, exactly like a thrown item.
      const applyImpact = () => {
        if (enemy && isHostile(enemy)) {
          const result = resolveAttack(context, this, enemy, {
            baseDamage: damage, damageType: item.damageType,
            isRanged: true, onHitEffects: item.wandEffects()
          });
          applyAttackResult(context, this, enemy, result, {
            applyEffect: (target, effect) => applyEffect(target, effect),
            removeEffect: (target, id) => removeEffect(target, id),
            removeEntity: (ctx, target) => removeEntity(ctx, target),
            notifyVictim: false, applyZeroDamage: true,
            onHit: () => {
              if (result.damageType === "shock" && result.damage > 0 && item.arcsToAdjacent()) {
                dungeon.conductShockAdjacent(context, enemy, result.damage);
              }
            },
            afterEffects: () => dungeon.applyHitEffects(context, enemy, result.surprise)
          });
          dungeon.log(context, `${item.displayName}: ${result.surprise ? "surprise, " : ""}${result.crit ? "critical, " : ""}${result.hit ? `${result.damage} damage` : "miss"}.`);
        }
        this.moving = false;
      };

      context.throwMode = false;
      context.throwItem = undefined;
      this.zapping = false;
      this.spendTurn("use");

      if (context.onWandZap) {
        this.moving = true;
        context.onWandZap({ fromX: this.x, fromY: this.y, toX: tx, toY: ty, damageType: item.damageType }, applyImpact);
      } else {
        // Headless/tests without a renderer have no bolt to wait for.
        applyImpact();
      }
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
      ? splitStackItem(item)
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

    const targetX = map.tileToWorldX(tx)!;
    const targetY = map.tileToWorldY(ty)!;
    const landsInChasm = terrainFor(this.context).getFeature(tx, ty) === "chasm";

    const finishThrow = () => {
      projectile.destroy();
      this.resolveThrowLanding(thrown, tx, ty);
      this.moving = false;
    };

    if (landsInChasm) {
      // Fly to the chasm rim, then fall in: the item shrinks and fades into
      // the dark as it drops out of sight.
      scene.tweens.add({
        targets: projectile,
        x: targetX,
        y: targetY,
        duration: 130,
        ease: "Power2",
        onComplete: () => {
          scene.tweens.add({
            targets: projectile,
            y: targetY + 6,
            alpha: 0,
            scaleX: 0.2,
            scaleY: 0.2,
            duration: 160,
            ease: "Sine.easeIn",
            onComplete: finishThrow
          });
        }
      });
    } else {
      scene.tweens.add({
        targets: projectile,
        x: targetX,
        y: targetY,
        duration: 140,
        ease: "Power2",
        onComplete: finishThrow
      });
    }

    context.throwMode = false;
    context.throwItem = undefined;
  }

  private resolveThrowLanding(item: Entity, tx: number, ty: number): void {
    const context = this.context;
    // Loot can share an actor's tile; entity array order must not hide the
    // living target from the impact handler.
    const target = context.entities.find(entity =>
      isHostile(entity) && entity.healthPoints > 0 && entity.x === tx && entity.y === ty
    );

    if (target) {
      this.applyThrownItemToEnemy(item, target);
      removeEntity(context, item);
      dungeon.triggerArrowTrap(context, tx, ty);
      return;
    }

    // Items that land in a chasm drop through to the floor below. Checked
    // before the terrain potions so a flask can't splash the void from the rim.
    if (terrainFor(this.context).getFeature(tx, ty) === "chasm") {
      const landsBelow = stashChasmFallen(context, item);
      removeEntity(context, item);
      dungeon.log(context, landsBelow
        ? `${item.displayName} falls into the chasm and drops toward the floor below.`
        : `${item.displayName} falls into the chasm and is lost.`);
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
      const result = resolveAttack(context, this, enemy, {
        baseDamage: () => item.damage(), damageType: item.damageType ?? "physical",
        isRanged: true, onHitEffects: []
      });
      applyAttackResult(context, this, enemy, result, {
        applyEffect: (target, effect) => applyEffect(target, effect),
        removeEffect: (target, id) => removeEffect(target, id),
        removeEntity: (ctx, target) => removeEntity(ctx, target),
        onHit: () => {
          if (result.damage > 0) {
            dungeon.log(context,
              `You throw ${item.displayName} at ${enemy.name} for ${result.damage} ${result.damageType} damage.`);
            dungeon.applyHitEffects(context, enemy, result.surprise);
          } else {
            dungeon.log(context, `You throw ${item.displayName} at ${enemy.name} but deals no damage.`);
          }
        }
      });
      return;
    }

    // Potions splash their status effect onto the target where one applies.
    this.applyThrownPotion(item, enemy);
  }

  private applyThrownPotion(item: Entity, enemy: Entity): void {
    const context = this.context;
    dungeon.log(
      context,
      `You throw ${item.displayName} at ${enemy.name}.`
    );

    const name = item.name.toLowerCase();
    if (name.includes("liquid flame")) {
      applyEffect(enemy, createBurningEffect(4));
    } else if (name.includes("toxic gas")) {
      applyEffect(enemy, createPoisonedEffect(4));
      if (enemy.x !== undefined && enemy.y !== undefined) context.onCreatePoisonGas?.(enemy.x, enemy.y);
    } else if (name.includes("frost")) {
      // Fire elementals are critically weak to cold: a frost potion deals
      // direct ice damage (respecting ice resistance/vulnerability) before
      // the usual frozen splash. Other targets are merely frozen. Either way
      // the splash chills, exactly like a frost trap or a frost wand.
      if (enemy.damageType === "fire") {
        const damage = Math.max(
          0,
          FROST_POTION_FIRE_DAMAGE - (enemy.resistance.ice ?? 0) + (enemy.vulnerability.ice ?? 0)
        );
        if (damage > 0) enemy.takeDamage(damage);
        dungeon.log(
          context,
          `The frost potion hits ${enemy.name} for ${damage} ice damage.`
        );
        if (enemy.healthPoints <= 0) {
          removeEntity(context, enemy);
        } else {
          applyEffect(enemy, createFrozenEffect(1));
          applyEffect(enemy, createChilledEffect());
        }
      } else {
        applyEffect(enemy, createFrozenEffect(1));
        applyEffect(enemy, createChilledEffect());
      }
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

    placeFloorItem(item);

    dungeon.log(
      context,
      `You throw ${item.displayName} — it lands on the floor.`
    );
  }

  processInput(key: string): void {
    this.controls.processInput(this, key);
  }

  stepManually(dx: number, dy: number): void {
    this.controls.stepManually(this, dx, dy);
  }

  isOver() {
    return !this.actionReady && !this.moving;
  }

  statsText(): string {
    return heroStatsText(this);
  }

  onDestroy() {
    this.context.scene?.events.emit("player-died");
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
