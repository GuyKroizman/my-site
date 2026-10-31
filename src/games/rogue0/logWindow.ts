import { isModalOpen, type GameContext } from "./context";

// Paginate wrapped lines rather than message count: long messages remain readable
// on narrow phones, and no part of a retained message is discarded.
export function paginateLogLines(lines: string[], linesPerPage: number): string[] {
  const size = Math.max(1, Math.floor(linesPerPage));
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += size) pages.push(lines.slice(i, i + size).join("\n"));
  return pages.length ? pages : ["No messages yet."];
}

export class LogWindow {
  private root: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private closeButton: Phaser.GameObjects.Text;
  private newer: Phaser.GameObjects.Text;
  private older: Phaser.GameObjects.Text;
  private indicator: Phaser.GameObjects.Text;
  private clip: Phaser.GameObjects.Graphics;
  private pages: string[] = [];
  private page = 0;
  private snapshot: string[] = [];

  constructor(private scene: Phaser.Scene, private context: GameContext) {
    this.root = scene.add.container(0, 0).setDepth(800).setVisible(false);
    this.backdrop = scene.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0).setInteractive();
    this.panel = scene.add.rectangle(0, 0, 1, 1, 0x1f1926).setOrigin(0).setStrokeStyle(2, 0x5a5060).setInteractive();
    const text = (label: string, color = "#e8e1d5") => scene.add.text(0, 0, label, {
      fontFamily: "VT323, monospace", fontSize: 20, color
    });
    this.title = text("Log", "#f0b429");
    this.body = text("").setLineSpacing(2);
    this.closeButton = text("Close", "#f0b429").setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.newer = text("‹ Newer", "#f0b429").setInteractive({ useHandCursor: true });
    this.older = text("Older ›", "#f0b429").setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.indicator = text("").setOrigin(0.5, 0);
    this.root.add([this.backdrop, this.panel, this.title, this.body, this.closeButton, this.newer, this.older, this.indicator]);
    this.clip = scene.make.graphics({ x: 0, y: 0 });
    this.body.setMask(this.clip.createGeometryMask());
    this.backdrop.on("pointerup", () => this.close());
    this.closeButton.on("pointerup", () => this.close());
    this.newer.on("pointerup", () => { this.page = Math.max(0, this.page - 1); this.render(); });
    this.older.on("pointerup", () => { this.page = Math.min(this.pages.length - 1, this.page + 1); this.render(); });
    scene.events.once("shutdown", () => {
      context.logModalOpen = false;
      this.body.clearMask(true);
      this.clip.destroy();
    });
  }

  open() {
    if (isModalOpen(this.context)) return;
    this.snapshot = this.context.messages.slice(0, 20);
    this.page = 0;
    this.context.logModalOpen = true;
    if (this.context.player) {
      this.context.player.inputBuffer = [];
      this.context.player.walkPath = [];
    }
    this.root.setVisible(true);
    this.layout();
  }

  close() {
    this.context.logModalOpen = false;
    this.root.setVisible(false);
  }

  layout() {
    const { width, height } = this.scene.scale;
    const w = Math.min(560, width - 16);
    const h = Math.min(420, height - 16);
    const x = (width - w) / 2;
    const y = (height - h) / 2;
    this.backdrop.setSize(width, height);
    this.panel.setPosition(x, y).setSize(w, h);
    this.title.setPosition(x + 12, y + 10);
    this.closeButton.setPosition(x + w - 12, y + 10);
    const bodyH = Math.max(24, h - 100);
    this.body.setPosition(x + 12, y + 46).setWordWrapWidth(w - 24, true);
    this.clip.clear().fillStyle(0xffffff).fillRect(x + 12, y + 46, w - 24, bodyH);
    // Measure actual font metrics (including line spacing) for pagination.
    this.body.setText("M");
    const singleLineHeight = this.body.height;
    this.body.setText("M\nM");
    const lineHeight = this.body.height - singleLineHeight;
    const lines = this.body.getWrappedText(this.snapshot.join("\n\n"));
    this.pages = paginateLogLines(this.snapshot.length ? lines : [], Math.floor(bodyH / lineHeight));
    this.page = Math.min(this.page, this.pages.length - 1);
    this.newer.setPosition(x + 12, y + h - 36);
    this.older.setPosition(x + w - 12, y + h - 36);
    this.indicator.setPosition(x + w / 2, y + h - 36);
    this.render();
  }

  private render() {
    this.body.setText(this.pages[this.page] ?? "No messages yet.");
    this.indicator.setText(`${this.page + 1} / ${this.pages.length}`);
    this.newer.setAlpha(this.page > 0 ? 1 : 0.35);
    this.older.setAlpha(this.page < this.pages.length - 1 ? 1 : 0.35);
  }
}
