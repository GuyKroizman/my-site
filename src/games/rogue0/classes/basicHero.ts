import type { EntityType } from "../entity";
import { Entity, removeEntity, identify } from "../entity";
import { isModalOpen, type GameContext } from "../context";
import dungeon from "../dungeon";
import Gem from "../items/gem";
import Wand from "../items/wand";
import { getFeature, getTrapState, isGrassConcealed } from "../tiles";
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
import type { DamageType, StatusEffect } from "../effects";
import { resolveAttack } from "../combat";
import { applyAttackResult } from '../combatApplication';
import { heroInventory } from '../heroInventory';
import { splitStackItem, type EquipSlotKey } from '../inventory';
import { placeFloorItem } from '../itemPresentation';
import { heroStatsText } from '../heroViewModel';

// A friendly decoy (mirror image) is rendered/scheduled like an enemy, but is
// never a valid attack target for the hero. Kept local so headless tests that
// strip imports (and inject plain object stubs) still exercise real logic.
function isHostile(entity: Entity): boolean {
  return entity.type === "enemy" && !entity.isDecoy;
}

function hostileAtTile(context: GameContext, x: number, y: number): Entity | undefined {
  return (context.entities ?? []).find(entity =>
    isHostile(entity) && (entity.healthPoints ?? 0) > 0 && !!entity.sprite &&
    entity.x === x && entity.y === y
  );
}

// Pickup log lines read naturally ("You picked up a Gem.") without dumping an
// item's full description into the message log. Gold piles are a mass noun and
// get no article.
function pickupMessage(entity: Entity): string {
  const label = entity.displayName;
  if (entity.goldAmount > 0) return `You picked up ${label}.`;
  const article = /^[aeiou]/i.test(label) ? "an" : "a";
  return `You picked up ${article} ${label}.`;
}
import { spawnEntityFloatingText } from "../floatingText";
import { actionCost, starvationDamageDuring, type ActionKind } from "../timing";

