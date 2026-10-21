import type { GameContext } from "./context";
import { InventoryWindow } from "./inventoryWindow";

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

type ToolbarButton = {
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics;
  label?: Phaser.GameObjects.Text;
};

// Shared HUD geometry. scene0 uses this to shrink its camera viewport so the
// bottom HUD (log + toolbar) never hides playable map area; keep in sync with
// layout() below.
export function getHudMetrics(w: number, h: number): {
  size: number;
  hudHeight: number;
  hudTop: number;
} {
  const gap = 8;
  const count = 6; // hero, wait, search, inspect, skill, bag
  const size = Math.max(34, Math.min(46, Math.floor((w - 16 - (count - 1) * gap) / count)));
  // Toolbar block = size + 24 bottom margin; log (72px) sits 8px above it.
  const hudHeight = size + 24 + 8 + 72;
  return { size, hudHeight, hudTop: h - hudHeight };
}

export class UI extends Phaser.Scene {
  context: GameContext;
  private log: Phaser.GameObjects.Text | undefined;
  private inventoryWindow: InventoryWindow | undefined;

  private heroModal: Phaser.GameObjects.Container | undefined;
  private heroModalBg: Phaser.GameObjects.Rectangle | undefined;
  private heroModalText: Phaser.GameObjects.Text | undefined;
  private heroModalOpen = false;
  private heroCloseBtn: Phaser.GameObjects.Text | undefined;

  private inspectModal: Phaser.GameObjects.Container | undefined;
  private inspectModalBg: Phaser.GameObjects.Rectangle | undefined;
  private inspectModalText: Phaser.GameObjects.Text | undefined;
  private inspectCloseBtn: Phaser.GameObjects.Text | undefined;

  private logPanel: Phaser.GameObjects.Rectangle | undefined;
  private logTitle: Phaser.GameObjects.Text | undefined;
  private toolbar: ToolbarButton[] = [];

