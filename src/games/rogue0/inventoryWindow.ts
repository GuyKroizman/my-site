// SPD-style modal inventory window for rogue0.
//
// Renders above the fog layer (the UI scene draws after scene0), pauses world
// input while open, and maps item actions back onto BasicHero methods.

import type { GameContext } from "./context";
import type { Entity } from "./entity";
import type BasicHero from "./classes/basicHero";

type Action = "use" | "equip" | "unequip" | "drop" | "inspect";

const PAD = 14;
const CELL = 36;
const GAP = 8;
const WINDOW_X = 120;
const WINDOW_Y = 60;
const WINDOW_W = PAD * 2 + 5 * CELL + 4 * GAP; // 240
const WINDOW_H = 372;
const BACKPACK_COLS = 4;

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

    // Background panel.
    this.add(
      this.scene.add
        .rectangle(WINDOW_X, WINDOW_Y, WINDOW_W, WINDOW_H, 0x1a1418, 0.97)
        .setOrigin(0)
        .setStrokeStyle(1, 0x8a8578, 0.8)
    );

    this.add(
      this.scene.add.text(WINDOW_X + PAD, WINDOW_Y + 12, "Inventory", {
        font: "16px Arial",
        color: "#ffffff"
      })
    );
    this.add(
      this.scene.add.text(WINDOW_X + WINDOW_W - PAD - 64, WINDOW_Y + 14, "[Esc] close", {
        font: "11px Arial",
        color: "#8a8578"
      })
    );

    // Equipped slots row.
    this.add(
      this.scene.add.text(WINDOW_X + PAD, WINDOW_Y + 40, "Equipped", {
        font: "11px Arial",
        color: "#cfc6b8"
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
      this.add(
        this.scene.add.text(cx, WINDOW_Y + 60, EQUIP_LABELS[i], {
          font: "9px Arial",
          color: "#8a8578"
        })
      );
      this.renderCell(cx, WINDOW_Y + 72, equipped[i], undefined);
    }

    // Backpack grid (4 columns, wraps to as many rows as capacity needs).
    this.add(
      this.scene.add.text(
        WINDOW_X + PAD,
        WINDOW_Y + 130,
        `Backpack (${player.backpack.length}/${player.capacity})`,
        { font: "11px Arial", color: "#cfc6b8" }
      )
    );

    const gridY = WINDOW_Y + 148;
    for (let i = 0; i < player.capacity; i++) {
      const col = i % BACKPACK_COLS;
      const row = Math.floor(i / BACKPACK_COLS);
      const cx = WINDOW_X + PAD + col * (CELL + GAP);
      const cy = gridY + row * (CELL + GAP);
      this.renderCell(cx, cy, player.backpack[i], String(i + 1));
    }

    // Action menu for the currently selected item.
    if (this.menuItem) {
      this.renderMenu(player, this.menuItem);
    }
  }

  private renderCell(
    x: number,
    y: number,
    item: Entity | undefined,
    cornerLabel: string | undefined
  ): void {
    const box = this.add(
      this.scene.add
        .rectangle(x, y, CELL, CELL, 0x2a2127, 0.9)
        .setOrigin(0)
        .setStrokeStyle(1, 0x8a8578, 0.5)
    );

    if (item) {
      if (item.identified) {
        const icon = this.add(
          this.scene.add
            .sprite(x + CELL / 2, y + CELL / 2, "tiles", item.tile)
            .setOrigin(0.5)
        );
        if (item.tint) {
          icon.tint = item.tint;
        }
      } else {
        this.add(
          this.scene.add
            .text(x + CELL / 2, y + CELL / 2, "?", {
              font: "18px Arial",
              color: "#ffffff"
            })
            .setOrigin(0.5)
        );
      }

      if (cornerLabel !== undefined) {
        this.add(
          this.scene.add.text(x + 3, y + 2, cornerLabel, {
            font: "9px Arial",
            color: "#8a8578"
          })
        );
      }

      box.setInteractive({ useHandCursor: true });
      box.on("pointerup", () => this.openMenu(item));
    } else if (cornerLabel !== undefined) {
      // Empty backpack cell still shows its quick-key index.
      this.add(
        this.scene.add
          .text(x + CELL / 2, y + CELL / 2, cornerLabel, {
            font: "10px Arial",
            color: "#5a554c"
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
    const mx = WINDOW_X + WINDOW_W + 12;
    const my = WINDOW_Y + 40;
    const mw = 170;
    const mh = 200;

    this.add(
      this.scene.add
        .rectangle(mx, my, mw, mh, 0x1a1418, 0.97)
        .setOrigin(0)
        .setStrokeStyle(1, 0x8a8578, 0.8)
    );

    const title = this.add(
      this.scene.add.text(mx + 10, my + 8, item.displayName, {
        font: "12px Arial",
        color: "#ffffff",
        wordWrap: { width: mw - 20 }
      })
    );

    if (item.cursed) {
      this.add(
        this.scene.add.text(mx + 10, my + 8 + title.height + 4, "(cursed)", {
          font: "10px Arial",
          color: "#ff6a6a"
        })
      );
    }

    const actions: { action: Action; label: string; enabled: boolean }[] = [
      { action: "use", label: "Use", enabled: item.consumable },
      {
        action: "equip",
        label: "Equip",
        enabled: !player.slotOf(item) && player.slotFor(item) !== undefined
      },
      {
        action: "unequip",
        label: "Unequip",
        enabled: player.slotOf(item) !== undefined
      },
      { action: "drop", label: "Drop", enabled: true },
      { action: "inspect", label: "Inspect", enabled: true }
    ];

    let ay = my + 60;
    for (const { action, label, enabled } of actions) {
      const btn = this.add(
        this.scene.add.text(mx + 10, ay, label, {
          font: "13px Arial",
          color: enabled ? "#ffffff" : "#6a655c"
        })
      );
      if (enabled) {
        btn.setInteractive({ useHandCursor: true });
        btn.on("pointerup", () => this.doAction(action, item));
      }
      ay += 24;
    }
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
      case "inspect":
        this.context.inspectedEntity = item;
        break;
    }

    this.menuItem = undefined;
    this.markDirty();
    this.refresh();
  }
}