// A thrown Potion of Frost is especially dangerous to fire elementals: the
// flask's cold payload hits them directly before the normal frozen splash.
const FROST_POTION_FIRE_DAMAGE = 4;

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

  inputBuffer: string[] = [];
  walkPath: Array<{ x: number; y: number }> = [];
  private acknowledgedWalkEnemies = new Set<Entity>();
  private walkTargetEntity?: Entity;

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
    const context = this.context;
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
    if (!this.canAct() || !this.getAllItems().includes(item)) return false;
    if (item instanceof Wand) {
      if (item.charges <= 0) {
        dungeon.log(this.context, "The wand is spent.");
        return false;
      }
      // A second tap on the same wand fires at the selected target (the
      // auto-targeted closest enemy or the last enemy tapped) instead of
      // re-opening target selection. Never fire at the hero's own tile when
      // no target could be auto-selected.
      if (this.zapping && this.context.throwMode && this.context.throwItem === item &&
          this.context.cursorX !== undefined && this.context.cursorY !== undefined &&
          (this.context.cursorX !== this.x || this.context.cursorY !== this.y)) {
        this.throwAtCursor();
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

  processTouchInput(context: GameContext, event: Phaser.Input.Pointer) {
    if (isModalOpen(context)) return;
    if (context.pinching || context.panning) return;
    if (context.map == undefined) {
      throw new Error("context.map is undefined");
    }
    const x = context.map.worldToTileX(event.worldX);
    const y = context.map.worldToTileY(event.worldY);

    let entity = dungeon.entityAtTile(context, x!, y!);
    if (entity && isGrassConcealed(entity.x, entity.y, this.x, this.y)) entity = undefined;

    // Throw targeting takes priority: any tap resolves the pending throw.
    // Wand targeting is select-then-confirm: tapping an enemy selects it
    // (highlighting its tile); tapping that same enemy again fires. Tapping
    // any other tile still fires immediately, preserving free aiming.
    if (context.throwMode) {
      if (this.zapping && x !== null && y !== null) {
        const hostile = hostileAtTile(context, x, y);
        if (hostile && !isGrassConcealed(hostile.x, hostile.y, this.x, this.y)) {
          if (context.cursorX === x && context.cursorY === y) {
            this.throwAt(x, y);
          } else {
            context.cursorX = x;
            context.cursorY = y;
          }
          return;
        }
      }
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

    if (entity && isHostile(entity)) {
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
        // No ranged attack: chase the enemy and attack when adjacent.
        this.setWalkTarget(entity.x!, entity.y!, entity);
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

  private setWalkTarget(tx: number, ty: number, target?: Entity): void {
    if (this.x === undefined || this.y === undefined) return;
    // Chasing a hostile entity re-targets each step (see stepAutoWalk) so a
    // moving monster is pursued, not the tile it occupied when tapped.
    this.walkTargetEntity =
      target && isHostile(target) ? target : undefined;
    if (this.tryStepIntoChasm(tx, ty)) return;
    this.context.onResumeFollow?.();
    // A fresh command acknowledges current threats, but not other monsters
    // encountered later along the route. Use identity rather than position.
    this.acknowledgedWalkEnemies = new Set(
      this.context.entities.filter((entity) =>
        isHostile(entity) && entity.healthPoints > 0 &&
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
      isHostile(entity) && entity.healthPoints > 0 &&
      !this.acknowledgedWalkEnemies.has(entity) &&
      this.context.visibleTiles.has(`${entity.x},${entity.y}`) &&
      !isGrassConcealed(entity.x, entity.y, this.x, this.y)
    )) {
      this.walkPath = [];
      this.walkTargetEntity = undefined;
      return;
    }
    if (!this.canAct()) return;

    // A moving enemy is chased by re-pathing toward its current tile every
    // step. If it dies, stop; if it leaves sight, fall back to its last known
    // position (already stored as the end of the current walkPath).
    if (this.walkTargetEntity) {
      const target = this.walkTargetEntity;
      const alive =
        isHostile(target) &&
        target.healthPoints > 0 &&
        target.x !== undefined &&
        target.y !== undefined &&
        this.context.entities.includes(target);
      if (!alive || this.x === undefined || this.y === undefined) {
        this.walkTargetEntity = undefined;
        this.walkPath = [];
        return;
      }
      if (!this.context.visibleTiles.has(`${target.x},${target.y}`) ||
          isGrassConcealed(target.x, target.y, this.x, this.y)) {
        this.walkTargetEntity = undefined;
      } else {
        const path = dungeon.findPath(this.x!, this.y!, target.x!, target.y!, true, true, this);
        this.walkPath =
          path.length > 1 ? path.slice(1).map(([x, y]) => ({ x, y })) : [];
        if (this.walkPath.length === 0) {
          this.walkTargetEntity = undefined;
          return;
        }
      }
    }

    const destination = this.walkPath[this.walkPath.length - 1];
    if (!destination) {
      this.walkPath = [];
      this.walkTargetEntity = undefined;
      return;
    }
    const step = this.nextStepToward(destination.x, destination.y);
    if (!step) {
      this.walkPath = [];
      this.walkTargetEntity = undefined;
      return;
    }

    const entity = dungeon.entityAtTile(this.context, step.x, step.y);

    // Recheck every automated action: damage and movement speed may change
    // during travel. Stop without spending time, opening doors or picking up loot.
    if (this.hunger <= 0) {
      const action = entity && isHostile(entity) ? 'attack' : 'move';
      const duration = actionCost(this, action, this.currentWeapon()?.attackDelay ?? this.attackDelay);
      if (starvationDamageDuring(this.context.simulationTime ?? 0, duration) >= this.healthPoints) {
        this.walkPath = [];
        this.walkTargetEntity = undefined;
        dungeon.log(this.context, 'Auto-walk stopped: starvation would kill you. Eat or heal before continuing.');
        return;
      }
    }

    if (entity && isHostile(entity)) {
      this.walkPath = [];
      this.walkTargetEntity = undefined;
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
      this.walkTargetEntity = undefined;
      return;
    }

    if (hasEffect(this, "confused") && dungeon.confusedMove(this.context, this)) return;

    if (entity && entity.type === "item") {
      this.walkPath = [];
      if (entity.isContainer) {
        entity.openContainer();
        return;
      }
      if (this.addItem(entity)) {
        dungeon.itemPicked(entity);
        dungeon.log(this.context, pickupMessage(entity));
        // Pickup is included in the cost of stepping onto this tile.
        this.spendTurn("move");
        dungeon.moveEntityTo(this.context, this, step.x, step.y);
      }
      return;
    }

    // Opening a closed door is its own action: spend the turn here, then step
    // through on the next auto-walk action.
    if (dungeon.openDoor(step.x, step.y)) {
      this.spendTurn("openDoor");
      return;
    }
    if (dungeon.isWalkableTile(this.context, step.x, step.y)) {
      this.walkPath.shift();
      this.spendTurn("move");
      dungeon.moveEntityTo(this.context, this, step.x, step.y);
    } else {
      this.walkPath = [];
      this.walkTargetEntity = undefined;
    }
  }

  private tryStepIntoChasm(x: number, y: number): boolean {
    if (!dungeon.canEnterChasm(this.context, this, x, y)) return false;
    this.walkPath = [];
    this.inputBuffer = [];
    if (!this.canAct() || isModalOpen(this.context)) return true;
    const warning = this.context.floor === 25
      ? "You will fall to your death."
      : "You will fall to the level below and take damage (1/3 of your maximum HP).";
    const floor = this.context.floor;
    const originX = this.x;
    const originY = this.y;
    this.context.onConfirmChasm?.(warning, () => {
      // The UI is asynchronous: reject stale confirmations after travel or death.
      if (this.context.floor !== floor || this.x !== originX || this.y !== originY ||
          this.healthPoints <= 0 || !this.canAct() || isModalOpen(this.context)) return;
      if (dungeon.stepIntoChasm(this.context, this, x, y)) this.spendTurn("move");
    });
    return true;
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

  // Nearest visible, unobstructed enemy for wand auto-targeting. Kept
  // defensive (entities/visibleTiles may be absent in headless tests).
  private closestZapTarget(): Entity | undefined {
    const context = this.context;
    if (this.x === undefined || this.y === undefined) return undefined;
    const level = dungeon.getCurrentLevel();
    if (!level?.length) return undefined;

    let best: Entity | undefined;
    let bestDistance = Infinity;
    for (const entity of context.entities ?? []) {
      if (!isHostile(entity) || (entity.healthPoints ?? 0) <= 0 || !entity.sprite) continue;
      if (entity.x === undefined || entity.y === undefined) continue;
      if (!context.visibleTiles?.has(`${entity.x},${entity.y}`)) continue;
      if (isGrassConcealed(entity.x, entity.y, this.x, this.y)) continue;
      if (!hasLineOfSight(level, this.x, this.y, entity.x, entity.y)) continue;

      const distance = Math.max(
        Math.abs(entity.x - this.x),
        Math.abs(entity.y - this.y)
      );
      if (distance < bestDistance) {
        best = entity;
        bestDistance = distance;
      }
    }
    return best;
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
    if (zap) {
      // Zapping starts aimed at the nearest visible enemy so a second tap on
      // the wand (or a tap on that enemy) fires immediately. With no valid
      // enemy, the cursor stays on the hero and must be moved before firing.
      const target = this.closestZapTarget();
      context.cursorX = target?.x ?? this.x;
      context.cursorY = target?.y ?? this.y;
    } else if (context.cursorX === undefined || context.cursorY === undefined) {
      context.cursorX = this.x;
      context.cursorY = this.y;
    }
    // Targeting instructions are shown temporarily by the HUD.
  }

  cancelThrow(): void {
    const context = this.context;
    if (!context.throwMode) return;
    context.throwMode = false;
    context.throwItem = undefined;
    this.zapping = false;

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
    const landsInChasm = getFeature(tx, ty) === "chasm";

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

    // Items that land in a chasm fall in and are lost. Checked before the
    // terrain potions so a flask can't splash the void from the rim.
    if (getFeature(tx, ty) === "chasm") {
      removeEntity(context, item);
      dungeon.log(context, `${item.displayName} falls into the chasm and is lost.`);
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
  // damage, on-hit status effects and death cleanup. Bonus damage is passed
  // explicitly, so callbacks never observe temporarily modified hero stats.
  protected resolveSkillAttack(
    victim: Entity,
    opts: {
      bonusDamage?: number;
      damageType?: DamageType;
      onHitEffects?: StatusEffect[];
    } = {}
  ): void {
    const result = resolveAttack(this.context, this, victim, {
      bonusDamage: opts.bonusDamage, damageType: opts.damageType ?? "physical",
      onHitEffects: opts.onHitEffects ?? []
    });
    applyAttackResult(this.context, this, victim, result, {
      applyEffect: (target, effect) => applyEffect(target, effect),
      removeEffect: (target, id) => removeEffect(target, id),
      removeEntity: (ctx, target) => removeEntity(ctx, target),
      onHit: () => {
        if (result.damage > 0) {
          dungeon.log(this.context, `You hit ${victim.name} for ${result.damage} ${result.damageType} damage.`);
          dungeon.applyHitEffects(this.context, victim, result.surprise);
        } else {
          dungeon.log(this.context, `You hit ${victim.name} but deals no damage.`);
        }
      }
    });
  }

  // Nearest visible enemy within `maxRange` tiles (chebyshev distance).
  protected nearestVisibleEnemy(maxRange: number): Entity | undefined {
    if (this.x === undefined || this.y === undefined) return undefined;

    let best: Entity | undefined;
    let bestDistance = Infinity;

    for (const entity of this.context.entities) {
      if (!isHostile(entity) || !entity.sprite) continue;
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
      if (!isHostile(entity) || !entity.sprite) continue;
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
      if (!isHostile(entity) || !entity.sprite) continue;
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

    if (!this.canAct()) return;

    const oldX = this.x!;
    const oldY = this.y!;
    let moved = false;
    let newX = this.x!;
    let newY = this.y!;

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
      if (this.tryStepIntoChasm(newX, newY)) return;
      // Opening a closed door is its own action (SPD-style): spend a turn to
      // open it and stay put, then step through on a later action.
      if (dungeon.openDoor(newX, newY)) {
        this.spendTurn("openDoor");
        return;
      }

      if (!dungeon.isWalkableTile(this.context, newX, newY)) {
        const entity = dungeon.entityAtTile(this.context, newX, newY);

        // Check if entity at destination is an enemy
        if (entity && isHostile(entity)) {
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
          if (entity.isContainer) {
            entity.openContainer();
            return;
          }
          if (this.addItem(entity)) {
            dungeon.itemPicked(entity);
            dungeon.log(this.context, pickupMessage(entity));
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
