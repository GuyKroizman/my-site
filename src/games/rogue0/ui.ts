import type { GameContext } from "./context";
import { InventoryWindow } from "./inventoryWindow";

// Shared rogue0 palette — kept in sync with the --r0-* variables in
// src/index.css. Text colors are CSS strings, rectangle fills are 0x numbers.
const FONT_PIXEL = "Press Start 2P";
const FONT_MONO = "VT323";

const COL = {
  gold: "#f0b429",
  text: "#e8e1d5",
  muted: "#a29a8e",
  dim: "#6e675f"
};

const C = {
  bg: 0x16121c,
  panel: 0x1f1926,
  border: 0x3a3342,
  borderStrong: 0x5a5060
};

const SIDEBAR_X = 1080;
const SIDEBAR_W = 200;
const SIDEBAR_H = 800;
const PAD = 12;

export class UI extends Phaser.Scene {
  context: GameContext;
  active: boolean;
  private log: Phaser.GameObjects.Text | undefined;
  private floorText: Phaser.GameObjects.Text | undefined;
  private inventoryWindow: InventoryWindow | undefined;

  // Hero stats modal (opens by tapping the hero icon).
  private heroModal: Phaser.GameObjects.Container | undefined;
  private heroModalText: Phaser.GameObjects.Text | undefined;
  private heroModalOpen = false;

  // Inspect modal (shows while something is being inspected).
  private inspectModal: Phaser.GameObjects.Container | undefined;
  private inspectModalText: Phaser.GameObjects.Text | undefined;

  constructor(context: GameContext) {
    super("ui-scene");

    this.context = context;
    this.active = true;
    this.log = undefined;
    this.floorText = undefined;
    this.inventoryWindow = undefined;
    this.heroModal = undefined;
    this.heroModalText = undefined;
    this.inspectModal = undefined;
    this.inspectModalText = undefined;
  }

