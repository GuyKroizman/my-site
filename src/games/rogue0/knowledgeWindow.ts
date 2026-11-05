// Item-knowledge modal, opened from the game menu ("Potions & scrolls").
//
// Two pages: every potion kind and every scroll kind the hero has met this
// run. Identified kinds are listed by their real name; the rest keep their
// scrambled appearance label, so the page never reveals an unknown identity.
//
// Like the other modals it renders in the UI scene (above the map), pauses
// world input, and scales itself to fit the current game size.

import type { GameContext } from "./context";
import {
  consumableKnowledge,
  type ConsumableCategory,
  type ConsumableKnowledgeEntry
} from "./entity";

const PAD = 14;
const TITLE_BAR_H = 24;
const CLOSE_W = 62;
const CLOSE_H = 22;
const TAB_GAP = 6;
const TAB_H = 26;
const ROW_H = 26;
const ICON_SIZE = 16;
const WINDOW_W = 300;
const FOOTER_H = 20;

const FONT_PIXEL = "Press Start 2P";
const FONT_MONO = "VT323";

const COL = {
  gold: "#f0b429",
  text: "#e8e1d5",
  muted: "#a29a8e",
  dim: "#6e675f"
};

const C = {
  overlay: 0x000000,
  panel: 0x1f1926,
  panel2: 0x241d2b,
  cell: 0x16121c,
  cellActive: 0x102846,
  border: 0x3a3342,
  borderStrong: 0x5a5060,
  gold: 0xf0b429
};

const PAGES: { category: ConsumableCategory; label: string }[] = [
  { category: "potion", label: "Potions" },
  { category: "scroll", label: "Scrolls" }
];

export class KnowledgeWindow {
  private open = false;
  private page: ConsumableCategory = "potion";
  private signature = "";
  // Overlay + container. The container destroys its children on rebuild.
  private objects: Phaser.GameObjects.GameObject[] = [];
  private root: Phaser.GameObjects.Container | undefined;

  constructor(private scene: Phaser.Scene, private context: GameContext) {}

  isOpen(): boolean {
    return this.open;
  }

  openWindow(): void {
    if (this.open || !this.context.player) return;
    this.open = true;
    this.page = "potion";
    this.context.knowledgeOpen = true;
    this.render();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.context.knowledgeOpen = false;
    this.clear();
  }

  // Called on resize: rebuild so the window re-fits the viewport.
  layout(): void {
    if (this.open) this.render();
  }

  // Rebuild only when the knowledge changed (a kind was identified, or the
  // scene was resized).
  refresh(): void {
    if (!this.open) return;
    if (this.describeKnowledge() === this.signature) return;
    this.render();
  }

  private describeKnowledge(): string {
    const potions = consumableKnowledge(this.context, "potion");
    const scrolls = consumableKnowledge(this.context, "scroll");
    const describe = (entries: ConsumableKnowledgeEntry[]) =>
      entries.map(entry => `${entry.identified ? "!" : "?"}${entry.name}/${entry.appearance}`).join(",");
    return `${this.page}|${describe(potions)}|${describe(scrolls)}`;
  }

  private clear(): void {
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.root = undefined;
  }

