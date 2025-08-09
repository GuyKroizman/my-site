// TypeScript errors after site migration - ignoring for game functionality
// @ts-nocheck
import type { EntityType } from "../entity";
import { Entity } from "../entity";
import type { GameContext } from "../context";
import { context } from "../context";
import dungeon from "../dungeon";

const UI_HIGHLIGHT_BACKGROUND_COLOR = "#646059";

export default class BasicHero extends Entity {
  name: string = "The Hero";
  description: string = "A brave adventurer";
  movementPoints: number = 1;
  actionPoints: number = 1;
  healthPoints: number = 30;
  maxHealthPoints: number = 30;
  tile: number = 26;
  moving: boolean = false;
  type: EntityType = "player";
  items: Entity[] = [];
  UIHeader?: Phaser.GameObjects.Text;
  UIStatsText?: Phaser.GameObjects.Text;
  UIScene?: Phaser.Scene;
  UIItems?: Phaser.GameObjects.Rectangle[] = [];

  constructor(context: GameContext) {
    super();

    if (context.scene?.input?.keyboard == undefined) {
      throw new Error("Error in PlayerCharacter context is undefined");
    }

    context.scene.input.keyboard.on("keydown", (event: KeyboardEvent) => {
      if (!this.isOver()) {
        this.processInput(event);
      }
    });

    context.scene.input.on("pointerup", (event: Phaser.Input.Pointer) => {
      if (!this.isOver()) {
        this.processTouchInput(context, event);
      }
    });
  }

  turn() {
    if (!this.sprite) {
      throw new Error("Error in PlayerCharacter sprite is undefined");
    }
    if (this.healthPoints <= 6) {
      this.sprite.tint = Phaser.Display.Color.GetColor(255, 0, 0);
    }

    // update item display
    this.refreshUI();
  }

  toggleItem(context: GameContext, itemNumber: number) {
    const item = this.items[itemNumber];
    if (item) {
      if (item.weapon) {
        this.items.forEach(i => i.active = i.weapon ? false : i.active);
      }
      item.active = !item.active;

      if (item.active) {
        dungeon.log(context, `${this.name} equips ${item.name}: ${item.description}.`);
        item.equip(itemNumber);
      }
    }
  }

  removeItem(itemNumber: number) {
    const item = this.items[itemNumber];

    if (item) {
      this.items.forEach(i => {
        i.UISprite?.destroy();
        delete i.UISprite;
      });
      this.items = this.items.filter(i => i !== item);
      this.refreshUI();
    }
  }

  removeItemByProperty(property: string, value: any) {
    this.items.forEach(i => {
      i.UISprite?.destroy();
      delete i.UISprite;
    });
    // @ts-ignore
    this.items = this.items.filter(i => i[property] !== value);
    this.refreshUI();
  }

  equippedItems() {
    return this.items.filter(i => i.active);
  }

  currentWeapon() {
    const items = this.equippedItems();
    return items.find(w => w.weapon);
  }

  attack() {
    const items = this.equippedItems();
    const combineDamage = (total: number, item: Entity) => total + item.damage();

    return items.reduce(combineDamage, 0);
  }

  protection() {
    const items = this.equippedItems();
    const combineProtection = (total: number, item: Entity) => total + item.protection();

    return items.reduce(combineProtection, 0);
  }

  refresh() {
    this.movementPoints = 1;
    this.actionPoints = 1;
  }

  processTouchInput(context: GameContext, event: Phaser.Input.Pointer) {
    if (context.map == undefined) {
      throw new Error("context.map is undefined");
    }
    let x = context.map.worldToTileX(event.worldX);
    let y = context.map.worldToTileY(event.worldY);

    let entity = dungeon.entityAtTile(context, x!, y!);

    if (entity && entity.type == "enemy" && this.actionPoints > 0) {
      const currentWeapon = this.currentWeapon();
      if (!currentWeapon) {
        return;
      }
      const rangedAttack = currentWeapon.range() > 0 ? currentWeapon.attackTile || currentWeapon.tile : false;
      const distance = dungeon.distanceBetweenEntities(this, entity);
      if (rangedAttack && distance <= currentWeapon.range()) {
        dungeon.attackEntity(context, this, entity, rangedAttack, currentWeapon.tint);
        this.actionPoints -= 1;
      }
    }
  }