  constructor(context: GameContext) {
    super("ui-scene");

    this.context = context;
    this.log = undefined;
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
        this.closeHeroModal();
        this.inventoryWindow?.toggle();
      } else if (key === "Escape") {
        this.inventoryWindow?.close();
        this.closeHeroModal();
      }
    });

    this.scene.get("scene0").events.on("entities-created", () => {
      this.buildHUD();
    });

    this.scale.on("resize", () => this.layout());
  }

  buildHUD() {
    this.buildToolbar();
    this.buildLog();
    this.buildHeroModal();
    this.buildInspectModal();
    this.layout();
  }

  private buildToolbar() {
    const iconColor = 0xa29a8e;

    // Hero (character info) — the player's own tile sprite.
    const heroBg = this.add
      .rectangle(0, 0, 46, 46, C.panel, 1)
      .setStrokeStyle(2, C.borderStrong, 1)
      .setInteractive({ useHandCursor: true });
    const p = this.context.player;
    const heroIcon = this.add.sprite(0, 0, "tiles", p ? p.tile : 26).setScale(1.5);
    heroBg.on("pointerover", () => heroBg.setStrokeStyle(2, 0xf0b429, 1));
    heroBg.on("pointerout", () => heroBg.setStrokeStyle(2, C.borderStrong, 1));
    heroBg.on("pointerup", () => this.toggleHeroModal());
    this.toolbar.push({ bg: heroBg, icon: heroIcon });

    // Wait.
    this.toolbar.push(this.makeButton(() => this.context.player?.waitTurn(), (g) => {
      g.lineStyle(2, iconColor, 1);
      g.strokeCircle(0, 0, 7);
      g.lineBetween(0, 0, 0, -4);
      g.lineBetween(0, 0, 4, 2);
    }, "Wait"));

    // Search.
    this.toolbar.push(this.makeButton(() => this.context.player?.search(), (g) => {
      g.lineStyle(2, iconColor, 1);
      g.strokeCircle(0, 0, 6);
      g.lineBetween(4, 4, 10, 10);
    }, "Search"));

    // Inspect (eye) — toggles inspect mode; the next tap inspects a tile.
    this.toolbar.push(this.makeButton(() => this.context.player?.toggleInspectMode(), (g) => {
      g.lineStyle(2, iconColor, 1);
      g.strokeEllipse(0, 0, 13, 9);
      g.fillStyle(iconColor, 1);
      g.fillCircle(0, 0, 2.5);
    }, "Inspect"));

    // Skill.
    this.toolbar.push(this.makeButton(() => this.context.player?.tryUseSkill(), (g) => {
      g.lineStyle(2, iconColor, 1);
      g.strokeTriangle(0, -8, 7, 6, -7, 6);
    }));

    // Backpack.
    this.toolbar.push(this.makeButton(() => {
      this.closeHeroModal();
      this.inventoryWindow?.toggle();
    }, (g) => {
      g.lineStyle(2, iconColor, 1);
      g.strokeRect(-6, -3, 12, 9);
      g.strokeCircle(0, -4, 2);
    }, "Bag"));
  }

  private makeButton(
    onClick: () => void,
    draw: (g: Phaser.GameObjects.Graphics) => void,
    label?: string
  ): ToolbarButton {
    const size = 46;
    const bg = this.add
      .rectangle(0, 0, size, size, C.panel, 1)
      .setStrokeStyle(2, C.borderStrong, 1)
      .setInteractive({ useHandCursor: true });

    const g = this.add.graphics();
    draw(g);

    let txt: Phaser.GameObjects.Text | undefined;
    if (label) {
      txt = this.add.text(0, 0, label, {
        fontFamily: `${FONT_PIXEL}, monospace`,
        fontSize: 8,
        color: COL.muted
      }).setOrigin(0.5);
    }

    bg.on("pointerover", () => bg.setStrokeStyle(2, 0xf0b429, 1));
    bg.on("pointerout", () => bg.setStrokeStyle(2, C.borderStrong, 1));
    bg.on("pointerup", onClick);

    return { bg, icon: g, label: txt };
  }

  private buildLog() {
    this.logPanel = this.add.rectangle(0, 0, 100, 60, C.panel, 0.9).setOrigin(0);
    this.logTitle = this.add.text(0, 0, "Log", {
      fontFamily: `"${FONT_PIXEL}", monospace`,
      fontSize: 8,
      color: COL.gold
    });
    this.log = this.add.text(0, 0, "", {
      fontFamily: `${FONT_MONO}, monospace`,
      fontSize: 16,
      color: COL.muted,
      lineSpacing: 2,
      wordWrap: { width: 400, useAdvancedWrap: true }
    });
  }

  private buildHeroModal() {
    const w = 320;
    const h = 200;
    const root = this.add.container(0, 0).setDepth(600).setVisible(false);
    this.heroModalBg = this.add.rectangle(0, 0, w, h, C.panel, 0.98).setOrigin(0).setStrokeStyle(2, C.borderStrong, 1);
    root.add(this.heroModalBg);
    root.add(
      this.add.text(10, 8, "Hero", {
        fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 8, color: COL.gold
      })
    );
    this.heroModalText = this.add.text(10, 26, "", {
      fontFamily: `${FONT_MONO}, monospace`,
      fontSize: 17,
      color: COL.text,
      lineSpacing: 2,
      wordWrap: { width: w - 20 }
    });
    root.add(this.heroModalText);
    this.heroCloseBtn = this.add
      .text(w - 12, 8, "Close", {
        fontFamily: `${FONT_MONO}, monospace`,
        fontSize: 17,
        color: COL.gold
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.heroCloseBtn.on("pointerover", () => this.heroCloseBtn?.setColor(COL.text));
    this.heroCloseBtn.on("pointerout", () => this.heroCloseBtn?.setColor(COL.gold));
    this.heroCloseBtn.on("pointerup", () => this.closeHeroModal());
    root.add(this.heroCloseBtn);
    this.heroModal = root;
  }

  private buildInspectModal() {
    const w = 340;
    const h = 170;
    const root = this.add.container(0, 0).setDepth(600).setVisible(false);
    this.inspectModalBg = this.add.rectangle(0, 0, w, h, C.panel, 0.98).setOrigin(0).setStrokeStyle(2, C.borderStrong, 1);
    root.add(this.inspectModalBg);
    root.add(
      this.add.text(10, 8, "Inspect", {
        fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 8, color: COL.gold
      })
    );
    this.inspectModalText = this.add.text(10, 26, "", {
      fontFamily: `${FONT_MONO}, monospace`,
      fontSize: 17,
      color: COL.text,
      lineSpacing: 2,
      wordWrap: { width: w - 20 }
    });
    root.add(this.inspectModalText);
    this.inspectModal = root;

    this.inspectCloseBtn = this.add
      .text(0, 0, "Close", {
        fontFamily: `${FONT_MONO}, monospace`,
        fontSize: 17,
        color: COL.gold
      })
      .setOrigin(1, 0)
      .setDepth(601)
      .setInteractive({ useHandCursor: true });
    this.inspectCloseBtn.on("pointerover", () => this.inspectCloseBtn?.setColor(COL.text));
    this.inspectCloseBtn.on("pointerout", () => this.inspectCloseBtn?.setColor(COL.gold));
    this.inspectCloseBtn.on("pointerup", () => {
      this.context.inspectedEntity = undefined;
      this.context.inspectedTerrain = undefined;
    });
  }

  private layout() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Toolbar: responsive button size so it always fits horizontally.
    const gap = 8;
    const count = this.toolbar.length;
    const { size } = getHudMetrics(w, h);
    const totalW = count * size + (count - 1) * gap;
    let x = (w - totalW) / 2;
    const y = h - size - 24;
    for (const b of this.toolbar) {
      b.bg.setPosition(x + size / 2, y + size / 2).setSize(size, size);
      b.icon.setPosition(x + size / 2, y + size / 2);
      if (b.label) b.label.setPosition(x + size / 2, y + size + 8);
      x += size + gap;
    }
    // Log above the toolbar.
    const logW = Math.min(w - 16, 520);
    const logH = 72;
    const logX = (w - logW) / 2;
    const logY = y - logH - 8;
    this.logPanel?.setPosition(logX, logY).setSize(logW, logH);
    this.logTitle?.setPosition(logX + 8, logY + 4);
    this.log?.setPosition(logX + 8, logY + 20);
    this.log?.setWordWrapWidth(logW - 16);

    // Hero modal: clamp to the viewport and center it.
    const heroW = Math.min(320, w - 16);
    const heroH = 200;
    this.heroModalBg?.setSize(heroW, heroH);
    this.heroModalText?.setWordWrapWidth(heroW - 20);
    this.heroCloseBtn?.setPosition(heroW - 12, 8);
    this.heroModal?.setPosition(
      (w - heroW) / 2,
      Phaser.Math.Clamp((h - heroH) / 2 - 40, 8, Math.max(8, h - heroH - 8))
    );

    // Inspect modal: clamp to the viewport and center it.
    const inspW = Math.min(340, w - 16);
    const inspH = 170;
    this.inspectModalBg?.setSize(inspW, inspH);
    this.inspectModalText?.setWordWrapWidth(inspW - 20);
    const ix = (w - inspW) / 2;
    const iy = Phaser.Math.Clamp((h - inspH) / 2, 8, Math.max(8, h - inspH - 8));
    this.inspectModal?.setPosition(ix, iy);
    this.inspectCloseBtn?.setPosition(ix + inspW - 12, iy + 8);
  }

  private toggleHeroModal() {
    this.heroModalOpen = !this.heroModalOpen;
    this.heroModal?.setVisible(this.heroModalOpen);
  }

  private closeHeroModal() {
    this.heroModalOpen = false;
    this.heroModal?.setVisible(false);
  }

  update() {
    if (!this.log) return;

    this.log.setText(this.context.messages.join("\n\n"));
    this.updateHeroModal();
    this.updateInspectModal();
    this.inventoryWindow?.refresh();
  }

  private updateHeroModal() {
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

  private updateInspectModal() {
    if (!this.inspectModal || !this.inspectModalText) return;

    const e = this.context.inspectedEntity;
    const terrain = this.context.inspectedTerrain;

    if (e) {
      this.inspectModal.setVisible(true);
      this.inspectCloseBtn?.setVisible(true);
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
      this.inspectCloseBtn?.setVisible(true);
      this.inspectModalText.setText(terrain);
      return;
    }

    this.inspectModal.setVisible(false);
    this.inspectCloseBtn?.setVisible(false);
  }
}
