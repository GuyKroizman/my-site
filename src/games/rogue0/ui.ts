import { isModalOpen, type GameContext } from "./context";
import { InventoryWindow } from "./inventoryWindow";
import { LogWindow } from "./logWindow";
import { QuickslotPane } from "./quickslotPane";
import { attachTooltip } from "./tooltip";

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

// Compact edge-anchored HUD geometry; the map remains full screen.
export function getHudMetrics(w: number, h: number): {
  size: number;
  hudHeight: number;
  hudTop: number;
} {
  // Wait/search + four quick slots + backpack, with a gap between groups.
  const size = Math.max(24, Math.min(34, Math.floor((w - 36) / 7)));
  const hudHeight = size + 8 + 6 + 48;
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
  private inspectChoiceRows: Phaser.GameObjects.Text[] = [];
  private inspectChoicePage = 0;
  private renderedInspectChoices: GameContext["inspectChoices"];

  private logPanel: Phaser.GameObjects.Rectangle | undefined;
  private logTitle: Phaser.GameObjects.Text | undefined;
  private logClip: Phaser.GameObjects.Graphics | undefined;
  private logWindow: LogWindow | undefined;
  private toolbar: ToolbarButton[] = [];
  private quickslotPane: QuickslotPane | undefined;
  private healthTrack: Phaser.GameObjects.Rectangle | undefined;
  private healthFill: Phaser.GameObjects.Rectangle | undefined;
  private healthText: Phaser.GameObjects.Text | undefined;
  private heroStatus: Phaser.GameObjects.Text | undefined;
  private healthWidth = 140;

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
    this.logWindow = new LogWindow(this, this.context);

    // i / b toggle the inventory window; Esc closes it.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (this.context.helpOpen) return;
      const key = event.key;
      if (this.context.logModalOpen) {
        if (key === "Escape") this.logWindow?.close();
        return;
      }
      if (key === "i" || key === "I" || key === "b" || key === "B") {
        this.closeHeroModal();
        this.inventoryWindow?.toggle();
      } else if (key === "Escape") {
        this.inventoryWindow?.close();
        this.closeHeroModal();
        this.context.inspectChoices = undefined;
        this.context.inspectedEntity = undefined;
        this.context.inspectedTerrain = undefined;
      }
    });

    this.scene.get("scene0").events.on("entities-created", () => {
      this.buildHUD();
    });

    this.scale.on("resize", () => this.layout());
  }

  buildHUD() {
    this.buildToolbar();
    this.healthTrack = this.add.rectangle(0, 0, 140, 16, C.panel)
      .setOrigin(0).setStrokeStyle(1, C.borderStrong);
    this.healthFill = this.add.rectangle(0, 0, 138, 14, 0xf0b429).setOrigin(0);
    this.healthText = this.add.text(0, 0, '', {
      fontFamily: `${FONT_MONO}, monospace`, fontSize: 16, color: COL.text,
      stroke: '#16121c', strokeThickness: 3
    }).setOrigin(0.5);
    this.heroStatus = this.add.text(0, 0, '', {
      fontFamily: `${FONT_MONO}, monospace`, fontSize: 14, color: COL.muted
    });
    this.quickslotPane = new QuickslotPane(this, this.context, this.inventoryWindow!);
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
    attachTooltip(this, this.context, heroBg, 'Character info');
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
    }, "Character special"));

    // Backpack.
    this.toolbar.push(this.makeButton(() => {
      this.closeHeroModal();
      this.inventoryWindow?.toggle();
    }, (g) => {
      g.lineStyle(2, iconColor, 1);
      g.strokeRect(-6, -3, 12, 9);
      g.strokeCircle(0, -4, 2);
    }, "Backpack"));
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
    bg.on("pointerup", () => {
      if (!isModalOpen(this.context)) onClick();
    });

    if (label) attachTooltip(this, this.context, bg, label);
    return { bg, icon: g, label: txt };
  }

  private buildLog() {
    this.logPanel = this.add.rectangle(0, 0, 100, 60, C.panel, 0.9).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.logPanel.on("pointerup", () => this.logWindow?.open());
    this.logTitle = this.add.text(0, 0, "Log · tap for history", {
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
    this.logClip = this.make.graphics({ x: 0, y: 0 });
    this.log.setMask(this.logClip.createGeometryMask());
    this.events.once("shutdown", () => {
      this.log?.clearMask(true);
      this.logClip?.destroy();
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
      this.context.inspectChoices = undefined;
      this.context.inspectedEntity = undefined;
      this.context.inspectedTerrain = undefined;
    });
  }

  private layout() {
    const w = this.scale.width;
    const h = this.scale.height;

    const gap = 3;
    const edge = 8;
    const { size } = getHudMetrics(w, h);
    const y = h - size - edge;
    const positions = [
      [edge, edge], // portrait
      [edge, y], [edge + size + gap, y], // wait, search
      [w - edge - size, y - 2 * (size + gap)], // inspect
      [w - edge - size, y - size - gap], // special, directly above backpack
      [w - edge - size, y] // backpack
    ];
    this.toolbar.forEach((b, i) => {
      const [x, top] = positions[i];
      b.bg.setPosition(x + size / 2, top + size / 2).setSize(size, size);
      b.icon.setPosition(x + size / 2, top + size / 2);
      if (i === 0) b.icon.setScale(size / 32);
      b.label?.setVisible(false);
    });
    const healthX = edge + size + 6;
    this.healthWidth = Math.max(60, Math.min(160, w - healthX - 64));
    this.healthTrack?.setPosition(healthX, edge).setSize(this.healthWidth, 16);
    this.healthFill?.setPosition(healthX + 1, edge + 1);
    this.healthText?.setPosition(healthX + this.healthWidth / 2, edge + 8);
    this.heroStatus?.setPosition(healthX, edge + 20);
    // A lightweight message strip above the bottom controls, with history on tap.
    const logW = Math.min(w - 16 - size - gap, 520);
    const logH = 48;
    const logX = edge;
    this.quickslotPane?.layout(w - edge - size - gap, y + size / 2, size, gap);
    const logY = y - logH - 6;
    this.logPanel?.setPosition(logX, logY).setSize(logW, logH);
    this.logPanel?.setFillStyle(C.bg, 0.65);
    this.logTitle?.setVisible(false);
    this.log?.setPosition(logX + 4, logY + 4);
    this.log?.setWordWrapWidth(logW - 8);
    this.logClip?.clear().fillStyle(0xffffff).fillRect(logX + 4, logY + 4, logW - 8, logH - 8);
    this.logWindow?.layout();

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
    if (!this.heroModalOpen && isModalOpen(this.context)) return;
    this.heroModalOpen = !this.heroModalOpen;
    this.context.heroModalOpen = this.heroModalOpen;
    this.heroModal?.setVisible(this.heroModalOpen);
  }

  private closeHeroModal() {
    this.heroModalOpen = false;
    this.context.heroModalOpen = false;
    this.heroModal?.setVisible(false);
  }

  update() {
    if (!this.log) return;

    this.log.setText(this.context.messages.join("\n"));
    const player = this.context.player;
    if (player) {
      const fraction = Phaser.Math.Clamp(player.healthPoints / Math.max(1, player.maxHealthPoints), 0, 1);
      this.healthFill?.setSize((this.healthWidth - 2) * fraction, 14).setVisible(fraction > 0);
      this.healthText?.setText(`${player.healthPoints}/${player.maxHealthPoints}`);
      this.heroStatus?.setText(`Lv ${player.level} · Food ${Math.ceil(player.hunger)}`);
    }
    this.updateHeroModal();
    this.updateInspectModal();
    this.inventoryWindow?.refresh();
    this.quickslotPane?.refresh();
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

  private renderInspectChoices() {
    this.inspectChoiceRows.forEach((row) => row.destroy());
    this.inspectChoiceRows = [];
    const choices = this.context.inspectChoices;
    if (!choices?.length || !this.inspectModal) return;

    const addRow = (y: number, label: string, onClick?: () => void) => {
      const row = this.add.text(10, y, label, {
        fontFamily: `${FONT_MONO}, monospace`, fontSize: 17,
        color: onClick ? COL.gold : COL.text
      });
      if (onClick) {
        row.setInteractive({ useHandCursor: true });
        row.on("pointerover", () => row.setColor(COL.text));
        row.on("pointerout", () => row.setColor(COL.gold));
        row.on("pointerup", onClick);
      }
      this.inspectModal!.add(row);
      this.inspectChoiceRows.push(row);
    };

    addRow(26, "Choose an object to inspect:");
    const pageSize = 3;
    const start = this.inspectChoicePage * pageSize;
    choices.slice(start, start + pageSize).forEach((entity, index) => {
      addRow(50 + index * 28, `${start + index + 1}. ${entity.displayName}`, () => {
        this.context.inspectChoices = undefined;
        this.context.inspectedEntity = entity;
        this.context.inspectedTerrain = undefined;
      });
    });
    const pages = Math.ceil(choices.length / pageSize);
    if (pages > 1) {
      addRow(138, `More (${this.inspectChoicePage + 1}/${pages}) →`, () => {
        this.inspectChoicePage = (this.inspectChoicePage + 1) % pages;
        this.renderInspectChoices();
      });
    }
  }

  private updateInspectModal() {
    if (!this.inspectModal || !this.inspectModalText) return;

    const choices = this.context.inspectChoices;
    if (choices !== this.renderedInspectChoices) {
      this.inspectChoicePage = 0;
      this.renderedInspectChoices = choices;
      this.renderInspectChoices();
    }
    this.inspectModalText.setVisible(!choices?.length);
    if (choices?.length) {
      this.inspectModal.setVisible(true);
      this.inspectCloseBtn?.setVisible(true);
      return;
    }

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
        const desc = e.identified ? e.displayDescription : "You have not identified this item.";
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
