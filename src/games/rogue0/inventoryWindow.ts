// SPD-style modal inventory window for rogue0.
//
// Renders above the fog layer (the UI scene draws after scene0), pauses world
// input while open, and maps item actions back onto BasicHero methods.

import type { GameContext } from "./context";
import type { Entity } from "./entity";
import type BasicHero from "./classes/basicHero";

type Action = "use" | "equip" | "unequip" | "drop" | "throw" | "close";

const PAD = 16;
const CELL = 38;
const GAP = 10;
const WINDOW_X = 96;
const WINDOW_Y = 56;
const EQUIP_COLS = 5;
const BACKPACK_COLS = 4;
const TITLE_BAR_H = 34;

const FONT_PIXEL = "Press Start 2P";
const FONT_MONO = "VT323";

const COL = {
  gold: "#f0b429",
  text: "#e8e1d5",
  muted: "#a29a8e",
  dim: "#6e675f",
  red: "#e04a3a"
};

const C = {
  overlay: 0x000000,
  panel: 0x1f1926,
  panel2: 0x241d2b,
  cell: 0x16121c,
  cellSelected: 0x2b2232,
  cellHover: 0x2a2130,
  border: 0x3a3342,
  borderStrong: 0x5a5060,
  gold: 0xf0b429
};

const WINDOW_W = PAD * 2 + EQUIP_COLS * CELL + (EQUIP_COLS - 1) * GAP;

const EQUIP_LABELS = ["Weapon", "Armor", "Ring 1", "Ring 2", "Artifact"];

