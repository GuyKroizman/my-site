// SPD-style modal inventory window for rogue0.
//
// Renders above the fog layer (the UI scene draws after scene0), pauses world
// input while open, and maps item actions back onto BasicHero methods.
//
// Responsive: the window and the item dialog are built in their own
// containers and scaled/centered to fit the current game size, so they stay
// fully on-screen in both portrait and landscape mobile layouts.

import type { GameContext } from "./context";
import type { Entity } from "./entity";
import type BasicHero from "./classes/basicHero";

import Gem from "./items/gem";
import Wand from "./items/wand";
import { attachTooltip } from "./tooltip";

type Action = "use" | "equip" | "unequip" | "drop" | "throw" | "close";

const PAD = 16;
const CELL = 38;
const GAP = 10;
const EQUIP_COLS = 5;
const BACKPACK_COLS = 4;
const TITLE_BAR_H = 34;
const MENU_W = 300;

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
  cellSafe: 0x102846,
  cellUnknown: 0x352c22,
  cellCursed: 0x49151c,
  curseGlow: 0xd93645,
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
  private enchantingGem: Gem | undefined;
  private targetedItem: Entity | undefined;
  private quickslot: number | undefined;

  chooseQuickslot(index: number): void {
    this.openWindow();
    this.quickslot = index;
    this.render();
  }
  // Top-level objects (overlay + containers) owned for cleanup. Containers
  // destroy their children when destroyed.
  private objects: Phaser.GameObjects.GameObject[] = [];
  private winRoot: Phaser.GameObjects.Container | undefined;
  private menuRoot: Phaser.GameObjects.Container | undefined;

  constructor(scene: Phaser.Scene, context: GameContext) {
    this.scene = scene;
    this.context = context;
    context.onChooseEnchantment = (item) => {
      if (!(item instanceof Gem)) return;
      this.openWindow();
      this.enchantingGem = item;
      this.render();
    };
    context.onChooseItemTarget = (item) => {
      this.openWindow();
      this.targetedItem = item;
      this.render();
    };
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
    this.quickslot = undefined;
    this.enchantingGem = undefined;
    this.targetedItem = undefined;
    this.context.inventoryOpen = true;
    this.menuItem = undefined;
    this.dirty = false;

    // Pause world (scene0) input while the modal is open.
    if (this.context.scene) {
      this.context.scene.input.enabled = false;
    }

    this.render();
  }

  // Dismiss only the topmost modal; item inspection never spends a turn.
  dismiss(): void {
    if (this.menuItem) {
      this.menuItem = undefined;
      this.markDirty();
      this.refresh();
    } else {
      this.close();
    }
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.quickslot = undefined;
    this.enchantingGem = undefined;
    this.targetedItem = undefined;
    this.context.inventoryOpen = false;
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
    this.winRoot = undefined;
    this.menuRoot = undefined;
  }

  // Track a top-level object (overlay or container) for cleanup.
  private add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.objects.push(obj);
    return obj;
  }

  private render(): void {
    this.clearObjects();

    const player = this.context.player;
    if (!player) return;

    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    // Modal dim over the whole game field. Tap outside closes.
    const overlay = this.add(
      this.scene.add
        .rectangle(0, 0, sw, sh, C.overlay, 0.55)
        .setOrigin(0)
        .setDepth(0)
    );
    overlay.setInteractive({ useHandCursor: true });
    overlay.on("pointerup", () => this.dismiss());

    this.winRoot = this.add(this.scene.add.container(0, 0).setDepth(100));

    const rows = Math.ceil(player.capacity / BACKPACK_COLS);
    const gridW = BACKPACK_COLS * CELL + (BACKPACK_COLS - 1) * GAP;
    const gridX = PAD + Math.floor((WINDOW_W - PAD * 2 - gridW) / 2);

    const goldY = TITLE_BAR_H + 10;
    const equipLabelY = goldY + 30;
    const slotLabelY = equipLabelY + 16;
    const equipCellY = slotLabelY + 14;
    const backpackLabelY = equipCellY + CELL + 18;
    const gridY = backpackLabelY + 18;
    const gridH = rows * CELL + (rows - 1) * GAP;
    const windowH = gridY + gridH + PAD;

    // Window background.
    this.winRoot.add(
      this.scene.add
        .rectangle(0, 0, WINDOW_W, windowH, C.panel, 0.98)
        .setOrigin(0)
        .setStrokeStyle(2, C.borderStrong, 1)
    );

    // Title bar + close button.
    this.winRoot.add(
      this.scene.add
        .rectangle(0, 0, WINDOW_W, TITLE_BAR_H, C.panel2, 1)
        .setOrigin(0)
        .setStrokeStyle(1, C.border, 1)
    );
    this.winRoot.add(
      this.scene.add.text(PAD, 11, this.quickslot !== undefined ? "QUICKSLOT: CHOOSE" : this.enchantingGem ? "ENCHANT: CHOOSE GEAR" : this.targetedItem ? "CLEANSE: CHOOSE ITEM" : "INVENTORY", {
        fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 9,
        color: COL.gold
      })
    );

    const closeBtn = this.scene.add
      .rectangle(WINDOW_W - 8 - 62, 6, 62, 22, C.panel, 1)
      .setOrigin(0)
      .setStrokeStyle(1, C.borderStrong, 1)
      .setInteractive({ useHandCursor: true });
    const closeLabel = this.scene.add
      .text(WINDOW_W - 8 - 62 + 31, 17, "Close", {
        fontFamily: `${FONT_MONO}, monospace`, fontSize: 16,
        color: COL.muted
      })
      .setOrigin(0.5);
    closeBtn.on("pointerover", () => {
      closeBtn.setStrokeStyle(1, C.gold, 1);
      closeLabel.setColor(COL.gold);
    });
    closeBtn.on("pointerout", () => {
      closeBtn.setStrokeStyle(1, C.borderStrong, 1);
      closeLabel.setColor(COL.muted);
    });
    closeBtn.on("pointerup", () => this.close());
    this.winRoot.add(closeBtn);
    this.winRoot.add(closeLabel);

    // Currency is tracked separately and does not occupy backpack slots.
    this.winRoot.add(
      this.scene.add.text(PAD, goldY, `Gold: ${player.gold}`, {
        fontFamily: `${FONT_MONO}, monospace`, fontSize: 20,
        color: COL.gold
      })
    );

    // Equipped slots row.
    this.winRoot.add(
      this.scene.add.text(PAD, equipLabelY, "EQUIPPED", {
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
      const cx = PAD + i * (CELL + GAP);
      const selected = this.menuItem !== undefined && this.menuItem === equipped[i];
      this.winRoot.add(
        this.scene.add
          .text(cx + CELL / 2, slotLabelY, EQUIP_LABELS[i], {
            fontFamily: `${FONT_MONO}, monospace`, fontSize: 14,
            color: COL.muted
          })
          .setOrigin(0.5, 0)
      );
      this.renderCell(cx, equipCellY, equipped[i], selected);
    }

    // Backpack grid (centered within the window).
    this.winRoot.add(
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
      this.renderCell(cx, cy, item, selected);
    }

    // Fit the window within the viewport (with a small margin) and center it.
    const winScale = Math.min(1, (sw - 16) / WINDOW_W, (sh - 16) / windowH);
    this.winRoot.setScale(winScale);
    this.winRoot.setPosition(
      (sw - WINDOW_W * winScale) / 2,
      (sh - windowH * winScale) / 2
    );

    if (this.menuItem) {
      this.renderMenu(player, this.menuItem);
    }
  }

  private renderCell(
    x: number,
    y: number,
    item: Entity | undefined,
    selected: boolean
  ): void {
    // Match inspection's knowledge rules; never expose an unidentified curse.
    const curseKnown = !!item && (item.identified || !!this.context.player?.slotOf(item));
    const knownCursed = curseKnown && !!item?.cursed;
    const background = !item ? C.cell : !curseKnown ? C.cellUnknown :
      knownCursed ? C.cellCursed : C.cellSafe;
    const box = this.scene.add
      .rectangle(x, y, CELL, CELL, background, 1)
      .setOrigin(0)
      .setStrokeStyle(selected ? 2 : 1, selected ? C.gold : C.border, 1);
    // Add the cell background first so the item icon/count render on top.
    this.winRoot!.add(box);

    if (knownCursed) {
      // Pulse only the background, leaving icons, counts and selection crisp.
      const glow = this.scene.add
        .rectangle(x + 1, y + 1, CELL - 2, CELL - 2, C.curseGlow, 1)
        .setOrigin(0)
        .setAlpha(0.12);
      this.winRoot!.add(glow);
      const pulse = this.scene.tweens.add({
        targets: glow,
        alpha: 0.55,
        duration: 1200,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1
      });
      glow.once("destroy", () => pulse.remove());
    }

    if (item) {
      const disabled = (!!this.targetedItem && !this.targetedItem.canTargetItem(item)) ||
        (!!this.enchantingGem && !this.enchantingGem.canEnchant(item)) ||
        (this.quickslot !== undefined && !this.context.player!.canQuickslot(item));
      // Identification hides properties, not the artwork already visible on the floor.
      const icon = this.scene.add
        .sprite(x + CELL / 2, y + CELL / 2, item.spriteTextureKey, item.spriteFrame)
        .setOrigin(0.5);
      if (item.tint) icon.tint = item.tint;
      this.winRoot!.add(icon);

      // Stack count in the bottom-right corner.
      if (item.count > 1) {
        this.winRoot!.add(
          this.scene.add
            .text(x + CELL - 3, y + CELL - 3, String(item.count), {
              fontFamily: `${FONT_MONO}, monospace`,
              fontSize: 14,
              color: COL.gold
            })
            .setOrigin(1, 1)
        );
      }

      box.setInteractive({ useHandCursor: !disabled });
      attachTooltip(this.scene, this.context, box, () => item.displayName,
        () => this.open && !this.menuItem);

      if (disabled) {
        // Draw over icon/count so ineligible items are visibly dimmed.
        this.winRoot!.add(this.scene.add.rectangle(x, y, CELL, CELL, C.overlay, 0.7).setOrigin(0));
        return;
      }
      box.on("pointerover", () => {
        box.setStrokeStyle(selected ? 2 : 1, C.gold, 1);
      });
      box.on("pointerout", () => {
        box.setStrokeStyle(selected ? 2 : 1, selected ? C.gold : C.border, 1);
      });
      box.on("pointerup", () => this.openMenu(item));
    }
  }

  private openMenu(item: Entity): void {
    if (this.quickslot !== undefined) {
      if (this.context.player?.assignQuickslot(this.quickslot, item)) this.close();
      return;
    }
    if (this.enchantingGem) {
      if (this.enchantingGem.enchant(item)) this.close();
      return;
    }
    if (this.targetedItem) {
      if (this.targetedItem.useOnItem(item)) this.close();
      return;
    }
    this.menuItem = this.menuItem === item ? undefined : item;
    this.markDirty();
    this.refresh();
  }

  private renderMenu(player: BasicHero, item: Entity): void {
    this.menuRoot = this.add(this.scene.add.container(0, 0).setDepth(200));

    const mw = MENU_W;
    const pad = 14;
    const iconSize = 38;
    const iconX = pad;
    let ay = pad;

    // Panel background (resized once we know the content height).
    const panel = this.scene.add
      .rectangle(0, 0, mw, 100, C.panel, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, C.borderStrong, 1);
    this.menuRoot.add(panel);

    // Use the same artwork as the floor and inventory, even before identification.
    const icon = this.scene.add.sprite(
      iconX + iconSize / 2,
      ay + iconSize / 2,
      item.spriteTextureKey,
      item.spriteFrame
    );
    if (item.tint) icon.tint = item.tint;
    this.menuRoot.add(icon);

    const name = this.scene.add.text(iconX + iconSize + 12, ay, item.displayName, {
      fontFamily: `${FONT_MONO}, monospace`, fontSize: 18,
      color: COL.text,
      wordWrap: { width: mw - 24 - iconSize - 12, useAdvancedWrap: true }
    });
    this.menuRoot.add(name);
    ay += Math.max(iconSize, name.height) + 10;

    if (item.cursed && (item.identified || player.slotOf(item))) {
      this.menuRoot.add(
        this.scene.add.text(iconX, ay, "(cursed)", {
          fontFamily: `${FONT_MONO}, monospace`, fontSize: 16,
          color: COL.red
        })
      );
      ay += 20;
    }

    this.menuRoot.add(
      this.scene.add
        .rectangle(iconX, ay, mw - 28, 1, C.border, 1)
        .setOrigin(0)
    );
    ay += 12;

    // Recognizable equipment reveals its identity, but not its curse status.
    const description = item.identified || item.isRecognizableEquipment
      ? [item.displayDescription, item.strengthDescription(player.strength),
          !item.identified && item.isRecognizableEquipment
            ? "Curse status unknown. Cursed equipment cannot be removed once equipped and may have other harmful effects."
            : ""].filter(Boolean).join("\n")
      : item instanceof Wand
        ? "An unidentified wand. Its kind of magic is unknown."
        : "You have not identified this item.";
    const desc = this.scene.add.text(iconX, ay, description, {
      fontFamily: `${FONT_MONO}, monospace`, fontSize: 16,
      color: item.identified ? COL.text : COL.muted,
      wordWrap: { width: mw - 28, useAdvancedWrap: true },
      lineSpacing: 2
    });
    this.menuRoot.add(desc);
    ay += desc.height + 12;

    const actions = this.buildActions(player, item);
    for (const { action, label, enabled } of actions) {
      const rowH = 26;
      const row = this.scene.add
        .rectangle(8, ay, mw - 16, rowH, C.cell, 1)
        .setOrigin(0)
        .setStrokeStyle(1, C.border, 1);
      const labelText = this.scene.add.text(16, ay + 6, label, {
        fontFamily: `${FONT_MONO}, monospace`, fontSize: 16,
        color: enabled ? COL.text : COL.dim
      });

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

      this.menuRoot.add(row);
      this.menuRoot.add(labelText);
      ay += rowH + 6;
    }

    const mh = ay - 6 + pad;
    panel.setSize(mw, mh);

    // Fit and center the dialog.
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const scale = Math.min(1, (sw - 16) / mw, (sh - 16) / mh);
    this.menuRoot.setScale(scale);
    this.menuRoot.setPosition((sw - mw * scale) / 2, (sh - mh * scale) / 2);
  }

  private buildActions(
    player: BasicHero,
    item: Entity
  ): { action: Action; label: string; enabled: boolean }[] {
    const actions: { action: Action; label: string; enabled: boolean }[] = [];

    if (item.consumable || item instanceof Wand) {
      actions.push({ action: "use", label: item instanceof Wand ? "Zap" : "Use", enabled: true });
    }

    actions.push({ action: "throw", label: "Throw", enabled: !item.cursed || !player.slotOf(item) });

    if (player.slotOf(item)) {
      actions.push({
        action: "unequip",
        label: "Unequip",
        enabled: !item.cursed
      });
    } else if (player.slotFor(item) !== undefined) {
      actions.push({ action: "equip", label: "Equip", enabled: true });
    }

    actions.push({
      action: "drop",
      label: "Drop",
      enabled: !item.cursed || !player.slotOf(item)
    });
    actions.push({ action: "close", label: "Close", enabled: true });

    return actions;
  }

  private doAction(action: Action, item: Entity): void {
    if (action === "close") {
      this.dismiss();
      return;
    }
    const player = this.context.player;
    if (!player) return;

    switch (action) {
      case "use":
        player.useItem(item);
        if (this.context.throwMode) {
          this.close();
          return;
        }
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
    }

    // Let the world resolve the spent turn instead of leaving it paused
    // behind the inventory modal with every subsequent action disabled.
    if (!player.canAct()) {
      this.close();
      return;
    }
    this.menuItem = undefined;
    this.markDirty();
    this.refresh();
  }
}