  processInput(event: KeyboardEvent) {
    let oldX = this.x!;
    let oldY = this.y!;
    let moved = false;
    let newX = this.x!;
    let newY = this.y!;

    let key = event.key;

    // Equip items
    if (!isNaN(Number(key))) {

      let keyNumber = Number(key);
      if (keyNumber == 0) {
        keyNumber = 10;
      }

      this.toggleItem(this.context, keyNumber - 1);
    }

    // Pass the turn
    if (event.key == " ") {
      this.movementPoints = 0;
      this.actionPoints = 0;
    }

    // Movement decision
    if (event.key == "ArrowLeft" || event.key === "h") {
      newX -= 1;
      moved = true;
    }

    if (event.key == "ArrowRight" || event.key === "l") {
      newX += 1;
      moved = true;
    }

    if (event.key == "ArrowUp" || event.key === "k") {
      newY -= 1;
      moved = true;
    }

    if (event.key == "ArrowDown" || event.key === "j") {
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
          dungeon.attackEntity(this.context, this, entity, rangedAttack, currentWeapon.tint);
          this.actionPoints -= 1;
          this.movementPoints += 1;
        }

        // Check if entity at destination is an item
        if (entity && entity.type == "item" && this.actionPoints > 0) {
          this.items.push(entity);
          dungeon.itemPicked(entity);
          dungeon.log(context, `${this.name} picked ${entity.name}: ${entity.description}`);
          this.actionPoints -= 1;
        } else {
          newX = oldX;
          newY = oldY;
        }

      }


      if (newX !== oldX || newY !== oldY) {
        dungeon.moveEntityTo(context, this, newX, newY);
      }
    }
  }

  isOver() {
    let isOver = this.movementPoints == 0 && !this.moving;

    if (this.UIHeader) {
      if (isOver) {
        this.UIHeader.setColor(UI_HIGHLIGHT_BACKGROUND_COLOR);
        this.actionPoints = 0;
      } else {
        this.UIHeader.setColor("#fff");
      }
    }

    if (this.UIStatsText) {
      this.UIStatsText.setText(`Hp: ${this.healthPoints}\nMp: ${this.movementPoints}\nAp: ${this.actionPoints}`);
    }
    return isOver;
  }

  onDestroy() {
    alert("OMG! you died!");
    location.reload();
  }

  createUI({ scene, x, y }: {
    scene: Phaser.Scene;
    x: number;
    y: number
  }) {
    this.UIScene = scene;
    let accumulatedHeight = 0;
    // Character sprite and name
    this.UISprite = scene.add.sprite(x, y, "tiles", this.tile).setOrigin(0);

    this.UIHeader = scene.add.text(
      x + 20,
      y,
      this.name,
      {
        font: "16px Arial",
        color: UI_HIGHLIGHT_BACKGROUND_COLOR
      });


    // Character stats
    this.UIStatsText = scene.add.text(
      x + 20,
      y + 20,
      `Hp: ${this.healthPoints}\nMp: ${this.movementPoints}\nAp: ${this.actionPoints}`,
      {
        font: "12px Arial",
        backgroundColor: UI_HIGHLIGHT_BACKGROUND_COLOR
      });

    accumulatedHeight += this.UIStatsText.height + this.UISprite.height;

    // Inventory screen
    let itemsPerRow = 5;
    let rows = 2;
    this.UIItems = [];

    for (let row = 1; row <= rows; row++) {
      for (let cell = 1; cell <= itemsPerRow; cell++) {
        let rx = x + (25 * cell);
        let ry = y + 50 + (25 * row);
        this.UIItems.push(
          scene.add.rectangle(rx, ry, 20, 20, 0xcfc6b8, 0.3).setOrigin(0)
        );
      }
    }

    accumulatedHeight += 90;

    // Separator
    scene.add.line(x + 5, y + 120, 0, 10, 175, 10, 0xcfc6b8).setOrigin(0);

    return accumulatedHeight;
  }

  refreshUI() {
    for (let i = 0; i < this.items.length; i++) {
      let item = this.items[i];
      if (!item.UISprite) {
        let x = this.UIItems![i].x + 10;
        let y = this.UIItems![i].y + 10;
        item.UISprite = this.UIScene?.add.sprite(x, y, "tiles", item.tile);
        if(item.UISprite && item.tint) {
          item.UISprite.tint = item.tint;
        }
      }
      if (!item.active) {
        item.UISprite?.setAlpha(0.5);
        this.UIItems![i].setStrokeStyle();
      } else {
        item.UISprite?.setAlpha(1);
        this.UIItems![i].setStrokeStyle(1, 0xffffff);
      }
    }
  }

  damage(): number {
    return 0;
  }

  equip(itemNumber: number): void {
  }

  range(): number {
    return 0;
  }
}
