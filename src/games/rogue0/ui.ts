import { applyInspectChoice, isModalOpen, type GameContext } from "./context";
import { InventoryWindow } from "./inventoryWindow";
import { KnowledgeWindow } from "./knowledgeWindow";
import Wand from "./items/wand";
import { LogWindow } from "./logWindow";
import { ConfirmationWindow } from "./confirmationWindow";
import { QuickslotPane } from "./quickslotPane";
import { attachTooltip } from "./tooltip";
import { describeEffect } from "./effects";
import { heroHudView, heroPortrait, statusDurationLabel } from './heroViewModel';
import {
  STATUS_ICON_SIZE,
  STATUS_ICON_TEXTURE,
  generateStatusIconTextures,
  statusIconFrame
} from './statusIconTextures';
import { LOG_STRIP_GAP, LOG_STRIP_HEIGHT, statusIconLayout } from './statusHudLayout';

// Slots are cheap and effects are capped in practice, but leave headroom so a
// heavily buffed hero still shows every status.
const STATUS_ICON_SLOTS = 16;

const FONT_PIXEL = "Press Start 2P";
const FONT_MONO = "VT323";
// Number of inspect entries shown per page (one row per line).
const INSPECT_CHOICE_PAGE_SIZE = 3;

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
  private knowledgeWindow: KnowledgeWindow | undefined;

  private heroModal: Phaser.GameObjects.Container | undefined;
  private heroModalBg: Phaser.GameObjects.Rectangle | undefined;
  private heroModalText: Phaser.GameObjects.Text | undefined;
  private heroModalOpen = false;
  private showingTalents = false;
  private talentRows: Phaser.GameObjects.Text[] = [];
  private talentTab?: Phaser.GameObjects.Text;
  private heroCloseBtn: Phaser.GameObjects.Text | undefined;
  private heroBackdrop: Phaser.GameObjects.Rectangle | undefined;

  private inspectModal: Phaser.GameObjects.Container | undefined;
  private inspectModalBg: Phaser.GameObjects.Rectangle | undefined;
  private inspectModalText: Phaser.GameObjects.Text | undefined;
  private inspectCloseBtn: Phaser.GameObjects.Text | undefined;
  private inspectBackdrop: Phaser.GameObjects.Rectangle | undefined;
  private inspectChoiceRows: Phaser.GameObjects.Text[] = [];
  private inspectChoicePage = 0;
  private renderedInspectChoices: GameContext["inspectChoices"];

  private logPanel: Phaser.GameObjects.Rectangle | undefined;
  private logTitle: Phaser.GameObjects.Text | undefined;
  private logCropWidth = 0;
  private logCropHeight = 0;
  private lastLogText = '';
  private logWindow: LogWindow | undefined;
  private confirmationWindow: ConfirmationWindow | undefined;
  private toolbar: ToolbarButton[] = [];
  private heroIcon: Phaser.GameObjects.Sprite | undefined;
  private quickslotPane: QuickslotPane | undefined;
  private healthTrack: Phaser.GameObjects.Rectangle | undefined;
  private healthFill: Phaser.GameObjects.Rectangle | undefined;
  private healthText: Phaser.GameObjects.Text | undefined;
  private heroStatus: Phaser.GameObjects.Text | undefined;
  private floorStatus: Phaser.GameObjects.Text | undefined;
  private healthWidth = 140;
  private statusIcons: {
    bg: Phaser.GameObjects.Rectangle;
    icon: Phaser.GameObjects.Sprite;
    count: Phaser.GameObjects.Text;
    id: string;
  }[] = [];
  private readonly statusIconSize = 28;
  private readonly statusIconGap = 4;

  constructor(context: GameContext) {
    super("ui-scene");

    this.context = context;
    this.log = undefined;
    this.inventoryWindow = undefined;
    this.heroModal = undefined;
    this.heroModalText = undefined;
    this.heroBackdrop = undefined;
    this.inspectModal = undefined;
    this.inspectModalText = undefined;
    this.inspectBackdrop = undefined;
  }

  create() {
    this.inventoryWindow = new InventoryWindow(this, this.context);
    this.logWindow = new LogWindow(this, this.context);
    this.confirmationWindow = new ConfirmationWindow(this, this.context);
    this.knowledgeWindow = new KnowledgeWindow(this, this.context);
    // The React game menu opens the knowledge modal through the context.
    this.context.onOpenKnowledge = () => this.knowledgeWindow?.openWindow();

    // b toggles the inventory window; i is a movement key (up-right diagonal).
    // Esc dismisses the topmost dialog.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      // The store scene owns all input while it is open; the level HUD must
      // never answer its hotkeys underneath it.
      if (this.context.storeOpen || this.context.helpOpen) return;
      const key = event.key;
      if (this.context.confirmationOpen) {
        if (key === "Escape") this.confirmationWindow?.close();
        return;
      }
      if (this.context.logModalOpen) {
        if (key === "Escape") this.logWindow?.close();
        return;
      }
      if (this.context.knowledgeOpen) {
        // The knowledge pages are read-only, so only Esc (or Close) dismisses.
        if (key === "Escape") this.knowledgeWindow?.close();
        return;
      }
      // Pick from the shared-tile inspect list; taps work too.
      const choices = this.context.inspectChoices;
      if (choices?.length) {
        if (key === "Escape") { this.closeInspectModal(); return; }
        const pick = Number(key);
        if (Number.isInteger(pick) && pick >= 1 && pick <= INSPECT_CHOICE_PAGE_SIZE) {
          const choice = choices[this.inspectChoicePage * INSPECT_CHOICE_PAGE_SIZE + pick - 1];
          if (choice) applyInspectChoice(this.context, choice);
          return;
        }
      }
      if (key === "b" || key === "B") {
        this.closeHeroModal();
        this.inventoryWindow?.toggle();
      } else if (key === "Escape") {
        this.inventoryWindow?.dismiss();
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
    generateStatusIconTextures(this);
    this.buildToolbar();
    this.buildStatusIcons();
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
    this.floorStatus = this.add.text(0, 0, '', {
      fontFamily: `${FONT_MONO}, monospace`, fontSize: 16, color: COL.gold,
      stroke: '#16121c', strokeThickness: 3
    }).setOrigin(1, 0);
    this.quickslotPane = new QuickslotPane(this, this.context, this.inventoryWindow!);
    this.buildLog();
    this.buildHeroModal();
    this.buildInspectModal();
    this.layout();
  }

  private buildToolbar() {
    const iconColor = 0xa29a8e;

    // Hero (character info) — drawn from the hero's own sprite, so the button
    // always matches the character standing in the dungeon.
    const heroBg = this.add
      .rectangle(0, 0, 46, 46, C.panel, 1)
      .setStrokeStyle(2, C.borderStrong, 1)
      .setInteractive({ useHandCursor: true });
    const portrait = heroPortrait(this.context.player);
    const heroIcon = this.add.sprite(0, 0, portrait.textureKey, portrait.frame).setScale(1.5);
    this.heroIcon = heroIcon;
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
    }, "Wait  [Space]"));

    // One tap targets inspection; a second tap on this button searches.
    this.toolbar.push(this.makeButton(() => this.context.player?.inspectOrSearch(), (g) => {
      g.lineStyle(2, iconColor, 1);
      g.strokeCircle(0, 0, 6);
      g.lineBetween(4, 4, 10, 10);
    }, "Inspect  [x] · Search  [s]"));

    // Backpack.
    this.toolbar.push(this.makeButton(() => {
      this.closeHeroModal();
      this.inventoryWindow?.toggle();
    }, (g) => {
      g.lineStyle(2, iconColor, 1);
      g.strokeRect(-6, -3, 12, 9);
      g.strokeCircle(0, -4, 2);
    }, "Backpack  [b]"));

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

  private buildStatusIcons() {
    for (let i = 0; i < STATUS_ICON_SLOTS; i++) {
      const bg = this.add
        .rectangle(0, 0, this.statusIconSize, this.statusIconSize, C.panel, 1)
        .setStrokeStyle(1, C.borderStrong, 1)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
      // Every effect has its own drawn icon (see statusIconTextures): the old
      // tilesheet frames were shared by several statuses and unreadable.
      const icon = this.add
        .sprite(0, 0, STATUS_ICON_TEXTURE, 0)
        .setDisplaySize(STATUS_ICON_SIZE, STATUS_ICON_SIZE)
        .setVisible(false);
      // Remaining turns sit on the icon itself, so the number is visible
      // without opening the tooltip or the character modal.
      const count = this.add
        .text(0, 0, "", {
          fontFamily: `${FONT_MONO}, monospace`, fontSize: 11, color: COL.gold,
          stroke: '#16121c', strokeThickness: 3
        })
        .setOrigin(1, 1)
        .setVisible(false);
      bg.on("pointerover", () => bg.setStrokeStyle(1, 0xf0b429, 1));
      bg.on("pointerout", () => bg.setStrokeStyle(1, C.borderStrong, 1));
      const slot = { bg, icon, count, id: "" };
      this.statusIcons.push(slot);
      attachTooltip(
        this,
        this.context,
        bg,
        () => this.statusTooltipLabel(slot),
        () => slot.bg.visible && !isModalOpen(this.context)
      );
    }
  }

  private statusTooltipLabel(slot: { id: string }): string {
    const effect = this.context.player?.effects.find((e) => e.id === slot.id);
    if (!effect) return "";
    const duration = statusDurationLabel(effect);
    const detail = describeEffect(effect);
    return detail
      ? `${effect.name} (${duration}) — ${detail}`
      : `${effect.name} (${duration})`;
  }

  /**
   * A column of status icons under the hero portrait, in the top-left corner.
   * Icons wrap into a second column when the column would reach the message
   * strip, so a stack of buffs is never silently hidden.
   */
  private updateStatusIcons() {
    const effects = this.context.player?.effects ?? [];
    const w = this.scale.width;
    const h = this.scale.height;
    const { size } = getHudMetrics(w, h);
    const ic = this.statusIconSize;
    const { boxes } = statusIconLayout({
      width: w,
      height: h,
      count: effects.length,
      toolbarSize: size,
      iconSize: ic,
      gap: this.statusIconGap
    });

    this.statusIcons.forEach((slot, i) => {
      const effect = effects[i];
      const box = boxes[i];
      if (!effect || !box) {
        slot.id = "";
        slot.bg.setVisible(false);
        slot.icon.setVisible(false);
        slot.count.setVisible(false);
        return;
      }

      slot.id = effect.id;
      slot.bg.setVisible(box.visible);
      slot.icon.setVisible(box.visible);
      slot.count.setVisible(box.visible);
      if (!box.visible) return;

      slot.bg.setPosition(box.x + ic / 2, box.y + ic / 2).setSize(ic, ic);
      slot.icon
        .setPosition(box.x + ic / 2, box.y + ic / 2)
        .setFrame(statusIconFrame(effect.id));
      slot.count
        .setPosition(box.x + ic - 2, box.y + ic - 1)
        .setText(statusDurationLabel(effect));
    });
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
    // Phaser 4 only supports geometry masks in Canvas mode, so the strip is
    // clipped with a crop over the text texture instead of a mask.
    this.events.once("shutdown", () => {
      this.log?.setCrop();
    });
  }

  private buildHeroModal() {
    const w = 320;
    const h = 360;
    this.showingTalents = false;
    this.talentRows = [];
    this.heroBackdrop = this.add
      .rectangle(0, 0, 1, 1, 0x000000, 0.5)
      .setOrigin(0)
      .setDepth(599)
      .setVisible(false)
      .setInteractive();
    this.heroBackdrop.on("pointerup", () => this.closeHeroModal());

    const root = this.add.container(0, 0).setDepth(600).setVisible(false);
    // Interactive so taps on the modal body don't fall through to the
    // outside-click backdrop and dismiss the dialog.
    this.heroModalBg = this.add.rectangle(0, 0, w, h, C.panel, 0.98).setOrigin(0).setStrokeStyle(2, C.borderStrong, 1)
      .setInteractive();
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
    this.talentTab = this.add.text(70, 5, "Talents", {
      fontFamily: `${FONT_MONO}, monospace`, fontSize: 17, color: COL.gold
    }).setInteractive({ useHandCursor: true });
    this.talentTab.on("pointerup", () => {
      this.showingTalents = !this.showingTalents;
      this.updateHeroModal();
    });
    root.add(this.talentTab);
    for (let index = 0; index < 2; index++) {
      const row = this.add.text(10, 85 + index * 100, "", {
        fontFamily: `${FONT_MONO}, monospace`, fontSize: 17, color: COL.gold,
        wordWrap: { width: w - 20 }
      }).setInteractive({ useHandCursor: true }).setVisible(false);
      row.on("pointerup", () => {
        if (!this.heroModalOpen || !this.showingTalents) return;
        const player = this.context.player;
        const talent = player?.availableTalents[index];
        if (talent) player?.learnTalent(talent.id);
        this.updateHeroModal();
      });
      this.talentRows.push(row);
      root.add(row);
    }
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
    this.inspectBackdrop = this.add
      .rectangle(0, 0, 1, 1, 0x000000, 0.5)
      .setOrigin(0)
      .setDepth(599)
      .setVisible(false)
      .setInteractive();
    this.inspectBackdrop.on("pointerup", () => this.closeInspectModal());

    const root = this.add.container(0, 0).setDepth(600).setVisible(false);
    // Interactive so taps on the modal body don't fall through to the
    // outside-click backdrop and dismiss the dialog.
    this.inspectModalBg = this.add.rectangle(0, 0, w, h, C.panel, 0.98).setOrigin(0).setStrokeStyle(2, C.borderStrong, 1)
      .setInteractive();
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
    this.inspectCloseBtn.on("pointerup", () => this.closeInspectModal());
  }

  private closeInspectModal() {
    this.context.inspectChoices = undefined;
    this.context.inspectedEntity = undefined;
    this.context.inspectedTerrain = undefined;
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
      [edge, y], [edge + size + gap, y], // wait, inspect/search
      [w - edge - size, y] // backpack
    ];
    this.toolbar.forEach((b, i) => {
      const [x, top] = positions[i];
      b.bg.setPosition(x + size / 2, top + size / 2).setSize(size, size);
      b.icon.setPosition(x + size / 2, top + size / 2);
      b.label?.setVisible(false);
    });
    // Fit the portrait inside the button with a small margin; hero art is not
    // square (16×22), so scale by its tallest side.
    if (this.heroIcon) {
      const fit = Math.max(this.heroIcon.width, this.heroIcon.height) || 16;
      this.heroIcon.setScale((size - 8) / fit);
    }
    const healthX = edge + size + 6;
    this.healthWidth = Math.max(60, Math.min(160, w - healthX - 64));
    this.healthTrack?.setPosition(healthX, edge).setSize(this.healthWidth, 16);
    this.healthFill?.setPosition(healthX + 1, edge + 1);
    this.healthText?.setPosition(healthX + this.healthWidth / 2, edge + 8);
    this.heroStatus?.setPosition(healthX, edge + 20);
    // Keep the floor readout clear of the DOM menu button (top-right).
    this.floorStatus?.setPosition(w - edge, edge + 36);
    // A lightweight message strip above the bottom controls, with history on tap.
    const logW = Math.min(w - 16 - size - gap, 520);
    const logH = LOG_STRIP_HEIGHT;
    const logX = edge;
    this.quickslotPane?.layout(w - edge - size - gap, y + size / 2, size, gap);
    const logY = y - logH - LOG_STRIP_GAP;
    this.logPanel?.setPosition(logX, logY).setSize(logW, logH);
    this.logPanel?.setFillStyle(C.bg, 0.65);
    this.logTitle?.setVisible(false);
    this.log?.setPosition(logX + 4, logY + 4);
    this.log?.setWordWrapWidth(logW - 8);
    this.clipLogStrip(logW - 8, logH - 8);
    this.logWindow?.layout();
    this.confirmationWindow?.layout();
    this.knowledgeWindow?.layout();

    // Hero modal: clamp to the viewport and center it.
    const heroW = Math.min(320, w - 16);
    const heroH = 360;
    this.heroModalBg?.setSize(heroW, heroH);
    this.heroModalText?.setWordWrapWidth(heroW - 20);
    this.talentRows.forEach(row => row.setWordWrapWidth(heroW - 20));
    this.heroCloseBtn?.setPosition(heroW - 12, 8);
    const heroScale = Math.min(1, Math.max(0.1, (h - 16) / heroH));
    this.heroModal?.setScale(heroScale);
    this.heroModal?.setPosition(
      (w - heroW * heroScale) / 2,
      Phaser.Math.Clamp((h - heroH * heroScale) / 2 - 40, 8, Math.max(8, h - heroH * heroScale - 8))
    );
    this.heroBackdrop?.setSize(w, h);

    // Inspect modal: sized to its content (see fitInspectModal).
    this.fitInspectModal();
  }

  // Grows/shrinks the inspect dialog to its current text or choice list and
  // clamps it into the viewport, so long terrain descriptions stay readable.
  private fitInspectModal() {
    if (!this.inspectModal || !this.inspectModalBg || !this.inspectModalText) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const inspW = Math.min(340, w - 16);
    let contentBottom = 60;
    if (this.context.inspectChoices?.length) {
      contentBottom = this.inspectChoiceRows.reduce(
        (max, row) => Math.max(max, row.y + row.height), contentBottom);
    } else if (this.inspectModalText.visible) {
      contentBottom = this.inspectModalText.y + this.inspectModalText.height;
    }
    const inspH = Math.min(Math.max(96, contentBottom + 14), h - 16);
    this.inspectModalBg.setSize(inspW, inspH);
    this.inspectModalText.setWordWrapWidth(inspW - 20);
    const ix = (w - inspW) / 2;
    const iy = Phaser.Math.Clamp((h - inspH) / 2, 8, Math.max(8, h - inspH - 8));
    this.inspectModal.setPosition(ix, iy);
    this.inspectCloseBtn?.setPosition(ix + inspW - 12, iy + 8);
    this.inspectBackdrop?.setSize(w, h);
  }

  private toggleHeroModal() {
    if (!this.heroModalOpen && isModalOpen(this.context)) return;
    this.heroModalOpen = !this.heroModalOpen;
    this.context.heroModalOpen = this.heroModalOpen;
    this.heroModal?.setVisible(this.heroModalOpen);
    this.heroBackdrop?.setVisible(this.heroModalOpen);
  }

  private closeHeroModal() {
    this.heroModalOpen = false;
    this.context.heroModalOpen = false;
    this.heroModal?.setVisible(false);
    this.heroBackdrop?.setVisible(false);
  }

  /** The strip is a fixed window over the message text; scrolling history lives
   * in the log window. Cropping replaces the geometry mask, which Phaser 4 only
   * supports in Canvas mode. */
  private clipLogStrip(width: number, height: number): void {
    this.logCropWidth = width;
    this.logCropHeight = height;
    if (!this.log) return;
    this.log.setCrop(0, 0, width, Math.min(height, this.log.height));
  }

  update() {
    if (!this.log) return;

    const hint = this.context.throwMode
        ? this.context.throwItem instanceof Wand
          ? `Target ${this.context.throwItem.displayName}: tap an enemy to select it, tap it again (or Enter) to fire. Move the cursor past your sight to zap into the dark; walls and closed doors still block the bolt. Tap the wand again to fire at the highlighted foe. Open the backpack or press Esc to cancel.`
          : `Target ${this.context.throwItem?.displayName ?? "item"}: tap any tile in sight, or move cursor + Enter. Esc cancels.`
        : undefined;
    const logText = hint ?? this.context.messages.join("\n");
    // A new string rebuilds the text texture, which drops the crop with it.
    if (logText !== this.lastLogText) {
      this.lastLogText = logText;
      this.log.setText(logText);
      this.clipLogStrip(this.logCropWidth, this.logCropHeight);
    }
    const player = this.context.player;
    if (player) {
      const view = heroHudView(player, this.context.floor);
      this.healthFill?.setSize((this.healthWidth - 2) * view.healthFraction, 14).setVisible(view.healthFraction > 0);
      this.healthText?.setText(view.healthText);
      this.heroStatus?.setText(view.heroStatus);
      this.floorStatus?.setText(view.floorStatus);
    }
    this.updateStatusIcons();
    this.updateHeroModal();
    this.updateInspectModal();
    this.inventoryWindow?.refresh();
    this.knowledgeWindow?.refresh();
    this.quickslotPane?.refresh();
  }

  private updateHeroModal() {
    if (!this.heroModalText) return;
    const p = this.context.player;
    if (!p) return;

    this.talentTab?.setText(this.showingTalents ? "Stats" : `Talents (${p.talentPoints})`);
    this.talentRows.forEach((row, index) => {
      const talent = p.availableTalents[index];
      row.setVisible(this.showingTalents && !!talent);
      if (!talent) return;
      const rank = p.talentRank(talent.id);
      const canLearn = p.talentPoints > 0 && rank < 2;
      row.setColor(canLearn ? COL.gold : COL.muted);
      row.setText(`${talent.name} ${rank}/2${canLearn ? "  [+]" : ""}\n${talent.description}`);
    });
    if (this.showingTalents) {
      this.heroModalText.setText(`Points: ${p.talentPoints} (levels 2–4)\nTap a talent to rank up.\nPermanent choices; rank cap 2.`);
      return;
    }
    let text = p.statsText();
    if (p.effects.length) {
      text += "\n\nEffects:";
      for (const e of p.effects) {
        const duration = statusDurationLabel(e);
        const detail = describeEffect(e);
        text += detail
          ? `\n${e.name} (${duration}) — ${detail}`
          : `\n${e.name} (${duration})`;
      }
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

    addRow(26, "Choose something to inspect:");
    const pageSize = INSPECT_CHOICE_PAGE_SIZE;
    const start = this.inspectChoicePage * pageSize;
    choices.slice(start, start + pageSize).forEach((choice, index) => {
      const label = choice.kind === "terrain" ? choice.label : choice.entity.displayName;
      addRow(50 + index * 28, `${start + index + 1}. ${label}`, () => {
        applyInspectChoice(this.context, choice);
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
    this.refreshInspectModal();
    this.fitInspectModal();
  }

  private refreshInspectModal() {
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
      this.inspectBackdrop?.setVisible(true);
      return;
    }

    const e = this.context.inspectedEntity;
    const terrain = this.context.inspectedTerrain;

    if (e) {
      this.inspectModal.setVisible(true);
      this.inspectCloseBtn?.setVisible(true);
      this.inspectBackdrop?.setVisible(true);
      if (e.type === "enemy") {
        const hp = e.healthPoints ?? 0;
        const maxHp = e.maxHealthPoints ?? e.healthPoints ?? 0;
        const atk = typeof e.attack === "function" ? e.attack() : 0;
        const prot = typeof e.protection === "function" ? e.protection() : 0;
        const range = typeof e.range === "function" ? e.range() : 0;
        this.inspectModalText.setText(
          `${e.name}\n${e.displayDescription}\nHP: ${hp}/${maxHp}\nATK: ${atk}  DEF: ${prot}  Range: ${range}`
        );
      } else {
        const desc = e.identified || e.isPhysicalEquipment
          ? e.displayDescription
          : ['You have not identified this item.', e.curseDescription].filter(Boolean).join('\n\n');
        this.inspectModalText.setText(`${e.displayName}\n${desc}`);
      }
      return;
    }

    if (terrain) {
      this.inspectModal.setVisible(true);
      this.inspectCloseBtn?.setVisible(true);
      this.inspectBackdrop?.setVisible(true);
      this.inspectModalText.setText(terrain);
      return;
    }

    this.inspectModal.setVisible(false);
    this.inspectCloseBtn?.setVisible(false);
    this.inspectBackdrop?.setVisible(false);
  }
}