export class InventoryWindow {
  private scene: Phaser.Scene;
  private context: GameContext;
  private open = false;
  private dirty = false;
  private menuItem: Entity | undefined;
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, context: GameContext) {
    this.scene = scene;
    this.context = context;
  }

  isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    if (this.open) {
      this.close();
    } else {
      this.openWindow();
    }
  }

  openWindow(): void {
    if (!this.context.player) return;
    this.open = true;
    this.menuItem = undefined;
    this.dirty = false;

    // Pause world (scene0) input while the modal is open.
    if (this.context.scene) {
      this.context.scene.input.enabled = false;
    }

    this.render();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.menuItem = undefined;

    if (this.context.scene) {
      this.context.scene.input.enabled = true;
    }

    this.clearObjects();
  }

  // Rebuild only when something changed (cheap no-op otherwise).
  refresh(): void {
    if (!this.open || !this.dirty) return;
    this.dirty = false;
    this.render();
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private clearObjects(): void {
    for (const obj of this.objects) {
      obj.destroy();
    }
    this.objects = [];
  }

  private add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.objects.push(obj);
    return obj;
  }

  private render(): void {
    this.clearObjects();

    const player = this.context.player;
    if (!player) return;

    // Modal dim over the whole game field.
    this.add(
      this.scene.add
        .rectangle(0, 0, 1280, 800, C.overlay, 0.55)
        .setOrigin(0)
    );

    const rows = Math.ceil(player.capacity / BACKPACK_COLS);
    const gridW = BACKPACK_COLS * CELL + (BACKPACK_COLS - 1) * GAP;
    const gridX = WINDOW_X + PAD + Math.floor((WINDOW_W - PAD * 2 - gridW) / 2);

    const equipLabelY = WINDOW_Y + TITLE_BAR_H + 12;
    const slotLabelY = equipLabelY + 16;
    const equipCellY = slotLabelY + 14;
    const backpackLabelY = equipCellY + CELL + 18;
    const gridY = backpackLabelY + 18;
    const gridH = rows * CELL + (rows - 1) * GAP;
    const windowH = gridY + gridH + PAD - WINDOW_Y;

    // Window background.
    this.add(
      this.scene.add
        .rectangle(WINDOW_X, WINDOW_Y, WINDOW_W, windowH, C.panel, 0.98)
        .setOrigin(0)
        .setStrokeStyle(2, C.borderStrong, 1)
    );

    // Title bar.
    this.add(
      this.scene.add
        .rectangle(WINDOW_X, WINDOW_Y, WINDOW_W, TITLE_BAR_H, C.panel2, 1)
        .setOrigin(0)
        .setStrokeStyle(1, C.border, 1)
    );
    this.add(
      this.scene.add.text(WINDOW_X + PAD, WINDOW_Y + 11, "INVENTORY", {
        fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 9,
        color: COL.gold
      })
    );
    this.add(
      this.scene.add
        .text(WINDOW_X + WINDOW_W - PAD, WINDOW_Y + 10, "[Esc] close", {
          fontFamily: `${FONT_MONO}, monospace`, fontSize: 16,
          color: COL.muted
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", function (this: Phaser.GameObjects.Text) { this.setColor(COL.gold); })
        .on("pointerout", function (this: Phaser.GameObjects.Text) { this.setColor(COL.muted); })
        .on("pointerup", () => this.close())
    );

    // Equipped slots row.
    this.add(
      this.scene.add.text(WINDOW_X + PAD, equipLabelY, "EQUIPPED", {
        fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 8,
        color: COL.muted
      })
    );

    const equipped = [
      player.weapon,
      player.armor,
      player.ring1,
      player.ring2,
      player.artifact
    ];
    for (let i = 0; i < equipped.length; i++) {
      const cx = WINDOW_X + PAD + i * (CELL + GAP);
      const selected = this.menuItem !== undefined && this.menuItem === equipped[i];
      this.add(
        this.scene.add
          .text(cx + CELL / 2, slotLabelY, EQUIP_LABELS[i], {
            fontFamily: `${FONT_MONO}, monospace`, fontSize: 14,
            color: COL.muted
          })
          .setOrigin(0.5, 0)
      );
      this.renderCell(cx, equipCellY, equipped[i], undefined, selected);
    }

    // Backpack grid (centered within the window).
    this.add(
      this.scene.add.text(
        gridX,
        backpackLabelY,
        `BACKPACK (${player.backpack.length}/${player.capacity})`,
        { fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 8, color: COL.muted }
      )
    );

    for (let i = 0; i < player.capacity; i++) {
      const col = i % BACKPACK_COLS;
      const row = Math.floor(i / BACKPACK_COLS);
      const cx = gridX + col * (CELL + GAP);
      const cy = gridY + row * (CELL + GAP);
      const item = player.backpack[i];
      const selected = this.menuItem !== undefined && this.menuItem === item;
      this.renderCell(cx, cy, item, String(i + 1), selected);
    }

    if (this.menuItem) {
      this.renderMenu(player, this.menuItem);
    }
  }

  private renderCell(
    x: number,
    y: number,
    item: Entity | undefined,
    cornerLabel: string | undefined,
    selected: boolean
  ): void {
    const box = this.add(
      this.scene.add
        .rectangle(x, y, CELL, CELL, selected ? C.cellSelected : C.cell, 1)
        .setOrigin(0)
        .setStrokeStyle(selected ? 2 : 1, selected ? C.gold : C.border, 1)
    );

    if (item) {
      if (item.identified) {
        const icon = this.add(
          this.scene.add
            .sprite(x + CELL / 2, y + CELL / 2, item.spriteTextureKey, item.spriteFrame)
            .setOrigin(0.5)
        );
        if (item.tint) {
          icon.tint = item.tint;
        }
      } else {
        this.add(
          this.scene.add
            .text(x + CELL / 2, y + CELL / 2, "?", {
              fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 20,
              color: COL.muted
            })
            .setOrigin(0.5)
        );
      }

      if (cornerLabel !== undefined) {
        this.add(
          this.scene.add.text(x + 4, y + 3, cornerLabel, {
            fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 8,
            color: COL.muted
          })
        );
      }

      box.setInteractive({ useHandCursor: true });
      box.on("pointerover", () => {
        box.setStrokeStyle(selected ? 2 : 1, C.gold, 1);
      });
      box.on("pointerout", () => {
        box.setStrokeStyle(selected ? 2 : 1, selected ? C.gold : C.border, 1);
      });
      box.on("pointerup", () => this.openMenu(item));
    } else if (cornerLabel !== undefined) {
      // Empty backpack cell still shows its quick-key index.
      this.add(
        this.scene.add
          .text(x + CELL / 2, y + CELL / 2, cornerLabel, {
            fontFamily: `${FONT_MONO}, monospace`, fontSize: 14,
            color: COL.muted
          })
          .setOrigin(0.5)
      );
    }
  }

  private openMenu(item: Entity): void {
    this.menuItem = this.menuItem === item ? undefined : item;
    this.markDirty();
    this.refresh();
  }

  private renderMenu(player: BasicHero, item: Entity): void {
    const mx = WINDOW_X + WINDOW_W + 14;
    const my = WINDOW_Y + TITLE_BAR_H;
    const mw = 230;

    const panel = this.add(
      this.scene.add
        .rectangle(mx, my, mw, 100, C.panel, 0.98)
        .setOrigin(0)
        .setStrokeStyle(2, C.borderStrong, 1)
    );

    let ay = my + 14;

    // Icon (or a "?" while unidentified).
    const iconSize = 38;
    const iconX = mx + 14;
    if (item.identified) {
      const icon = this.add(
        this.scene.add.sprite(iconX + iconSize / 2, ay + iconSize / 2, item.spriteTextureKey, item.spriteFrame)
      );
      if (item.tint) icon.tint = item.tint;
    } else {
      this.add(
        this.scene.add
          .text(iconX + iconSize / 2, ay + iconSize / 2, "?", {
            fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 22,
            color: COL.muted
          })
          .setOrigin(0.5)
      );
    }

    const name = this.add(
      this.scene.add.text(iconX + iconSize + 12, ay, item.displayName, {
        fontFamily: `${FONT_MONO}, monospace`, fontSize: 18,
        color: COL.text,
        wordWrap: { width: mw - 24 - iconSize - 12, useAdvancedWrap: true }
      })
    );
    ay += Math.max(iconSize, name.height) + 12;

    if (item.cursed) {
      this.add(
        this.scene.add.text(iconX, ay, "(cursed)", {
          fontFamily: `${FONT_MONO}, monospace`, fontSize: 16,
          color: COL.red
        })
      );
      ay += 20;
    }

    this.add(
      this.scene.add
        .rectangle(iconX, ay, mw - 28, 1, C.border, 1)
        .setOrigin(0)
    );
    ay += 12;

    // Full description, hidden until the item is identified.
    const description = item.identified
      ? item.description
      : "You have not identified this item.";
    const desc = this.add(
      this.scene.add.text(iconX, ay, description, {
        fontFamily: `${FONT_MONO}, monospace`, fontSize: 16,
        color: item.identified ? COL.text : COL.muted,
        wordWrap: { width: mw - 28, useAdvancedWrap: true },
        lineSpacing: 2
      })
    );
    ay += desc.height + 14;

    const actions = this.buildActions(player, item);
    for (const { action, label, enabled } of actions) {
      const rowH = 26;
      const row = this.add(
        this.scene.add
          .rectangle(mx + 8, ay, mw - 16, rowH, C.cell, 1)
          .setOrigin(0)
          .setStrokeStyle(1, C.border, 1)
      );
      const labelText = this.add(
        this.scene.add.text(mx + 16, ay + 6, label, {
          fontFamily: `${FONT_MONO}, monospace`, fontSize: 16,
          color: enabled ? COL.text : COL.dim
        })
      );

      if (enabled) {
        row.setInteractive({ useHandCursor: true });
        row.on("pointerover", () => {
          row.setFillStyle(C.cellHover, 1);
          row.setStrokeStyle(1, C.gold, 1);
          labelText.setColor("#ffffff");
        });
        row.on("pointerout", () => {
          row.setFillStyle(C.cell, 1);
          row.setStrokeStyle(1, C.border, 1);
          labelText.setColor(COL.text);
        });
        row.on("pointerup", () => this.doAction(action, item));
      }

      ay += rowH + 6;
    }

    panel.setSize(mw, ay - my + 14);
  }

  private buildActions(
    player: BasicHero,
    item: Entity
  ): { action: Action; label: string; enabled: boolean }[] {
    const actions: { action: Action; label: string; enabled: boolean }[] = [];

    if (item.consumable) {
      actions.push({ action: "use", label: "Use", enabled: true });
    }

    actions.push({ action: "throw", label: "Throw", enabled: !item.cursed });

    if (player.slotOf(item)) {
      actions.push({
        action: "unequip",
        label: "Unequip",
        enabled: !item.cursed
      });
    } else if (player.slotFor(item) !== undefined) {
      actions.push({ action: "equip", label: "Equip", enabled: true });
    }

    actions.push({ action: "drop", label: "Drop", enabled: !item.cursed });
    actions.push({ action: "close", label: "Close", enabled: true });

    return actions;
  }

  private doAction(action: Action, item: Entity): void {
    const player = this.context.player;
    if (!player) return;

    switch (action) {
      case "use":
        player.useItem(item);
        break;
      case "equip":
        player.equipItem(item);
        break;
      case "unequip":
        player.unequipItem(item);
        break;
      case "drop":
        player.dropItem(item);
        break;
      case "throw":
        // Close the window so world input is live again for target selection.
        player.beginThrow(item);
        this.close();
        return;
      case "close":
        break;
    }

    this.menuItem = undefined;
    this.markDirty();
    this.refresh();
  }
}