  create() {
    this.inventoryWindow = new InventoryWindow(this, this.context);

    // i / b toggle the inventory window; Esc closes it.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const key = event.key;
      if (key === "i" || key === "I" || key === "b" || key === "B") {
        this.inventoryWindow?.toggle();
      } else if (key === "Escape") {
        this.inventoryWindow?.close();
        this.closeHeroModal();
      }
    });

    this.scene.get("scene0").events.on("entities-created", () => {
      this.buildPanel();
    });

    this.scene.get("scene0").events.on("floor-changed", () => {
      this.floorText?.setText(`Floor ${this.context.floor}`);
    });
  }

  buildPanel() {
    if (!this.context.player) {
      throw new Error("Initialization order error. UI scene has no player.");
    }

    this.context.player.onBackpackToggle = () => this.inventoryWindow?.toggle();
    this.context.player.onHeroIconTap = () => this.toggleHeroModal();

    // Sidebar backdrop.
    this.add.rectangle(SIDEBAR_X, 0, SIDEBAR_W, SIDEBAR_H, C.bg, 1).setOrigin(0);
    this.add
      .rectangle(SIDEBAR_X, 0, 2, SIDEBAR_H, C.borderStrong, 1)
      .setOrigin(0);

    let y = 14;

    // Floor header.
    this.floorText = this.add
      .text(SIDEBAR_X + SIDEBAR_W / 2, y, `Floor ${this.context.floor}`, {
        fontFamily: `"${FONT_PIXEL}", monospace`,
        fontSize: 11,
        color: COL.gold
      })
      .setOrigin(0.5, 0);
    y += 24;
    this.add
      .rectangle(SIDEBAR_X + PAD, y, SIDEBAR_W - PAD * 2, 1, C.border, 1)
      .setOrigin(0);
    y += 10;

    // Hero icon + toolbar buttons (stats live in a modal, not here).
    const heroX = SIDEBAR_X + PAD;
    const heroW = SIDEBAR_W - PAD * 2;
    const heroPad = 6;
    this.add
      .rectangle(heroX, y, heroW, 104, C.panel, 1)
      .setOrigin(0)
      .setStrokeStyle(1, C.border, 1);

    this.context.player.createUI({
      scene: this,
      x: heroX + heroPad,
      y: y + heroPad,
      width: heroW - heroPad * 2
    });
    y += 104 + 12;

    this.buildLogPanel(y);

    this.buildHeroModal();
    this.buildInspectModal();
  }

  private buildHeroModal(): void {
    const w = 300;
    const h = 190;
    const x = 10;
    const y = 10;

    const root = this.add.container(0, 0).setDepth(600).setVisible(false);

    root.add(
      this.add.rectangle(x, y, w, h, C.panel, 0.98).setOrigin(0).setStrokeStyle(2, C.borderStrong, 1)
    );
    root.add(
      this.add.text(x + 10, y + 8, "Hero", {
        fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 8, color: COL.gold
      })
    );
    this.heroModalText = this.add.text(x + 10, y + 24, "", {
      fontFamily: `${FONT_MONO}, monospace`,
      fontSize: 17,
      color: COL.text,
      lineSpacing: 2,
      wordWrap: { width: w - 20 }
    });
    root.add(this.heroModalText);

    this.heroModal = root;
  }

  private buildInspectModal(): void {
    const w = 340;
    const h = 170;
    const x = 10;
    const y = 500;

    const root = this.add.container(0, 0).setDepth(600).setVisible(false);

    root.add(
      this.add.rectangle(x, y, w, h, C.panel, 0.98).setOrigin(0).setStrokeStyle(2, C.borderStrong, 1)
    );
    root.add(
      this.add.text(x + 10, y + 8, "Inspect", {
        fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 8, color: COL.gold
      })
    );
    this.inspectModalText = this.add.text(x + 10, y + 24, "", {
      fontFamily: `${FONT_MONO}, monospace`,
      fontSize: 17,
      color: COL.text,
      lineSpacing: 2,
      wordWrap: { width: w - 20 }
    });
    root.add(this.inspectModalText);

    this.inspectModal = root;
  }

  private toggleHeroModal(): void {
    this.heroModalOpen = !this.heroModalOpen;
    this.heroModal?.setVisible(this.heroModalOpen);
  }

  private closeHeroModal(): void {
    this.heroModalOpen = false;
    this.heroModal?.setVisible(false);
  }

  private buildLogPanel(y: number): void {
    const w = SIDEBAR_W - PAD * 2;
    const px = SIDEBAR_X + PAD;
    const bottom = SIDEBAR_H - 14;
    const h = Math.max(60, bottom - y);

    this.add
      .rectangle(px, y, w, h, C.panel, 1)
      .setOrigin(0)
      .setStrokeStyle(1, C.border, 1);

    this.add.text(px + 8, y + 8, "Log", {
      fontFamily: `"${FONT_PIXEL}", monospace`,
      fontSize: 8,
      color: COL.gold
    });

    this.add.rectangle(px + 8, y + 24, w - 16, 1, C.border, 1).setOrigin(0);

    this.log = this.scrollableText(px + 8, y + 32, w - 16, h - 40);
  }

  // Keep long descriptions and message history inside their own panels.
  // Scroll (wheel or touch drag) rather than shrinking text or losing details.
  private scrollableText(x: number, y: number, width: number, height: number) {
    const text = this.add.text(x, y, "", {
      fontFamily: `${FONT_MONO}, monospace`,
      fontSize: 16,
      color: COL.muted,
      wordWrap: { width, useAdvancedWrap: true },
      lineSpacing: 2
    });
    const clip = this.make.graphics({ x: 0, y: 0 });
    clip.fillRect(x, y, width, height - 20);
    text.setMask(clip.createGeometryMask());
    const hint = this.add.text(x, y + height - 16, "Scroll for more", {
      fontFamily: `${FONT_MONO}, monospace`, fontSize: 14, color: COL.muted
    }).setVisible(false);
    text.setData({ top: y, viewport: height - 20, hint });
    const scroll = (delta: number) => {
      text.y = Phaser.Math.Clamp(text.y - delta, y - Math.max(0, text.height - (height - 20)), y);
    };
    this.add.zone(x, y, width, height).setOrigin(0).setInteractive()
      .on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => scroll(dy))
      .on("pointermove", (pointer: Phaser.Input.Pointer) => {
        if (pointer.isDown) scroll(pointer.prevPosition.y - pointer.position.y);
      });
    return text;
  }

  private setPanelText(text: Phaser.GameObjects.Text, value: string) {
    if (text.text === value) return;
    text.setText(value).setY(text.getData("top"));
    (text.getData("hint") as Phaser.GameObjects.Text)
      .setVisible(text.height > text.getData("viewport"));
  }

  update() {
    if (!this.log) return;

    this.setPanelText(this.log, this.context.messages.join(`\n\n`));
    this.context.player?.updateUI?.();
    this.context.player?.refreshUI?.();
    this.updateHeroModal();
    this.updateInspectModal();
    this.inventoryWindow?.refresh();
  }

  private updateHeroModal(): void {
    if (!this.heroModalText) return;
    const p = this.context.player;
    if (!p) return;

    let text = p.statsText();
    if (p.effects.length) {
      text +=
        "\n\n" +
        p.effects
          .map((e) => {
            const infinite =
              e.manualExpiry || e.duration === Number.POSITIVE_INFINITY;
            return `${e.name} ${infinite ? "∞" : e.duration}`;
          })
          .join("\n");
    }
    this.heroModalText.setText(text);
  }

  private updateInspectModal(): void {
    if (!this.inspectModal || !this.inspectModalText) return;

    const e = this.context.inspectedEntity;
    const terrain = this.context.inspectedTerrain;

    if (e) {
      this.inspectModal.setVisible(true);
      if (e.type === "enemy") {
        const hp = e.healthPoints ?? 0;
        const maxHp = e.maxHealthPoints ?? e.healthPoints ?? 0;
        const atk = typeof e.attack === "function" ? e.attack() : 0;
        const prot = typeof e.protection === "function" ? e.protection() : 0;
        const range = typeof e.range === "function" ? e.range() : 0;
        this.inspectModalText.setText(
          `${e.name}\n${e.description}\nHP: ${hp}/${maxHp}\nATK: ${atk}  DEF: ${prot}  Range: ${range}`
        );
      } else {
        const desc = e.identified ? e.description : "You have not identified this item.";
        this.inspectModalText.setText(`${e.displayName}\n${desc}`);
      }
      return;
    }

    if (terrain) {
      this.inspectModal.setVisible(true);
      this.inspectModalText.setText(terrain);
      return;
    }

    this.inspectModal.setVisible(false);
  }
}
