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
  private statusText: Phaser.GameObjects.Text | undefined;
  private inspectLabel: Phaser.GameObjects.Text | undefined;
  private logLabel: Phaser.GameObjects.Text | undefined;
  private inventoryWindow: InventoryWindow | undefined;

  constructor(context: GameContext) {
    super("ui-scene");

    this.context = context;
    this.active = true;
    this.log = undefined;
    this.floorText = undefined;
    this.statusText = undefined;
    this.inspectLabel = undefined;
    this.logLabel = undefined;
    this.inventoryWindow = undefined;
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

    // Sidebar backdrop: an opaque panel separating the HUD from the map, with
    // a strong left edge so the game viewport reads as a framed play area.
    this.add.rectangle(SIDEBAR_X, 0, SIDEBAR_W, SIDEBAR_H, C.bg, 1).setOrigin(0);
    this.add
      .rectangle(SIDEBAR_X, 0, 2, SIDEBAR_H, C.borderStrong, 1)
      .setOrigin(0);

    let y = 14;

    // Floor header.
    this.floorText = this.add
      .text(SIDEBAR_X + SIDEBAR_W / 2, y, `Floor ${this.context.floor}`, {
        font: `11px '${FONT_PIXEL}'`,
        color: COL.gold
      })
      .setOrigin(0.5, 0);
    y += 24;
    this.add
      .rectangle(SIDEBAR_X + PAD, y, SIDEBAR_W - PAD * 2, 1, C.border, 1)
      .setOrigin(0);
    y += 10;

    // Hero panel is rendered by BasicHero; we draw a backing panel behind it
    // so the sprite, stats and backpack button sit on a framed surface.
    const heroX = SIDEBAR_X + PAD;
    const heroW = SIDEBAR_W - PAD * 2;
    const heroPad = 6;
    this.add
      .rectangle(heroX, y, heroW, 186, C.panel, 1)
      .setOrigin(0)
      .setStrokeStyle(1, C.border, 1);

    this.context.player.createUI({
      scene: this,
      x: heroX + heroPad,
      y: y + heroPad,
      width: heroW - heroPad * 2
    });
    y += 186 + 12;

    y = this.buildInspectPanel(y);
    this.buildLogPanel(y);

    // Web fonts can load after the first paint; re-render static labels once
    // they are ready so pixel fonts snap in.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready
        .then(() => this.rerenderStaticText())
        .catch(() => undefined);
    }
  }

  private buildInspectPanel(y: number): number {
    const w = SIDEBAR_W - PAD * 2;
    const h = 118;
    const px = SIDEBAR_X + PAD;

    this.add
      .rectangle(px, y, w, h, C.panel, 1)
      .setOrigin(0)
      .setStrokeStyle(1, C.border, 1);

    this.inspectLabel = this.add.text(px + 8, y + 8, "Inspect", {
      font: `8px '${FONT_PIXEL}'`,
      color: COL.gold
    });

    this.add.rectangle(px + 8, y + 24, w - 16, 1, C.border, 1).setOrigin(0);

    this.statusText = this.add.text(px + 8, y + 32, "", {
      font: `15px '${FONT_MONO}'`,
      color: COL.muted,
      wordWrap: { width: w - 16 },
      lineSpacing: 2
    });

    return y + h;
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

    this.logLabel = this.add.text(px + 8, y + 8, "Log", {
      font: `8px '${FONT_PIXEL}'`,
      color: COL.gold
    });

    this.add.rectangle(px + 8, y + 24, w - 16, 1, C.border, 1).setOrigin(0);

    this.log = this.add.text(px + 8, y + 32, "", {
      font: `15px '${FONT_MONO}'`,
      color: COL.muted,
      wordWrap: { width: w - 16 },
      lineSpacing: 2
    });
  }

  private rerenderStaticText(): void {
    if (!this.floorText) return;
    this.floorText.setText(`Floor ${this.context.floor}`);
    this.inspectLabel?.setText("Inspect");
    this.logLabel?.setText("Log");
  }

  update() {
    if (!this.log) return;

    this.log.setText(this.context.messages.join(`\n\n`));
    this.context.player?.updateUI?.();
    this.context.player?.refreshUI?.();
    this.updateStatus();
    this.inventoryWindow?.refresh();
  }

  updateStatus() {
    if (!this.statusText) return;

    const e = this.context.inspectedEntity;
    if (!e) {
      this.statusText.setColor(COL.muted);
      this.statusText.setText("Hover a creature, or tap it with Inspect on.");
      return;
    }

    this.statusText.setColor(COL.text);

    if (e.type === "enemy") {
      const hp = e.healthPoints ?? 0;
      const maxHp = e.maxHealthPoints ?? e.healthPoints ?? 0;
      const atk = typeof e.attack === "function" ? e.attack() : 0;
      const prot = typeof e.protection === "function" ? e.protection() : 0;
      const range = typeof e.range === "function" ? e.range() : 0;
      this.statusText.setText(
        `${e.name}\n${e.description}\nHP: ${hp}/${maxHp}\nATK: ${atk}  DEF: ${prot}  Range: ${range}`
      );
    } else {
      const desc = e.identified ? e.description : "You have not identified this item.";
      this.statusText.setText(`${e.displayName}\n${desc}`);
    }
  }
}