  private add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }

  private selectPage(category: ConsumableCategory): void {
    if (this.page === category) return;
    this.page = category;
    this.render();
  }

  private render(): void {
    this.signature = this.describeKnowledge();
    this.clear();

    const potions = consumableKnowledge(this.context, "potion");
    const scrolls = consumableKnowledge(this.context, "scroll");
    const counts: Record<ConsumableCategory, number> = {
      potion: potions.length,
      scroll: scrolls.length
    };
    const entries = this.page === "potion" ? potions : scrolls;

    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    const overlay = this.add(
      this.scene.add
        .rectangle(0, 0, sw, sh, C.overlay, 0.55)
        .setOrigin(0)
        .setDepth(300)
    );
    overlay.setInteractive({ useHandCursor: true });
    overlay.on("pointerup", () => this.close());

    this.root = this.add(this.scene.add.container(0, 0).setDepth(301));

    // Page tabs sit directly under the title bar and act as the two pages.
    const tabsY = TITLE_BAR_H + 8;
    const tabW = Math.floor((WINDOW_W - PAD * 2 - TAB_GAP * (PAGES.length - 1)) / PAGES.length);
    const rowsY = tabsY + TAB_H + 8;
    const listH = Math.max(1, entries.length) * ROW_H;
    const windowH = rowsY + listH + 8 + FOOTER_H + PAD;

    this.root.add(
      this.scene.add
        .rectangle(0, 0, WINDOW_W, windowH, C.panel, 0.98)
        .setOrigin(0)
        .setStrokeStyle(2, C.borderStrong, 1)
        // Swallow taps on the window body so only the outside overlay closes it.
        .setInteractive()
    );
    this.root.add(
      this.scene.add
        .rectangle(0, 0, WINDOW_W, TITLE_BAR_H, C.panel2, 1)
        .setOrigin(0)
        .setStrokeStyle(1, C.border, 1)
    );
    this.root.add(
      this.scene.add.text(PAD, 8, "POTIONS & SCROLLS", {
        fontFamily: `"${FONT_PIXEL}", monospace`, fontSize: 10,
        color: COL.gold
      })
    );

    // Close button mirrors the backpack window's header control.
    const closeX = WINDOW_W - 8 - CLOSE_W;
    const closeBtn = this.scene.add
      .rectangle(closeX, (TITLE_BAR_H - CLOSE_H) / 2, CLOSE_W, CLOSE_H, C.panel, 1)
      .setOrigin(0)
      .setStrokeStyle(1, C.borderStrong, 1)
      .setInteractive({ useHandCursor: true });
    const closeLabel = this.scene.add
      .text(closeX + CLOSE_W / 2, TITLE_BAR_H / 2, "Close", {
        fontFamily: `${FONT_MONO}, monospace`, fontSize: 18,
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
    this.root.add(closeBtn);
    this.root.add(closeLabel);

    // Page tabs.
    PAGES.forEach((page, index) => {
      const active = page.category === this.page;
      const x = PAD + index * (tabW + TAB_GAP);
      const tab = this.scene.add
        .rectangle(x, tabsY, tabW, TAB_H, active ? C.cellActive : C.cell, 1)
        .setOrigin(0)
        .setStrokeStyle(active ? 2 : 1, active ? C.gold : C.border, 1)
        .setInteractive({ useHandCursor: !active });
      const label = this.scene.add
        .text(x + tabW / 2, tabsY + TAB_H / 2, `${page.label} ${counts[page.category]}`, {
          fontFamily: `${FONT_MONO}, monospace`, fontSize: 18,
          color: active ? COL.gold : COL.muted
        })
        .setOrigin(0.5);
      tab.on("pointerup", () => this.selectPage(page.category));
      if (!active) {
        tab.on("pointerover", () => {
          tab.setStrokeStyle(1, C.gold, 1);
          label.setColor(COL.text);
        });
        tab.on("pointerout", () => {
          tab.setStrokeStyle(1, C.border, 1);
          label.setColor(COL.muted);
        });
      }
      this.root!.add(tab);
      this.root!.add(label);
    });

    // Entry rows: icon (the appearance the hero already sees) plus a name that
    // appears only once the kind has been identified.
    if (!entries.length) {
      this.root.add(
        this.scene.add.text(PAD, rowsY + 4, `No ${this.page} appearances assigned.`, {
          fontFamily: `${FONT_MONO}, monospace`, fontSize: 18,
          color: COL.muted
        })
      );
    }
    entries.forEach((entry, index) => {
      const y = rowsY + index * ROW_H;
      const icon = this.scene.add
        .sprite(PAD + ICON_SIZE / 2, y + ROW_H / 2, entry.appearance)
        .setOrigin(0.5)
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.root!.add(icon);
      const label = entry.identified
        ? entry.name
        : `${this.page === "potion" ? "Potion" : "Scroll"} “${entry.alias}”`;
      this.root!.add(
        this.scene.add.text(PAD + ICON_SIZE + 8, y + ROW_H / 2, label, {
          fontFamily: `${FONT_MONO}, monospace`, fontSize: 18,
          color: entry.identified ? COL.text : COL.muted
        }).setOrigin(0, 0.5)
      );
    });

    // Progress footer: how much of this page is really known yet.
    const known = entries.filter(entry => entry.identified).length;
    const footer = entries.length
      ? `${known}/${entries.length} identified — use unknown ones to learn`
      : `Nothing to show for ${this.page}s.`;
    this.root.add(
      this.scene.add.text(PAD, rowsY + listH + 8, footer, {
        fontFamily: `${FONT_MONO}, monospace`, fontSize: 15,
        color: COL.dim
      })
    );

    // Fit and center, like the backpack window.
    const scale = Math.min(1, (sw - 16) / WINDOW_W, (sh - 16) / windowH);
    this.root.setScale(scale);
    this.root.setPosition(
      (sw - WINDOW_W * scale) / 2,
      (sh - windowH * scale) / 2
    );
  }

}
